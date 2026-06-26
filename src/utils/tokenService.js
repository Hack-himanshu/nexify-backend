const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

/**
 * Generates a short-lived access token carrying identity + role + tenant scope.
 * Keeping the payload minimal avoids leaking unnecessary data and keeps tokens small.
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      store: user.store ? user.store.toString() : null,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
};

/**
 * Generates a long-lived, opaque refresh token. We only ever store a SHA-256
 * hash of it in the DB (never the raw token) so a DB leak can't be used to
 * impersonate users.
 */
const generateRefreshToken = async (user, meta = {}) => {
  const rawToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const expiresInMs = parseDurationToMs(process.env.JWT_REFRESH_EXPIRES || '30d');

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    userAgent: meta.userAgent || '',
    ip: meta.ip || '',
    expiresAt: new Date(Date.now() + expiresInMs),
  });

  return rawToken;
};

/**
 * Rotates a refresh token: validates the presented raw token against its stored hash,
 * revokes it, and issues a brand new one. Rotation on every use limits the blast
 * radius if a refresh token is ever stolen (reuse detection becomes possible).
 */
const rotateRefreshToken = async (rawToken, meta = {}) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const existing = await RefreshToken.findOne({ tokenHash });

  if (!existing || existing.isRevoked || existing.expiresAt < new Date()) {
    return null; // caller should treat as invalid/expired session
  }

  existing.isRevoked = true;

  const newRawToken = crypto.randomBytes(64).toString('hex');
  const newTokenHash = crypto.createHash('sha256').update(newRawToken).digest('hex');
  existing.replacedByTokenHash = newTokenHash;
  await existing.save();

  const expiresInMs = parseDurationToMs(process.env.JWT_REFRESH_EXPIRES || '30d');
  await RefreshToken.create({
    user: existing.user,
    tokenHash: newTokenHash,
    userAgent: meta.userAgent || '',
    ip: meta.ip || '',
    expiresAt: new Date(Date.now() + expiresInMs),
  });

  return { userId: existing.user, rawToken: newRawToken };
};

const revokeRefreshToken = async (rawToken) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await RefreshToken.updateOne({ tokenHash }, { isRevoked: true });
};

const revokeAllUserTokens = async (userId) => {
  await RefreshToken.updateMany({ user: userId, isRevoked: false }, { isRevoked: true });
};

function parseDurationToMs(duration) {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // default 30 days
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * unitMs[unit];
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
};
