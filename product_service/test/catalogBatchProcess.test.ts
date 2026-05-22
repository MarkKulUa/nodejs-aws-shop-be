import type { SQSEvent } from "aws-lambda";

const sendMock = jest.fn();
const snsPublishMock = jest.fn();

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: () => ({ send: (...args: unknown[]) => sendMock(...args) }),
  },
  TransactWriteCommand: jest
    .fn()
    .mockImplementation((input: unknown) => ({ __type: "TransactWrite", input })),
}));

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@aws-sdk/client-sns", () => ({
  SNSClient: jest.fn().mockImplementation(() => ({
    send: (...args: unknown[]) => snsPublishMock(...args),
  })),
  PublishCommand: jest
    .fn()
    .mockImplementation((input: unknown) => ({ __type: "Publish", input })),
}));

beforeEach(() => {
  sendMock.mockReset();
  snsPublishMock.mockReset();
  sendMock.mockResolvedValue({});
  snsPublishMock.mockResolvedValue({});
  process.env.PRODUCTS_TABLE = "products";
  process.env.STOCKS_TABLE = "stocks";
  process.env.SNS_TOPIC_ARN = "arn:aws:sns:eu-west-1:123456789:createProductTopic";
});

afterAll(() => {
  delete process.env.PRODUCTS_TABLE;
  delete process.env.STOCKS_TABLE;
  delete process.env.SNS_TOPIC_ARN;
});

const createEvent = (bodies: object[]): SQSEvent =>
  ({
    Records: bodies.map((body, i) => ({
      messageId: `msg-${i}`,
      body: JSON.stringify(body),
    })),
  } as unknown as SQSEvent);

import { handler } from "../lambda/catalogBatchProcess";

describe("catalogBatchProcess", () => {
  it("should create products in DynamoDB for valid messages", async () => {
    const event = createEvent([
      { title: "Product A", price: 10, count: 5 },
      { title: "Product B", price: 20, count: 3 },
    ]);

    await handler(event);

    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("should skip invalid messages and continue processing", async () => {
    const event = createEvent([
      { title: "", price: 10, count: 5 }, // invalid: empty title
      { title: "Valid", price: 15, count: 2 }, // valid
    ]);

    await handler(event);

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("should handle non-JSON message bodies gracefully", async () => {
    const event = {
      Records: [{ messageId: "msg-0", body: "not json" }],
    } as unknown as SQSEvent;

    await expect(handler(event)).resolves.not.toThrow();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("should send SNS notification after creating products", async () => {
    const event = createEvent([
      { title: "Product A", price: 10, count: 5 },
    ]);

    await handler(event);

    expect(snsPublishMock).toHaveBeenCalledTimes(1);
    const publishCmd = snsPublishMock.mock.calls[0][0];
    expect(publishCmd.input).toEqual(
      expect.objectContaining({
        TopicArn: "arn:aws:sns:eu-west-1:123456789:createProductTopic",
      })
    );
  });

  it("should not send SNS notification if no products were created", async () => {
    const event = createEvent([
      { title: "", price: -1, count: -1 }, // invalid
    ]);

    await handler(event);

    expect(snsPublishMock).not.toHaveBeenCalled();
  });

  it("should parse string price and count from CSV rows", async () => {
    const event = createEvent([
      { title: "CSV Product", price: "25.5", count: "10", description: "from csv" },
    ]);

    await handler(event);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = sendMock.mock.calls[0][0];
    const items = cmd.input.TransactItems;
    expect(items[0].Put.Item.price).toBe(25.5);
    expect(items[1].Put.Item.count).toBe(10);
  });

  it("should continue processing if DynamoDB write fails for one product", async () => {
    sendMock
      .mockRejectedValueOnce(new Error("DynamoDB error"))
      .mockResolvedValueOnce({});

    const event = createEvent([
      { title: "Fail", price: 10, count: 1 },
      { title: "Success", price: 20, count: 2 },
    ]);

    await handler(event);

    expect(sendMock).toHaveBeenCalledTimes(2);
    // SNS should be called only for the successful one
    expect(snsPublishMock).toHaveBeenCalledTimes(1);
  });
});
