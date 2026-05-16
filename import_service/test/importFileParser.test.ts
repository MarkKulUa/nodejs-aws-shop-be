import { Readable } from "node:stream";
import type { S3Event } from "aws-lambda";

const sendMock = jest.fn();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: (...args: unknown[]) => sendMock(...args),
  })),
  GetObjectCommand: jest
    .fn()
    .mockImplementation((input: unknown) => ({ __type: "GetObject", input })),
  CopyObjectCommand: jest
    .fn()
    .mockImplementation((input: unknown) => ({ __type: "CopyObject", input })),
  DeleteObjectCommand: jest
    .fn()
    .mockImplementation((input: unknown) => ({ __type: "DeleteObject", input })),
}));

beforeEach(() => {
  sendMock.mockReset();
  process.env.UPLOAD_FOLDER = "uploaded";
  process.env.PARSED_FOLDER = "parsed";
});

afterAll(() => {
  delete process.env.UPLOAD_FOLDER;
  delete process.env.PARSED_FOLDER;
});

const createEvent = (key: string, bucket = "my-bucket"): S3Event =>
  ({
    Records: [
      {
        s3: {
          bucket: { name: bucket },
          object: { key },
        },
      },
    ],
  } as unknown as S3Event);

const csvBody = (rows: string[]): Readable => Readable.from(rows.join("\n"));

import { handler } from "../lambda/importFileParser";

const importHandler = (event: S3Event): Promise<void> => handler(event);

describe("importFileParser", () => {
  it("should parse CSV rows from S3 stream and log them", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    sendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === "GetObject") {
        return Promise.resolve({
          Body: csvBody(["a,b", "1,2", "3,4"]),
        });
      }
      return Promise.resolve({});
    });

    await importHandler(createEvent("uploaded/products.csv"));

    const csvRowLogs = logSpy.mock.calls.filter((c) => c[0] === "CSV row:");
    expect(csvRowLogs).toHaveLength(2);
    expect(csvRowLogs[0][1]).toEqual({ a: "1", b: "2" });
    expect(csvRowLogs[1][1]).toEqual({ a: "3", b: "4" });

    logSpy.mockRestore();
  });

  it("should copy parsed file to 'parsed/' and delete the original", async () => {
    sendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === "GetObject") {
        return Promise.resolve({ Body: csvBody(["a,b", "1,2"]) });
      }
      return Promise.resolve({});
    });

    await importHandler(createEvent("uploaded/products.csv"));

    const calls = sendMock.mock.calls.map((c) => c[0]);

    const copyCmd = calls.find((c) => c.__type === "CopyObject");
    const deleteCmd = calls.find((c) => c.__type === "DeleteObject");

    expect(copyCmd).toBeDefined();
    expect(copyCmd.input).toEqual(
      expect.objectContaining({
        Bucket: "my-bucket",
        Key: "parsed/products.csv",
        CopySource: "/my-bucket/uploaded%2Fproducts.csv",
      })
    );

    expect(deleteCmd).toBeDefined();
    expect(deleteCmd.input).toEqual(
      expect.objectContaining({
        Bucket: "my-bucket",
        Key: "uploaded/products.csv",
      })
    );
  });

  it("should skip objects outside of uploaded/ prefix", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await importHandler(createEvent("other/products.csv"));

    expect(warnSpy).toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("should rethrow when S3 GetObject fails", async () => {
    sendMock.mockRejectedValue(new Error("boom"));
    await expect(
      importHandler(createEvent("uploaded/products.csv"))
    ).rejects.toThrow("boom");
  });

  it("should decode URL-encoded keys from S3 events", async () => {
    sendMock.mockImplementation((cmd: { __type: string; input: { Key: string } }) => {
      if (cmd.__type === "GetObject") {
        expect(cmd.input.Key).toBe("uploaded/my file.csv");
        return Promise.resolve({ Body: csvBody(["a,b", "1,2"]) });
      }
      return Promise.resolve({});
    });

    await importHandler(createEvent("uploaded/my+file.csv"));
  });
});
