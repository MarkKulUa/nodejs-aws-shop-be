import { APIGatewayProxyEvent } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { buildResponse } from "./utils";
import { docClient, PRODUCTS_TABLE, STOCKS_TABLE } from "./dynamo";
import type {
  AvailableProduct,
  ProductRecord,
  StockRecord,
} from "./types";

export const handler = async (event: APIGatewayProxyEvent) => {
  console.log("getProductsById called with:", {
    pathParameters: event.pathParameters,
  });

  try {
    const productId = event.pathParameters?.productId;

    if (!productId) {
      return buildResponse(400, { message: "Product ID is required" });
    }

    const [productResult, stockResult] = await Promise.all([
      docClient.send(
        new GetCommand({
          TableName: PRODUCTS_TABLE,
          Key: { id: productId },
        })
      ),
      docClient.send(
        new GetCommand({
          TableName: STOCKS_TABLE,
          Key: { product_id: productId },
        })
      ),
    ]);

    const product = productResult.Item as ProductRecord | undefined;

    if (!product) {
      return buildResponse(404, { message: "Product not found" });
    }

    const stock = stockResult.Item as StockRecord | undefined;

    const joined: AvailableProduct = {
      ...product,
      count: stock?.count ?? 0,
    };

    return buildResponse(200, joined);
  } catch (error) {
    console.error("getProductsById error:", error);
    return buildResponse(500, { message: "Internal server error" });
  }
};
