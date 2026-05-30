import type {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
  PolicyDocument,
} from "aws-lambda";

type Effect = "Allow" | "Deny";

const generatePolicy = (
  principalId: string,
  effect: Effect,
  resource: string
): APIGatewayAuthorizerResult => {
  const policyDocument: PolicyDocument = {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: effect,
        Resource: resource,
      },
    ],
  };

  return { principalId, policyDocument };
};

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log("basicAuthorizer event:", JSON.stringify(event));

  const { authorizationToken, methodArn } = event;

  // 401 — Authorization header is not provided.
  // Throwing "Unauthorized" makes API Gateway respond with HTTP 401.
  if (!authorizationToken) {
    console.error("Authorization header is not provided");
    throw new Error("Unauthorized");
  }

  try {
    const [scheme, encodedCreds] = authorizationToken.split(" ");

    if (scheme !== "Basic" || !encodedCreds) {
      console.error("Authorization token has invalid format");
      return generatePolicy("user", "Deny", methodArn);
    }

    const decoded = Buffer.from(encodedCreds, "base64").toString("utf-8");
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      console.error("Decoded credentials have invalid format");
      return generatePolicy("user", "Deny", methodArn);
    }

    const login = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);

    const storedPassword = process.env[login];

    // 403 — access is denied for this user (invalid credentials).
    const effect: Effect =
      storedPassword !== undefined && storedPassword === password
        ? "Allow"
        : "Deny";

    console.log(`Authorization result for "${login}": ${effect}`);

    return generatePolicy(login, effect, methodArn);
  } catch (error) {
    console.error("basicAuthorizer error:", error);
    // Any unexpected error during decoding/checking => deny (403).
    return generatePolicy("user", "Deny", methodArn);
  }
};
