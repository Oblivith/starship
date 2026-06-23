-- Migration 003: Phase 4.3 data expansion
-- Career profiles: 20 new rows (career_id 6–25)
-- Scholarships: 20 verified + 14 likely-real = 34 new rows

-- ============================================================
-- CAREER PROFILES
-- ============================================================

INSERT INTO career_profiles
  (career_name, primary_trait, secondary_trait,
   numerical_required, verbal_required, discipline_required, study_tolerance_required,
   required_exam, difficulty_level, typical_degree_duration,
   recommended_higher_study, work_life_balance, income_growth,
   job_market_demand, research_orientation)
VALUES
('Software Engineer', 'I', 'R', 4, 2, 3, 3, 'JEE / GATE (optional)', 3, 4, false, 3, 5, 5, 2),
('Civil Services (IAS/IPS)', 'E', 'S', 3, 4, 5, 5, 'UPSC CSE', 5, 4, false, 2, 3, 2, 2),
('Architect', 'A', 'R', 3, 2, 3, 3, 'NATA / JEE Paper 2', 4, 5, false, 3, 3, 3, 2),
('Teacher / Professor', 'S', 'I', 2, 4, 3, 3, 'UGC NET / CTET', 3, 4, true, 5, 2, 3, 3),
('Journalist', 'A', 'E', 1, 5, 2, 2, 'IIMC Entrance / Mass Media Entrance', 3, 3, false, 2, 3, 3, 2),
('Psychologist', 'I', 'S', 2, 4, 3, 4, 'University Entrance / NIMHANS Entrance', 4, 5, true, 4, 3, 4, 4),
('Nurse', 'S', 'R', 2, 3, 4, 3, 'NEET / BSc Nursing Entrance', 3, 4, false, 2, 3, 5, 1),
('Pharmacist', 'I', 'C', 3, 2, 4, 4, 'NEET / D.Pharm Entrance', 4, 4, false, 4, 3, 4, 2),
('Fashion Designer', 'A', 'E', 1, 2, 3, 2, 'NID Entrance / NIFT Entrance', 3, 4, false, 3, 4, 3, 1),
('Film / Media Producer', 'A', 'E', 1, 4, 3, 2, 'FTII Entrance / SRFTI Entrance', 3, 3, false, 2, 4, 3, 1),
('Hotel Management Professional', 'E', 'S', 2, 3, 3, 2, 'NCHM JEE', 3, 3, false, 2, 3, 4, 1),
('Sports Management Professional', 'E', 'S', 2, 3, 3, 2, 'CAT / SPJIMR Sports Mgmt Entrance', 3, 2, false, 3, 3, 3, 1),
('Social Worker', 'S', 'E', 1, 4, 3, 3, 'MSW Entrance / University Admission', 3, 4, true, 4, 2, 3, 2),
('Agricultural Scientist', 'I', 'R', 3, 2, 4, 4, 'ICAR AIEEA / CUET', 4, 4, true, 4, 3, 3, 4),
('Graphic Designer', 'A', 'R', 1, 2, 3, 2, 'NID Entrance / Portfolio-based Admission', 3, 4, false, 4, 3, 4, 1),
('Civil Engineer', 'R', 'I', 3, 1, 3, 4, 'JEE Main / JEE Advanced', 4, 4, false, 3, 3, 4, 2),
('Dentist', 'I', 'S', 2, 2, 4, 5, 'NEET UG', 5, 5, false, 3, 4, 4, 2),
('Environmental Scientist', 'I', 'R', 3, 3, 4, 4, 'CUET / University Entrance / GATE', 4, 4, true, 4, 3, 3, 4),
('Economist / Business Analyst', 'I', 'C', 4, 3, 3, 3, 'CUET / CAT / University Entrance', 4, 4, false, 3, 4, 4, 3),
('Event Manager / PR Professional', 'E', 'A', 1, 4, 3, 2, 'Mass Media Entrance / University Admission', 2, 3, false, 3, 3, 4, 1);

-- ============================================================
-- SCHOLARSHIPS — 20 VERIFIED
-- ============================================================

INSERT INTO scholarships
  (scholarship_name, provider, income_limit_inr, min_percentage,
   amount_max_inr, application_start_date, application_end_date,
   application_url, renewable, notes, competitiveness_level)
