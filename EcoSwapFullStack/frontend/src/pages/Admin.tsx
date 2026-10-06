import { useEffect, useState } from 'react';
import { api } from '../services/api';

type Product = { id?: string; _id?: string; name: string; seller?: { name: string } | null };
type Order = { id?: string; _id?: string; status: string; buyer?: { name: string } | null; product?: { name: string } | null };
type User = { id: string; name: string; email: string; role: string };
type RequestRow = { id?: string; _id?: string; type: string; itemName?: string; status: string; user?: { name: string } | null };

export default function Admin() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([api.stats(), api.adminProducts(), api.adminOrders(), api.users(), api.adminRequests()])
      .then(([nextStats, nextProducts, nextOrders, nextUsers, nextRequests]) => {
        if (!active) return;
        setStats(nextStats);
        setItems(nextProducts);
        setOrders(nextOrders);
        setUsers(nextUsers);
        setRequests(nextRequests);
      })
      .catch((loadError: Error) => {
        if (active) setError(loadError.message || 'Unable to load admin data.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function remove(id: string) {
    if (!confirm('Remove this listing?')) return;
    setError('');
    try {
      await api.removeProduct(id);
      setItems((current) => current.filter((product) => (product.id || product._id) !== id));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove listing.');
    }
  }

  async function updateRequest(id: string, status: string) {
    setError('');
    try {
      const updated = await api.updateAdminRequest(id, status);
      setRequests((current) => current.map((request) => (request.id || request._id) === id ? { ...request, status: updated.status } : request));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update request.');
    }
  }

  const stat = (key: string) => stats ? stats[key] ?? 0 : '—';
  return (
    <section className="section">
      <h1>Admin Dashboard</h1>
      {loading && <p role="status">Loading admin data...</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="stats">
        <div>Users<br /><b>{stat('users')}</b></div>
        <div>Listings<br /><b>{stat('listings')}</b></div>
        <div>Donations<br /><b>{stat('donations')}</b></div>
        <div>Recycling<br /><b>{stat('recycling')}</b></div>
        <div>Exchanges<br /><b>{stat('exchanges')}</b></div>
      </div>
      <h2>Users</h2>
      {!loading && !error && users.length === 0 && <p>No registered users.</p>}
      {users.map((user) => <div className="adminrow" key={user.id}><span>{user.name} · {user.email}</span><b>{user.role}</b></div>)}
      <h2>Listings</h2>
      {!loading && !error && items.length === 0 && <p>No listings to moderate.</p>}
      {items.map((product) => {
        const id = product.id || product._id;
        return <div className="adminrow" key={id}>
          <span>{product.name} · {product.seller?.name || 'Seller unavailable'}</span>
          {id && <button onClick={() => remove(id)}>Remove</button>}
        </div>;
      })}
      <h2>Orders</h2>
      {!loading && !error && orders.length === 0 && <p>No order requests yet.</p>}
      {orders.map((order) => <p key={order.id || order._id}>
        {order.product?.name || 'Product unavailable'} · buyer {order.buyer?.name || 'unavailable'} · {order.status}
      </p>)}
      <h2>Donation, recycling, and exchange requests</h2>
      {!loading && !error && requests.length === 0 && <p>No requests yet.</p>}
      {requests.map((request) => {
        const id = request.id || request._id;
        return <div className="adminrow" key={id}>
          <span>{request.type} · {request.itemName || 'Exchange'} · {request.user?.name || 'User unavailable'} · {request.status}</span>
          {id && <select aria-label={`Update ${request.type} request status`} value={request.status} onChange={(event) => updateRequest(id, event.target.value)}>
            {['Pending', 'Approved', 'Completed', 'Rejected'].map((status) => <option key={status}>{status}</option>)}
          </select>}
        </div>;
      })}
    </section>
  );
}
