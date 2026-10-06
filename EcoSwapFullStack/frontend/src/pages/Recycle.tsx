import { ChangeEvent, FormEvent, useState } from 'react';
import { api } from '../services/api';

export default function Recycle() {
  const [form, setForm] = useState({ itemName: '', material: '', condition: 'Damaged', description: '', address: '', pickupDate: '' });
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const imageUrl = image ? (await api.upload(image)).imageUrl : undefined;
      await api.requests({ type: 'recycle', ...form, image: imageUrl });
      setMessage('Recycling request submitted successfully.');
      setForm({ itemName: '', material: '', condition: 'Damaged', description: '', address: '', pickupDate: '' });
      setImage(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit recycling request.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="formpage wide">
      <form onSubmit={submit}>
        <h1>Recycle clothing</h1>
        <p>For textiles that are no longer suitable for reuse.</p>
        {message && <p role="status">{message}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <input placeholder="Clothing name" value={form.itemName} onChange={(event) => setForm({ ...form, itemName: event.target.value })} required />
        <input placeholder="Material type (e.g. cotton, polyester)" value={form.material} onChange={(event) => setForm({ ...form, material: event.target.value })} required />
        <select value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })}>{['Damaged', 'Torn', 'Heavily Used', 'Used'].map((value) => <option key={value}>{value}</option>)}</select>
        <textarea placeholder="Clothing description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
        <input placeholder="Pickup address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} required />
        <input type="date" value={form.pickupDate} onChange={(event) => setForm({ ...form, pickupDate: event.target.value })} required />
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} />
        {image && <small>{image.name}</small>}
        <button className="darkbtn" disabled={loading}>{loading ? 'Submitting…' : 'Submit Recycling Request'}</button>
      </form>
    </section>
  );
}
