import bcrypt from "bcryptjs";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

export const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (user.isDeleted) {
      return res.status(403).json({
        message: "This account has been deleted",
      });
    }

    if (user.authProvider !== "local") {
      return res.status(401).json({
        message: "Use the connected OAuth provider to sign in",
      });
    }

    if (!user.password) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

export const loginWithGoogle = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=google`,
      );
    }

    const io = req.app.get("io");

    if (user.justCreatedFromGoogle && io) {
      io.emit("user_profile_updated", {
        user: {
          _id: user._id,
          username: user.username,
          displayName: user.displayName || "",
          profilePicture: user.profilePicture || "",
          status: user.status,
        },
      });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const userData = encodeURIComponent(
      JSON.stringify({
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture || "",
      }),
    );

    res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/oauth-success?token=${token}&user=${userData}`,
    );
  } catch (error) {
    console.error("Google login error:", error.message);

    res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=google`,
    );
  }
};
