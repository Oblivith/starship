-- Phase 7A: populate salary / education_path / top_recruiters / growth_outlook
-- for all 25 career profiles. Figures are realistic Indian-market values
-- (INR per year). Run after 004_career_profiles_expansion.sql.
--
-- Notes:
--   * salary_min_inr / salary_max_inr span typical entry-level to a few-years
--     experienced practitioner in India.
--   * education_path uses dollar-quoting ($j$...$j$) so apostrophes in the steps
--     don't need escaping.
--   * growth_outlook reflects the current (2026) Indian job market.

BEGIN;

-- 1. Mechanical Engineer
UPDATE career_profiles SET
  salary_min_inr = 350000,
  salary_max_inr = 1500000,
  growth_outlook = 'Moderate',
  top_recruiters = ARRAY['Tata Motors','Mahindra & Mahindra','Larsen & Toubro','Maruti Suzuki','Bosch','Siemens']::text[],
  education_path = $j${"steps": ["Take Physics, Chemistry and Maths (PCM) in Class 11-12", "Clear JEE Main / JEE Advanced", "Complete B.Tech in Mechanical Engineering (4 years)", "Take GATE for PSU jobs or pursue an M.Tech specialization", "Build core experience through design and manufacturing internships"]}$j$::jsonb
WHERE career_name = 'Mechanical Engineer';

-- 2. Doctor (MBBS)
UPDATE career_profiles SET
  salary_min_inr = 600000,
  salary_max_inr = 2500000,
  growth_outlook = 'High',
  top_recruiters = ARRAY['AIIMS','Apollo Hospitals','Fortis Healthcare','Max Healthcare','Manipal Hospitals','Government Health Services']::text[],
  education_path = $j${"steps": ["Take Physics, Chemistry and Biology (PCB) in Class 11-12", "Clear NEET UG", "Complete MBBS including the rotating internship (5.5 years)", "Register with the State / National Medical Council to practise", "Clear NEET PG for an MD / MS specialization"]}$j$::jsonb
WHERE career_name = 'Doctor (MBBS)';

-- 3. Corporate Lawyer
UPDATE career_profiles SET
  salary_min_inr = 600000,
  salary_max_inr = 2000000,
  growth_outlook = 'High',
  top_recruiters = ARRAY['Cyril Amarchand Mangaldas','Shardul Amarchand Mangaldas','AZB & Partners','Khaitan & Co','Trilegal','J Sagar Associates']::text[],
  education_path = $j${"steps": ["Clear CLAT or AILET after Class 12", "Complete the 5-year integrated BA LLB at a National Law University", "Intern with corporate law firms during the degree", "Clear the All India Bar Examination (AIBE) to practise", "Optionally pursue an LLM in corporate or commercial law"]}$j$::jsonb
WHERE career_name = 'Corporate Lawyer';

-- 4. Data Scientist
UPDATE career_profiles SET
  salary_min_inr = 600000,
  salary_max_inr = 2500000,
  growth_outlook = 'High',
  top_recruiters = ARRAY['Google','Amazon','Microsoft','Flipkart','Fractal Analytics','Mu Sigma']::text[],
  education_path = $j${"steps": ["Earn a Bachelor's in Computer Science, Statistics, Maths or Engineering", "Master Python, SQL, statistics and machine learning", "Build a portfolio of real projects on Kaggle and GitHub", "Earn certifications in cloud ML and deep learning", "Optionally complete an M.Tech / MS in Data Science or AI"]}$j$::jsonb
WHERE career_name = 'Data Scientist';

-- 5. Chartered Accountant
UPDATE career_profiles SET
  salary_min_inr = 700000,
  salary_max_inr = 2000000,
  growth_outlook = 'High',
  top_recruiters = ARRAY['Deloitte','PwC','EY','KPMG','Grant Thornton','Reliance Industries']::text[],
  education_path = $j${"steps": ["Register for and clear CA Foundation after Class 12", "Clear both groups of CA Intermediate", "Complete 3 years of articleship under a practising CA", "Clear CA Final", "Become an ICAI member and specialize in audit, tax or finance"]}$j$::jsonb
WHERE career_name = 'Chartered Accountant';

-- 6. Software Engineer
UPDATE career_profiles SET
  salary_min_inr = 500000,
  salary_max_inr = 2500000,
  growth_outlook = 'High',
  top_recruiters = ARRAY['TCS','Infosys','Google','Microsoft','Amazon','Flipkart']::text[],
  education_path = $j${"steps": ["Take PCM and clear JEE / a state engineering entrance", "Complete B.Tech / BE in CSE or IT (or BCA followed by MCA)", "Master data structures, algorithms and a programming language", "Build projects and contribute to open source; do internships", "Specialize in an area such as cloud, AI or backend systems"]}$j$::jsonb
