-- Backend/sql/pharmacist_entries_example.sql
-- Example schema for pharmacist entries table
-- This table should already exist in your database

-- IF NOT EXISTS, create pharmacist_entries table
-- Modify column names to match your existing table

/*
CREATE TABLE IF NOT EXISTS pharmacist_entries (
  id BIGSERIAL PRIMARY KEY,
  pharmacist_id UUID REFERENCES pharmacists(id),
  organism TEXT NOT NULL,
  antibiotic TEXT NOT NULL,
  district TEXT NOT NULL,
  state TEXT DEFAULT 'Kerala',
  
  -- ML prediction result (stored after prediction is made)
  resistance_probability FLOAT CHECK (resistance_probability >= 0 AND resistance_probability <= 1),
  risk_level TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_file TEXT,
  notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entries_organism_district 
  ON pharmacist_entries(organism, district);

CREATE INDEX IF NOT EXISTS idx_entries_created_at 
  ON pharmacist_entries(created_at DESC);

-- Enable RLS
ALTER TABLE pharmacist_entries ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth setup)
CREATE POLICY "Pharmacists can insert their own entries"
  ON pharmacist_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = pharmacist_id);

CREATE POLICY "Pharmacists can view their own entries"
  ON pharmacist_entries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = pharmacist_id);
*/

-- NOTE: The above is EXAMPLE ONLY
-- Use your existing pharmacist_entries table structure
-- Just ensure it has these columns for RWUI to work:
-- - organism (text)
-- - antibiotic (text)
-- - district (text)
-- - resistance_probability (float, 0-1)
-- - created_at (timestamp)
