-- День 54: таблица рекордов и правила доступа.
--
-- Как применить: Supabase → SQL Editor → вставить файл целиком → Run.
-- Скрипт можно запускать повторно: он ничего не ломает и не стирает.
--
-- Ключ, который лежит в игре (src/config.js), публичный: его видит любой,
-- кто открыл сайт. Поэтому защищает данные не ключ, а три слоя правил ниже:
--   1. права на таблицу  — что роли вообще разрешено (читать и добавлять);
--   2. политики RLS      — какие именно строки ей видны и доступны;
--   3. ограничения check — какие значения база согласна принять.

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  -- Время ставит сервер: клиенту колонка недоступна (см. права ниже).
  created_at timestamptz not null default now(),
  location   text    not null,
  hero       text    not null,
  -- Сколько секунд длился забег.
  time_sec   integer not null,
  kills      integer not null,
  level      integer not null,
  damage     integer not null,
  -- Босс локации повержен.
  victory    boolean not null default false,

  constraint scores_location_known check (location in ('wasteland', 'forest', 'ruins', 'glacier', 'abyss')),
  constraint scores_hero_known     check (hero in ('gunner', 'thrower', 'warden')),
  -- Грубые рамки от мусора. Правдоподобие результата проверяется на 57-й день.
  constraint scores_time_range     check (time_sec between 1 and 14400),
  constraint scores_kills_range    check (kills between 0 and 1000000),
  constraint scores_level_range    check (level between 1 and 999),
  constraint scores_damage_range   check (damage between 0 and 1000000000)
);

comment on table public.scores is 'Онлайн-рекорды Survive or Die: одна строка — один завершённый забег.';

-- Топ по локации: больше убийств — выше, при равенстве раньше тот, кто быстрее.
create index if not exists scores_top_idx on public.scores (location, kills desc, time_sec asc);

-- 1. Права на таблицу. Сначала забираем всё, потом выдаём ровно нужное.
--    anon — игрок без входа (публичный ключ), authenticated — вошедший.
revoke all on table public.scores from anon, authenticated;
grant select on table public.scores to anon, authenticated;
-- Добавлять можно только эти колонки: id и created_at подделать нельзя.
grant insert (location, hero, time_sec, kills, level, damage, victory)
  on table public.scores to anon, authenticated;
-- update и delete не выданы никому: рекорд нельзя ни исправить, ни стереть.

-- 2. Политики RLS. Без включённого RLS права выше были бы единственной защитой.
alter table public.scores enable row level security;

drop policy if exists scores_read_all on public.scores;
create policy scores_read_all on public.scores
  for select to anon, authenticated
  using (true);

drop policy if exists scores_insert_all on public.scores;
create policy scores_insert_all on public.scores
  for insert to anon, authenticated
  with check (true);
-- Политик на update и delete нет — значит, RLS запрещает их даже тому,
-- кому по ошибке выдадут права.
