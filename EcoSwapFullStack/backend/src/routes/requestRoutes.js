const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getSupabase, isUuid, normalizeRow, sendSupabaseError } = require('../config/supabase');

const requestFields = [
  'itemName',
  'category',
  'image',
  'condition',
  'material',
  'description',
  'address',
  'pickupDate',
  'product',
  'requestedItem',
  'message'
];

router.post('/', protect, async (req, res) => {
  const body = req.body || {};
  if (!['donation', 'recycle', 'exchange'].includes(body.type)) {
    return res.status(400).json({ message: 'Request type must be donation, recycle, or exchange' });
  }
  if (body.product && !isUuid(body.product)) {
    return res.status(400).json({ message: 'Invalid product id' });
  }
  const requiredByType = {
    donation: ['itemName', 'category', 'condition', 'description', 'address', 'pickupDate'],
    recycle: ['itemName', 'material', 'condition', 'description', 'address', 'pickupDate'],
    exchange: ['product', 'requestedItem']
  };
  for (const field of requiredByType[body.type]) {
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      return res.status(400).json({ message: `${field} is required for a ${body.type} request` });
    }
  }

  const request = { type: body.type, user: req.user.id, status: 'Pending' };
  for (const field of requestFields) {
    if (body[field] !== undefined) {
      if (field !== 'product' && body[field] !== null && typeof body[field] !== 'string') {
        return res.status(400).json({ message: `Invalid ${field} value` });
      }
      request[field] = body[field];
    }
  }
  if (request.product === '') delete request.product;

  try {
    const supabase = getSupabase();
    if (body.type === 'exchange') {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id,seller,status')
        .eq('id', body.product)
        .maybeSingle();
      if (productError) return sendSupabaseError(res, productError);
      if (!product) return res.status(404).json({ message: 'Product not found' });
      if (product.seller === req.user.id) return res.status(400).json({ message: 'You cannot request an exchange for your own listing' });
      if (product.status !== 'Available') return res.status(409).json({ message: 'This product is no longer available for exchange' });
    }

    const { data, error } = await supabase
      .from('requests')
      .insert(request)
      .select('*')
      .single();
    if (error) return sendSupabaseError(res, error);
    return res.status(201).json(normalizeRow(data));
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const { data, error } = await getSupabase()
      .from('requests')
      .select('*')
      .eq('user', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return sendSupabaseError(res, error);
    return res.json((data || []).map(normalizeRow));
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

module.exports = router;
