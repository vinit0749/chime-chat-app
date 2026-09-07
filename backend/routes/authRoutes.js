import express from "express";
import passport from "../config/passport.js";

import {
  registerUser,
  loginUser,
  loginWithGoogle,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "http://localhost:5173/login?error=google",
  }),
  loginWithGoogle,
);

export default router;