VALUES
('PM Scholarship Scheme (PMSS)',
 'Dept of Ex-Servicemen Welfare (MoD)',
 NULL, 60, 42000, NULL, NULL,
 'https://ksb.gov.in/pmss.htm', true,
 'For wards/widows of ex-servicemen, ex-Coast Guard. Rs 30,000/yr boys, Rs 36,000/yr girls (revised 2024). No income bar. National.',
 2),

('Pre Matric Scholarship for SC Students',
 'Ministry of Social Justice & Empowerment',
 200000, 0, 10000, NULL, NULL,
 'https://scholarships.gov.in', true,
 'Category: SC. Class 9-10. Income <= Rs 2 lakh. National (centrally sponsored, state implementation). Renewable.',
 1),

('Post Matric Scholarship for OBC Students',
 'Ministry of Social Justice & Empowerment',
 100000, 0, 15000, NULL, NULL,
 'https://scholarships.gov.in', true,
 'Category: OBC. Post-matric level. Income <= Rs 1 lakh. National. Covers maintenance + fees.',
 1),

('Scholarship for Top Class Education (SC)',
 'Ministry of Social Justice & Empowerment',
 600000, 0, 300000, NULL, NULL,
 'https://scholarships.gov.in', true,
 'Category: SC. For admission to listed top-class institutes (IITs, NITs, IIMs etc). Covers full tuition + Rs 2,220/month maintenance. National.',
 3),

('Pre Matric Scholarship for Minority Students',
 'Ministry of Minority Affairs',
 100000, 50, 10500, NULL, NULL,
 'https://scholarships.gov.in', true,
 'Category: Minority (Muslim, Christian, Sikh, Buddhist, Parsi, Jain). Class 1-10. Income <= Rs 1 lakh. National.',
 1),

('Post Matric Scholarship for Minority Students',
 'Ministry of Minority Affairs',
 200000, 50, 20000, NULL, NULL,
 'https://scholarships.gov.in', true,
 'Category: Minority. Class 11 onwards including UG/PG. Income <= Rs 2 lakh. National.',
 1),

('Merit cum Means Scholarship for Minorities (MCM)',
 'Ministry of Minority Affairs',
 250000, 50, 30000, NULL, NULL,
 'https://scholarships.gov.in', true,
 'Category: Minority. Technical/professional courses only. Income <= Rs 2.5 lakh. 30% slots reserved for girls. National.',
 2),

('Maulana Azad National Fellowship (MANF)',
 'Ministry of Minority Affairs / UGC',
 600000, 55, 420000, NULL, NULL,
 'https://manf.ucanapply.com', true,
 'Category: Minority. M.Phil/PhD level only. Rs 31,000-35,000/month + HRA + contingency. Income <= Rs 6 lakh. National.',
 4),

('ISHAN UDAY — Special Scholarship Scheme for NE Students',
 'UGC',
 450000, 60, 75600, NULL, NULL,
 'https://scholarships.gov.in', true,
 'State: NE states (Assam, Manipur, Meghalaya, Mizoram, Nagaland, Sikkim, Tripura, Arunachal Pradesh). UG only. Rs 5,400-7,800/month. Income <= Rs 4.5 lakh. National scheme.',
 2),

('Indira Gandhi PG Scholarship for Single Girl Child',
 'UGC',
 NULL, 55, 36200, NULL, NULL,
 'https://ugc.ac.in/scholarshipandfellowship', true,
 'Gender: Female only (single girl child of family). PG first year. Non-professional courses only. Rs 36,200/year for 2 years. No income limit. National.',
 3),

('Rajiv Gandhi National Fellowship for ST Students (RGNF)',
 'Ministry of Tribal Affairs / UGC',
 NULL, 55, 420000, NULL, NULL,
 'https://ugc.ac.in/scholarshipandfellowship', true,
 'Category: ST. M.Phil/PhD. Rs 31,000-35,000/month + HRA + contingency. National. 667 slots/year.',
 4),

('National Fellowship for SC Students (NF-SC)',
 'Ministry of Social Justice & Empowerment / UGC',
 NULL, 55, 420000, NULL, NULL,
 'https://ugc.ac.in/scholarshipandfellowship', true,
 'Category: SC. M.Phil/PhD. Rs 31,000-35,000/month + HRA + contingency. 2,000 slots/year. National.',
 4),

('National Talent Search Examination (NTSE) Scholarship',
 'NCERT',
 NULL, 0, 24000, NULL, NULL,
 'https://ncert.nic.in/ntse.php', true,
 'Pure merit. Class 10 students. Rs 1,250/month (Class 11-12), Rs 2,000/month (UG/PG). Highly competitive entrance exam. National.',
 5),

