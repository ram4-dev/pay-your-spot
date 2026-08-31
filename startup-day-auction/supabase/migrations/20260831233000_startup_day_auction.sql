create table if not exists public.spots (
  id text primary key,
  placement text not null,
  description text not null,
  size_label text not null,
  tier text not null,
  tone text not null,
  starting_amount_cents bigint not null check (starting_amount_cents > 0),
  increment_amount_cents bigint not null check (increment_amount_cents > 0),
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','ACTIVE','RESERVED')),
  started_at timestamptz,
  ends_at timestamptz,
  reserved_at timestamptz,
  leading_bid_id uuid,
  auction_round integer not null default 0,
  sort_order integer not null unique
);

create table if not exists public.bids (
  id uuid primary key,
  spot_id text not null references public.spots(id),
  bidder_company text not null,
  bidder_email text not null,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null check (status in ('LEADING','OUTBID','RESERVED','CONTACTED','FAILED')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  contacted_at timestamptz,
  bidder_logo bytea,
  logo_mime_type text check (logo_mime_type in ('image/png','image/jpeg'))
);

create index if not exists bids_spot_status_idx on public.bids(spot_id,status);
create index if not exists bids_email_idx on public.bids(bidder_email);
create index if not exists spots_status_ends_idx on public.spots(status,ends_at);

alter table public.spots enable row level security;
alter table public.bids enable row level security;
revoke all on table public.spots from anon, authenticated;
revoke all on table public.bids from anon, authenticated;

insert into public.spots(id,placement,description,size_label,tier,tone,starting_amount_cents,increment_amount_cents,sort_order) values
  ('top-band','Franja superior','Máxima visibilidad sobre el acceso principal.','2,4 m × 0,6 m','Premium','charcoal',500000,100000,1),
  ('side-a','Bloque lateral A','Plano completo a la izquierda del centro visual.','1,2 m × 1,2 m','Estándar','indigo',500000,100000,2),
  ('access','Marco de acceso','Contacto directo con cada persona que entra al stand.','1,2 m × 0,6 m','Estándar','brick',500000,100000,3),
  ('right-band','Franja derecha','Presencia lateral junto al flujo principal.','1,2 m × 0,6 m','Estándar','rose',500000,100000,4),
  ('center-a','Centro A','Ubicación compacta dentro del foco central.','0,8 m × 0,8 m','Compacto','blue',500000,100000,5),
  ('center-b','Centro B','Ubicación compacta junto al foco central.','0,8 m × 0,8 m','Compacto','violet',500000,100000,6),
  ('lower-a','Franja inferior A','Formato horizontal en la base del cartel.','0,8 m × 0,6 m','Compacto','green',500000,100000,7),
  ('lower-b','Franja inferior B','Formato horizontal en la base del cartel.','0,8 m × 0,6 m','Compacto','yellow',500000,100000,8),
  ('side-b','Bloque lateral B','Bloque cuadrado sobre el lateral derecho.','0,8 m × 0,8 m','Compacto','sand',500000,100000,9),
  ('corner-a','Esquina superior','Presencia compacta en el recorrido superior.','0,6 m × 0,6 m','Compacto','slate',500000,100000,10),
  ('corner-b','Esquina inferior','Presencia compacta en el recorrido inferior.','0,6 m × 0,6 m','Compacto','orange',500000,100000,11),
  ('new-spot','Módulo emergente','El punto de entrada para una marca nueva.','0,6 m × 0,6 m','Compacto','open',500000,100000,12)
on conflict (id) do update set
  placement=excluded.placement,
  description=excluded.description,
  size_label=excluded.size_label,
  tier=excluded.tier,
  tone=excluded.tone,
  starting_amount_cents=excluded.starting_amount_cents,
  increment_amount_cents=excluded.increment_amount_cents,
  sort_order=excluded.sort_order;
