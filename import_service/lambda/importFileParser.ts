import type { S3Event, S3EventRecord } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import csvParser from "csv-parser";
import { Readable } from "node:stream";

const s3 = new S3Client({});
const sqs = new SQSClient({});

const processRecord = async (record: S3EventRecord) => {
  const uploadFolder = process.env.UPLOAD_FOLDER ?? "uploaded";
  const parsedFolder = process.env.PARSED_FOLDER ?? "parsed";
  const sqsQueueUrl = process.env.SQS_QUEUE_URL ?? "";

  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

  console.log(`Processing object s3://${bucket}/${key}`);

  if (!key.startsWith(`${uploadFolder}/`)) {
    console.warn(
      `Skipping object outside of "${uploadFolder}/" folder: ${key}`
    );
    return;
  }

  const getResp = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );

  if (!getResp.Body) {
    throw new Error(`Empty body for s3://${bucket}/${key}`);
  }

  const stream = getResp.Body as Readable;
  const rows: Record<string, string>[] = [];

  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(csvParser())
      .on("data", (row: Record<string, string>) => {
        rows.push(row);
      })
      .on("error", (err: Error) => reject(err))
      .on("end", () => resolve());

    stream.on("error", (err: Error) => reject(err));
  });

  // Send each record to SQS and wait for all of them to complete.
  await Promise.all(
    rows.map((row) =>
      sqs.send(
        new SendMessageCommand({
          QueueUrl: sqsQueueUrl,
          MessageBody: JSON.stringify(row),
        })
      )
    )
  );

  console.log(`Sent ${rows.length} messages to SQS from ${key}`);

  const parsedKey = key.replace(`${uploadFolder}/`, `${parsedFolder}/`);

  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `/${bucket}/${encodeURIComponent(key)}`,
      Key: parsedKey,
    })
  );
  console.log(`Copied to s3://${bucket}/${parsedKey}`);

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log(`Deleted source s3://${bucket}/${key}`);
};

export const handler = async (event: S3Event) => {
  console.log("importFileParser called with:", JSON.stringify(event));

  try {
    for (const record of event.Records) {
      await processRecord(record);
    }
  } catch (error) {
    console.error("importFileParser error:", error);
    throw error;
  }
};
