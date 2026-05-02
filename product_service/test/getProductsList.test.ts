import { handler } from "../lambda/getProductsList";
import { products } from "../lambda/products";

describe("getProductsList", () => {
  it("should return status code 200", async () => {
    const result = await handler();
    expect(result.statusCode).toBe(200);
  });

  it("should return all products", async () => {
    const result = await handler();
    const body = JSON.parse(result.body);
    expect(body).toEqual(products);
    expect(body.length).toBe(products.length);
  });

  it("should return CORS headers", async () => {
    const result = await handler();
    expect(result.headers).toEqual({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
  });

  it("should return body as a JSON string", async () => {
    const result = await handler();
    expect(typeof result.body).toBe("string");
    expect(() => JSON.parse(result.body)).not.toThrow();
  });
});
