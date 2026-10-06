import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Address, useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import ImageFrame from '../components/ImageFrame';
import './ProductDetails.css';

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  size: string;
  condition: string;
  brand: string;
  image: string;
  description: string;
  status: string;
  is_demo?: boolean;
  seller?: { id: string; name: string; email: string } | null;
  aiAnalysis?: { recommendation?: string; confidence?: number; reason?: string; demo?: boolean };
};

type RazorpayCheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (response: RazorpayCheckoutResponse) => void;
  modal: { ondismiss: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

const emptyAddress: Address = { addressLine: '', city: '', state: '', pinCode: '', country: '' };

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => window.Razorpay
      ? resolve()
      : reject(new Error('Razorpay checkout could not be initialized.'));
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout. Check your internet connection and retry.'));
    document.body.appendChild(script);
  });
}

export default function ProductDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [address, setAddress] = useState<Address>(user?.address || emptyAddress);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) {
      setError('Product not found');
      setLoading(false);
      return;
    }
    setLoading(true);
    api.product(id)
      .then((result) => { if (active) setProduct(result); })
      .catch((loadError: Error) => { if (active) setError(loadError.message || 'Unable to load product.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!user) {
      setAddress(emptyAddress);
      return;
    }
    setAddress(user.address || emptyAddress);
    api.profile()
      .then((result) => setAddress(result.user.address || emptyAddress))
      .catch((profileError: Error) => setError(profileError.message));
  }, [user]);

  useEffect(() => {
    if (loading || !product || window.location.hash !== '#buy') return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('buy')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, product]);

  async function buy(event: FormEvent) {
    event.preventDefault();
    if (!id || submitting) return;
    setError('');
    setMessage('');
    setSubmitting(true);
    let pendingOrderId: string | undefined;
    try {
      const checkout = await api.createPaymentOrder({
        productId: id,
        shippingAddress: { fullName: user?.name, phoneNumber: user?.phoneNumber, ...address }
      });
      pendingOrderId = checkout.orderId;
      await loadRazorpayCheckout();
      if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable. Please retry.');

      let paymentSubmitted = false;
      const payment = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: 'EcoSwap',
        description: checkout.productName,
        order_id: checkout.paymentOrderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phoneNumber || ''
        },
        theme: { color: '#087e6b' },
        handler: (response) => {
          paymentSubmitted = true;
          setSubmitting(true);
          void api.verifyPayment({
            orderId: checkout.orderId,
            paymentOrderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature
          })
            .then(() => {
              setProduct((current) => current ? { ...current, status: 'Sold' } : current);
              setMessage('Payment successful. Your order is confirmed.');
            })
            .catch((verifyError: Error) => setError(verifyError.message || 'Payment was received but could not be confirmed yet. Please retry or contact support.'))
            .finally(() => setSubmitting(false));
        },
        modal: {
          ondismiss: () => {
            if (!paymentSubmitted) {
              void api.cancelPayment({ orderId: checkout.orderId })
                .catch((cancelError: Error) => setError(cancelError.message || 'Could not close the pending checkout. Please contact support.'));
            }
          }
        }
      });
      payment.open();
    } catch (submitError) {
      const failureMessage = submitError instanceof Error ? submitError.message : 'Unable to start payment checkout.';
      if (pendingOrderId) {
        try {
          await api.cancelPayment({ orderId: pendingOrderId });
        } catch (cancelError) {
          const cancelMessage = cancelError instanceof Error ? cancelError.message : 'Unable to release the reserved listing.';
          setError(`${failureMessage} ${cancelMessage}`);
          return;
        }
      }
      setError(failureMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function requestSwap() {
    if (!product) return;
    setError('');
    setMessage('');
    try {
      await api.requests({ type: 'exchange', product: product.id, requestedItem: product.name, message: `Swap request for ${product.name}` });
      setMessage('Exchange request submitted.');
    } catch (swapError) {
      setError(swapError instanceof Error ? swapError.message : 'Unable to submit exchange request.');
    }
  }

  function updateAddress(field: keyof Address, value: string) {
    setAddress((current) => ({ ...current, [field]: value }));
  }

  if (loading) return <section className="section"><p role="status">Loading product...</p></section>;
  if (!product) return <section className="section"><p className="error" role="alert">{error || 'Product not found'}</p><Link to="/marketplace">Back to Browse</Link></section>;

  const price = `₹${Number(product.price).toLocaleString('en-IN')}`;
  const available = !product.status || product.status.toLowerCase() === 'available';
  const isSeller = user?.id === product.seller?.id;

  return (
    <section className="section checkout">
      <Link to="/marketplace">← Back to Browse</Link>
      <h1>{product.name}</h1>
      {product.is_demo && <p className="demo-listing-badge">Seeded demo listing</p>}
      <ImageFrame src={product.image} alt={product.name} className="product-detail-image" />
      <h2>{price}</h2>
      <p><b>Category:</b> {product.category}</p>
      <p><b>Size:</b> {product.size}</p>
      <p><b>Condition:</b> {product.condition}</p>
      <p><b>Brand:</b> {product.brand || 'Not specified'}</p>
      <p><b>Description:</b> {product.description}</p>
      <p><b>Seller:</b> {product.seller?.name || 'Seller details unavailable'}{product.seller?.email ? ` · ${product.seller.email}` : ''}</p>
      <p><b>Availability:</b> {product.status || 'Available'}</p>
      {product.aiAnalysis?.recommendation && (
        <div className="analysis-result">
          <b>AI recommendation: {product.aiAnalysis.recommendation}</b>
          {product.aiAnalysis.confidence !== undefined && <span> · {Math.round(product.aiAnalysis.confidence * 100)}% confidence</span>}
          {product.aiAnalysis.reason && <p>{product.aiAnalysis.reason}</p>}
          {product.aiAnalysis.demo && <small>Demo analysis</small>}
        </div>
      )}

      {available && isSeller && <p>This is your listing.</p>}
      {available && !isSeller && (
        <div id="buy" className="purchase-section">
          {user
            ? <button type="button" onClick={requestSwap}>Request Exchange</button>
            : <p><Link to="/login" state={{ from: `/product/${id}#buy` }}>Sign in</Link> to request an exchange.</p>}
          <h2>Buy this item</h2>
          {!user
            ? <p><Link to="/login" state={{ from: `/product/${id}#buy` }}>Sign in</Link> to submit an order request.</p>
            : (
              <form onSubmit={buy}>
                <h3>Delivery address</h3>
                <p><b>{user.name}</b><br />{user.phoneNumber}</p>
                {editing ? (
                  <>
                    <input placeholder="Address Line" value={address.addressLine} onChange={(event) => updateAddress('addressLine', event.target.value)} required />
                    <div className="address-grid">
                      <input placeholder="City" value={address.city} onChange={(event) => updateAddress('city', event.target.value)} required />
                      <input placeholder="State" value={address.state} onChange={(event) => updateAddress('state', event.target.value)} required />
                      <input placeholder="PIN Code" value={address.pinCode} onChange={(event) => updateAddress('pinCode', event.target.value)} required />
                      <input placeholder="Country" value={address.country} onChange={(event) => updateAddress('country', event.target.value)} required />
                    </div>
                    <button type="button" onClick={() => setEditing(false)}>Use this address</button>
                  </>
                ) : (
                  <p>{address.addressLine}<br />{address.city}, {address.state} - {address.pinCode}<br />{address.country}</p>
                )}
                <button type="button" onClick={() => setEditing((current) => !current)}>Change Address</button>
                <button className="darkbtn" disabled={submitting}>{submitting ? 'Opening secure checkout…' : `Pay with Google Pay / UPI · ${price}`}</button>
                <small>Razorpay securely offers Google Pay and other available payment methods at checkout.</small>
              </form>
            )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="secondary-action" onClick={() => navigate('/marketplace')}>Back to Browse</button>
    </section>
  );
}
