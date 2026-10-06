const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getSupabase, isUuid, normalizeRow, sendSupabaseError } = require('../config/supabase');

async function attachSellerInfo(rows, supabase) {
  if (!rows.length) return [];
  const sellerIds = [...new Set(rows.map((row) => row.seller).filter(Boolean))];
  if (!sellerIds.length) return rows.map(normalizeRow);

  const { data: sellers, error } = await supabase
    .from('users')
    .select('id,name,email')
    .in('id', sellerIds);
  if (error) throw error;

  const sellerMap = Object.fromEntries(
    (sellers || []).map((seller) => [seller.id, { id: seller.id, name: seller.name, email: seller.email }])
  );
  return rows.map((row) => ({
    ...normalizeRow(row),
    seller: sellerMap[row.seller] || null
  }));
}

router.get('/', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return sendSupabaseError(res, error);
    return res.json(await attachSellerInfo(data || [], supabase));
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.get('/mine', protect, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('seller', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return sendSupabaseError(res, error);
    return res.json(await attachSellerInfo(data || [], supabase));
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ message: 'Invalid product id' });

  try {
    const supabase = getSupabase();
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) return sendSupabaseError(res, error);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    let seller = null;
    if (product.seller) {
      const { data, error: sellerError } = await supabase
        .from('users')
        .select('id,name,email')
        .eq('id', product.seller)
        .maybeSingle();
      if (sellerError) return sendSupabaseError(res, sellerError);
      if (data) seller = { id: data.id, name: data.name, email: data.email };
    }
    return res.json({ ...normalizeRow(product), seller });
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.post('/', protect, async (req, res) => {
  const { name, description, price, category, condition, size, brand, image, aiAnalysis } = req.body || {};
  const numericPrice = Number(price);
  const requiredTextFields = [name, description, category, condition, size, brand, image];
  if (requiredTextFields.some((value) => typeof value !== 'string' || !value.trim()) ||
      !Number.isFinite(numericPrice) || numericPrice <= 0) {
    return res.status(400).json({ message: 'Name, description, positive price, category, condition, size, brand, and image are required' });
  }

  try {
    const { data: product, error } = await getSupabase()
      .from('products')
      .insert({
        name: String(name).trim(),
        description: String(description).trim(),
        price: numericPrice,
        category: String(category).trim(),
        condition: String(condition).trim(),
        size: String(size).trim(),
        brand: String(brand).trim(),
        image: String(image).trim(),
        aiAnalysis: aiAnalysis || {},
        seller: req.user.id,
        status: 'Available'
      })
      .select('*')
      .single();

    if (error) return sendSupabaseError(res, error);
    return res.status(201).json(normalizeRow(product));
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.put('/:id', protect, async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ message: 'Invalid product id' });
  const editableFields = ['name', 'description', 'price', 'category', 'condition', 'size', 'brand', 'image'];
  const updates = {};
  for (const field of editableFields) {
    if (req.body?.[field] !== undefined) updates[field] = req.body[field];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ message: 'At least one product field is required' });
  if (updates.price !== undefined && (!Number.isFinite(Number(updates.price)) || Number(updates.price) <= 0)) {
    return res.status(400).json({ message: 'Price must be greater than 0' });
  }
  for (const [field, value] of Object.entries(updates)) {
    if (field !== 'price' && (typeof value !== 'string' || !value.trim())) {
      return res.status(400).json({ message: `Invalid ${field} value` });
    }
  }
  if (updates.price !== undefined) updates.price = Number(updates.price);
  if (req.body?.aiAnalysis !== undefined) updates.aiAnalysis = req.body.aiAnalysis;

  try {
    const supabase = getSupabase();
    const { data: existing, error: fetchError } = await supabase
      .from('products')
      .select('id,seller')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) return sendSupabaseError(res, fetchError);
    if (!existing) return res.status(404).json({ message: 'Product not found' });
    if (existing.seller !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not allowed' });
    }

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();
    if (error) return sendSupabaseError(res, error);
    if (!data) return res.status(404).json({ message: 'Product not found' });
    return res.json(normalizeRow(data));
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.delete('/:id', protect, async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ message: 'Invalid product id' });

  try {
    const supabase = getSupabase();
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id,seller')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) return sendSupabaseError(res, fetchError);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (String(product.seller) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not allowed' });
    }

    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) return sendSupabaseError(res, error);
    return res.json({ message: 'Deleted' });
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

module.exports = router;
