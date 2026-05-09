import { APIGatewayProxyEvent } from "aws-lambda";

const sendMock = jest.fn();

jest.mock("../lambda/dynamo", () => ({
  docClient: { send: (...args: unknown[]) => sendMock(...args) },
  PRODUCTS_TABLE: "products",
  STOCKS_TABLE: "stocks",
}));

import { handler } from "../lambda/createProduct";

const createEvent = (body: unknown): APIGatewayProxyEvent =>
  ({
    body: body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body),
  } as unknown as APIGatewayProxyEvent);

describe("createProduct", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("should create a product and return 201", async () => {
    sendMock.mockResolvedValue({});
    const result = await handler(
      createEvent({
        title: "New Item",
        description: "Desc",
        price: 100,
        count: 5,
      })
    );
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body).toMatchObject({
      title: "New Item",
      description: "Desc",
      price: 100,
      count: 5,
    });
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("should return 400 for invalid JSON", async () => {
    const result = await handler(createEvent("not-json{"));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ message: "Request body must be valid JSON" });
  });

  it.each([
    [{ description: "d", price: 10, count: 1 }, "title"],
    [{ title: "", price: 10, count: 1 }, "title"],
    [{ title: "T", price: -1, count: 1 }, "price"],
    [{ title: "T", price: "10", count: 1 }, "price"],
    [{ title: "T", price: 10, count: -1 }, "count"],
    [{ title: "T", price: 10, count: 1.5 }, "count"],
    [{ title: "T", price: 10 }, "count"],
  ])("should return 400 when %p (invalid %s)", async (input, field) => {
    const result = await handler(createEvent(input));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toMatch(new RegExp(field));
  });

  it("should return 500 when DynamoDB fails", async () => {
    sendMock.mockRejectedValue(new Error("boom"));
    const result = await handler(
      createEvent({ title: "T", price: 10, count: 1 })
    );
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ message: "Internal server error" });
  });
});
