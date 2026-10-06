insert into public.users (
  id, name, email, "phoneNumber", address, password, role
) values (
  '10000000-0000-4000-8000-000000000001',
  'EcoSwap Demo Seller',
  'demo-seller@example.invalid',
  '+1-555-0100',
  '{"addressLine":"42 Sample Lane","city":"Greenville","state":"CA","pinCode":"90000","country":"USA"}'::jsonb,
  '$2b$10$weGoLMGkx19T45fZZXSVmuDZiZjwlPXD0lm0mIRXhc7wCk4aYPNHy',
  'user'
)
on conflict do nothing;

insert into public.products (
  id, name, description, price, category, condition, size, brand, image, seller, status, is_demo
) values
  (
    '20000000-0000-4000-8000-000000000001',
    'Floral Midi Dress',
    'Lightweight floral dress in excellent condition, ideal for spring and summer.',
    28.00, 'Women''s Wear', 'Excellent', 'M', 'Willow & Thread',
    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=900&q=80',
    '10000000-0000-4000-8000-000000000001', 'Available', true
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Classic Cotton T-Shirt',
    'Soft everyday cotton tee with plenty of life left; freshly washed.',
    12.00, 'Men''s Wear', 'Good', 'L', 'North Loop',
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
    '10000000-0000-4000-8000-000000000001', 'Available', true
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'Straight-Leg Denim Jeans',
    'Timeless mid-wash jeans with a relaxed straight fit and no visible damage.',
    24.00, 'Women''s Wear', 'Good', '28', 'Everdenim',
    'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80',
    '10000000-0000-4000-8000-000000000001', 'Available', true
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'Everyday Canvas Jacket',
    'A versatile light jacket with sturdy buttons and gently worn-in fabric.',
    36.00, 'Winter Wear', 'Very Good', 'M', 'Fieldwork',
    'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=80',
    '10000000-0000-4000-8000-000000000001', 'Available', true
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    'Handwoven Festive Kurta',
    'Traditional woven kurta in a deep blue shade, carefully stored and well kept.',
    32.00, 'Traditional Wear', 'Excellent', 'L', 'Indigo Loom',
    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=80',
    '10000000-0000-4000-8000-000000000001', 'Available', true
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    'Linen Button-Down Shirt',
    'Breathable long-sleeve shirt in a neutral color, suitable for work or weekends.',
    20.00, 'Men''s Wear', 'Very Good', 'M', 'Harbor & Pine',
    'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=80',
    '10000000-0000-4000-8000-000000000001', 'Available', true
  )
on conflict do nothing;
