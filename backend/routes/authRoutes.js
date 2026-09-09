import express from "express";
import rateLimit from "express-rate-limit";
import passport from "../config/passport.js";

import {
  registerUser,
  loginUser,
  loginWithGoogle,
} from "../controllers/authController.js";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
});

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authLimiter, registerUser);

router.post("/login", authLimiter, loginUser);

router.get(
  "/google",
  oauthLimiter,
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  oauthLimiter,
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=google`,
  }),
  loginWithGoogle,
);

export default router;
