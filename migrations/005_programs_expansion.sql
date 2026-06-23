-- ============================================================================
-- migrations/005_programs_expansion.sql
-- Phase 7B, Task 2 — expand the `programs` catalogue from 8 to 70+ entries
-- covering every major field, and MAP each program to one of the 25 career
-- profiles via programs.career_id (the FK fk_program_career → career_profiles).
--
-- Why career_id is the mapping field: career_profiles has no `required_programs`
-- column. The scoring engine (score_assessment.py) discovers a career's programs
-- with:
--     SELECT DISTINCT program_name, field_id FROM programs
--     WHERE career_id = (SELECT career_id FROM career_profiles WHERE career_name=?)
-- so attaching the correct career_id IS the program→career mapping the brief asks
-- for. The new rows are generic templates (university_id IS NULL): the engine's
-- program query does not use university_id, and universities are matched
-- separately by field_id / budget / state.
--
-- Idempotent & non-destructive:
--   * New fields inserted with ON CONFLICT (field_name) DO NOTHING.
--   * New programs staged in a temp table and inserted only when an identical
--     generic row (same program_name + career_id, university_id IS NULL) does
--     not already exist. Re-running adds nothing and removes nothing.
--   * The original 8 programs are never touched.
--
-- Run:
--   /opt/homebrew/bin/psql -U postgres -h localhost -d career_counseling_system \
--       -f migrations/005_programs_expansion.sql
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. New TOP-LEVEL fields (parent_field_id NULL) — domains not yet represented.
--    Inserted first so the sub-fields in step 2 can resolve them as parents.
-- ---------------------------------------------------------------------------
INSERT INTO fields (field_name, parent_field_id, description) VALUES
  ('Management',          NULL, 'Business administration, management and MBA disciplines'),
  ('Architecture',       NULL, 'Architecture and built-environment design'),
  ('Pharmacy',           NULL, 'Pharmaceutical sciences and pharmacy practice'),
  ('Agriculture',        NULL, 'Agricultural sciences, horticulture and allied fields'),
  ('Education',          NULL, 'Teacher education and pedagogy'),
  ('Mass Communication', NULL, 'Journalism, media studies and mass communication'),
  ('Design',             NULL, 'Design disciplines: fashion, communication, product'),
  ('Hospitality',        NULL, 'Hotel management and hospitality administration')
