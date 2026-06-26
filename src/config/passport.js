const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

/**
 * Google OAuth strategy for PLATFORM-level accounts (super_admin sign-in is
 * disabled for OAuth by policy, store_owner and customer can use it).
 *
 * Note: customer Google sign-in is tenant-scoped. The store context must be
 * passed via the `state` param when initiating the OAuth flow from the
 * storefront, since Google's callback doesn't know which store the customer
 * started from otherwise.
 *
 * Registration is conditional on GOOGLE_CLIENT_ID/SECRET being present in the
 * environment. This lets the app boot and run fully (email/password auth,
 * stores, products, etc.) before Google OAuth credentials are set up — the
 * passport-google-oauth20 strategy throws synchronously at construction time
 * if clientID is missing, which would otherwise crash the whole server on
 * startup just because one optional login method isn't configured yet.
 */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const emailObj =
            profile.emails && profile.emails.length > 0 ? profile.emails[0] : null;
          const email = emailObj && emailObj.value ? emailObj.value.toLowerCase() : null;
          if (!email) {
            return done(new Error('Google account has no email'), null);
          }

          // storeSlug is forwarded through OAuth `state` for customer-scoped signups
          const storeSlug = req.query.state ? JSON.parse(req.query.state).storeSlug : null;
          let store = null;
          if (storeSlug) {
            const Store = require('../models/Store');
            store = await Store.findOne({ slug: storeSlug });
          }

          const query = store ? { email, store: store._id } : { email, store: null };
          let user = await User.findOne(query);

          const photoObj =
            profile.photos && profile.photos.length > 0 ? profile.photos[0] : null;
          const avatarUrl = photoObj && photoObj.value ? photoObj.value : '';

          if (!user) {
            user = await User.create({
              name: profile.displayName || email.split('@')[0],
              email,
              googleId: profile.id,
              isEmailVerified: true,
              role: store ? 'customer' : 'customer',
              store: store ? store._id : null,
              avatar: { url: avatarUrl },
            });
          } else if (!user.googleId) {
            user.googleId = profile.id;
            user.isEmailVerified = true;
            await user.save();
          }

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
} else {
  console.warn(
    '[AUTH] Google OAuth is not configured (GOOGLE_CLIENT_ID/SECRET missing in .env). ' +
      'Email/password auth still works. Set these env vars later to enable "Sign in with Google".'
  );
}

module.exports = passport;
