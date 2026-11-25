-- =====================================================================
--  Fraud Analytics games — database schema (Supabase / Postgres)
--  Run this whole file once in Supabase → SQL Editor → New query → Run.
--  It is safe to re-run. It lives alongside the POM games and newsvendor
--  tables (all objects here are prefixed fraud_) and uses the same
--  instructor login.
--
--  Design
--   * One generic data model for every fraud game:
--       fraud_sessions     one class run of one game (game key + params jsonb,
--                          is_open, revealed)
--       fraud_players      one student in a session (nickname + secret token)
--       fraud_submissions  one row per (player, kind): data jsonb (what the
--                          student submitted), label (private truth, e.g.
--                          'real'/'fake'), guess (instructor's guess)
--   * Students never touch tables; they call four functions with the public
--     key. The instructor logs in; RLS shows only the instructor's own
--     sessions. The instructor may update only the `guess` column.
--   * Before a session is revealed, students cannot see the instructor's
--     guess. After reveal, they can no longer change their submission.
-- =====================================================================

create extension if not exists pgcrypto;

create table if not exists public.fraud_sessions (
  id          uuid primary key default gen_random_uuid(),
  game        text not null check (game ~ '^[a-z0-9_-]{2,30}$'),
  code        text not null unique check (code ~ '^[A-Z0-9]{3,12}$'),
  title       text not null default 'Fraud analytics game',
  params      jsonb not null default '{}'::jsonb,
  is_open     boolean not null default true,
  revealed    boolean not null default false,
  revealed_at timestamptz,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.fraud_players (
  id          uuid primary key default gen_random_uuid(),
  token       uuid not null default gen_random_uuid(),
  session_id  uuid not null references public.fraud_sessions(id) on delete cascade,
  nickname    text not null check (char_length(nickname) between 1 and 40),
  user_agent  text,
  joined_at   timestamptz not null default now()
);
create unique index if not exists fraud_players_nick_uq on public.fraud_players (session_id, lower(nickname));

create table if not exists public.fraud_submissions (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.fraud_sessions(id) on delete cascade,
  player_id   uuid not null references public.fraud_players(id) on delete cascade,
  kind        text not null default 'main' check (kind ~ '^[a-z0-9_]{1,30}$'),
  data        jsonb not null default '{}'::jsonb,
  label       text check (char_length(label) <= 40),
  guess       text check (char_length(guess) <= 40),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (player_id, kind)
);
create index if not exists fraud_submissions_session_idx on public.fraud_submissions (session_id, id);

-- ---------------------------------------------------------------------
--  Trigger: upper-case the code, lock game/params once students have
--  joined, stamp revealed_at
-- ---------------------------------------------------------------------
create or replace function public._fraud_session_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.code := upper(new.code);
  if tg_op = 'UPDATE' then
    if (new.game is distinct from old.game or new.params is distinct from old.params)
       and exists (select 1 from fraud_players where session_id = old.id) then
      raise exception 'Game settings cannot change after students have joined. Create a new session instead.';
    end if;
    if new.revealed then new.revealed_at := coalesce(old.revealed_at, now());
    else new.revealed_at := null; end if;
  else
    new.revealed_at := case when new.revealed then now() else null end;
  end if;
  return new;
end $$;
drop trigger if exists fraud_session_defaults on public.fraud_sessions;
create trigger fraud_session_defaults before insert or update on public.fraud_sessions
  for each row execute function public._fraud_session_defaults();

-- ---------------------------------------------------------------------
--  Student-facing functions (callable with the public key)
-- ---------------------------------------------------------------------
-- What a student may see: own nickname, session info, own submissions.
-- The instructor's guess is hidden until the session is revealed.
create or replace function public._fraud_state(p_id uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'player_id', p.id, 'token', p.token, 'nickname', p.nickname,
    'session', json_build_object('code', s.code, 'title', s.title, 'game', s.game,
                                 'params', s.params, 'is_open', s.is_open, 'revealed', s.revealed),
    'submissions', coalesce((select json_agg(json_build_object(
                               'kind', b.kind, 'data', b.data, 'label', b.label,
                               'guess', case when s.revealed then b.guess else null end,
                               'updated_at', b.updated_at) order by b.id)
                             from fraud_submissions b where b.player_id = p.id), '[]'::json))
  from fraud_players p join fraud_sessions s on s.id = p.session_id
  where p.id = p_id
$$;

create or replace function public.fraud_join(p_code text, p_game text, p_nickname text,
                                              p_user_agent text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  s    fraud_sessions;
  pid  uuid;
  nick text := trim(coalesce(p_nickname, ''));
  i    int := 0;
begin
  select * into s from fraud_sessions where code = upper(trim(p_code));
  if s.id is null then raise exception 'No session with code %', upper(trim(p_code)); end if;
  if s.game <> p_game then raise exception 'Code % is for a different game (%).', s.code, s.game; end if;
  if not s.is_open then raise exception 'This session is closed.'; end if;
  if char_length(nick) > 40 then raise exception 'Nickname is too long (40 characters max).'; end if;

  if nick = '' then
    -- anonymous: generate a free "Anon1234" name
    loop
      nick := 'Anon' || lpad(floor(random() * 10000)::int::text, 4, '0');
      exit when not exists (select 1 from fraud_players where session_id = s.id and lower(nickname) = lower(nick));
      i := i + 1;
      if i > 50 then raise exception 'Could not create an anonymous name. Try again.'; end if;
    end loop;
  elsif exists (select 1 from fraud_players where session_id = s.id and lower(nickname) = lower(nick)) then
    raise exception 'Nickname "%" is taken in this session. Pick another one.', nick;
  end if;

  insert into fraud_players (session_id, nickname, user_agent)
  values (s.id, nick, left(p_user_agent, 300))
  returning id into pid;
  return _fraud_state(pid);
end $$;

create or replace function public.fraud_resume(p_player uuid, p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from fraud_players where id = p_player and token = p_token) then
    raise exception 'Player not found.';
  end if;
  return _fraud_state(p_player);
end $$;

-- Submit (or overwrite, until the reveal) one submission.
-- Game-specific validation lives here; add a new `elsif s.game = '...'` branch for new games.
create or replace function public.fraud_submit(p_player uuid, p_token uuid, p_kind text,
                                               p_data jsonb, p_label text)
returns json language plpgsql security definer set search_path = public as $$
declare
  p   fraud_players;
  s   fraud_sessions;
  v_n int;
begin
  select * into p from fraud_players where id = p_player and token = p_token;
  if p.id is null then raise exception 'Player not found.'; end if;
  select * into s from fraud_sessions where id = p.session_id;
  if not s.is_open then raise exception 'This session is closed.'; end if;
  if s.revealed then raise exception 'The instructor has already revealed the results. Submissions are locked.'; end if;
  if p_kind is null or p_kind !~ '^[a-z0-9_]{1,30}$' then raise exception 'Bad submission kind.'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Bad data.'; end if;
  if length(p_data::text) > 8000 then raise exception 'Payload too large.'; end if;

  if s.game = 'coinflip' then
    if p_kind <> 'main' then raise exception 'Bad submission kind.'; end if;
    v_n := coalesce((s.params->>'n')::int, 50);
    if jsonb_typeof(p_data->'seq') is distinct from 'string'
       or (p_data->>'seq') !~ ('^[01]{' || v_n::text || '}$') then
      raise exception 'The sequence must be exactly % symbols (H/T or 1/0).', v_n;
    end if;
    if p_label is null or p_label not in ('real', 'fake') then
      raise exception 'Say whether your sequence is real or made up.';
    end if;
    -- keep only the sequence itself
    p_data := jsonb_build_object('seq', p_data->>'seq');
  elsif s.game = 'towns' then
    if p_kind <> 'main' then raise exception 'Bad submission kind.'; end if;
    v_n := coalesce((s.params->>'n')::int, 50);
    if jsonb_typeof(p_data->'nums') is distinct from 'array' then
      raise exception 'Send a list of % town populations.', v_n;
    end if;
    if jsonb_array_length(p_data->'nums') <> v_n then
      raise exception 'You must enter exactly % numbers.', v_n;
    end if;
    if exists (select 1 from jsonb_array_elements(p_data->'nums') e
               where case when jsonb_typeof(e) = 'number'
                          then (e #>> '{}')::numeric <> trunc((e #>> '{}')::numeric)
                               or (e #>> '{}')::numeric < 1 or (e #>> '{}')::numeric > 50000000
                          else true end) then
      raise exception 'Every number must be a whole number from 1 to 50,000,000.';
    end if;
    -- keep only the numbers themselves
    p_data := jsonb_build_object('nums', p_data->'nums');
  else
    if p_label is not null and char_length(p_label) > 40 then raise exception 'Label too long.'; end if;
  end if;

  insert into fraud_submissions (session_id, player_id, kind, data, label)
  values (s.id, p.id, p_kind, p_data, p_label)
  on conflict (player_id, kind) do update
    set data = excluded.data, label = excluded.label, guess = null, updated_at = now();
  return _fraud_state(p.id);
end $$;

create or replace function public.fraud_ping()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from fraud_sessions where false
$$;

-- ---------------------------------------------------------------------
--  Permissions & row-level security
-- ---------------------------------------------------------------------
alter table public.fraud_sessions    enable row level security;
alter table public.fraud_players     enable row level security;
alter table public.fraud_submissions enable row level security;

revoke all on public.fraud_sessions, public.fraud_players, public.fraud_submissions from anon;
revoke all on public.fraud_players, public.fraud_submissions from authenticated;
grant select, insert, update, delete on public.fraud_sessions to authenticated;
grant select, delete on public.fraud_players to authenticated;
grant select, delete on public.fraud_submissions to authenticated;
grant update (guess) on public.fraud_submissions to authenticated;   -- instructor records guesses; nothing else is editable

drop policy if exists fraud_sessions_owner on public.fraud_sessions;
create policy fraud_sessions_owner on public.fraud_sessions
  for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists fraud_players_owner on public.fraud_players;
create policy fraud_players_owner on public.fraud_players for select to authenticated
  using (exists (select 1 from fraud_sessions s where s.id = session_id and s.owner = auth.uid()));
drop policy if exists fraud_players_owner_del on public.fraud_players;
create policy fraud_players_owner_del on public.fraud_players for delete to authenticated
  using (exists (select 1 from fraud_sessions s where s.id = session_id and s.owner = auth.uid()));

drop policy if exists fraud_submissions_owner on public.fraud_submissions;
create policy fraud_submissions_owner on public.fraud_submissions for select to authenticated
  using (exists (select 1 from fraud_sessions s where s.id = session_id and s.owner = auth.uid()));
drop policy if exists fraud_submissions_owner_upd on public.fraud_submissions;
create policy fraud_submissions_owner_upd on public.fraud_submissions for update to authenticated
  using (exists (select 1 from fraud_sessions s where s.id = session_id and s.owner = auth.uid()))
  with check (exists (select 1 from fraud_sessions s where s.id = session_id and s.owner = auth.uid()));
drop policy if exists fraud_submissions_owner_del on public.fraud_submissions;
create policy fraud_submissions_owner_del on public.fraud_submissions for delete to authenticated
  using (exists (select 1 from fraud_sessions s where s.id = session_id and s.owner = auth.uid()));

revoke execute on function public._fraud_state(uuid) from public, anon, authenticated;
revoke execute on function public._fraud_session_defaults() from public, anon, authenticated;
revoke execute on function public.fraud_join(text, text, text, text)                from public;
revoke execute on function public.fraud_resume(uuid, uuid)                          from public;
revoke execute on function public.fraud_submit(uuid, uuid, text, jsonb, text)       from public;
revoke execute on function public.fraud_ping()                                      from public;
grant execute on function public.fraud_join(text, text, text, text)                 to anon, authenticated;
grant execute on function public.fraud_resume(uuid, uuid)                           to anon, authenticated;
grant execute on function public.fraud_submit(uuid, uuid, text, jsonb, text)        to anon, authenticated;
grant execute on function public.fraud_ping()                                       to anon, authenticated;

-- ---------------------------------------------------------------------
--  Handy flat view for SQL analysis (one row per submission, owner-only)
-- ---------------------------------------------------------------------
create or replace view public.fraud_v_submissions with (security_invoker = true) as
  select s.game, s.code, s.title, s.revealed,
         row_number() over (partition by b.session_id order by b.id) as seq_no,
         p.nickname, b.kind, b.data, b.label, b.guess,
         b.created_at, b.updated_at, b.player_id, b.session_id
  from fraud_submissions b
  join fraud_players p  on p.id = b.player_id
  join fraud_sessions s on s.id = b.session_id;
revoke all on public.fraud_v_submissions from anon;
grant select on public.fraud_v_submissions to authenticated;
