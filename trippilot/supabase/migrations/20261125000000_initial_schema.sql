-- TripPilot initial schema
-- Tables: profiles, trips, trip_members, trip_preferences, itinerary_days,
--         activities, bookings, expenses, saved_places, chat_messages
-- Every table has Row Level Security. Users can access only their own data,
-- plus trips explicitly shared with them through trip_members.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  home_currency text not null default 'USD',
  onboarded boolean not null default false,
  notifications jsonb not null default
    '{"trip_reminders": true, "itinerary_changes": true, "product_updates": false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  destinations text[] not null default '{}',
  start_date date not null,
  end_date date not null,
  travelers integer not null default 1 check (travelers between 1 and 50),
  travel_party text not null default 'couple',
  budget numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  budget_excludes_flights boolean not null default true,
  pace text not null default 'balanced',
  interests text[] not null default '{}',
  description text not null default '',
  special_requests text not null default '',
  cover_image text,
  itinerary_source text check (itinerary_source in ('ai', 'demo', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_dates_valid check (end_date >= start_date)
);

create index trips_user_id_idx on public.trips (user_id, start_date);
create trigger trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

-- Sharing (P2): explicit membership grants access to a trip.
create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'viewer' check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index trip_members_user_idx on public.trip_members (user_id);

-- Access helpers (security definer avoids recursive RLS evaluation).
create or replace function public.can_read_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips t where t.id = p_trip_id and t.user_id = auth.uid()
  ) or exists (
    select 1 from public.trip_members m where m.trip_id = p_trip_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_write_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips t where t.id = p_trip_id and t.user_id = auth.uid()
  ) or exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role = 'editor'
  );
$$;

-- ---------------------------------------------------------------------------
-- trip_preferences
-- One row per user with trip_id null = the traveler's default preferences.
-- Optional rows with trip_id set = per-trip overrides.
-- ---------------------------------------------------------------------------

create table public.trip_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  travel_style text not null default 'balanced',
  budget_range text not null default '3k-6k',
  accommodation text not null default 'boutique-hotel',
  food_preferences text[] not null default '{}',
  activities text[] not null default '{}',
  pace text not null default 'balanced',
  travel_party text not null default 'couple',
  preferred_destinations text[] not null default '{}',
  accessibility_needs text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index trip_preferences_user_default_idx
  on public.trip_preferences (user_id) where trip_id is null;
create unique index trip_preferences_user_trip_idx
  on public.trip_preferences (user_id, trip_id) where trip_id is not null;
create trigger trip_preferences_updated_at before update on public.trip_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- itinerary_days & activities
-- ---------------------------------------------------------------------------

