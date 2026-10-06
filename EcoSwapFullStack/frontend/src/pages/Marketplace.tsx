import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import ImageFrame from '../components/ImageFrame';
import './Marketplace.css';

const categories = [
  "Women's Wear",
  "Men's Wear",
  'Kids Wear',
  'Footwear',
  'Accessories',
  'Traditional Wear',
  'Winter Wear',
  'Sports Wear'
];

type Product = {
  id?: string;
  _id?: string;
  name: string;
  price: number;
  category: string;
  size: string;
  condition: string;
  brand?: string;
  description?: string;
  image?: string;
  status?: string;
  is_demo?: boolean;
};

const formatPrice = (price: number) => `₹${Number(price).toLocaleString('en-IN')}`;

export default function Marketplace() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const [items, setItems] = useState<Product[]>([]);
  const [query, setQuery] = useState(params.get('q') || '');
  const [condition, setCondition] = useState(params.get('condition') || '');
  const [size, setSize] = useState(params.get('size') || '');
  const [min, setMin] = useState(params.get('min') || '');
  const [max, setMax] = useState(params.get('max') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.products()
      .then((products) => {
        if (active) setItems(products);
      })
      .catch((loadError: Error) => {
        if (active) setError(loadError.message || 'Unable to load products. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setQuery(params.get('q') || '');
    setCondition(params.get('condition') || '');
    setSize(params.get('size') || '');
    setMin(params.get('min') || '');
    setMax(params.get('max') || '');
  }, [params]);

  const shown = useMemo(() => items.filter((product) => {
    const searchFields = `${product.name || ''} ${product.brand || ''} ${product.description || ''} ${product.category || ''} ${product.size || ''} ${product.condition || ''}`.toLowerCase();
    return (!category || product.category === category) &&
      (!condition || product.condition?.toLowerCase() === condition.toLowerCase()) &&
      (!size || product.size?.toLowerCase() === size.toLowerCase()) &&
      (!min || Number(product.price) >= Number(min)) &&
      (!max || Number(product.price) <= Number(max)) &&
      searchFields.includes(query.toLowerCase());
  }), [items, category, condition, size, min, max, query]);

  function updateParams(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  }

  const heading = category || 'Find your next favorite piece.';
  const subtitle = category
    ? `Pre-loved ${category.toLowerCase()} from the EcoSwap community.`
    : 'Discover pre-loved clothing from our community.';

  return (
    <section className="section">
      <h1>{heading}</h1>
      <p>{subtitle}</p>
      <div className="market-filters">
        <select value={category || 'All Categories'} onChange={(event) => updateParams({ category: event.target.value === 'All Categories' ? '' : event.target.value })}>
          <option>All Categories</option>
          {categories.map((value) => <option key={value}>{value}</option>)}
        </select>
        <input aria-label="Minimum price" placeholder="Min ₹" type="number" min="0" value={min} onChange={(event) => updateParams({ min: event.target.value })} />
        <input aria-label="Maximum price" placeholder="Max ₹" type="number" min="0" value={max} onChange={(event) => updateParams({ max: event.target.value })} />
        <select value={condition} onChange={(event) => updateParams({ condition: event.target.value })}>
          <option value="">All Conditions</option>
          {['New', 'Excellent', 'Good', 'Very Good', 'Used', 'Damaged', 'Torn', 'Heavily Used'].map((value) => <option key={value}>{value}</option>)}
        </select>
        <input className="search" placeholder="Search clothes, brands, sizes..." value={query} onChange={(event) => updateParams({ q: event.target.value })} />
        <input aria-label="Size" placeholder="Size" value={size} onChange={(event) => updateParams({ size: event.target.value })} />
      </div>

      {loading && <p role="status">Loading products...</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!loading && !error && items.length === 0 && <p>No products available yet.</p>}
      {!loading && !error && items.length > 0 && shown.length === 0 && <p>No products match this category and search.</p>}

      <div className="grid">
        {shown.map((product) => {
          const id = product.id || product._id;
          if (!id) return null;
          const available = !product.status || product.status.toLowerCase() === 'available';
          return (
            <article className="card" key={id}>
              <Link to={`/product/${id}`} className="card-content-link">
                <ImageFrame src={product.image} alt={product.name} className="product-card-image" />
                <div>
                  <small>{product.brand || product.category} · {product.condition}</small>
                  <h3>{product.name}</h3>
                  {product.is_demo && <small className="demo-listing-badge">Seeded demo listing</small>}
                  <b>{formatPrice(product.price)}</b>
                  <span>Size {product.size}</span>
                  <p>{product.category} · {product.status || 'Available'}</p>
                </div>
              </Link>
              <div className="card-actions">
                <Link className="buy-link" to={`/product/${id}#buy`}>{available ? 'Buy now' : 'View item'} →</Link>
                <Link className="view-details" to={`/product/${id}`}>View details</Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