ON CONFLICT (field_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. New SUB-fields, parents resolved by name (all parents now exist).
-- ---------------------------------------------------------------------------
INSERT INTO fields (field_name, parent_field_id, description) VALUES
  -- under Engineering
  ('Civil Engineering',                          (SELECT field_id FROM fields WHERE field_name='Engineering'), 'Civil and structural engineering'),
  ('Aerospace Engineering',                      (SELECT field_id FROM fields WHERE field_name='Engineering'), 'Aerospace and aeronautical engineering'),
  ('Chemical Engineering',                       (SELECT field_id FROM fields WHERE field_name='Engineering'), 'Chemical and process engineering'),
  ('Information Technology',                      (SELECT field_id FROM fields WHERE field_name='Engineering'), 'Information technology and software systems'),
  ('Electronics and Communication Engineering',  (SELECT field_id FROM fields WHERE field_name='Engineering'), 'Electronics and communication engineering'),
  -- under Science
  ('Physics',               (SELECT field_id FROM fields WHERE field_name='Science'), 'Pure and applied physics'),
  ('Chemistry',             (SELECT field_id FROM fields WHERE field_name='Science'), 'Pure and applied chemistry'),
  ('Biology',               (SELECT field_id FROM fields WHERE field_name='Science'), 'Biological and life sciences'),
  ('Mathematics',           (SELECT field_id FROM fields WHERE field_name='Science'), 'Mathematics and statistics'),
  ('Environmental Science', (SELECT field_id FROM fields WHERE field_name='Science'), 'Environmental and sustainability sciences'),
  -- under Medicine
  ('Dentistry', (SELECT field_id FROM fields WHERE field_name='Medicine'), 'Dental surgery and oral health'),
  ('Nursing',   (SELECT field_id FROM fields WHERE field_name='Medicine'), 'Nursing and midwifery'),
  -- under Arts & Humanities
  ('Political Science',   (SELECT field_id FROM fields WHERE field_name='Arts & Humanities'), 'Political science and public administration'),
  ('Psychology',          (SELECT field_id FROM fields WHERE field_name='Arts & Humanities'), 'Psychology and behavioural science'),
  ('English Literature',  (SELECT field_id FROM fields WHERE field_name='Arts & Humanities'), 'English language and literature'),
  ('Social Work',         (SELECT field_id FROM fields WHERE field_name='Arts & Humanities'), 'Social work and community development'),
  ('Economics',           (SELECT field_id FROM fields WHERE field_name='Arts & Humanities'), 'Economics and business analysis'),
  -- under Design
  ('Fashion Design', (SELECT field_id FROM fields WHERE field_name='Design'), 'Fashion and apparel design'),
  ('Fine Arts',      (SELECT field_id FROM fields WHERE field_name='Design'), 'Fine arts and applied arts'),
  -- under Education
  ('Physical Education', (SELECT field_id FROM fields WHERE field_name='Education'), 'Physical education and sports science')
ON CONFLICT (field_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Stage the program catalogue. career_name / field_name are resolved to ids
--    by the join in step 4, so a typo would simply drop a row (caught by the
--    diagnostic in step 5 before COMMIT).
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _new_programs (
  program_name                 VARCHAR,
  degree_type                  VARCHAR,
  field_of_study               VARCHAR,
  duration_years               INTEGER,
  total_cost_inr               INTEGER,
  average_starting_salary_inr  INTEGER,
  career_name                  VARCHAR,
  field_name                   VARCHAR
) ON COMMIT DROP;

INSERT INTO _new_programs
  (program_name, degree_type, field_of_study, duration_years, total_cost_inr, average_starting_salary_inr, career_name, field_name)
VALUES
  -- Mechanical Engineer (+ general engineering branches mapped to nearest career)
  ('B.Tech Mechanical Engineering',                    'Bachelors',    'Engineering', 4, 400000, 600000, 'Mechanical Engineer',            'Mechanical Engineering'),
  ('B.E. Mechanical Engineering',                      'Bachelors',    'Engineering', 4, 400000, 600000, 'Mechanical Engineer',            'Mechanical Engineering'),
  ('Diploma in Mechanical Engineering',                'Diploma',      'Engineering', 3, 150000, 300000, 'Mechanical Engineer',            'Mechanical Engineering'),
  ('B.Tech Electrical Engineering',                    'Bachelors',    'Engineering', 4, 400000, 650000, 'Mechanical Engineer',            'Electrical Engineering'),
  ('B.Tech Aerospace Engineering',                     'Bachelors',    'Engineering', 4, 450000, 700000, 'Mechanical Engineer',            'Aerospace Engineering'),
  ('B.Tech Chemical Engineering',                      'Bachelors',    'Engineering', 4, 400000, 650000, 'Mechanical Engineer',            'Chemical Engineering'),
  -- Civil Engineer
  ('B.Tech Civil Engineering',                         'Bachelors',    'Engineering', 4, 400000, 500000, 'Civil Engineer',                 'Civil Engineering'),
  ('B.E. Civil Engineering',                           'Bachelors',    'Engineering', 4, 400000, 500000, 'Civil Engineer',                 'Civil Engineering'),
  ('Diploma in Civil Engineering',                     'Diploma',      'Engineering', 3, 150000, 280000, 'Civil Engineer',                 'Civil Engineering'),
  -- Software Engineer
  ('B.Tech Computer Science and Engineering',          'Bachelors',    'Engineering', 4, 500000, 900000, 'Software Engineer',              'Computer Science'),
  ('B.Tech Information Technology',                     'Bachelors',    'Engineering', 4, 450000, 800000, 'Software Engineer',              'Information Technology'),
  ('Bachelor of Computer Applications (BCA)',          'Bachelors',    'Computer Applications', 3, 300000, 500000, 'Software Engineer',     'Computer Science'),
  ('Master of Computer Applications (MCA)',            'Masters',      'Computer Applications', 2, 250000, 700000, 'Software Engineer',     'Computer Science'),
  ('B.Tech Electronics and Communication Engineering', 'Bachelors',    'Engineering', 4, 450000, 750000, 'Software Engineer',              'Electronics and Communication Engineering'),
  -- Data Scientist
  ('B.Tech Computer Science (AI and Machine Learning)','Bachelors',    'Engineering', 4, 550000, 1000000, 'Data Scientist',                'Computer Science'),
  ('B.Sc Data Science',                                'Bachelors',    'Science', 3, 350000, 600000, 'Data Scientist',                     'Computer Science'),
  ('M.Sc Data Science',                                'Masters',      'Science', 2, 400000, 900000, 'Data Scientist',                     'Computer Science'),
  ('B.Sc Statistics',                                  'Bachelors',    'Science', 3, 150000, 500000, 'Data Scientist',                     'Mathematics'),
  -- Doctor (MBBS)
  ('MBBS',                                             'Bachelors',    'Medicine', 5, 2000000, 1000000, 'Doctor (MBBS)',                   'MBBS'),
  ('MD General Medicine',                              'Masters',      'Medicine', 3, 1500000, 1800000, 'Doctor (MBBS)',                   'MBBS'),
  -- Dentist
  ('Bachelor of Dental Surgery (BDS)',                 'Bachelors',    'Medicine', 5, 800000, 500000, 'Dentist',                          'Dentistry'),
  ('Master of Dental Surgery (MDS)',                   'Masters',      'Medicine', 3, 1200000, 900000, 'Dentist',                          'Dentistry'),
  -- Nurse
  ('B.Sc Nursing',                                     'Bachelors',    'Medicine', 4, 400000, 400000, 'Nurse',                            'Nursing'),
  ('General Nursing and Midwifery (GNM)',              'Diploma',      'Medicine', 3, 200000, 300000, 'Nurse',                            'Nursing'),
  -- Pharmacist
  ('Bachelor of Pharmacy (B.Pharm)',                   'Bachelors',    'Pharmacy', 4, 400000, 400000, 'Pharmacist',                       'Pharmacy'),
  ('Diploma in Pharmacy (D.Pharm)',                    'Diploma',      'Pharmacy', 2, 150000, 250000, 'Pharmacist',                       'Pharmacy'),
  ('Master of Pharmacy (M.Pharm)',                     'Masters',      'Pharmacy', 2, 300000, 600000, 'Pharmacist',                       'Pharmacy'),
  -- Corporate Lawyer
  ('BA LLB (Hons)',                                    'Bachelors',    'Law', 5, 600000, 700000, 'Corporate Lawyer',                      'Law'),
  ('LLB',                                              'Bachelors',    'Law', 3, 200000, 600000, 'Corporate Lawyer',                      'Law'),
  ('LLM Corporate Law',                                'Masters',      'Law', 2, 250000, 900000, 'Corporate Lawyer',                      'Corporate Law'),
  -- Chartered Accountant
  ('B.Com',                                            'Bachelors',    'Commerce', 3, 150000, 400000, 'Chartered Accountant',             'Commerce'),
  ('Chartered Accountancy (CA)',                       'Professional', 'Commerce', 4, 300000, 800000, 'Chartered Accountant',             'Chartered Accountancy'),
  ('B.Com Finance and Accountancy',                    'Bachelors',    'Commerce', 3, 200000, 450000, 'Chartered Accountant',             'Commerce'),
  -- Civil Services (IAS/IPS)
  ('BA Political Science',                             'Bachelors',    'Arts & Humanities', 3, 100000, 400000, 'Civil Services (IAS/IPS)', 'Political Science'),
  ('BA Public Administration',                         'Bachelors',    'Arts & Humanities', 3, 100000, 400000, 'Civil Services (IAS/IPS)', 'Political Science'),
  ('BA History',                                       'Bachelors',    'Arts & Humanities', 3, 100000, 350000, 'Civil Services (IAS/IPS)', 'Arts & Humanities'),
  -- Architect
  ('Bachelor of Architecture (B.Arch)',               'Bachelors',    'Architecture', 5, 600000, 500000, 'Architect',                     'Architecture'),
  ('Master of Architecture (M.Arch)',                 'Masters',      'Architecture', 2, 400000, 800000, 'Architect',                     'Architecture'),
  -- Teacher / Professor
  ('Bachelor of Education (B.Ed)',                     'Bachelors',    'Education', 2, 100000, 350000, 'Teacher / Professor',              'Education'),
  ('Master of Education (M.Ed)',                       'Masters',      'Education', 2, 120000, 450000, 'Teacher / Professor',              'Education'),
  ('B.Sc Physics',                                     'Bachelors',    'Science', 3, 120000, 400000, 'Teacher / Professor',              'Physics'),
  ('B.Sc Chemistry',                                   'Bachelors',    'Science', 3, 120000, 400000, 'Teacher / Professor',              'Chemistry'),
  ('B.Sc Mathematics',                                 'Bachelors',    'Science', 3, 120000, 450000, 'Teacher / Professor',              'Mathematics'),
  ('MA English Literature',                            'Masters',      'Arts & Humanities', 2, 80000, 400000, 'Teacher / Professor',       'English Literature'),
  -- Journalist
  ('BA Journalism and Mass Communication',            'Bachelors',    'Mass Communication', 3, 300000, 400000, 'Journalist',               'Mass Communication'),
  ('MA Mass Communication',                            'Masters',      'Mass Communication', 2, 250000, 500000, 'Journalist',               'Mass Communication'),
  -- Psychologist
  ('BA Psychology',                                    'Bachelors',    'Arts & Humanities', 3, 200000, 400000, 'Psychologist',             'Psychology'),
  ('MA Psychology',                                    'Masters',      'Arts & Humanities', 2, 200000, 550000, 'Psychologist',             'Psychology'),
  ('M.Sc Clinical Psychology',                         'Masters',      'Science', 2, 250000, 600000, 'Psychologist',                       'Psychology'),
  -- Fashion Designer
  ('B.Des Fashion Design',                             'Bachelors',    'Design', 4, 600000, 500000, 'Fashion Designer',                   'Fashion Design'),
  ('B.Sc Fashion Design',                              'Bachelors',    'Design', 3, 300000, 400000, 'Fashion Designer',                   'Fashion Design'),
  -- Film / Media Producer
  ('BA Film and Television Production',               'Bachelors',    'Mass Communication', 3, 500000, 500000, 'Film / Media Producer',     'Mass Communication'),
  ('B.Des Communication Design',                       'Bachelors',    'Design', 4, 600000, 600000, 'Film / Media Producer',              'Design'),
  -- Hotel Management Professional
  ('Bachelor of Hotel Management (BHM)',              'Bachelors',    'Hospitality', 4, 400000, 400000, 'Hotel Management Professional',  'Hospitality'),
  ('B.Sc Hospitality and Hotel Administration',       'Bachelors',    'Hospitality', 3, 350000, 400000, 'Hotel Management Professional',  'Hospitality'),
  -- Sports Management Professional
  ('BBA Sports Management',                            'Bachelors',    'Management', 3, 400000, 500000, 'Sports Management Professional', 'Management'),
  ('Bachelor of Physical Education (BPEd)',           'Bachelors',    'Education', 3, 150000, 350000, 'Sports Management Professional',  'Physical Education'),
  -- Social Worker
  ('Bachelor of Social Work (BSW)',                   'Bachelors',    'Arts & Humanities', 3, 100000, 300000, 'Social Worker',             'Social Work'),
  ('Master of Social Work (MSW)',                     'Masters',      'Arts & Humanities', 2, 120000, 400000, 'Social Worker',             'Social Work'),
  -- Agricultural Scientist
  ('B.Sc Agriculture',                                'Bachelors',    'Agriculture', 4, 200000, 450000, 'Agricultural Scientist',         'Agriculture'),
  ('B.Tech Agricultural Engineering',                 'Bachelors',    'Engineering', 4, 300000, 500000, 'Agricultural Scientist',         'Agriculture'),
  ('B.Sc Horticulture',                               'Bachelors',    'Agriculture', 4, 180000, 400000, 'Agricultural Scientist',         'Agriculture'),
  -- Graphic Designer
  ('B.Des Communication Design (Graphics)',           'Bachelors',    'Design', 4, 600000, 550000, 'Graphic Designer',                   'Design'),
  ('Bachelor of Fine Arts (BFA)',                     'Bachelors',    'Design', 4, 250000, 400000, 'Graphic Designer',                   'Fine Arts'),
  ('B.Sc Multimedia and Animation',                   'Bachelors',    'Design', 3, 350000, 450000, 'Graphic Designer',                   'Design'),
  -- Environmental Scientist
  ('B.Sc Environmental Science',                      'Bachelors',    'Science', 3, 150000, 400000, 'Environmental Scientist',            'Environmental Science'),
  ('M.Sc Environmental Science',                      'Masters',      'Science', 2, 180000, 550000, 'Environmental Scientist',            'Environmental Science'),
  ('B.Sc Biology',                                    'Bachelors',    'Science', 3, 120000, 400000, 'Environmental Scientist',            'Biology'),
  -- Economist / Business Analyst
  ('BA Economics',                                    'Bachelors',    'Arts & Humanities', 3, 200000, 500000, 'Economist / Business Analyst', 'Economics'),
  ('B.Sc Economics',                                  'Bachelors',    'Science', 3, 250000, 600000, 'Economist / Business Analyst',       'Economics'),
  ('Master of Business Administration (MBA)',         'Masters',      'Management', 2, 800000, 900000, 'Economist / Business Analyst',    'Management'),
  ('Bachelor of Business Administration (BBA)',       'Bachelors',    'Management', 3, 400000, 500000, 'Economist / Business Analyst',    'Management'),
  -- Event Manager / PR Professional
  ('BBA Event Management',                            'Bachelors',    'Management', 3, 400000, 450000, 'Event Manager / PR Professional', 'Management'),
  ('BA Public Relations and Event Management',        'Bachelors',    'Mass Communication', 3, 300000, 450000, 'Event Manager / PR Professional', 'Mass Communication');

-- ---------------------------------------------------------------------------
-- 4. Insert generic program rows that aren't already present.
--    JOINs resolve career_id (the mapping) and field_id.
-- ---------------------------------------------------------------------------
INSERT INTO programs
  (program_name, degree_type, field_of_study, duration_years, university_id,
   total_cost_inr, average_starting_salary_inr, international_students_allowed,
   career_id, field_name, field_id)
SELECT
  np.program_name, np.degree_type, np.field_of_study, np.duration_years, NULL,
  np.total_cost_inr, np.average_starting_salary_inr, FALSE,
  cp.career_id, np.field_name, f.field_id
FROM _new_programs np
JOIN career_profiles cp ON cp.career_name = np.career_name
JOIN fields            f  ON f.field_name  = np.field_name
WHERE NOT EXISTS (
  SELECT 1 FROM programs p
  WHERE p.program_name = np.program_name
    AND p.career_id    = cp.career_id
    AND p.university_id IS NULL
);

-- ---------------------------------------------------------------------------
-- 5. Diagnostic — any staged row whose career_name or field_name failed to
--    resolve (should return ZERO rows; shown before COMMIT for visibility).
-- ---------------------------------------------------------------------------
SELECT np.program_name,
       np.career_name,
       (cp.career_id IS NULL) AS missing_career,
       np.field_name,
       (f.field_id IS NULL)   AS missing_field
FROM _new_programs np
LEFT JOIN career_profiles cp ON cp.career_name = np.career_name
LEFT JOIN fields            f  ON f.field_name  = np.field_name
WHERE cp.career_id IS NULL OR f.field_id IS NULL;

COMMIT;

-- ---------------------------------------------------------------------------
-- Post-migration summary
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS total_programs FROM programs;
SELECT COUNT(DISTINCT career_id) AS careers_with_programs FROM programs WHERE career_id IS NOT NULL;
SELECT COUNT(*) AS total_fields FROM fields;
