const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getSupabase, normalizeRow, sendSupabaseError } = require('../config/supabase');

const requiredAddress = ['addressLine', 'city', 'state', 'pinCode', 'country'];
const profile = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phoneNumber: user.phoneNumber,
  address: user.address,
  role: user.role
});

router.get('/profile', protect, (req, res) => {
  res.json({ user: profile(req.user) });
});

router.put('/profile', protect, async (req, res) => {
  const { name, phoneNumber, address } = req.body || {};
  if (typeof name !== 'string' || !name.trim() ||
      typeof phoneNumber !== 'string' || !phoneNumber.trim() ||
      !address || requiredAddress.some((field) => typeof address[field] !== 'string' || !address[field].trim())) {
    return res.status(400).json({ message: 'Name, phone number, and complete address are required' });
  }

  try {
    const { data: updatedUser, error } = await getSupabase()
      .from('users')
      .update({ name: String(name).trim(), phoneNumber: String(phoneNumber).trim(), address })
      .eq('id', req.user.id)
      .select('*')
      .maybeSingle();

    if (error) return sendSupabaseError(res, error);
    if (!updatedUser) return res.status(404).json({ message: 'User not found' });
    return res.json({ user: profile(normalizeRow(updatedUser)) });
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

module.exports = router;
