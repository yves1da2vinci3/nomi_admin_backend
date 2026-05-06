import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  PORT: z.coerce.number().default(4001),
  DATABASE_URL: z.string().min(1),
  ADMIN_API_TOKEN: z.string().min(8),
  ADMIN_CORS_ORIGIN: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid env:", parsed.error.flatten().fieldErrors);
    throw new Error("Environment validation failed");
  }
  return parsed.data;
}
