create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  "phoneNumber" text,
  address jsonb not null default '{}'::jsonb,
  password text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_email_lower_idx on public.users (lower(email));

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  price numeric(10,2) not null check (price > 0),
  category text not null,
  condition text not null,
  size text not null,
  brand text not null,
  image text not null,
  seller uuid not null references public.users (id) on delete cascade,
  status text not null default 'Available',
  is_demo boolean not null default false,
  "aiAnalysis" jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products add column if not exists is_demo boolean not null default false;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer uuid not null references public.users (id) on delete cascade,
  product uuid not null references public.products (id) on delete cascade,
  "shippingAddress" jsonb not null,
  status text not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  "user" uuid references public.users (id) on delete set null,
  type text not null check (type in ('donation', 'recycle', 'exchange')),
  "itemName" text,
  category text,
  image text,
  condition text,
  material text,
  description text,
  address text,
  "pickupDate" date,
  product uuid references public.products (id) on delete set null,
  "requestedItem" text,
  message text,
  status text not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.requests add column if not exists category text;

alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.requests enable row level security;

create index if not exists products_seller_idx on public.products (seller);
create index if not exists products_category_status_idx on public.products (category, status);
create index if not exists products_created_at_idx on public.products (created_at desc);
create index if not exists orders_buyer_created_at_idx on public.orders (buyer, created_at desc);
create index if not exists orders_product_idx on public.orders (product);
create index if not exists requests_user_created_at_idx on public.requests ("user", created_at desc);
create index if not exists requests_type_status_idx on public.requests (type, status);

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at before update on public.users
for each row execute function public.update_updated_at_column();

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
for each row execute function public.update_updated_at_column();

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
for each row execute function public.update_updated_at_column();

drop trigger if exists requests_updated_at on public.requests;
create trigger requests_updated_at before update on public.requests
for each row execute function public.update_updated_at_column();

create or replace function public.create_pending_order(
  buyer_id uuid,
  product_id uuid,
  shipping_address jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  reserved_product_id uuid;
  created_order public.orders;
begin
  update public.products
  set status = 'Reserved'
  where id = product_id
    and seller <> buyer_id
    and status = 'Available'
  returning id into reserved_product_id;

  if reserved_product_id is null then
    raise exception 'Product is no longer available' using errcode = 'P0001';
  end if;

  insert into public.orders (buyer, product, "shippingAddress", status)
  values (buyer_id, product_id, shipping_address, 'Pending')
  returning * into created_order;

  return created_order;
end;
$$;

revoke all on function public.create_pending_order(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_pending_order(uuid, uuid, jsonb) to service_role;
