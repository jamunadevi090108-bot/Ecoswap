import { ChangeEvent, FormEvent, useState } from 'react';
import { api } from '../services/api';

const categories = ["Women's Wear", "Men's Wear", 'Kids Wear', 'Footwear', 'Accessories', 'Traditional Wear', 'Winter Wear', 'Sports Wear'];

export default function Donate() {
  const [form, setForm] = useState({ itemName: '', category: "Women's Wear", condition: 'Good', description: '', address: '', pickupDate: '' });
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (file && file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      event.target.value = '';
      return;
    }
    setError('');
    setImage(file);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const imageUrl = image ? (await api.upload(image)).imageUrl : undefined;
      await api.requests({ type: 'donation', ...form, image: imageUrl });
      setMessage('Donation request submitted successfully.');
      setForm({ itemName: '', category: "Women's Wear", condition: 'Good', description: '', address: '', pickupDate: '' });
      setImage(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit donation request.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="formpage wide">
      <form onSubmit={submit}>
        <h1>Donate clothing</h1>
        <p>Give your pre-loved clothes another life.</p>
        {message && <p role="status">{message}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <input placeholder="Clothing name" value={form.itemName} onChange={(event) => update('itemName', event.target.value)} required />
        <select value={form.category} onChange={(event) => update('category', event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={form.condition} onChange={(event) => update('condition', event.target.value)}>{['New', 'Excellent', 'Good', 'Used', 'Damaged'].map((value) => <option key={value}>{value}</option>)}</select>
        <textarea placeholder="Description" value={form.description} onChange={(event) => update('description', event.target.value)} required />
        <input placeholder="Pickup address" value={form.address} onChange={(event) => update('address', event.target.value)} required />
        <input type="date" value={form.pickupDate} onChange={(event) => update('pickupDate', event.target.value)} required />
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} />
        {image && <small>{image.name}</small>}
        <button className="darkbtn" disabled={loading}>{loading ? 'Submitting…' : 'Submit Donation'}</button>
      </form>
    </section>
  );
}
