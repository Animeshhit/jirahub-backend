import { Router } from "express";
import {
  RegisterUser,
  LoginUser,
  RefreshAccessToken,
  LogoutUser,
  getCurrentUser,
} from "../../controllers/auth.controllers.ts";
import { requireAuth } from "../../middlewares/auth.middlewares.ts";
import { authLimiter, refreshLimiter } from "../../middlewares/ratelimiter.ts";

const router = Router();

router.post("/register", authLimiter, RegisterUser);
router.post("/login", authLimiter, LoginUser);
router.post("/refresh", refreshLimiter, RefreshAccessToken);
router.post("/logout", requireAuth, LogoutUser);
router.get("/me", requireAuth, getCurrentUser);

export default router;