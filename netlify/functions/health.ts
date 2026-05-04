import type { Handler } from "@netlify/functions";

export const handler: Handler = async () => {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      service: "automacaozap-functions",
      status: "ok",
      env: process.env.APP_ENV ?? "development",
      timestamp: new Date().toISOString()
    })
  };
};
