import { Readable } from "node:stream";
import type { S3Event } from "aws-lambda";

const s3SendMock = jest.fn();
const sqsSendMock = jest.fn();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: (...args: unknown[]) => s3SendMock(...args),
  })),
  GetObjectCommand: jest
    .fn()
    .mockImplementation((input: unknown) => ({ __type: "GetObject", input })),
  CopyObjectCommand: jest
    .fn()
    .mockImplementation((input: unknown) => ({ __type: "CopyObject", input })),
  DeleteObjectCommand: jest
    .fn()
    .mockImplementation((input: unknown) => ({ __type: "DeleteObject", input })),
}));

jest.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: jest.fn().mockImplementation(() => ({
    send: (...args: unknown[]) => sqsSendMock(...args),
  })),
  SendMessageCommand: jest
    .fn()
    .mockImplementation((input: unknown) => ({ __type: "SendMessage", input })),
}));

beforeEach(() => {
  s3SendMock.mockReset();
  sqsSendMock.mockReset();
  sqsSendMock.mockResolvedValue({});
  process.env.UPLOAD_FOLDER = "uploaded";
  process.env.PARSED_FOLDER = "parsed";
  process.env.SQS_QUEUE_URL = "https://sqs.eu-west-1.amazonaws.com/123456789/catalogItemsQueue";
});

afterAll(() => {
  delete process.env.UPLOAD_FOLDER;
  delete process.env.PARSED_FOLDER;
  delete process.env.SQS_QUEUE_URL;
});

const createEvent = (key: string, bucket = "my-bucket"): S3Event =>
  ({
    Records: [
      {
        s3: {
          bucket: { name: bucket },
          object: { key },
        },
      },
    ],
  } as unknown as S3Event);

const csvBody = (rows: string[]): Readable => Readable.from(rows.join("\n"));

import { handler } from "../lambda/importFileParser";

describe("importFileParser", () => {
  it("should send each CSV row to SQS", async () => {
    s3SendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === "GetObject") {
        return Promise.resolve({
          Body: csvBody(["title,price,count", "ProductA,10,5", "ProductB,20,3"]),
        });
      }
      return Promise.resolve({});
    });

    await handler(createEvent("uploaded/products.csv"));

    expect(sqsSendMock).toHaveBeenCalledTimes(2);

    const firstCall = sqsSendMock.mock.calls[0][0];
    const parsed = JSON.parse(firstCall.input.MessageBody);
    expect(parsed).toEqual({ title: "ProductA", price: "10", count: "5" });

    const secondCall = sqsSendMock.mock.calls[1][0];
    const parsed2 = JSON.parse(secondCall.input.MessageBody);
    expect(parsed2).toEqual({ title: "ProductB", price: "20", count: "3" });
  });

  it("should copy parsed file to 'parsed/' and delete the original", async () => {
    s3SendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === "GetObject") {
        return Promise.resolve({ Body: csvBody(["a,b", "1,2"]) });
      }
      return Promise.resolve({});
    });

    await handler(createEvent("uploaded/products.csv"));

    const calls = s3SendMock.mock.calls.map((c) => c[0]);

    const copyCmd = calls.find((c) => c.__type === "CopyObject");
    const deleteCmd = calls.find((c) => c.__type === "DeleteObject");

    expect(copyCmd).toBeDefined();
    expect(copyCmd.input).toEqual(
      expect.objectContaining({
        Bucket: "my-bucket",
        Key: "parsed/products.csv",
        CopySource: "/my-bucket/uploaded%2Fproducts.csv",
      })
    );

    expect(deleteCmd).toBeDefined();
    expect(deleteCmd.input).toEqual(
      expect.objectContaining({
        Bucket: "my-bucket",
        Key: "uploaded/products.csv",
      })
    );
  });

  it("should skip objects outside of uploaded/ prefix", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await handler(createEvent("other/products.csv"));

    expect(warnSpy).toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
    expect(sqsSendMock).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("should rethrow when S3 GetObject fails", async () => {
    s3SendMock.mockRejectedValue(new Error("boom"));
    await expect(
      handler(createEvent("uploaded/products.csv"))
    ).rejects.toThrow("boom");
  });

  it("should send correct QueueUrl in SQS messages", async () => {
    s3SendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === "GetObject") {
        return Promise.resolve({ Body: csvBody(["x,y", "1,2"]) });
      }
      return Promise.resolve({});
    });

    await handler(createEvent("uploaded/test.csv"));

    expect(sqsSendMock).toHaveBeenCalledTimes(1);
    const cmd = sqsSendMock.mock.calls[0][0];
    expect(cmd.input.QueueUrl).toBe(
      "https://sqs.eu-west-1.amazonaws.com/123456789/catalogItemsQueue"
    );
  });
});
