-- =============================================================================
-- Migration 002: Schema fixes — missing FKs and missing indexes
-- Safe: adds constraints and indexes only; no tables or columns dropped.
-- Run once against: career_counseling_system
-- =============================================================================

BEGIN;

-- =============================================================================
-- P1 — MISSING FOREIGN KEYS
-- =============================================================================

-- assessment_sessions.student_id has no FK to students.
-- Any orphaned rows (student_id not in students) must be cleaned up first;
-- on a fresh DB there will be none.
ALTER TABLE public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(student_id)
    ON DELETE CASCADE;

-- student_question_responses_v2.student_id has no FK to students.
ALTER TABLE public.student_question_responses_v2
    ADD CONSTRAINT student_question_responses_v2_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(student_id)
    ON DELETE CASCADE;


-- =============================================================================
-- P2 — MISSING INDEXES ON HOT QUERY PATHS
-- =============================================================================

-- student_question_responses_v2(student_id)
-- Fetched on every call to run_career_engine(); table will grow with every
-- student submission so this index is load-bearing.
CREATE INDEX IF NOT EXISTS idx_sqr_v2_student_id
    ON public.student_question_responses_v2 (student_id);

-- student_question_responses_v2(question_id)
-- Joined inside the per-question trait-weight loop in run_career_engine().
CREATE INDEX IF NOT EXISTS idx_sqr_v2_question_id
    ON public.student_question_responses_v2 (question_id);

-- question_trait_weights_v2(question_id)
-- Looked up once per answered question inside the scoring loop.
CREATE INDEX IF NOT EXISTS idx_qtw_v2_question_id
    ON public.question_trait_weights_v2 (question_id);

-- universities(university_name)
-- run_career_engine() looks universities up by name 3+ times per university
-- per student (subject rankings, intelligence score, cutoffs).
CREATE INDEX IF NOT EXISTS idx_universities_name
    ON public.universities (university_name);

-- university_field_strength(field_id)
-- Primary join column in the university-matching layer of the engine.
CREATE INDEX IF NOT EXISTS idx_ufs_field_id
    ON public.university_field_strength (field_id);

-- career_profiles(career_name)
-- Looked up by name for strategy details, required exam, and difficulty.
CREATE INDEX IF NOT EXISTS idx_career_profiles_name
    ON public.career_profiles (career_name);

-- assessment_sessions(student_id)
-- Used in /start-assessment and will be queried when listing a student's
-- sessions.
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_student_id
    ON public.assessment_sessions (student_id);


COMMIT;
