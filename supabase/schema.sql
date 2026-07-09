-- ============================================================
-- HEALTH APP — CORE DATABASE SCHEMA (Supabase / Postgres)
-- ============================================================
-- Design principles:
-- 1. Every log table is timestamped (timestamptz) so the AI
--    insights engine can join across sleep/food/exercise/meds/vitals.
-- 2. Every table is scoped by user_id and protected with Row
--    Level Security (RLS) so users only ever see their own data.
-- 3. Device-sourced data (Terra webhooks) and manual entries share
--    the same tables, distinguished by a `source` column.
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES (extends Supabase auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  height_in numeric,               -- used for BMI / calorie calcs
  date_of_birth date,
  sex text check (sex in ('male','female','other')),
  activity_level text,             -- sedentary/light/moderate/active/very_active
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- DEVICE CONNECTIONS (Terra aggregator links)
-- ------------------------------------------------------------
create table public.device_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('withings','fitbit','freestyle_libre','inbody')),
  terra_user_id text not null,     -- Terra's internal reference ID for this connection
  status text not null default 'active' check (status in ('active','disconnected','error')),
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz
);

-- ------------------------------------------------------------
-- FOODS (shared reference library + food bank)
-- ------------------------------------------------------------
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  barcode text,
  name text not null,
  brand text,
  serving_size numeric not null default 1,
  serving_unit text not null default 'serving',
  calories numeric not null,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  sodium_mg numeric,
  micronutrients jsonb,             -- flexible store: {"vitamin_d_mcg": 5, "iron_mg": 2.1, ...}
  source text check (source in ('barcode_openfoodfacts','usda','plate_scan_ai','manual')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_foods_barcode on public.foods (barcode);

-- Per-user "food bank" — foods the user has actually logged before,
-- so repeat items are instantly searchable/re-loggable.
create table public.user_food_bank (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  times_logged integer not null default 1,
  last_logged_at timestamptz not null default now(),
  unique (user_id, food_id)
);

-- ------------------------------------------------------------
-- MEAL LOGS
-- ------------------------------------------------------------
create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  food_id uuid references public.foods(id),
  logged_at timestamptz not null default now(),   -- when it was actually eaten
  meal_type text check (meal_type in ('breakfast','lunch','dinner','snack')),
  quantity numeric not null default 1,             -- multiplier on food's serving_size
  -- snapshot of nutrition at time of logging (protects history if `foods` row is edited later)
  calories numeric not null,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  sodium_mg numeric,
  micronutrients jsonb,
  entry_method text check (entry_method in ('barcode','plate_scan','manual','food_bank')),
  photo_url text,                                  -- stored plate-scan photo, if applicable
  created_at timestamptz not null default now()
);
create index idx_meal_logs_user_time on public.meal_logs (user_id, logged_at);

-- ------------------------------------------------------------
-- EXERCISES (reference library)
-- ------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,               -- e.g. 'chest','back','legs','cardio'
  met_value numeric,           -- used for calorie-burn estimate
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- WORKOUT LOGS + SETS
-- ------------------------------------------------------------
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_workout_logs_user_time on public.workout_logs (user_id, logged_at);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  set_number integer not null,
  weight_lbs numeric,
  reps integer,
  calories_burned numeric,      -- estimated: MET x bodyweight x duration
  created_at timestamptz not null default now()
);
create index idx_workout_sets_log on public.workout_sets (workout_log_id);

-- ------------------------------------------------------------
-- BODY METRICS (InBody H30 + manual)
-- ------------------------------------------------------------
create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  source text not null check (source in ('inbody_h30','manual')),
  weight_lbs numeric,
  body_fat_pct numeric,
  body_fat_lbs numeric,
  skeletal_muscle_mass_lbs numeric,   -- SMM
  lean_mass_lbs numeric,
  created_at timestamptz not null default now()
);
create index idx_body_metrics_user_time on public.body_metrics (user_id, recorded_at);

-- ------------------------------------------------------------
-- WEIGHT GOALS
-- ------------------------------------------------------------
create table public.weight_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_weight_lbs numeric not null,
  target_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- SLEEP LOGS (Withings Sleep Analyzer via Terra)
