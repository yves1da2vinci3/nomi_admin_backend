import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  const status = typeof err === "object" && err && "status" in err && typeof (err as any).status === "number"
    ? (err as any).status
    : 500;
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Internal Server Error";
  res.status(status).json({ success: false, error: message });
};
