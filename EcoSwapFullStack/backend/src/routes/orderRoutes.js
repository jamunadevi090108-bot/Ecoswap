const router = require('express').Router();
const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const { getSupabase, isUuid, normalizeRow, sendSupabaseError } = require('../config/supabase');
const { getRazorpayKeyId, createRazorpayOrder, getRazorpayPayment, captureRazorpayPayment, RazorpayError } = require('../services/razorpayService');

function getShippingAddress(inputAddress, user) {
  return {
    fullName: inputAddress.fullName || user.name,
    phoneNumber: inputAddress.phoneNumber || user.phoneNumber,
    addressLine: inputAddress.addressLine || user.address?.addressLine,
    city: inputAddress.city || user.address?.city,
    state: inputAddress.state || user.address?.state,
    pinCode: inputAddress.pinCode || user.address?.pinCode,
    country: inputAddress.country || user.address?.country
  };
}

function validShippingAddress(address) {
  return Object.values(address).every((value) => String(value || '').trim());
}

function sendOrderError(res, error) {
  if (error instanceof RazorpayError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  return sendSupabaseError(res, error);
}

router.get('/', protect, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('buyer', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return sendSupabaseError(res, error);

    const rows = orders || [];
    const productIds = [...new Set(rows.map((order) => order.product).filter(Boolean))];
    const { data: products, error: productsError } = productIds.length
      ? await supabase.from('products').select('id,name,image,price,category,size,condition').in('id', productIds)
      : { data: [], error: null };
    if (productsError) return sendSupabaseError(res, productsError);
    const productMap = Object.fromEntries((products || []).map((product) => [product.id, product]));
    return res.json(rows.map((order) => ({ ...normalizeRow(order), product: productMap[order.product] || null })));
  } catch (error) {
    return sendSupabaseError(res, error);
  }
});

router.post('/', protect, async (req, res) => {
  return res.status(410).json({ message: 'Unpaid order requests are disabled. Use Razorpay checkout to pay for the product.' });
});

router.post('/checkout', protect, async (req, res) => {
  const productId = req.body?.productId;
  if (!isUuid(productId)) return res.status(400).json({ message: 'A valid product id is required' });

  try {
    const keyId = getRazorpayKeyId();
    const supabase = getSupabase();
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id,name,price,status,seller')
      .eq('id', productId)
      .maybeSingle();
    if (productError) return sendSupabaseError(res, productError);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.status !== 'Available') return res.status(409).json({ message: 'This product is no longer available' });
    if (product.seller === req.user.id) return res.status(400).json({ message: 'You cannot buy your own listing' });

    const amount = Math.round(Number(product.price) * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return res.status(400).json({ message: 'This product has an invalid price and cannot be purchased.' });
    }

    const shippingAddress = getShippingAddress(req.body.shippingAddress || {}, req.user);
    if (!validShippingAddress(shippingAddress)) {
      return res.status(400).json({ message: 'Complete shipping address is required' });
    }

    const gatewayOrder = await createRazorpayOrder({
      amount,
      currency: 'INR',
      receipt: `eco_${crypto.randomUUID().replace(/-/g, '').slice(0, 36)}`,
      notes: { product_id: product.id, buyer_id: req.user.id }
    });
    const { data: order, error } = await supabase.rpc('create_payment_order', {
      p_buyer_id: req.user.id,
      p_product_id: product.id,
      p_shipping_address: shippingAddress,
      p_gateway_order_id: gatewayOrder.id,
      p_amount: amount
    });
    if (error?.code === '42883' || error?.code === 'PGRST202') {
      return res.status(503).json({ message: 'Payment checkout is not ready yet. Apply backend/supabase/payment-schema.sql in Supabase.' });
    }
    if (error) return sendSupabaseError(res, error);

    return res.status(201).json({
      orderId: order.id,
      paymentOrderId: gatewayOrder.id,
      amount,
      currency: 'INR',
      keyId,
      productName: product.name
    });
  } catch (error) {
    return sendOrderError(res, error);
  }
});

router.post('/verify-payment', protect, async (req, res) => {
  const { orderId, paymentId, paymentOrderId, signature } = req.body || {};
  if (!isUuid(orderId) ||
      typeof paymentId !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(paymentId) ||
      typeof paymentOrderId !== 'string' || !/^order_[A-Za-z0-9]+$/.test(paymentOrderId) ||
      typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) {
    return res.status(400).json({ message: 'Invalid payment verification details.' });
  }

  try {
    getRazorpayKeyId();
    const supabase = getSupabase();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id,buyer,product,status,payment_order_id,payment_id,payment_amount,payment_currency')
      .eq('id', orderId)
      .eq('buyer', req.user.id)
      .maybeSingle();
    if (orderError) return sendSupabaseError(res, orderError);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (order.status === 'Paid' && order.payment_id === paymentId) {
      return res.json({ message: 'Payment confirmed.', orderId: order.id, status: order.status });
    }
    if (order.status !== 'Payment Pending' || order.payment_order_id !== paymentOrderId) {
      return res.status(409).json({ message: 'This payment order is no longer pending.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${order.payment_order_id}|${paymentId}`)
      .digest();
    const receivedSignature = Buffer.from(signature, 'hex');
    if (receivedSignature.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(receivedSignature, expectedSignature)) {
      return res.status(400).json({ message: 'Payment signature could not be verified.' });
    }

    let payment = await getRazorpayPayment(paymentId);
    if (payment.order_id !== order.payment_order_id ||
        Number(payment.amount) !== Number(order.payment_amount) ||
        payment.currency !== order.payment_currency) {
      return res.status(400).json({ message: 'Payment details do not match this order.' });
    }
    if (payment.status === 'authorized') {
      payment = await captureRazorpayPayment(paymentId, Number(order.payment_amount), order.payment_currency);
    }
    if (payment.status !== 'captured') {
      return res.status(409).json({ message: 'Payment has not been captured yet. Please wait and retry verification.' });
    }

    const { data: completedOrder, error } = await supabase.rpc('complete_paid_order', {
      p_order_id: order.id,
      p_buyer_id: req.user.id,
      p_payment_id: paymentId
    });
    if (error) return sendSupabaseError(res, error);
    return res.json({ message: 'Payment confirmed.', orderId: completedOrder.id, status: completedOrder.status });
  } catch (error) {
    return sendOrderError(res, error);
  }
});

router.post('/cancel-payment', protect, async (req, res) => {
  const { orderId } = req.body || {};
  if (!isUuid(orderId)) return res.status(400).json({ message: 'A valid order id is required.' });

  try {
    const { data, error } = await getSupabase().rpc('cancel_payment_order', {
      p_order_id: orderId,
      p_buyer_id: req.user.id
    });
    if (error) return sendSupabaseError(res, error);
    return res.json({ message: 'Unpaid checkout closed.', status: data.status });
  } catch (error) {
    return sendOrderError(res, error);
  }
});

module.exports = router;
