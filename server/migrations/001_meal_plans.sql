-- Meal plans for AI-generated daily menus
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  plan_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft|active|completed|archived
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meal_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meal_type TEXT NOT NULL, -- breakfast|lunch|dinner|snack
  calories NUMERIC,
  protein NUMERIC,
  carbs NUMERIC,
  fats NUMERIC,
  unit TEXT,
  serving_qty NUMERIC,
  serving_unit TEXT,
  planned_time TIME,
  description TEXT,
  ingredients JSONB,
  food_item_id UUID,
  applied BOOLEAN DEFAULT false,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date ON meal_plans (user_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_meal_plan_items_plan ON meal_plan_items (plan_id);
