function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret || /^(your_|replace_|dev_secret)/i.test(secret) || secret.includes('<')) {
    return null;
  }
  return secret;
}

module.exports = { getJwtSecret };
