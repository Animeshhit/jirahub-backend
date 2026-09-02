import { type Request, type Response, type NextFunction } from "express";
import { verifyAccessToken } from "../utills/tokens";

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(400).json({ message: "Access token missing" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token as string);
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
};