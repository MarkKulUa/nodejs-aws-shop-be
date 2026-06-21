import type { SQSEvent } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { docClient, PRODUCTS_TABLE, STOCKS_TABLE } from "./dynamo";

const sns = new SNSClient({});

interface ProductInput {
  title?: unknown;
  description?: unknown;
  price?: unknown;
  count?: unknown;
}

interface ValidProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  count: number;
}

const validate = (
  input: ProductInput
): { valid: true; value: ValidProduct } | { valid: false; error: string } => {
  if (!input || typeof input !== "object") {
    return { valid: false, error: "Input must be an object" };
  }

  const { title, description, price, count } = input;

  if (typeof title !== "string" || title.trim().length === 0) {
    return { valid: false, error: "Field 'title' must be a non-empty string" };
  }

  const parsedPrice = typeof price === "string" ? Number(price) : price;
  if (typeof parsedPrice !== "number" || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
    return { valid: false, error: "Field 'price' must be a non-negative number" };
  }

  const parsedCount = typeof count === "string" ? Number(count) : count;
  if (
    typeof parsedCount !== "number" ||
    !Number.isFinite(parsedCount) ||
    parsedCount < 0
  ) {
    return { valid: false, error: "Field 'count' must be a non-negative integer" };
  }

  return {
    valid: true,
    value: {
      id: randomUUID(),
      title: title.trim(),
      description: typeof description === "string" ? description : "",
      price: parsedPrice,
      count: Math.round(parsedCount),
    },
  };
};

export const handler = async (event: SQSEvent) => {
  console.log("catalogBatchProcess called with", event.Records.length, "records");

  const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN ?? "";
  const createdProducts: ValidProduct[] = [];

  for (const record of event.Records) {
    let parsed: ProductInput;
    try {
      parsed = JSON.parse(record.body);
    } catch {
      console.error("Failed to parse SQS message body:", record.body);
      continue;
    }

    const result = validate(parsed);
    if (!result.valid) {
      console.error("Validation failed:", result.error, "| body:", record.body);
      continue;
    }

    const { id, title, description, price, count } = result.value;

    try {
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

      console.log("Created product:", id, title);
      createdProducts.push(result.value);
    } catch (error) {
      console.error("DynamoDB write failed for product:", title, error);
    }
  }

  if (createdProducts.length > 0 && SNS_TOPIC_ARN) {
    try {
      await sns.send(
        new PublishCommand({
          TopicArn: SNS_TOPIC_ARN,
          Subject: `${createdProducts.length} product(s) created`,
          Message: JSON.stringify(createdProducts, null, 2),
          MessageAttributes: {
            count: {
              DataType: "Number",
              StringValue: String(createdProducts.length),
            },
          },
        })
      );
      console.log("SNS notification sent for", createdProducts.length, "products");
    } catch (error) {
      console.error("Failed to publish SNS notification:", error);
    }
  }
};
