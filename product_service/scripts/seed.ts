import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { productsSeed, stocksSeed } from "../lambda/products";

const REGION = process.env.AWS_REGION ?? "eu-west-1";
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE ?? "products";
const STOCKS_TABLE = process.env.STOCKS_TABLE ?? "stocks";

const client = new DynamoDBClient({ region: REGION });
const doc = DynamoDBDocumentClient.from(client);

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

const batchPut = async (table: string, items: unknown[]) => {
  for (const batch of chunk(items, 25)) {
    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [table]: batch.map((Item) => ({ PutRequest: { Item: Item as Record<string, unknown> } })),
        },
      })
    );
  }
};

const main = async () => {
  console.log(`Region: ${REGION}`);
  console.log(`Seeding ${productsSeed.length} products into "${PRODUCTS_TABLE}"...`);
  await batchPut(PRODUCTS_TABLE, productsSeed);

  console.log(`Seeding ${stocksSeed.length} stocks into "${STOCKS_TABLE}"...`);
  await batchPut(STOCKS_TABLE, stocksSeed);

  console.log("Seed complete.");
};

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
