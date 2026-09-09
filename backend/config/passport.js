import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

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

        user = await User.create({
          username,
          displayName: profile.displayName || "",
          email,
          password: null,
          authProvider: "google",
          providerId: profile.id,
          profilePicture: profile.photos?.[0]?.value || "",
        });

        user.justCreatedFromGoogle = true;

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    },
  ),
);

export default passport;
