import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  APP_BASE_URL: z.string().url().optional(),
  APP_ENCRYPTION_KEY: z.string().min(32).optional(),
  ENABLE_MOCK_WHATSAPP: z.string().optional(),
  ENABLE_MOCK_OPENAI: z.string().optional(),
});

export function readEnv() {
  return schema.parse(process.env);
}