WHERE career_name = 'Software Engineer';

-- 7. Civil Services (IAS/IPS)
UPDATE career_profiles SET
  salary_min_inr = 700000,
  salary_max_inr = 1800000,
  growth_outlook = 'Moderate',
  top_recruiters = ARRAY['Government of India','State Governments','Central Ministries','Union Public Service Commission','Public Sector Administration']::text[],
  education_path = $j${"steps": ["Complete any Bachelor's degree (the only eligibility requirement)", "Prepare for the UPSC Civil Services Examination and pick an optional subject", "Clear the Prelims, then the Mains, then the Personality Test", "Undergo training at LBSNAA / the respective service academy", "Take charge of a cadre posting as an IAS / IPS / IFS officer"]}$j$::jsonb
WHERE career_name = 'Civil Services (IAS/IPS)';

-- 8. Architect
UPDATE career_profiles SET
  salary_min_inr = 400000,
  salary_max_inr = 1500000,
  growth_outlook = 'Moderate',
  top_recruiters = ARRAY['L&T Construction','Morphogenesis','Hafeez Contractor','CP Kukreja Architects','DLF','Gensler']::text[],
  education_path = $j${"steps": ["Take PCM in Class 11-12", "Clear NATA or JEE Main Paper 2 (B.Arch)", "Complete a 5-year B.Arch from a COA-recognized college", "Register with the Council of Architecture to practise", "Optionally pursue an M.Arch or urban design specialization"]}$j$::jsonb
WHERE career_name = 'Architect';

-- 9. Teacher / Professor
UPDATE career_profiles SET
  salary_min_inr = 350000,
  salary_max_inr = 1200000,
  growth_outlook = 'Moderate',
  top_recruiters = ARRAY['Kendriya Vidyalaya Sangathan','Delhi Public School','Central & State Universities','Amity University','Allen Career Institute','Vedantu']::text[],
  education_path = $j${"steps": ["Complete a Bachelor's degree in your subject", "For school teaching, complete a B.Ed and clear CTET / state TET", "For college teaching, complete a Master's and clear UGC NET", "Pursue a PhD to qualify for Assistant Professor and research roles", "Build teaching experience and specialize in your field"]}$j$::jsonb
WHERE career_name = 'Teacher / Professor';

-- 10. Journalist
UPDATE career_profiles SET
  salary_min_inr = 300000,
  salary_max_inr = 1000000,
  growth_outlook = 'Moderate',
  top_recruiters = ARRAY['The Times of India','The Hindu','NDTV','India Today','Hindustan Times','The Indian Express']::text[],
  education_path = $j${"steps": ["Complete a Bachelor's in Journalism / Mass Communication (BJMC)", "Clear the IIMC or a mass-comm entrance for a PG diploma", "Build a portfolio through internships at newspapers and channels", "Specialize in broadcast, digital or investigative journalism", "Develop a strong digital and social-media presence"]}$j$::jsonb
WHERE career_name = 'Journalist';

-- 11. Psychologist
UPDATE career_profiles SET
  salary_min_inr = 350000,
  salary_max_inr = 1200000,
  growth_outlook = 'High',
  top_recruiters = ARRAY['NIMHANS','Fortis Healthcare','Apollo Hospitals','YourDOST','1to1help','Schools & EAP providers']::text[],
  education_path = $j${"steps": ["Complete a BA / BSc in Psychology", "Complete an MA / MSc in Psychology (clinical, counselling or organizational)", "For clinical practice, pursue an RCI-recognized M.Phil in Clinical Psychology", "Register with the Rehabilitation Council of India (clinical track)", "Complete supervised internship and practice hours"]}$j$::jsonb
WHERE career_name = 'Psychologist';

-- 12. Nurse
UPDATE career_profiles SET
  salary_min_inr = 300000,
  salary_max_inr = 800000,
  growth_outlook = 'High',
  top_recruiters = ARRAY['AIIMS','Apollo Hospitals','Fortis Healthcare','Max Healthcare','Manipal Hospitals','Government Hospitals']::text[],
  education_path = $j${"steps": ["Take PCB in Class 11-12", "Clear NEET / a state B.Sc Nursing entrance", "Complete B.Sc Nursing (4 years)", "Register with the State / Indian Nursing Council", "Optionally pursue an M.Sc Nursing or an ICU / paediatric specialization"]}$j$::jsonb
WHERE career_name = 'Nurse';

