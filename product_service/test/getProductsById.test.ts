import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent } from "aws-lambda";

const sendMock = jest.fn();

jest.mock("../lambda/dynamo", () => ({
  docClient: { send: (...args: unknown[]) => sendMock(...args) },
  PRODUCTS_TABLE: "products",
  STOCKS_TABLE: "stocks",
}));

import { handler } from "../lambda/getProductsById";

const createEvent = (productId?: string): APIGatewayProxyEvent =>
  ({
    pathParameters: productId !== undefined ? { productId } : null,
  } as unknown as APIGatewayProxyEvent);

describe("getProductsById", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("should return 200 and the joined product", async () => {
    sendMock.mockImplementation((cmd: GetCommand) => {
      const table = (cmd as any).input.TableName;
      if (table === "products") {
        return Promise.resolve({
          Item: { id: "p1", title: "P1", description: "d1", price: 10 },
        });
      }
      if (table === "stocks") {
        return Promise.resolve({ Item: { product_id: "p1", count: 7 } });
      }
      throw new Error(`Unknown table ${table}`);
    });

    const result = await handler(createEvent("p1"));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      id: "p1",
      title: "P1",
      description: "d1",
      price: 10,
      count: 7,
    });
  });

  it("should default count to 0 when stock missing", async () => {
    sendMock.mockImplementation((cmd: GetCommand) => {
      const table = (cmd as any).input.TableName;
      if (table === "products") {
        return Promise.resolve({
          Item: { id: "p1", title: "P1", description: "d1", price: 10 },
        });
      }
      return Promise.resolve({});
    });

    const result = await handler(createEvent("p1"));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).count).toBe(0);
  });

  it("should return 404 when product is not found", async () => {
    sendMock.mockResolvedValue({});
    const result = await handler(createEvent("missing"));
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ message: "Product not found" });
  });

  it("should return 400 when productId is not provided", async () => {
    const result = await handler(createEvent());
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ message: "Product ID is required" });
  });

  it("should return 500 on DynamoDB error", async () => {
    sendMock.mockRejectedValue(new Error("boom"));
    const result = await handler(createEvent("p1"));
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ message: "Internal server error" });
  });

  it("should return CORS headers", async () => {
    sendMock.mockResolvedValue({});
    const result = await handler(createEvent("missing"));
    expect(result.headers).toMatchObject({
      "Access-Control-Allow-Origin": "*",
    });
  });
});
