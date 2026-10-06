alter table public.orders
  add column if not exists payment_provider text,
  add column if not exists payment_order_id text,
  add column if not exists payment_id text,
  add column if not exists payment_amount integer,
  add column if not exists payment_currency text;

create unique index if not exists orders_payment_order_id_unique_idx
  on public.orders (payment_order_id)
  where payment_order_id is not null;

create unique index if not exists orders_payment_id_unique_idx
  on public.orders (payment_id)
  where payment_id is not null;

create or replace function public.create_payment_order(
  p_buyer_id uuid,
  p_product_id uuid,
  p_shipping_address jsonb,
  p_gateway_order_id text,
  p_amount integer
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
  if p_amount <= 0 or nullif(trim(p_gateway_order_id), '') is null then
    raise exception 'Invalid payment order details' using errcode = '22023';
  end if;

  update public.products
  set status = 'Reserved'
  where id = p_product_id
    and seller <> p_buyer_id
    and status = 'Available'
    and round(price * 100)::integer = p_amount
  returning id into reserved_product_id;

  if reserved_product_id is null then
    raise exception 'Product is no longer available or its price changed' using errcode = 'P0001';
  end if;

  insert into public.orders (
    buyer, product, "shippingAddress", status, payment_provider,
    payment_order_id, payment_amount, payment_currency
  )
  values (
    p_buyer_id, p_product_id, p_shipping_address, 'Payment Pending',
    'razorpay', p_gateway_order_id, p_amount, 'INR'
  )
  returning * into created_order;

  return created_order;
end;
$$;

create or replace function public.complete_paid_order(
  p_order_id uuid,
  p_buyer_id uuid,
  p_payment_id text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.orders;
  completed_order public.orders;
  sold_product_id uuid;
begin
  select * into current_order
  from public.orders
  where id = p_order_id and buyer = p_buyer_id
  for update;

  if current_order.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if current_order.status = 'Paid' and current_order.payment_id = p_payment_id then
    return current_order;
  end if;
  if current_order.status <> 'Payment Pending' then
    raise exception 'Order is not awaiting payment' using errcode = 'P0001';
  end if;

  update public.products
  set status = 'Sold'
  where id = current_order.product and status = 'Reserved'
  returning id into sold_product_id;

  if sold_product_id is null then
    raise exception 'Reserved product could not be completed' using errcode = 'P0001';
  end if;

  update public.orders
  set status = 'Paid', payment_id = p_payment_id
  where id = current_order.id
  returning * into completed_order;

  return completed_order;
end;
$$;

create or replace function public.cancel_payment_order(
  p_order_id uuid,
  p_buyer_id uuid
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.orders;
  cancelled_order public.orders;
begin
  select * into current_order
  from public.orders
  where id = p_order_id and buyer = p_buyer_id
  for update;

  if current_order.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if current_order.status <> 'Payment Pending' then
    return current_order;
  end if;

  update public.products
  set status = 'Available'
  where id = current_order.product and status = 'Reserved';

  update public.orders
  set status = 'Cancelled'
  where id = current_order.id
  returning * into cancelled_order;

  return cancelled_order;
end;
$$;

revoke all on function public.create_payment_order(uuid, uuid, jsonb, text, integer) from public, anon, authenticated;
revoke all on function public.complete_paid_order(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.cancel_payment_order(uuid, uuid) from public, anon, authenticated;

grant execute on function public.create_payment_order(uuid, uuid, jsonb, text, integer) to service_role;
grant execute on function public.complete_paid_order(uuid, uuid, text) to service_role;
grant execute on function public.cancel_payment_order(uuid, uuid) to service_role;
