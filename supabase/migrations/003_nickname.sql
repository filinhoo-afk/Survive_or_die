-- День 58: никнейм игрока.
--
-- Как применить: Supabase → SQL Editor → вставить файл целиком → Run
-- (после 001_scores.sql; с 002_plausibility.sql они не связаны).
-- Скрипт можно запускать повторно: он ничего не ломает и не стирает.
--
-- Ник необязателен: безымянные результаты — null, как и все старые строки.
-- Игра без этой миграции тоже работает: не найдя колонку, она шлёт результат
-- без ника, а таблицу читает без неё.

-- Допустимый ник: 1–12 символов, латиница и кириллица заглавными, цифры
-- и одиночные пробелы или дефисы между словами. Тот же набор правил в игре:
-- src/systems/nickname.js (шрифт игры знает только заглавные буквы).
-- Функция чистая — её можно звать напрямую (POST /rest/v1/rpc/nick_valid):
-- так supabase/check-access.mjs проверяет правило, не добавляя строк в таблицу.
create or replace function public.nick_valid(p_nick text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_nick is not null
     and char_length(p_nick) between 1 and 12
     and p_nick ~ '^[A-ZА-Я0-9]+([ -][A-ZА-Я0-9]+)*$';
$$;

comment on function public.nick_valid(text) is 'Годится ли строка как никнейм игрока.';

revoke all on function public.nick_valid(text) from public;
grant execute on function public.nick_valid(text) to anon, authenticated;

alter table public.scores add column if not exists nick text;

comment on column public.scores.nick is 'Никнейм игрока; null — результат без имени.';

-- Ограничение добавляем, только если его ещё нет: у add constraint нет «if not exists».
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.scores'::regclass and conname = 'scores_nick_valid'
  ) then
    alter table public.scores
      add constraint scores_nick_valid check (nick is null or public.nick_valid(nick));
  end if;
end
$$;

-- Права на колонку: читать её можно сразу (select на таблицу уже выдан),
-- добавлять — только когда выдано право на вставку именно этой колонки.
-- update и delete по-прежнему не выданы никому: ник нельзя ни сменить, ни стереть.
grant insert (nick) on table public.scores to anon, authenticated;

-- Пусть REST-слой сразу увидит новую колонку и функцию.
notify pgrst, 'reload schema';
