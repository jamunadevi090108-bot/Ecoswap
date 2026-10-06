const API_URL = 'https://api.razorpay.com/v1';

class RazorpayError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'RazorpayError';
    this.statusCode = statusCode;
  }
}

function getCredentials() {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId) ||
      !keySecret ||
      /placeholder|your_key|replace_me/i.test(keySecret)) {
    throw new RazorpayError('Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env.', 503);
  }
  return { keyId, keySecret };
}

async function razorpayRequest(path, method, body) {
  const { keySecret } = getCredentials();
  const headers = {
    Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID.trim()}:${keySecret}`).toString('base64')}`,
    Accept: 'application/json'
  };
  if (body) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw new RazorpayError('Could not reach Razorpay. Please try again.');
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const providerMessage = result?.error?.description;
    const message = response.status === 401
      ? 'Razorpay rejected the configured API keys. Check backend/.env.'
      : typeof providerMessage === 'string' && providerMessage.length < 180
        ? `Razorpay: ${providerMessage}`
        : 'Razorpay could not complete the payment request.';
    throw new RazorpayError(message, response.status === 401 ? 503 : 502);
  }
  return result;
}

function getRazorpayKeyId() {
  return getCredentials().keyId;
}

function createRazorpayOrder(details) {
  return razorpayRequest('/orders', 'POST', details);
}

function getRazorpayPayment(paymentId) {
  return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`, 'GET');
}

function captureRazorpayPayment(paymentId, amount, currency) {
  return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/capture`, 'POST', { amount, currency });
}

module.exports = {
  getRazorpayKeyId,
  createRazorpayOrder,
  getRazorpayPayment,
  captureRazorpayPayment,
  RazorpayError
};
