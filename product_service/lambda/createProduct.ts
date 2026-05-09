import { APIGatewayProxyEvent } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { buildResponse } from "./utils";
import { docClient, PRODUCTS_TABLE, STOCKS_TABLE } from "./dynamo";
import type { AvailableProduct } from "./types";

interface CreateProductInput {
  title?: unknown;
  description?: unknown;
  price?: unknown;
  count?: unknown;
}

const validate = (
  input: CreateProductInput
): { valid: true; value: AvailableProduct } | { valid: false; error: string } => {
  if (!input || typeof input !== "object") {
    return { valid: false, error: "Request body must be an object" };
  }

  const { title, description, price, count } = input;

  if (typeof title !== "string" || title.trim().length === 0) {
    return { valid: false, error: "Field 'title' must be a non-empty string" };
  }

  if (description !== undefined && typeof description !== "string") {
    return { valid: false, error: "Field 'description' must be a string" };
  }

  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    return { valid: false, error: "Field 'price' must be a non-negative number" };
  }

  if (
    typeof count !== "number" ||
    !Number.isInteger(count) ||
    count < 0
  ) {
    return { valid: false, error: "Field 'count' must be a non-negative integer" };
  }

  return {
    valid: true,
    value: {
      id: randomUUID(),
      title: title.trim(),
      description: typeof description === "string" ? description : "",
      price,
      count,
    },
  };
};

export const handler = async (event: APIGatewayProxyEvent) => {
  console.log("createProduct called with body:", event.body);

  try {
    let parsed: CreateProductInput;
    try {
      parsed = event.body ? JSON.parse(event.body) : {};
    } catch {
      return buildResponse(400, { message: "Request body must be valid JSON" });
    }

    const result = validate(parsed);
    if (!result.valid) {
      return buildResponse(400, { message: result.error });
    }

    const { id, title, description, price, count } = result.value;

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: PRODUCTS_TABLE,
              Item: { id, title, description, price },
              ConditionExpression: "attribute_not_exists(id)",
            },
          },
          {
            Put: {
              TableName: STOCKS_TABLE,
              Item: { product_id: id, count },
              ConditionExpression: "attribute_not_exists(product_id)",
            },
          },
        ],
      })
    );

    console.log("createProduct created:", id);
    return buildResponse(201, { id, title, description, price, count });
  } catch (error) {
    console.error("createProduct error:", error);
    return buildResponse(500, { message: "Internal server error" });
  }
};
