import { APIGatewayProxyEvent } from "aws-lambda";
import { products } from "./products";
import { buildResponse } from "./utils";

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    const productId = event.pathParameters?.productId;

    if (!productId) {
      return buildResponse(400, { message: "Product ID is required" });
    }

    const product = products.find((p) => p.id === productId);

    if (!product) {
      return buildResponse(404, { message: "Product not found" });
    }

    return buildResponse(200, product);
  } catch (error) {
    return buildResponse(500, { message: "Internal server error" });
  }
};
