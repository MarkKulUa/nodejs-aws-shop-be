import { handler } from "../lambda/basicAuthorizer";
import type { APIGatewayTokenAuthorizerEvent } from "aws-lambda";

const METHOD_ARN =
  "arn:aws:execute-api:eu-west-1:123456789012:abc123/prod/GET/import";

const buildEvent = (
  authorizationToken: string
): APIGatewayTokenAuthorizerEvent => ({
  type: "TOKEN",
  authorizationToken,
  methodArn: METHOD_ARN,
});

const encode = (login: string, password: string) =>
  "Basic " + Buffer.from(`${login}:${password}`).toString("base64");

describe("basicAuthorizer", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, MarkKulUa: "TEST_PASSWORD" };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("throws Unauthorized (401) when no token is provided", async () => {
    await expect(handler(buildEvent(""))).rejects.toThrow("Unauthorized");
  });

  it("returns Allow policy for valid credentials", async () => {
    const result = await handler(buildEvent(encode("MarkKulUa", "TEST_PASSWORD")));

    const statement = result.policyDocument.Statement[0] as {
      Effect: string;
      Resource: string;
    };

    expect(result.principalId).toBe("MarkKulUa");
    expect(statement.Effect).toBe("Allow");
    expect(statement.Resource).toBe(METHOD_ARN);
  });

  it("returns Deny policy for wrong password", async () => {
    const result = await handler(buildEvent(encode("MarkKulUa", "WRONG")));

    const statement = result.policyDocument.Statement[0] as { Effect: string };
    expect(statement.Effect).toBe("Deny");
  });

  it("returns Deny policy for unknown user", async () => {
    const result = await handler(buildEvent(encode("someoneelse", "TEST_PASSWORD")));

    const statement = result.policyDocument.Statement[0] as { Effect: string };
    expect(statement.Effect).toBe("Deny");
  });

  it("returns Deny policy for malformed token (no Basic scheme)", async () => {
    const result = await handler(buildEvent("Bearer sometoken"));

    const statement = result.policyDocument.Statement[0] as { Effect: string };
    expect(statement.Effect).toBe("Deny");
  });
});
