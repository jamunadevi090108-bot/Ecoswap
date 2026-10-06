const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/auth');
const { getSupabase, normalizeRow, sendSupabaseError } = require('../config/supabase');
const { getJwtSecret } = require('../config/jwt');

const token = (user, secret) => jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '7d' });
const profile = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phoneNumber: user.phoneNumber,
  address: user.address,
  role: user.role
});

router.get('/me', protect, (req, res) => {
  res.json({ user: profile(req.user) });
});

router.post('/register', async (req, res) => {
  const secret = getJwtSecret();
  if (!secret) return res.status(503).json({ message: 'JWT_SECRET is not configured. Set a private value in backend/.env.' });

  const { name, email, phoneNumber, password, address } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (typeof name !== 'string' || typeof email !== 'string' ||
      typeof phoneNumber !== 'string' || typeof password !== 'string' ||
      !address || typeof address !== 'object' || Array.isArray(address)) {
    return res.status(400).json({ message: 'All registration and address fields are required' });
  }
  const fields = [
    name,
    normalizedEmail,
    phoneNumber,
    password,
    address?.addressLine,
    address?.city,
    address?.state,
    address?.pinCode,
    address?.country
  ];
  if (fields.some((value) => typeof value !== 'string' || !value.trim())) {
    return res.status(400).json({ message: 'All registration and address fields are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'A valid email address is required' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  try {
    const supabase = getSupabase();
    const { data: createdUser, error } = await supabase
      .from('users')
      .insert({
        name: String(name).trim(),
        email: normalizedEmail,
        phoneNumber: String(phoneNumber).trim(),
        address,
        password: await bcrypt.hash(password, 10),
        role: 'user'
      })
      .select('*')
      .single();

    if (error) return sendSupabaseError(res, error);
    return res.status(201).json({ token: token(createdUser, secret), user: profile(normalizeRow(createdUser)) });
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.post('/login', async (req, res) => {
  const secret = getJwtSecret();
  if (!secret) return res.status(503).json({ message: 'JWT_SECRET is not configured. Set a private value in backend/.env.' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = req.body?.password;
  if (!email || typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const { data: user, error } = await getSupabase()
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) return sendSupabaseError(res, error);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    return res.json({ token: token(user, secret), user: profile(normalizeRow(user)) });
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

module.exports = router;
