import { ScanCommand } from "@aws-sdk/lib-dynamodb";

const sendMock = jest.fn();

jest.mock("../lambda/dynamo", () => ({
  docClient: { send: (...args: unknown[]) => sendMock(...args) },
  PRODUCTS_TABLE: "products",
  STOCKS_TABLE: "stocks",
}));

import { handler } from "../lambda/getProductsList";

const productsMock = [
  { id: "p1", title: "P1", description: "d1", price: 10 },
  { id: "p2", title: "P2", description: "d2", price: 20 },
];
const stocksMock = [
  { product_id: "p1", count: 5 },
  { product_id: "p2", count: 0 },
];

describe("getProductsList", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("should return 200 and joined products", async () => {
    sendMock.mockImplementation((cmd: ScanCommand) => {
      const table = (cmd as any).input.TableName;
      if (table === "products") return Promise.resolve({ Items: productsMock });
      if (table === "stocks") return Promise.resolve({ Items: stocksMock });
      throw new Error(`Unknown table ${table}`);
    });

    const result = await handler();
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body).toEqual([
      { id: "p1", title: "P1", description: "d1", price: 10, count: 5 },
      { id: "p2", title: "P2", description: "d2", price: 20, count: 0 },
    ]);
  });

  it("should default count to 0 when stock missing", async () => {
    sendMock.mockImplementation((cmd: ScanCommand) => {
      const table = (cmd as any).input.TableName;
      if (table === "products") return Promise.resolve({ Items: productsMock });
      if (table === "stocks") return Promise.resolve({ Items: [] });
      throw new Error(`Unknown table ${table}`);
    });

    const result = await handler();
    const body = JSON.parse(result.body);
    expect(body.every((p: { count: number }) => p.count === 0)).toBe(true);
  });

  it("should return 500 on error", async () => {
    sendMock.mockRejectedValue(new Error("boom"));
    const result = await handler();
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ message: "Internal server error" });
  });

  it("should return CORS headers", async () => {
    sendMock.mockResolvedValue({ Items: [] });
    const result = await handler();
    expect(result.headers).toMatchObject({
      "Access-Control-Allow-Origin": "*",
    });
  });
});
