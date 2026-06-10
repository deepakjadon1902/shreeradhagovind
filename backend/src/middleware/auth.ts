import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../utils/jwt";
import { HttpError } from "./error";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return next(new HttpError(401, "Missing token"));
  try {
    req.user = verifyToken(h.slice(7));
    next();
  } catch {
    next(new HttpError(401, "Invalid token"));
  }
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") return next(new HttpError(403, "Admin only"));
  next();
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) {
    try {
      req.user = verifyToken(h.slice(7));
    } catch {
      /* ignore */
    }
  }
  next();
};
