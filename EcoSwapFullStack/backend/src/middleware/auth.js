const jwt = require('jsonwebtoken');
const { getSupabase, isUuid, normalizeRow, sendSupabaseError } = require('../config/supabase');
const { getJwtSecret } = require('../config/jwt');

async function protect(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please login first' });

  const secret = getJwtSecret();
  if (!secret) return res.status(503).json({ message: 'JWT_SECRET is not configured. Set a private value in backend/.env.' });

  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  if (!payload.id || !isUuid(payload.id)) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  try {
    const { data: user, error } = await getSupabase()
      .from('users')
      .select('*')
      .eq('id', payload.id)
      .maybeSingle();

    if (error) return sendSupabaseError(res, error);
    if (!user) return res.status(401).json({ message: 'User not found' });

    req.user = normalizeRow(user);
    delete req.user.password;
    return next();
  } catch (error) {
    return sendSupabaseError(res, error);
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

module.exports = { protect, adminOnly };
