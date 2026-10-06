import { ChangeEvent, FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const categories = ["Women's Wear", "Men's Wear", 'Kids Wear', 'Footwear', 'Accessories', 'Traditional Wear', 'Winter Wear', 'Sports Wear'];
type Listing = { name: string; category: string; brand: string; size: string; condition: string; price: string; description: string; image: string };

const initialListing: Listing = {
  name: '',
  category: "Women's Wear",
  brand: '',
  size: 'M',
  condition: 'Good',
  price: '',
  description: '',
  image: ''
};

export default function Sell() {
  const [form, setForm] = useState<Listing>(initialListing);
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage('');
    setError('');
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      event.target.value = '';
      return;
    }
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const result = await api.upload(file);
      setForm((current) => ({ ...current, image: result.imageUrl }));
      setMessage('Image uploaded.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload image.');
      setForm((current) => ({ ...current, image: '' }));
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting || uploading) return;
    setMessage('');
    setError('');
    if (Number(form.price) <= 0) {
      setError('Price must be greater than 0.');
      return;
    }
    if (!form.brand.trim() || !form.description.trim()) {
      setError('Brand and description are required.');
      return;
    }
    if (!form.image) {
      setError('Upload a product image before creating the listing.');
      return;
    }

    setSubmitting(true);
    try {
      const analysis = await api.analyze(form.condition, form.category);
      await api.createProduct({ ...form, price: Number(form.price), aiAnalysis: analysis });
      setMessage(analysis.demo
        ? 'Listing created. The saved clothing recommendation is a demo analysis.'
        : 'Listing created successfully.');
      window.setTimeout(() => navigate('/dashboard'), 800);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create listing.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="formpage wide">
      <form onSubmit={submit}>
        <h1>Sell your clothing</h1>
        <p>Add accurate details to help someone give it a second life.</p>
        {message && <p role="status">{message}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <input placeholder="Clothing name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select>
        <input placeholder="Brand" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} required />
        <input placeholder="Size" value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} required />
        <select value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })}>{['New', 'Excellent', 'Good', 'Used', 'Damaged', 'Torn', 'Heavily Used'].map((condition) => <option key={condition}>{condition}</option>)}</select>
        <input type="number" min="0.01" step="0.01" placeholder="Price (₹)" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
        <textarea placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} required />
        {uploading && <p role="status">Uploading image…</p>}
        {preview && <img className="preview" src={preview} alt="Listing image preview" />}
        <button className="darkbtn" disabled={uploading || submitting}>
          {uploading ? 'Uploading…' : submitting ? 'Creating listing…' : 'Create Listing'}
        </button>
      </form>
    </section>
  );
}
