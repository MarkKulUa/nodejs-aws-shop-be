import { APIGatewayProxyEvent } from "aws-lambda";

const getSignedUrlMock = jest.fn();

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

beforeEach(() => {
  getSignedUrlMock.mockReset();
  process.env.BUCKET_NAME = "test-bucket";
  process.env.UPLOAD_FOLDER = "uploaded";
});

afterAll(() => {
  delete process.env.BUCKET_NAME;
  delete process.env.UPLOAD_FOLDER;
});

const createEvent = (
  name?: string | null
): APIGatewayProxyEvent =>
  ({
    queryStringParameters:
      name === undefined ? null : name === null ? {} : { name },
  } as unknown as APIGatewayProxyEvent);

import { handler } from "../lambda/importProductsFile";

const importHandler = (
  event: APIGatewayProxyEvent
): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> =>
  handler(event) as Promise<{
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }>;

describe("importProductsFile", () => {
  it("should return 200 and the signed URL for valid CSV name", async () => {
    getSignedUrlMock.mockResolvedValue("https://signed.example/upload");

    const result = await importHandler(createEvent("products.csv"));

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe("https://signed.example/upload");
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);

    const putCommand = getSignedUrlMock.mock.calls[0][1];
    expect(putCommand.input).toEqual(
      expect.objectContaining({
        Bucket: "test-bucket",
        Key: "uploaded/products.csv",
        ContentType: "text/csv",
      })
    );
  });

  it("should return 400 when name is missing", async () => {
    const result = await importHandler(createEvent(null));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: "Query parameter 'name' is required",
    });
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  it("should return 400 when query parameters are not provided at all", async () => {
    const result = await importHandler(createEvent());
    expect(result.statusCode).toBe(400);
  });

  it("should return 400 for non-csv name", async () => {
    const result = await importHandler(createEvent("products.txt"));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: "Only .csv files are supported",
    });
  });

  it("should return 500 when bucket env is not configured", async () => {
    process.env.BUCKET_NAME = "";
    const result = await importHandler(createEvent("products.csv"));
    expect(result.statusCode).toBe(500);
  });

  it("should return 500 when getSignedUrl throws", async () => {
    getSignedUrlMock.mockRejectedValue(new Error("boom"));
    const result = await importHandler(createEvent("products.csv"));
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: "Internal server error",
    });
  });

  it("should include CORS headers", async () => {
    getSignedUrlMock.mockResolvedValue("https://signed.example/upload");
    const result = await importHandler(createEvent("products.csv"));
    expect(result.headers).toMatchObject({
      "Access-Control-Allow-Origin": "*",
    });
  });
});