('National Means cum Merit Scholarship (NMMS)',
 'Ministry of Education',
 150000, 55, 12000, NULL, NULL,
 'https://scholarships.gov.in', true,
 'Income <= Rs 1.5 lakh. Class 8 students; continues till Class 12. Rs 12,000/year (Rs 1,000/month). Merit + means test. National.',
 3),

('AICTE Tuition Fee Waiver Scheme',
 'AICTE',
 800000, 60, 120000, NULL, NULL,
 'https://scholarships.gov.in', true,
 'Income <= Rs 8 lakh. EWS/SC/ST students in AICTE-approved institutes. Full tuition fee waiver up to Rs 1.2 lakh/year. National.',
 2),

('ONGC Scholarship for SC/ST Students',
 'ONGC Foundation',
 200000, 60, 48000, NULL, NULL,
 'https://ongcscholar.org', true,
 'Category: SC/ST. Engineering/MBBS/MBA students. Rs 48,000/year. Income <= Rs 2 lakh. Merit-based selection. National PSU scheme.',
 3),

('LIC Golden Jubilee Foundation Scholarship',
 'LIC of India',
 100000, 60, 20000, NULL, NULL,
 'https://licindia.in/home/golden-jubilee-foundation', true,
 'Income <= Rs 1 lakh. Class 11/12 or diploma first year. Rs 10,000/year (boys) or Rs 20,000/year (girls). Gender preference to girls. National.',
 2),

('IOC Educational Scholarship',
 'Indian Oil Corporation (IOCL)',
 100000, 65, 30000, NULL, NULL,
 'https://scholarships.gov.in', true,
 'Income <= Rs 1 lakh. SC/ST/OBC/EWS students in engineering, medical, MBA, and Class 10-12. Rs 20,000-30,000/year. National PSU scheme.',
 2),

('BPCL B.R. Ambedkar Scholarship',
 'Bharat Petroleum Corporation Ltd (BPCL)',
 150000, 60, 25000, NULL, NULL,
 'https://bharatpetroleum.in/csr', true,
 'Category: SC/ST/OBC. Technical courses preferred. Income <= Rs 1.5 lakh. Rs 25,000/year. National PSU scheme.',
 2),

('Coal India Scholarship Scheme',
 'Coal India Limited (CIL)',
 NULL, 60, 25000, NULL, NULL,
 'https://coalindia.in', true,
 'For wards of CIL employees only. Merit-based. Engineering/Medical/CA courses. No income bar. National PSU scheme.',
 2);

