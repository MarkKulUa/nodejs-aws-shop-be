export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export const buildResponse = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: corsHeaders,
  body: typeof body === "string" ? body : JSON.stringify(body),
});
