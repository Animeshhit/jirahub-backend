import jwt from "jsonwebtoken";
import crypto from "crypto";

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

export const generateAccessToken = (payload: AccessTokenPayload) => {
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET!, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY as any || "15m",
  });
};

export const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString("hex");
};

export const hashToken = (token: string) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as AccessTokenPayload;
};

export const getRefreshTokenExpiryDate = () => {
  const days = parseInt(process.env.REFRESH_TOKEN_EXPIRY?.replace("d", "") || "7", 10);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};