-- ============================================================
-- SCHOLARSHIPS — 14 LIKELY REAL (approved subset)
-- Executing: 21, 22, 23, 25, 26, 27, 28, 29, 30, 32, 33, 36, 37, 40
-- Skipped: 24 (TN CM), 31 (Punjab SC), 34 (Vidyasaarathi), 35 (NTPC),
--          38 (Byju's), 39 (Manipur)
-- ============================================================

INSERT INTO scholarships
  (scholarship_name, provider, income_limit_inr, min_percentage,
   amount_max_inr, application_start_date, application_end_date,
   application_url, renewable, notes, competitiveness_level)
VALUES

-- #21
('Swami Vivekananda Merit cum Means Scholarship',
 'Government of West Bengal',
 250000, 75, 60000, NULL, NULL,
 'https://svmcm.wbhed.gov.in', true,
 'State: West Bengal. Class 11 to PhD. Rs 1,500-5,000/month depending on level. Income <= Rs 2.5 lakh. WB domicile required.',
 3),

-- #22
('Maharashtra Government Post Matric Scholarship',
 'Government of Maharashtra',
 250000, 50, 40000, NULL, NULL,
 'https://mahadbt.maharashtra.gov.in', true,
 'State: Maharashtra. Category: SC/NT/OBC. Post-matric courses. Income <= Rs 2.5 lakh (SC) / Rs 1.5 lakh (OBC). Via MahaDBT portal.',
 1),

-- #23
('Rajasthan Mukhyamantri Anuprati Coaching Yojana',
 'Government of Rajasthan',
 800000, 0, 40000, NULL, NULL,
 'https://sje.rajasthan.gov.in', false,
 'State: Rajasthan. Category: SC/ST/OBC/EWS/MBC. Free coaching support for UPSC/RPSC/JEE/NEET/CLAT. Income <= Rs 8 lakh. Covers coaching fees + Rs 40,000/year living allowance.',
 3),

-- #25 — with modified note per instruction
('Karnataka SC/ST Post Matric Scholarship',
 'Government of Karnataka',
 250000, 50, 35000, NULL, NULL,
 'https://sw.kar.nic.in', true,
 'State: Karnataka. Category: SC/ST. Post-matric courses. Income <= Rs 2.5 lakh. KA domicile required. NOTE: income ceiling figures need 2024 verification.',
 1),

-- #26
('Bihar Post Matric Scholarship (SC/BC/EBC)',
 'Government of Bihar',
 300000, 0, 25000, NULL, NULL,
 'https://pmsonline.bih.nic.in', true,
 'State: Bihar. Category: SC/BC/EBC. Post-matric courses. Income <= Rs 3 lakh (SC) / Rs 1.5 lakh (BC/EBC). Bihar domicile.',
 1),

-- #27
('Uttar Pradesh Post Matric Scholarship',
 'Government of Uttar Pradesh',
 250000, 0, 30000, NULL, NULL,
 'https://scholarship.up.gov.in', true,
 'State: Uttar Pradesh. Category: SC/ST/OBC/General (income-based). Post-matric. Income <= Rs 2.5 lakh. UP domicile.',
 1),

-- #28
('Odisha Post Matric Scholarship',
 'Government of Odisha',
 250000, 0, 30000, NULL, NULL,
 'https://scholarship.odisha.gov.in', true,
 'State: Odisha. Category: SC/ST/OBC/SEBC. Post-matric. Income <= Rs 2.5 lakh. Odisha domicile.',
 1),

-- #29
('Telangana ePASS Post Matric Scholarship',
 'Government of Telangana',
 200000, 0, 35000, NULL, NULL,
 'https://telanganaepass.cgg.gov.in', true,
 'State: Telangana. Category: SC/ST/BC/EBC/Minority. Post-matric. Income <= Rs 2 lakh. TS domicile.',
 1),

-- #30
('Andhra Pradesh ePass Post Matric Scholarship',
 'Government of Andhra Pradesh',
 200000, 0, 35000, NULL, NULL,
 'https://apepass.cgg.gov.in', true,
 'State: Andhra Pradesh. Category: SC/ST/BC/EBC/Minority. Post-matric. Income <= Rs 2 lakh. AP domicile.',
 1),

-- #32
('HDFC Bank Parivartan''s ECS Scholarship',
 'HDFC Bank',
 250000, 55, 75000, NULL, NULL,
 'https://www.b4s.in/hdfc', true,
 'Private bank CSR scheme. Class 10 onwards to UG. Income <= Rs 2.5 lakh. Rs 75,000/year. Merit + means. National.',
 3),

-- #33
('Sitaram Jindal Foundation Scholarship',
 'Sitaram Jindal Foundation',
 150000, 55, 36000, NULL, NULL,
 'https://sitaramjindalfoundation.org', true,
 'Private foundation. Class 11 to PG level. Income <= Rs 1.5 lakh. Rs 700-3,000/month by course level. Gender preference to girls. National.',
 2),

-- #36
('Reliance Foundation Undergraduate Scholarship',
 'Reliance Foundation',
 600000, 60, 200000, NULL, NULL,
 'https://reliancefoundation.org/scholarship', false,
 'Private. UG students in STEM + humanities. Income <= Rs 6 lakh. Rs 2,00,000/year + mentorship. Merit + means. National. Highly competitive.',
 5),

-- #37
('Kotak Kanya Scholarship',
 'Kotak Education Foundation',
 300000, 75, 150000, NULL, NULL,
 'https://kotakeducation.org', true,
 'Gender: Girls only. Class 12 pass entering professional UG courses (Engg/Medical/Law/CA). Income <= Rs 3 lakh. Rs 1,50,000/year. National.',
 3),

-- #40
('Dr Ambedkar Post Matric Scholarship for EBC/DNT',
 'Ministry of Social Justice & Empowerment',
 300000, 0, 20000, NULL, NULL,
 'https://scholarships.gov.in', true,
 'Category: Economically Backward Classes (EBC) and Denotified/Nomadic/Semi-Nomadic Tribes (DNT). Income <= Rs 3 lakh. National. NSP scheme.',
 1);
