const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getSupabase, isUuid, normalizeRow, sendSupabaseError } = require('../config/supabase');

router.use(protect, adminOnly);

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

router.get('/stats', async (req, res) => {
  try {
    const supabase = getSupabase();
    const results = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('requests').select('id', { count: 'exact', head: true }).eq('type', 'donation'),
      supabase.from('requests').select('id', { count: 'exact', head: true }).eq('type', 'recycle'),
      supabase.from('requests').select('id', { count: 'exact', head: true }).eq('type', 'exchange')
    ]);
    const failed = results.find((result) => result.error);
    if (failed) return sendSupabaseError(res, failed.error);

    const [users, listings, donations, recycling, exchanges] = results;
    return res.json({
      users: users.count || 0,
      listings: listings.count || 0,
      donations: donations.count || 0,
      recycling: recycling.count || 0,
      exchanges: exchanges.count || 0
    });
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.get('/users', async (req, res) => {
  try {
    const { data, error } = await getSupabase()
      .from('users')
      .select('id,name,email,phoneNumber,address,role,created_at')
      .order('created_at', { ascending: false });
    if (error) return sendSupabaseError(res, error);
    return res.json(data || []);
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.get('/products', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) return sendSupabaseError(res, error);
    return res.json(await attachSellerInfo(data || [], supabase));
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.delete('/products/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ message: 'Invalid product id' });

  try {
    const { data, error } = await getSupabase()
      .from('products')
      .delete()
      .eq('id', req.params.id)
      .select('id')
      .maybeSingle();
    if (error) return sendSupabaseError(res, error);
    if (!data) return res.status(404).json({ message: 'Product not found' });
    return res.json({ message: 'Listing removed' });
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.get('/requests', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('requests').select('*').order('created_at', { ascending: false });
    if (error) return sendSupabaseError(res, error);

    const rows = data || [];
    const userIds = [...new Set(rows.map((item) => item.user).filter(Boolean))];
    const productIds = [...new Set(rows.map((item) => item.product).filter(Boolean))];
    const [usersResult, productsResult] = await Promise.all([
      userIds.length ? supabase.from('users').select('id,name,email').in('id', userIds) : { data: [], error: null },
      productIds.length ? supabase.from('products').select('*').in('id', productIds) : { data: [], error: null }
    ]);
    if (usersResult.error) return sendSupabaseError(res, usersResult.error);
    if (productsResult.error) return sendSupabaseError(res, productsResult.error);

    const userMap = Object.fromEntries(
      (usersResult.data || []).map((user) => [user.id, { id: user.id, name: user.name, email: user.email }])
    );
    const productMap = Object.fromEntries((productsResult.data || []).map((product) => [product.id, normalizeRow(product)]));
    return res.json(rows.map((item) => ({
      ...normalizeRow(item),
      user: userMap[item.user] || null,
      product: productMap[item.product] || null
    })));
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.get('/orders', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: orders, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) return sendSupabaseError(res, error);

    const rows = orders || [];
    const userIds = [...new Set(rows.map((order) => order.buyer).filter(Boolean))];
    const productIds = [...new Set(rows.map((order) => order.product).filter(Boolean))];
    const [usersResult, productsResult] = await Promise.all([
      userIds.length ? supabase.from('users').select('id,name,email').in('id', userIds) : { data: [], error: null },
      productIds.length ? supabase.from('products').select('id,name,image,price').in('id', productIds) : { data: [], error: null }
    ]);
    if (usersResult.error) return sendSupabaseError(res, usersResult.error);
    if (productsResult.error) return sendSupabaseError(res, productsResult.error);
    const users = Object.fromEntries((usersResult.data || []).map((user) => [user.id, user]));
    const products = Object.fromEntries((productsResult.data || []).map((product) => [product.id, product]));
    return res.json(rows.map((order) => ({
      ...normalizeRow(order),
      buyer: users[order.buyer] || null,
      product: products[order.product] || null
    })));
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.patch('/requests/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ message: 'Invalid request id' });
  const status = String(req.body?.status || '').trim();
  if (!['Pending', 'Approved', 'Completed', 'Rejected'].includes(status)) {
    return res.status(400).json({ message: 'Status must be Pending, Approved, Completed, or Rejected' });
  }

  try {
    const { data, error } = await getSupabase()
      .from('requests')
      .update({ status })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();
    if (error) return sendSupabaseError(res, error);
    if (!data) return res.status(404).json({ message: 'Request not found' });
    return res.json(normalizeRow(data));
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

module.exports = router;
