import { handler } from "../lambda/getProductsById";
import { products } from "../lambda/products";
import { APIGatewayProxyEvent } from "aws-lambda";

const createEvent = (productId?: string): APIGatewayProxyEvent =>
  ({
    pathParameters: productId !== undefined ? { productId } : null,
  } as unknown as APIGatewayProxyEvent);

describe("getProductsById", () => {
  it("should return 200 and the product when found", async () => {
    const result = await handler(createEvent("1"));
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual(products[0]);
  });

  it("should return 404 when product is not found", async () => {
    const result = await handler(createEvent("999"));
    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body).toEqual({ message: "Product not found" });
  });

  it("should return 400 when productId is not provided", async () => {
    const event = {
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body).toEqual({ message: "Product ID is required" });
  });

  it("should return CORS headers on success", async () => {
    const result = await handler(createEvent("1"));
    expect(result.headers).toEqual({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
  });

  it("should return CORS headers on 404", async () => {
    const result = await handler(createEvent("999"));
    expect(result.headers).toEqual({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
  });
});
