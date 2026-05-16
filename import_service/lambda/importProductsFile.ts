import { APIGatewayProxyEvent } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildResponse } from "./utils";

const s3 = new S3Client({});

const isCsvName = (name: string) => /\.csv$/i.test(name.trim());

export const handler = async (event: APIGatewayProxyEvent) => {
  console.log("importProductsFile called with:", {
    queryStringParameters: event.queryStringParameters,
  });

  const bucketName = process.env.BUCKET_NAME ?? "";
  const uploadFolder = process.env.UPLOAD_FOLDER ?? "uploaded";
  const signedUrlTtl = Number(process.env.SIGNED_URL_TTL ?? "300");

  try {
    if (!bucketName) {
      console.error("BUCKET_NAME env var is not configured");
      return buildResponse(500, { message: "Bucket is not configured" });
    }

    const name = event.queryStringParameters?.name;

    if (!name || name.trim().length === 0) {
      return buildResponse(400, {
        message: "Query parameter 'name' is required",
      });
    }

    if (!isCsvName(name)) {
      return buildResponse(400, {
        message: "Only .csv files are supported",
      });
    }

    const key = `${uploadFolder}/${name}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: "text/csv",
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: signedUrlTtl,
    });

    console.log("Generated signed URL for key:", key);

    return buildResponse(200, signedUrl);
  } catch (error) {
    console.error("importProductsFile error:", error);
    return buildResponse(500, { message: "Internal server error" });
  }
};
