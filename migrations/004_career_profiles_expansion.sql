-- Phase 7A: career_profiles expansion — salary, education path, recruiters, outlook
-- Unblocks the Roadmap page (salary + education_path were empty states).

ALTER TABLE career_profiles
  ADD COLUMN IF NOT EXISTS salary_min_inr INTEGER,
  ADD COLUMN IF NOT EXISTS salary_max_inr INTEGER,
  ADD COLUMN IF NOT EXISTS education_path JSONB,
  ADD COLUMN IF NOT EXISTS top_recruiters TEXT[],
  ADD COLUMN IF NOT EXISTS growth_outlook VARCHAR(20);

-- growth_outlook valid values: 'High' | 'Moderate' | 'Low'
-- education_path shape: {"steps": ["Step 1...", "Step 2...", ...]}
-- top_recruiters: array of company/org name strings
