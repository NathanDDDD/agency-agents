-- AI usage ledger + per-user quota.
-- Every live AI request consumes "credits" (units) through consume_ai_quota(),
-- which checks a rolling 24h limit and a 10-minute burst limit atomically.
-- Rows can only be written through these functions (no insert/update/delete
-- policies), so travelers can't reset their own usage.

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('plan', 'regenerate_day', 'regenerate_activity', 'chat')),
  units integer not null check (units > 0),
  model text,
  status text not null default 'started' check (status in ('started', 'succeeded', 'failed')),
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

-- Travelers may read their own usage (for the "credits left today" display).
create policy "ai_usage_select_own" on public.ai_usage for select using (user_id = auth.uid());

create or replace function public.consume_ai_quota(
  p_kind text,
  p_units integer,
  p_daily_limit integer,
  p_burst_limit integer,
  p_model text default null
)
returns table (allowed boolean, usage_id uuid, used_today integer, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_used integer;
  v_recent integer;
  v_id uuid;
begin
  if v_uid is null then
    return query select false, null::uuid, 0, 'unauthenticated'::text;
    return;
  end if;

  -- Serialize concurrent requests from the same user.
  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  select coalesce(sum(u.units), 0)::integer into v_used
  from public.ai_usage u
  where u.user_id = v_uid and u.created_at > now() - interval '24 hours';

  select count(*)::integer into v_recent
  from public.ai_usage u
  where u.user_id = v_uid and u.created_at > now() - interval '10 minutes';

  if v_recent >= p_burst_limit then
    return query select false, null::uuid, v_used, 'burst'::text;
    return;
  end if;

  if v_used + p_units > p_daily_limit then
    return query select false, null::uuid, v_used, 'daily'::text;
    return;
  end if;

  insert into public.ai_usage (user_id, kind, units, model)
  values (v_uid, p_kind, p_units, p_model)
  returning id into v_id;

  return query select true, v_id, v_used + p_units, null::text;
end;
$$;

-- Records the outcome and token counts. Does not refund credits, so it can't
-- be used to reset a quota.
create or replace function public.finish_ai_usage(
  p_usage_id uuid,
  p_status text,
  p_input_tokens integer,
  p_output_tokens integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_usage
  set status = case when p_status in ('succeeded', 'failed') then p_status else status end,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      finished_at = now()
  where id = p_usage_id and user_id = auth.uid();
$$;

revoke all on function public.consume_ai_quota(text, integer, integer, integer, text) from public, anon;
revoke all on function public.finish_ai_usage(uuid, text, integer, integer) from public, anon;
grant execute on function public.consume_ai_quota(text, integer, integer, integer, text) to authenticated;
grant execute on function public.finish_ai_usage(uuid, text, integer, integer) to authenticated;