-- ------------------------------------------------------------
create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sleep_date date not null,               -- the "night of" date
  source text not null default 'withings',
  bedtime timestamptz,
  wake_time timestamptz,
  total_sleep_minutes integer,
  light_sleep_minutes integer,
  deep_sleep_minutes integer,
  rem_sleep_minutes integer,
  awake_minutes integer,
  sleep_score integer,
  avg_heart_rate numeric,
  avg_respiratory_rate numeric,
  snoring_minutes integer,
  apnea_flag boolean,                     -- irregular breathing events flagged
  created_at timestamptz not null default now()
);
create index idx_sleep_logs_user_date on public.sleep_logs (user_id, sleep_date);

-- ------------------------------------------------------------
-- VITALS (Blood Pressure + Blood Glucose)
-- ------------------------------------------------------------
create table public.vitals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  vital_type text not null check (vital_type in ('blood_pressure','blood_glucose')),
  source text not null check (source in ('withings_bpm_core','freestyle_libre','manual')),
  -- blood pressure fields
  systolic integer,
  diastolic integer,
  heart_rate integer,
  ecg_result text,
  -- glucose fields
  glucose_mg_dl numeric,
  created_at timestamptz not null default now()
);
create index idx_vitals_user_time on public.vitals (user_id, recorded_at, vital_type);

-- ------------------------------------------------------------
-- MEDICATIONS + REMINDERS + ADHERENCE LOG
-- ------------------------------------------------------------
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  dosage text,
  frequency text,                 -- e.g. 'daily','twice_daily','as_needed'
  reminder_times time[],          -- e.g. '{08:00, 20:00}'
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  scheduled_for timestamptz not null,
  taken_at timestamptz,             -- null until logged as taken
  status text not null default 'pending' check (status in ('pending','taken','skipped')),
  created_at timestamptz not null default now()
);
create index idx_medication_logs_user_time on public.medication_logs (user_id, scheduled_for);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.device_connections enable row level security;
alter table public.user_food_bank enable row level security;
alter table public.meal_logs enable row level security;
alter table public.workout_logs enable row level security;
alter table public.workout_sets enable row level security;
alter table public.body_metrics enable row level security;
alter table public.weight_goals enable row level security;
alter table public.sleep_logs enable row level security;
alter table public.vitals enable row level security;
alter table public.medications enable row level security;
alter table public.medication_logs enable row level security;

-- Standard "own data only" policy, repeated per table
create policy "own profile" on public.profiles for all using (auth.uid() = id);
create policy "own devices" on public.device_connections for all using (auth.uid() = user_id);
create policy "own food bank" on public.user_food_bank for all using (auth.uid() = user_id);
create policy "own meals" on public.meal_logs for all using (auth.uid() = user_id);
create policy "own workouts" on public.workout_logs for all using (auth.uid() = user_id);
create policy "own workout sets" on public.workout_sets for all using (
  auth.uid() = (select user_id from public.workout_logs where id = workout_log_id)
);
create policy "own body metrics" on public.body_metrics for all using (auth.uid() = user_id);
create policy "own goals" on public.weight_goals for all using (auth.uid() = user_id);
create policy "own sleep" on public.sleep_logs for all using (auth.uid() = user_id);
create policy "own vitals" on public.vitals for all using (auth.uid() = user_id);
create policy "own medications" on public.medications for all using (auth.uid() = user_id);
create policy "own medication logs" on public.medication_logs for all using (auth.uid() = user_id);

-- `foods` table is shared reference data — readable by all authenticated users,
-- but only the creator (or service role) can edit their own manual entries.
alter table public.foods enable row level security;
create policy "read all foods" on public.foods for select using (auth.role() = 'authenticated');
create policy "insert own foods" on public.foods for insert with check (auth.uid() = created_by);

-- `exercises` is a shared reference library, read-only for users (seeded by admin/service role).
alter table public.exercises enable row level security;
create policy "read all exercises" on public.exercises for select using (auth.role() = 'authenticated');
