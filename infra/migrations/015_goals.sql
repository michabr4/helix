-- Goals & Loops — OKR-style goal tracking for the SDM team.
-- A goal (objective) has one or more key results (measurable outcomes).
-- Progress is computed from key_results at read time; status is a
-- lightweight enum set by the Goal Loop agent based on progress vs. time
-- elapsed toward target_date.

CREATE TABLE IF NOT EXISTS mgm.goals (
  goal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'team' CHECK (category IN ('customer','team','financial','operational')),
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track','at_risk','off_track','completed')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_status ON mgm.goals (status);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON mgm.goals (target_date);

CREATE TABLE IF NOT EXISTS mgm.key_results (
  kr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES mgm.goals(goal_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metric_type TEXT NOT NULL DEFAULT 'number' CHECK (metric_type IN ('number','percent','currency','boolean')),
  unit TEXT,
  start_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  target_value NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_key_results_goal ON mgm.key_results (goal_id);

-- History snapshots so the Goal Loop agent can report week-over-week movement.
CREATE TABLE IF NOT EXISTS mgm.goal_progress_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES mgm.goals(goal_id) ON DELETE CASCADE,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  progress_pct NUMERIC(5,2) NOT NULL,
  status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goal_progress_history_goal ON mgm.goal_progress_history (goal_id);