create table public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_number integer not null,
  date date not null,
  title text not null default '',
  summary text not null default '',
  city text not null default '',
  morning_summary text not null default '',
  afternoon_summary text not null default '',
  evening_summary text not null default '',
  transport_notes text not null default '',
  notes text not null default '',
  estimated_cost numeric(12, 2),
  source text not null default 'ai' check (source in ('ai', 'demo', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index itinerary_days_trip_idx on public.itinerary_days (trip_id, day_number);
create trigger itinerary_days_updated_at before update on public.itinerary_days
  for each row execute function public.set_updated_at();

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.itinerary_days (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  description text not null default '',
  category text not null default 'other',
  is_restaurant boolean not null default false,
  slot text not null default 'afternoon' check (slot in ('morning', 'afternoon', 'evening')),
  suggested_time text,
  duration_minutes integer,
  estimated_cost numeric(12, 2),
  address text,
  latitude double precision,
  longitude double precision,
  booking_url text,
  notes text not null default '',
  completed boolean not null default false,
  sort_order integer not null default 0,
  source text not null default 'ai' check (source in ('ai', 'demo', 'user')),
  user_modified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activities_day_idx on public.activities (day_id, sort_order);
create index activities_trip_idx on public.activities (trip_id);
create trigger activities_updated_at before update on public.activities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  type text not null default 'other'
    check (type in ('flight', 'hotel', 'restaurant', 'activity', 'transport', 'car_rental', 'other')),
  name text not null,
  confirmation_number text not null default '',
  date date,
  time text,
  end_date date,
  address text not null default '',
  booking_url text not null default '',
  cost numeric(12, 2),
  notes text not null default '',
  documents jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_trip_idx on public.bookings (trip_id, date);
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  description text not null,
  category text not null default 'other'
    check (category in ('accommodation', 'food', 'activities', 'transport', 'shopping', 'flights', 'other')),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'USD',
  date date not null default current_date,
  is_planned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_trip_idx on public.expenses (trip_id, date);
create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- saved_places
-- ---------------------------------------------------------------------------

create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  name text not null,
  city text not null default '',
  category text not null default 'other',
  notes text not null default '',
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create index saved_places_user_idx on public.saved_places (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- chat_messages
-- ---------------------------------------------------------------------------

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  proposal jsonb,
  mode text check (mode in ('live', 'demo')),
  created_at timestamptz not null default now()
);

create index chat_messages_trip_idx on public.chat_messages (trip_id, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_preferences enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.activities enable row level security;
alter table public.bookings enable row level security;
alter table public.expenses enable row level security;
alter table public.saved_places enable row level security;
alter table public.chat_messages enable row level security;

-- profiles: own row only
create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- trips: owner has full access; members can read (and editors update)
create policy "trips_select" on public.trips for select using (public.can_read_trip(id));
create policy "trips_insert_own" on public.trips for insert with check (user_id = auth.uid());
create policy "trips_update" on public.trips for update using (public.can_write_trip(id)) with check (public.can_write_trip(id));
create policy "trips_delete_own" on public.trips for delete using (user_id = auth.uid());

-- trip_members: trip owner manages; members can see their own membership
create policy "trip_members_select" on public.trip_members for select
  using (user_id = auth.uid() or exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid()));
create policy "trip_members_owner_write" on public.trip_members for all
  using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid()));

-- trip_preferences: own rows only
create policy "trip_preferences_own" on public.trip_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Trip-scoped child tables: read if you can read the trip, write if you can write it.
create policy "itinerary_days_select" on public.itinerary_days for select using (public.can_read_trip(trip_id));
create policy "itinerary_days_write" on public.itinerary_days for all
  using (public.can_write_trip(trip_id)) with check (public.can_write_trip(trip_id));

create policy "activities_select" on public.activities for select using (public.can_read_trip(trip_id));
create policy "activities_write" on public.activities for all
  using (public.can_write_trip(trip_id)) with check (public.can_write_trip(trip_id));

create policy "bookings_select" on public.bookings for select using (public.can_read_trip(trip_id));
create policy "bookings_write" on public.bookings for all
  using (public.can_write_trip(trip_id)) with check (public.can_write_trip(trip_id));

create policy "expenses_select" on public.expenses for select using (public.can_read_trip(trip_id));
create policy "expenses_write" on public.expenses for all
  using (public.can_write_trip(trip_id)) with check (public.can_write_trip(trip_id));

-- Chat is private to each traveler, even on shared trips.
create policy "chat_messages_own" on public.chat_messages for all
  using (user_id = auth.uid() and public.can_read_trip(trip_id))
  with check (user_id = auth.uid() and public.can_read_trip(trip_id));

create policy "saved_places_own" on public.saved_places for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for booking documents, files stored under
-- "<user_id>/<trip_id>/<booking_id>/<filename>".
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('booking-documents', 'booking-documents', false, 10485760)
on conflict (id) do nothing;

create policy "booking_documents_select_own" on storage.objects for select
  using (bucket_id = 'booking-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "booking_documents_insert_own" on storage.objects for insert
  with check (bucket_id = 'booking-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "booking_documents_delete_own" on storage.objects for delete
  using (bucket_id = 'booking-documents' and (storage.foldername(name))[1] = auth.uid()::text);