-- 13. Pharmacist
UPDATE career_profiles SET
  salary_min_inr = 300000,
  salary_max_inr = 900000,
  growth_outlook = 'Moderate',
  top_recruiters = ARRAY['Sun Pharma','Cipla','Dr. Reddy''s Laboratories','Lupin','Biocon','Apollo Pharmacy']::text[],
  education_path = $j${"steps": ["Take PCB / PCM in Class 11-12", "Complete a D.Pharm or B.Pharm from a PCI-recognized institute", "Register with the State Pharmacy Council to practise", "Optionally pursue an M.Pharm or Pharm.D for clinical and industry roles", "Specialize in clinical pharmacy, regulatory affairs or R&D"]}$j$::jsonb
WHERE career_name = 'Pharmacist';

-- 14. Fashion Designer
UPDATE career_profiles SET
  salary_min_inr = 300000,
  salary_max_inr = 1200000,
  growth_outlook = 'Moderate',
  top_recruiters = ARRAY['Aditya Birla Fashion','Reliance Brands','Raymond','FabIndia','Myntra','Designer Labels']::text[],
  education_path = $j${"steps": ["Build a creative portfolio in Class 11-12", "Clear the NIFT or NID entrance", "Complete a Bachelor's in Fashion Design (B.Des, 4 years)", "Intern with designers and fashion houses", "Specialize in apparel, textiles or accessories, or launch a label"]}$j$::jsonb
WHERE career_name = 'Fashion Designer';

-- 15. Film / Media Producer
UPDATE career_profiles SET
  salary_min_inr = 400000,
  salary_max_inr = 1500000,
  growth_outlook = 'High',
  top_recruiters = ARRAY['Yash Raj Films','Dharma Productions','Netflix','Amazon Prime Video','Balaji Telefilms','Red Chillies Entertainment']::text[],
  education_path = $j${"steps": ["Complete a Bachelor's in Film, Media or Mass Communication", "Clear the FTII or SRFTI entrance for specialized training", "Learn production, editing and direction hands-on", "Build a reel through short films and on-set internships", "Work up from assistant roles while building an industry network"]}$j$::jsonb
WHERE career_name = 'Film / Media Producer';

-- 16. Hotel Management Professional
UPDATE career_profiles SET
  salary_min_inr = 300000,
  salary_max_inr = 900000,
  growth_outlook = 'Moderate',
  top_recruiters = ARRAY['Taj Hotels (IHCL)','The Oberoi Group','ITC Hotels','Marriott','Hyatt','Radisson']::text[],
  education_path = $j${"steps": ["Clear NCHM JEE after Class 12", "Complete a B.Sc in Hospitality & Hotel Administration from an IHM", "Complete industrial training and internships at hotels", "Specialize in food & beverage, front office or culinary operations", "Optionally pursue an MBA in Hospitality for management roles"]}$j$::jsonb
WHERE career_name = 'Hotel Management Professional';

-- 17. Sports Management Professional
UPDATE career_profiles SET
  salary_min_inr = 400000,
  salary_max_inr = 1200000,
  growth_outlook = 'High',
  top_recruiters = ARRAY['JSW Sports','Star Sports','Dream11','Decathlon','BCCI','IMG Reliance']::text[],
  education_path = $j${"steps": ["Complete a Bachelor's degree (sports or business background helps)", "Clear CAT or an entrance for a sports management programme", "Complete an MBA / PG Diploma in Sports Management", "Intern with leagues, franchises or sports agencies", "Specialize in marketing, operations or athlete management"]}$j$::jsonb
WHERE career_name = 'Sports Management Professional';

-- 18. Social Worker
UPDATE career_profiles SET
  salary_min_inr = 250000,
  salary_max_inr = 700000,
  growth_outlook = 'Moderate',
  top_recruiters = ARRAY['CRY','Pratham','Smile Foundation','Teach For India','UNICEF','Tata Trusts']::text[],
  education_path = $j${"steps": ["Complete a Bachelor's (BA in Sociology or Social Work helps)", "Complete a Master of Social Work (MSW)", "Do supervised fieldwork and internships with NGOs", "Specialize in community development, medical social work or CSR", "Build domain expertise in areas like child rights or public health"]}$j$::jsonb
WHERE career_name = 'Social Worker';

