import pino from "pino";

export const logger = pino({
  level: process.env.APP_ENV === "production" ? "info" : "debug"
});
