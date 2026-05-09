import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { buildResponse } from "./utils";
import { docClient, PRODUCTS_TABLE, STOCKS_TABLE } from "./dynamo";
import type {
  AvailableProduct,
  ProductRecord,
  StockRecord,
} from "./types";

export const handler = async () => {
  console.log("getProductsList called");

  try {
    const [productsResult, stocksResult] = await Promise.all([
      docClient.send(new ScanCommand({ TableName: PRODUCTS_TABLE })),
      docClient.send(new ScanCommand({ TableName: STOCKS_TABLE })),
    ]);

    const products = (productsResult.Items ?? []) as ProductRecord[];
    const stocks = (stocksResult.Items ?? []) as StockRecord[];

    const stockByProductId = new Map(
      stocks.map((s) => [s.product_id, s.count])
    );

    const joined: AvailableProduct[] = products.map((product) => ({
      ...product,
      count: stockByProductId.get(product.id) ?? 0,
    }));

    console.log(`Returning ${joined.length} products`);
    return buildResponse(200, joined);
  } catch (error) {
    console.error("getProductsList error:", error);
    return buildResponse(500, { message: "Internal server error" });
  }
};
