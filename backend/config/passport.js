import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";
import cloudinary from "./cloudinary.js";

const isGoogleProfilePicture = (url) =>
  typeof url === "string" && url.includes("googleusercontent.com");

const uploadGoogleProfilePicture = async (profile) => {
  const googleImageUrl = profile.photos?.[0]?.value;

  if (!googleImageUrl) {
    console.log("No Google profile picture found");
    return "";
  }

  console.log("Google profile picture URL:", googleImageUrl);

  try {
    const result = await cloudinary.uploader.upload(googleImageUrl, {
      folder: "chime/profile-pictures",
      public_id: `google-${profile.id}`,
      overwrite: true,
      resource_type: "image",
    });

    console.log(
      "Google profile picture uploaded to Cloudinary:",
      result.secure_url,
    );

    return result.secure_url;
  } catch (error) {
    console.error("Google profile picture Cloudinary upload failed:", error);

    throw error;
  }
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();

        if (!email) {
          return done(null, false, {
            message: "Google account does not have an email address",
          });
        }

        let user = await User.findOne({ email });

        if (user) {
          if (user.isDeleted) {
            return done(null, false, {
              message: "This account has been deleted",
            });
          }

          if (user.authProvider === "local") {
            return done(null, false, {
              message: "An account with this email already exists",
            });
          }

          if (user.authProvider !== "google") {
            return done(null, false, {
              message: "This email is already linked to another provider",
            });
          }

          if (!user.providerId) {
            user.providerId = profile.id;
            await user.save();
          }

          if (user.providerId !== profile.id) {
            return done(null, false, {
              message: "Google account does not match this user",
            });
          }

          if (isGoogleProfilePicture(user.profilePicture)) {
            user.profilePicture = await uploadGoogleProfilePicture(profile);
            await user.save();
          }

          return done(null, user);
        }

        const baseUsername =
          profile.displayName?.trim().replace(/\s+/g, "").toLowerCase() ||
          `googleuser${profile.id.slice(-6)}`;

        let username = baseUsername;
        let counter = 1;

        while (await User.exists({ username })) {
          username = `${baseUsername}${counter}`;
          counter += 1;
        }

        const profilePicture = await uploadGoogleProfilePicture(profile);

        user = await User.create({
          username,
          displayName: profile.displayName || "",
          email,
          password: null,
          authProvider: "google",
          providerId: profile.id,
          profilePicture,
        });

        user.justCreatedFromGoogle = true;

        return done(null, user);
      } catch (error) {
        console.error("Google authentication failed:", error);
        return done(error, null);
      }
    },
  ),
);

export default passport;
