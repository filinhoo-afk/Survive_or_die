-- День 59: испытание дня.
--
-- Как применить: Supabase → SQL Editor → вставить файл целиком → Run
-- (после 001_scores.sql и 002_plausibility.sql; 003_nickname.sql желательна,
-- но не обязательна). Скрипт можно запускать повторно: он ничего не ломает
-- и не стирает.
--
-- Испытание дня — забег с общим сидом: у всех игроков в этот день одна и та же
-- локация, один герой и один мир. Его результаты лежат в той же таблице
-- `scores`, но помечены датой в колонке `daily`; у обычных забегов она пуста,
-- поэтому у каждой таблицы — обычной и дневной — свой список.
-- Игра без этой миграции тоже работает: испытание просто никуда не отправляется,
-- а таблица локаций читается как раньше.

-- Какое испытание у этого дня. День считается по UTC: номер дня — число суток
-- с 1970-01-01, сид — его произведение на множитель Кнута по модулю 2^32,
-- локация и герой берутся из разных бит сида. Те же формулы — в игре:
-- src/systems/daily.js. Функция чистая — её можно звать напрямую
-- (POST /rest/v1/rpc/daily_challenge): так supabase/check-access.mjs сверяет
-- сервер с игрой, не добавляя строк в таблицу.
create or replace function public.daily_challenge(p_date date)
returns table (seed bigint, location text, hero text)
language sql
immutable
set search_path = ''
as $$
  with s as (
    select ((p_date - date '1970-01-01')::bigint * 2654435761) % 4294967296 as seed
  )
  select
    s.seed,
    (array['wasteland', 'forest', 'ruins', 'glacier', 'abyss'])[((s.seed / 65536) % 5)::int + 1],
    (array['gunner', 'thrower', 'warden'])[((s.seed / 256) % 3)::int + 1]
  from s;
$$;

comment on function public.daily_challenge(date) is 'Сид, локация и герой испытания дня за дату (UTC).';

revoke all on function public.daily_challenge(date) from public;
grant execute on function public.daily_challenge(date) to anon, authenticated;

alter table public.scores add column if not exists daily date;

comment on column public.scores.daily is 'Дата испытания дня (UTC); null — обычный забег.';

-- Таблица испытания: за дату, больше убийств — выше, при равенстве раньше тот, кто быстрее.
create index if not exists scores_daily_idx
  on public.scores (daily, kills desc, time_sec asc)
  where daily is not null;

-- Дату можно добавить при вставке, как и остальные колонки результата;
-- update и delete по-прежнему не выданы никому.
grant insert (daily) on table public.scores to anon, authenticated;

-- Триггер перед вставкой теперь проверяет и день. Правдоподобие числа забега
-- (002_plausibility.sql) — как раньше, а для строки испытания к нему добавляется:
--   · дата — сегодняшняя или вчерашняя по UTC: забег, начатый до полуночи,
--     успевает дойти, а будущие и давние дни закрыты;
--   · локация и герой — те, что выбрал для этой даты сервер: подставить в
--     таблицу испытания «лёгкую» локацию или своего героя нельзя.
-- Код ошибки тот же, что у ограничений check (23514): для игры это «сервер
-- отказался принять результат».
create or replace function public.scores_reject_implausible()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  problem text;
  today   date := (now() at time zone 'utc')::date;
  chosen  record;
begin
  if new.daily is not null then
    if new.daily < today - 1 or new.daily > today then
      problem := 'испытание не за сегодня';
    else
      select * into chosen from public.daily_challenge(new.daily);
      if new.location is distinct from chosen.location or new.hero is distinct from chosen.hero then
        problem := 'локация или герой не совпадают с испытанием дня';
      end if;
    end if;
  end if;

  if problem is null then
    problem := public.score_problem(
      new.location, new.time_sec, new.kills, new.level, new.damage, new.victory
    );
  end if;

  if problem is not null then
    raise exception 'неправдоподобный результат: %', problem
      using errcode = 'check_violation',
            hint = 'Правила — в supabase/migrations/002_plausibility.sql и 004_daily.sql';
  end if;
  return new;
end;
$$;

-- Триггер из 002 уже смотрит на эту функцию; пересоздаём на случай, если его нет.
drop trigger if exists scores_plausible on public.scores;
create trigger scores_plausible
  before insert on public.scores
  for each row execute function public.scores_reject_implausible();

-- Пусть REST-слой сразу увидит новую колонку и функцию.
notify pgrst, 'reload schema';
