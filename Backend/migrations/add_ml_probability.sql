-- Add ML resistance probability column to pharmacist_entries
-- This stores the baseline resistance probability from the ML API
-- Used in Resistance Pressure RWUI (v2) calculations

ALTER TABLE pharmacist_entries 
ADD COLUMN IF NOT EXISTS ml_resistance_probability FLOAT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_ml_resistance_probability 
ON pharmacist_entries(ml_resistance_probability) 
WHERE ml_resistance_probability IS NOT NULL;

-- Comment
COMMENT ON COLUMN pharmacist_entries.ml_resistance_probability IS 
'ML-predicted baseline resistance probability (0-1) from global resistance model. Used to calculate resistance pressure RWUI.';
