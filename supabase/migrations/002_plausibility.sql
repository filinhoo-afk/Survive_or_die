-- День 57: проверка правдоподобия результатов на сервере.
--
-- Как применить: Supabase → SQL Editor → вставить файл целиком → Run
-- (после 001_scores.sql). Скрипт можно запускать повторно.
--
-- Сервер не видел забега и доказать, что он был, не может. Зато он знает
-- правила игры и отсекает числа, которых честный забег дать не может:
-- тысячи убийств за минуту, победу над боссом до его появления, сотый
-- уровень при десятке убийств, убийства без урона. Каждая граница — потолок
-- с запасом, посчитанный по коду игры: честный забег, даже самый удачный,
-- проходит всегда. Обратная сторона: скромную подделку («в полтора раза
-- больше убийств») так не поймать — потолок неизбежно выше среднего забега.
--
-- Числа взяты из кода. Поменялся баланс — поправь здесь же:
--   src/config.js          spawner: волны, интервал, потолок врагов, рост здоровья
--   src/enemies/types.js   здоровье, опыт и стаи врагов, здоровье боссов
--   src/enemies/elites.js  множители элиты: здоровье ×2.5 (броня ещё ×2), опыт ×4 (богатая ещё ×2)
--   src/locations/*.js     враги локации и секунда выхода босса
--   src/systems/items.js   16 ящиков, из ящика — кристалл на 5 опыта
--   src/entities/necromancer.js, abysslord.js — призыв врагов боссом

-- Что не так с результатом: текст причины, или null, если всё правдоподобно.
-- Функция чистая — ничего не читает и не пишет, поэтому её можно звать
-- напрямую (POST /rest/v1/rpc/score_problem): так supabase/check-access.mjs
-- проверяет правила, не добавляя строк в таблицу.
create or replace function public.score_problem(
  p_location text,
  p_time_sec integer,
  p_kills    integer,
  p_level    integer,
  p_damage   integer,
  p_victory  boolean
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  boss_at    integer; -- секунда выхода босса; null — босса в локации нет
  boss_hp    integer;
  max_pack   integer; -- самая большая стая среди врагов локации
  min_hp     integer; -- самый хрупкий враг локации: рост здоровья только прибавляет
  max_hp     integer; -- самый живучий обычный враг локации
  t          numeric := 0;
  spawned    numeric := 0;
  summoned   numeric := 0;
  minutes    numeric;
  max_kills  numeric;
  max_alive  numeric;
  max_damage numeric;
begin
  -- Триггер срабатывает раньше ограничений таблицы, поэтому пустые значения
  -- и выход за рамки ловим сами: иначе цикл ниже мог бы не кончиться.
  if p_location is null or p_time_sec is null or p_kills is null
     or p_level is null or p_damage is null or p_victory is null then
    return 'не все поля заполнены';
  end if;
  if p_time_sec not between 1 and 14400 or p_kills < 0 or p_level < 1 or p_damage < 0 then
    return 'числа вне рамок таблицы';
  end if;

  case p_location
    -- Пустошь: рядовые, рой (стая 5, здоровье 8), танки, стрелки; босса нет.
    when 'wasteland' then boss_at := null; boss_hp := 0;    max_pack := 5; min_hp := 8;  max_hp := 160;
    -- Лес: волки (стая 3, здоровье 30), рядовые, энты (220), стрелки.
    when 'forest'    then boss_at := 480;  boss_hp := 2600; max_pack := 3; min_hp := 30; max_hp := 220;
    -- Руины: призраки (стая 2, здоровье 26), рядовые, стрелки, духи, танки.
    when 'ruins'     then boss_at := 480;  boss_hp := 3000; max_pack := 2; min_hp := 26; max_hp := 160;
    -- Ледник: волки, рядовые, рой, стрелки, танки.
    when 'glacier'   then boss_at := 480;  boss_hp := 3400; max_pack := 5; min_hp := 8;  max_hp := 160;
    -- Бездна: все враги прошлых локаций.
    when 'abyss'     then boss_at := 600;  boss_hp := 5000; max_pack := 5; min_hp := 8;  max_hp := 220;
    else return 'неизвестная локация';
  end case;

  -- Победа — это убитый босс: он выходит по таймеру, и здоровья у него много.
  if p_victory then
    if boss_at is null then
      return 'в этой локации нет босса';
    end if;
    if p_time_sec < boss_at then
      return 'победа раньше, чем вышел босс';
    end if;
    if p_kills < 1 or p_damage < boss_hp then
      return 'урона меньше, чем здоровья у босса';
    end if;
  end if;

  -- Убийств не больше, чем врагов могло появиться. Повторяем спавнер:
  -- волна раз в interval секунд, в волне waveSize типов, каждый — стаей;
  -- одна волна не выводит больше врагов, чем потолок на поле. Первая волна
  -- выходит сразу на старте забега. (С выходом босса спавнер замолкает,
  -- а здесь волны идут до конца — это лишь добавляет запаса.)
  spawned := least(3 * max_pack, 60);
  loop
    t := t + greatest(2, 5 - 0.4 * t / 60);
    exit when t > p_time_sec + 1;
    spawned := spawned + least((3 + floor(t / 45)) * max_pack, ceil(60 + 6 * t / 60));
  end loop;
  -- После выхода босса добавляются призванные им: не больше двух в секунду.
  if boss_at is not null and p_time_sec > boss_at then
    summoned := 2 * (p_time_sec - boss_at);
  end if;
  -- Запас 10% — на округления таймера волн; +1 — сам босс.
  max_kills := ceil(spawned * 1.1 + summoned) + 1;
  if p_kills > max_kills then
    return format('убийств больше, чем врагов могло появиться (не больше %s)', max_kills);
  end if;

  -- Урон в итогах — здоровье, которое враги реально потеряли. Значит, каждый
  -- убитый стоил хотя бы здоровья самого хрупкого врага локации...
  if p_damage::numeric < p_kills::numeric * min_hp then
    return 'урона меньше, чем здоровья у убитых врагов';
  end if;
  -- ...а всего урона не больше, чем здоровья у убитых и живых к концу забега,
  -- даже если все они — бронированная элита на последней секунде.
  minutes := (p_time_sec + 1) / 60.0;
  max_alive := 60 + 6 * minutes + 30;
  max_damage := (p_kills + max_alive) * max_hp * 5 * (1 + 0.15 * minutes) + boss_hp;
  if p_damage > max_damage then
    return 'урона больше, чем здоровья у всех врагов';
  end if;

  -- Уровень: чтобы дойти до level, нужно 5 + 10 + ... = 2.5·(level−1)·level опыта.
  -- Больше всего опыта даёт богатая элита-энт (6 × 4 × 2 = 48), ещё 200 —
  -- босс Бездны, и 16 × 5 — кристаллы из ящиков.
  if 2.5 * (p_level - 1)::numeric * p_level > 48 * p_kills::numeric + 200 + 80 then
    return 'уровень выше, чем хватило бы опыта';
  end if;

  return null;
end;
$$;

comment on function public.score_problem(text, integer, integer, integer, integer, boolean) is
  'Почему результат забега неправдоподобен; null — результат возможен.';

-- Звать функцию напрямую можно всем: она ничего не меняет.
revoke all on function public.score_problem(text, integer, integer, integer, integer, boolean) from public;
grant execute on function public.score_problem(text, integer, integer, integer, integer, boolean)
  to anon, authenticated;

-- Триггер перед вставкой: неправдоподобная строка не попадает в таблицу.
-- Код ошибки тот же, что у ограничений check (23514), — для игры это одно
-- и то же: «сервер отказался принять результат».
create or replace function public.scores_reject_implausible()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  problem text;
begin
  problem := public.score_problem(
    new.location, new.time_sec, new.kills, new.level, new.damage, new.victory
  );
  if problem is not null then
    raise exception 'неправдоподобный результат: %', problem
      using errcode = 'check_violation',
            hint = 'Правила — в supabase/migrations/002_plausibility.sql';
  end if;
  return new;
end;
$$;

drop trigger if exists scores_plausible on public.scores;
create trigger scores_plausible
  before insert on public.scores
  for each row execute function public.scores_reject_implausible();

-- Пусть REST-слой сразу увидит новую функцию.
notify pgrst, 'reload schema';
