import { type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/db.ts";
import { users, refreshTokens } from "../db/schema.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiryDate,
  verifyAccessToken,
} from "../utills/tokens.ts";

const REFRESH_COOKIE_NAME = "refreshToken";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/v1/auth", 
};

/* --------------------------- REGISTER --------------------------- */

export const RegisterUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db
      .insert(users)
      .values({ name, email, password: hashedPassword })
      .returning({ id: users.id, name: users.name, email: users.email });


      if(!newUser) return res.status(500).json({ message: "Failed to create user" });

    // --- auto-login: issue tokens immediately ---
    const accessToken = generateAccessToken({ userId: newUser.id, email: newUser.email });
    const refreshToken = generateRefreshToken();

    await db.insert(refreshTokens).values({
      userId: newUser.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: getRefreshTokenExpiryDate(),
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      message: "User registered successfully",
      accessToken,
      user: newUser,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ----------------------------- LOGIN ----------------------------- */

export const LoginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken();

    // store hashed refresh token so DB compromise doesn't leak usable tokens
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: getRefreshTokenExpiryDate(),
    });

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      message: "Login successful",
      accessToken,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* -------------------------- REFRESH TOKEN -------------------------- */

export const RefreshAccessToken = async (req: Request, res: Response) => {
  try {
    const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!incomingToken) {
      return res.status(401).json({ message: "Refresh token missing" });
    }

    const tokenHash = hashToken(incomingToken);

    const storedToken = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, tokenHash),
      with: { user: true },
    });

    if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
      return res.status(403).json({ message: "Invalid or expired refresh token" });
    }

    // rotate: revoke old, issue new (prevents replay if token is stolen)
    await db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens._id, storedToken._id));

    const newRefreshToken = generateRefreshToken();
    await db.insert(refreshTokens).values({
      userId: storedToken.userId,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: getRefreshTokenExpiryDate(),
    });

    const accessToken = generateAccessToken({
      userId: storedToken.user.id,
      email: storedToken.user.email,
    });

    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ accessToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* --------------------------- LOGOUT --------------------------- */

export const LogoutUser = async (req: Request, res: Response) => {
  try {
    const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (incomingToken) {
      await db
        .update(refreshTokens)
        .set({ revoked: true })
        .where(eq(refreshTokens.tokenHash, hashToken(incomingToken)));
    }

    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ------------------------- GET CURRENT USER ------------------------- */

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    // req.user is set by the auth middleware (see below)
    const userId = (req as any).user?.userId;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, name: true, email: true }, // exclude password
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

