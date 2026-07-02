import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const notFound = (_req: Request, res: Response) =>
  res.status(404).json({ error: "Not found" });

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    const message = err.issues.map((issue) => issue.message).join(", ");
    return res.status(400).json({ error: message || "Invalid request" });
  }
  const status = err.status || err.statusCode || 500;
  // eslint-disable-next-line no-console
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || "Server error" });
};
