import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import ImageFrame from '../components/ImageFrame';

type Product = {
  id?: string;
  _id?: string;
  name: string;
  image: string;
  category: string;
  condition: string;
  price: number;
  size: string;
  status?: string;
  is_demo?: boolean;
  aiAnalysis?: { recommendation?: string; demo?: boolean };
};

type Request = { type: string; status?: string };
type Order = { id?: string; _id?: string; status: string; product?: { name: string; image: string; price: number } | null };

export default function Dashboard() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([api.myProducts(), api.myRequests(), api.orders()])
      .then(([myProducts, myRequests, myOrders]) => {
        if (!active) return;
        setProducts(myProducts);
        setRequests(myRequests);
        setOrders(myOrders);
      })
      .catch((loadError: Error) => {
        if (active) setError(loadError.message || 'Unable to load your dashboard.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const count = (type: string) => requests.filter((request) => request.type === type).length;
  return (
    <section className="section">
      <h1>Welcome, {user?.name || 'EcoSwap member'}</h1>
      <p>{user?.email} · {user?.role || 'user'}</p>
      <p>Your EcoSwap activity in one place.</p>
      <Link className="darkbtn dashboard-sell-link" to="/sell">+ Sell / Add Product</Link>
      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p role="status">Loading your dashboard...</p>}
      {!loading && !error && (
        <>
          <div className="stats">
            <div>My Listings<br /><b>{products.length}</b></div>
            <div>Donations<br /><b>{count('donation')}</b></div>
            <div>Recycling<br /><b>{count('recycle')}</b></div>
            <div>Exchange Requests<br /><b>{count('exchange')}</b></div>
          </div>

          <h2>My Listings</h2>
          {products.length === 0
            ? <p>You haven’t listed any products yet. <Link to="/sell">Add your first listing</Link>.</p>
            : (
              <div className="grid">
                {products.map((product) => {
                  const id = product.id || product._id;
                  return (
                    <Link className="card" key={id} to={id ? `/product/${id}` : '/sell'}>
                      <ImageFrame src={product.image} alt={product.name} className="product-card-image" />
                      <div>
                        <small>{product.category} · {product.condition}</small>
                        <h3>{product.name}</h3>
                        {product.is_demo && <small className="demo-listing-badge">Seeded demo listing</small>}
                        <b>₹{Number(product.price).toLocaleString('en-IN')}</b>
                        <span>Size {product.size}</span>
                        <p>Status: {product.status || 'Available'}</p>
                        {product.aiAnalysis?.recommendation && <small>AI suggestion: {product.aiAnalysis.recommendation}{product.aiAnalysis.demo ? ' · Demo' : ''}</small>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

          <h2>My Orders</h2>
          {orders.length === 0
            ? <p>No order requests yet.</p>
            : orders.map((order) => <p key={order.id || order._id}>{order.product?.name || 'Listing'} · {order.status}</p>)}

          <h2>My Requests</h2>
          {requests.length === 0
            ? <p>No donation, recycling, or exchange requests yet.</p>
            : requests.map((request, index) => <p key={`${request.type}-${index}`}>{request.type} · {request.status || 'Pending'}</p>)}
        </>
      )}
    </section>
  );
}