-- 19. Agricultural Scientist
UPDATE career_profiles SET
  salary_min_inr = 400000,
  salary_max_inr = 1200000,
  growth_outlook = 'Moderate',
  top_recruiters = ARRAY['ICAR','IFFCO','Mahindra Agri','ITC Agri Business','Bayer CropScience','State Agriculture Departments']::text[],
  education_path = $j${"steps": ["Take PCB / Agriculture in Class 11-12", "Clear ICAR AIEEA or CUET", "Complete a B.Sc (Hons) in Agriculture (4 years)", "Pursue an M.Sc and clear the ICAR NET / ASRB for research roles", "Optionally complete a PhD for senior scientist positions"]}$j$::jsonb
WHERE career_name = 'Agricultural Scientist';

-- 20. Graphic Designer
UPDATE career_profiles SET
  salary_min_inr = 300000,
  salary_max_inr = 1000000,
  growth_outlook = 'High',
  top_recruiters = ARRAY['Ogilvy','Leo Burnett','Zomato','Swiggy','Razorpay','Wieden+Kennedy']::text[],
  education_path = $j${"steps": ["Build a design portfolio in Class 11-12", "Clear the NID / college entrance or apply portfolio-based", "Complete a Bachelor's in Design or Applied Arts (B.Des / BFA)", "Master industry tools such as the Adobe Suite and Figma", "Intern and specialize in branding, UI or motion design"]}$j$::jsonb
WHERE career_name = 'Graphic Designer';

-- 21. Civil Engineer
UPDATE career_profiles SET
  salary_min_inr = 350000,
  salary_max_inr = 1200000,
  growth_outlook = 'Moderate',
  top_recruiters = ARRAY['Larsen & Toubro','Tata Projects','Shapoorji Pallonji','Afcons Infrastructure','GMR Group','DLF']::text[],
  education_path = $j${"steps": ["Take PCM in Class 11-12", "Clear JEE Main / JEE Advanced", "Complete B.Tech in Civil Engineering (4 years)", "Take GATE for an M.Tech or PSU jobs", "Gain site experience and pursue structural or PMP specialization"]}$j$::jsonb
WHERE career_name = 'Civil Engineer';

-- 22. Dentist
UPDATE career_profiles SET
  salary_min_inr = 400000,
  salary_max_inr = 1200000,
  growth_outlook = 'Low',
  top_recruiters = ARRAY['Apollo White Dental','Clove Dental','Fortis Healthcare','Dentsply Sirona','Dental Colleges','Private Clinics']::text[],
  education_path = $j${"steps": ["Take PCB in Class 11-12", "Clear NEET UG", "Complete BDS including the internship (5 years)", "Register with the Dental Council of India", "Pursue an MDS specialization or set up your own practice"]}$j$::jsonb
WHERE career_name = 'Dentist';

-- 23. Environmental Scientist
UPDATE career_profiles SET
  salary_min_inr = 350000,
  salary_max_inr = 1000000,
  growth_outlook = 'High',
  top_recruiters = ARRAY['TERI','Central Pollution Control Board','NTPC','ERM','Tata Power','Environmental Consultancies']::text[],
  education_path = $j${"steps": ["Take PCB / PCM in Class 11-12", "Clear CUET or a university entrance", "Complete a B.Sc in Environmental Science", "Complete an M.Sc (take GATE for PSU and research roles)", "Specialize in EIA, sustainability or pollution control; optionally a PhD"]}$j$::jsonb
WHERE career_name = 'Environmental Scientist';

-- 24. Economist / Business Analyst
UPDATE career_profiles SET
  salary_min_inr = 500000,
  salary_max_inr = 1800000,
  growth_outlook = 'High',
  top_recruiters = ARRAY['Reserve Bank of India','NITI Aayog','McKinsey & Company','Deloitte','CRISIL','World Bank']::text[],
  education_path = $j${"steps": ["Complete a Bachelor's in Economics (BA / BSc Hons)", "Build skills in statistics, Excel and SQL", "Complete a Master's in Economics (or an MBA for business analysis)", "Intern with research, policy or consulting firms", "Specialize in econometrics, policy or financial analysis"]}$j$::jsonb
WHERE career_name = 'Economist / Business Analyst';

-- 25. Event Manager / PR Professional
UPDATE career_profiles SET
  salary_min_inr = 300000,
  salary_max_inr = 1000000,
  growth_outlook = 'Moderate',
  top_recruiters = ARRAY['Wizcraft','Percept','Adfactors PR','Edelman India','Showtime Events','Teamwork Arts']::text[],
  education_path = $j${"steps": ["Complete a Bachelor's in Mass Communication or Event Management", "Optionally complete a PG diploma in PR or Event Management", "Intern with event and PR agencies", "Build a network and a portfolio of executed events", "Specialize in corporate events, celebrity PR or digital PR"]}$j$::jsonb
WHERE career_name = 'Event Manager / PR Professional';

COMMIT;
