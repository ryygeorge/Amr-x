-- Backend/sql/rwui_metrics_table.sql
-- RWUI Analytics Table Schema
-- Run this in Supabase SQL Editor to create the analytics table

-- Create rwui_metrics table
CREATE TABLE IF NOT EXISTS rwui_metrics (
  id BIGSERIAL PRIMARY KEY,
  organism TEXT NOT NULL,
  district TEXT NOT NULL,
  rwui_value FLOAT NOT NULL CHECK (rwui_value >= 0 AND rwui_value <= 1),
  total_prescriptions INTEGER NOT NULL DEFAULT 0,
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique combination of organism + district + time window
  CONSTRAINT unique_rwui_metric UNIQUE (organism, district, window_start)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_rwui_organism_district 
  ON rwui_metrics(organism, district);

CREATE INDEX IF NOT EXISTS idx_rwui_window_start 
  ON rwui_metrics(window_start DESC);

CREATE INDEX IF NOT EXISTS idx_rwui_last_updated 
  ON rwui_metrics(last_updated DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE rwui_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access for authenticated users
CREATE POLICY "Allow read access for authenticated users"
  ON rwui_metrics
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow insert/update for service role only
CREATE POLICY "Allow write access for service role"
  ON rwui_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE rwui_metrics IS 
  'RWUI (Resistance Weighted Usage Index) metrics aggregated by organism, district, and time window';

COMMENT ON COLUMN rwui_metrics.rwui_value IS 
  'RWUI = Σ(usage × resistance) / Σ(usage), range [0,1], higher = more concerning';
