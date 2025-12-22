-- Templates for meal plans and items (configurable, no hardcode)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS meal_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  tags JSONB,
  status TEXT NOT NULL DEFAULT 'active', -- active|inactive
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meal_plan_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES meal_plan_templates(id) ON DELETE CASCADE,
  meal_type TEXT NOT NULL, -- breakfast|lunch|dinner|snack
  title TEXT NOT NULL,
  calories NUMERIC,
  protein NUMERIC,
  carbs NUMERIC,
  fats NUMERIC,
  serving_qty NUMERIC,
  serving_unit TEXT,
  description TEXT,
  ingredients JSONB,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_templates_status ON meal_plan_templates (status);
CREATE INDEX IF NOT EXISTS idx_meal_plan_template_items_template ON meal_plan_template_items (template_id);
