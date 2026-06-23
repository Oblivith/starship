-- migrations/006_country_salaries.sql
-- Add per-country salary data to career_profiles.
-- Run ONCE: /opt/homebrew/bin/psql -d career_counseling_system -f migrations/006_country_salaries.sql
--
-- Schema for each country_salary entry:
--   "IN": { min_inr, max_inr, min_local, max_local, currency_symbol, currency_code, growth_outlook }
--
-- India (IN) min_inr/max_inr must match the existing salary_min_inr / salary_max_inr columns exactly.
-- All figures are realistic mid-career annual totals (not currency conversions of India figures).
-- Conversion rates used for min_inr/max_inr of non-INR entries:
--   USD×84, GBP×106, CAD×62, AUD×55, SGD×63, HKD×11, AED×23, EUR×91
-- "EU" is treated as a single region (representative Western European market).

BEGIN;

ALTER TABLE career_profiles
ADD COLUMN IF NOT EXISTS country_salary JSONB;

-- ─── 1. Agricultural Scientist ────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":400000,"max_inr":1200000,"min_local":400000,"max_local":1200000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"Moderate"},
  "US": {"min_inr":5040000,"max_inr":8400000,"min_local":60000,"max_local":100000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"Moderate"},
  "GB": {"min_inr":3710000,"max_inr":6890000,"min_local":35000,"max_local":65000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"Moderate"},
  "CA": {"min_inr":3410000,"max_inr":6200000,"min_local":55000,"max_local":100000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"Moderate"},
  "AU": {"min_inr":3575000,"max_inr":6050000,"min_local":65000,"max_local":110000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":2520000,"max_inr":4725000,"min_local":40000,"max_local":75000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Moderate"},
  "HK": {"min_inr":3300000,"max_inr":6600000,"min_local":300000,"max_local":600000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"Moderate"},
  "AE": {"min_inr":1840000,"max_inr":3680000,"min_local":80000,"max_local":160000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"Moderate"},
  "EU": {"min_inr":3185000,"max_inr":6370000,"min_local":35000,"max_local":70000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"High"}
}$json$::jsonb
WHERE career_name = 'Agricultural Scientist';

-- ─── 2. Architect ─────────────────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":400000,"max_inr":1500000,"min_local":400000,"max_local":1500000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"Moderate"},
  "US": {"min_inr":6720000,"max_inr":10920000,"min_local":80000,"max_local":130000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"High"},
  "GB": {"min_inr":4770000,"max_inr":8480000,"min_local":45000,"max_local":80000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"Moderate"},
  "CA": {"min_inr":4340000,"max_inr":7440000,"min_local":70000,"max_local":120000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"Moderate"},
  "AU": {"min_inr":4125000,"max_inr":7150000,"min_local":75000,"max_local":130000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":3780000,"max_inr":6930000,"min_local":60000,"max_local":110000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Moderate"},
  "HK": {"min_inr":4950000,"max_inr":9350000,"min_local":450000,"max_local":850000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"Moderate"},
  "AE": {"min_inr":2990000,"max_inr":5980000,"min_local":130000,"max_local":260000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"High"},
  "EU": {"min_inr":4095000,"max_inr":7735000,"min_local":45000,"max_local":85000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Architect';

-- ─── 3. Chartered Accountant ──────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":700000,"max_inr":2000000,"min_local":700000,"max_local":2000000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"High"},
  "US": {"min_inr":6720000,"max_inr":12600000,"min_local":80000,"max_local":150000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"High"},
  "GB": {"min_inr":5830000,"max_inr":10600000,"min_local":55000,"max_local":100000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"High"},
  "CA": {"min_inr":4650000,"max_inr":8680000,"min_local":75000,"max_local":140000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"High"},
  "AU": {"min_inr":4400000,"max_inr":8250000,"min_local":80000,"max_local":150000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":4095000,"max_inr":7560000,"min_local":65000,"max_local":120000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"High"},
  "HK": {"min_inr":5500000,"max_inr":9900000,"min_local":500000,"max_local":900000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"High"},
  "AE": {"min_inr":3450000,"max_inr":6440000,"min_local":150000,"max_local":280000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"High"},
  "EU": {"min_inr":4550000,"max_inr":8190000,"min_local":50000,"max_local":90000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Chartered Accountant';

-- ─── 4. Civil Engineer ────────────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":350000,"max_inr":1200000,"min_local":350000,"max_local":1200000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"Moderate"},
  "US": {"min_inr":6300000,"max_inr":10080000,"min_local":75000,"max_local":120000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"High"},
  "GB": {"min_inr":4240000,"max_inr":7420000,"min_local":40000,"max_local":70000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"Moderate"},
  "CA": {"min_inr":4340000,"max_inr":7440000,"min_local":70000,"max_local":120000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"High"},
  "AU": {"min_inr":4400000,"max_inr":7150000,"min_local":80000,"max_local":130000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":3465000,"max_inr":6300000,"min_local":55000,"max_local":100000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Moderate"},
  "HK": {"min_inr":4400000,"max_inr":8250000,"min_local":400000,"max_local":750000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"Moderate"},
  "AE": {"min_inr":2990000,"max_inr":5750000,"min_local":130000,"max_local":250000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"High"},
  "EU": {"min_inr":4095000,"max_inr":7735000,"min_local":45000,"max_local":85000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Civil Engineer';

-- ─── 5. Civil Services (IAS/IPS) ─────────────────────────────────────────────
-- Mapped to equivalent public administration / senior civil service roles abroad.
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":700000,"max_inr":1800000,"min_local":700000,"max_local":1800000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"Moderate"},
  "US": {"min_inr":6720000,"max_inr":11760000,"min_local":80000,"max_local":140000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"Moderate"},
  "GB": {"min_inr":4770000,"max_inr":9540000,"min_local":45000,"max_local":90000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"Moderate"},
  "CA": {"min_inr":4340000,"max_inr":8060000,"min_local":70000,"max_local":130000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"Moderate"},
  "AU": {"min_inr":4125000,"max_inr":8250000,"min_local":75000,"max_local":150000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"Moderate"},
  "SG": {"min_inr":3780000,"max_inr":7560000,"min_local":60000,"max_local":120000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Moderate"},
  "HK": {"min_inr":5500000,"max_inr":9900000,"min_local":500000,"max_local":900000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"Moderate"},
  "AE": {"min_inr":2760000,"max_inr":5520000,"min_local":120000,"max_local":240000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"Moderate"},
  "EU": {"min_inr":3640000,"max_inr":7280000,"min_local":40000,"max_local":80000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Civil Services (IAS/IPS)';

-- ─── 6. Corporate Lawyer ──────────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":600000,"max_inr":2000000,"min_local":600000,"max_local":2000000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"High"},
  "US": {"min_inr":10080000,"max_inr":21000000,"min_local":120000,"max_local":250000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"High"},
  "GB": {"min_inr":7420000,"max_inr":14840000,"min_local":70000,"max_local":140000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"High"},
  "CA": {"min_inr":6200000,"max_inr":12400000,"min_local":100000,"max_local":200000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"High"},
  "AU": {"min_inr":5500000,"max_inr":11000000,"min_local":100000,"max_local":200000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":5040000,"max_inr":10080000,"min_local":80000,"max_local":160000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"High"},
  "HK": {"min_inr":7700000,"max_inr":15400000,"min_local":700000,"max_local":1400000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"High"},
  "AE": {"min_inr":4600000,"max_inr":9200000,"min_local":200000,"max_local":400000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"High"},
  "EU": {"min_inr":5460000,"max_inr":11830000,"min_local":60000,"max_local":130000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"High"}
}$json$::jsonb
WHERE career_name = 'Corporate Lawyer';

-- ─── 7. Data Scientist ────────────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":600000,"max_inr":2500000,"min_local":600000,"max_local":2500000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"High"},
  "US": {"min_inr":8400000,"max_inr":15120000,"min_local":100000,"max_local":180000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"Very High"},
  "GB": {"min_inr":6360000,"max_inr":11660000,"min_local":60000,"max_local":110000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"Very High"},
  "CA": {"min_inr":5580000,"max_inr":9920000,"min_local":90000,"max_local":160000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"High"},
  "AU": {"min_inr":5500000,"max_inr":9350000,"min_local":100000,"max_local":170000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":5040000,"max_inr":9450000,"min_local":80000,"max_local":150000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Very High"},
  "HK": {"min_inr":6600000,"max_inr":12100000,"min_local":600000,"max_local":1100000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"High"},
  "AE": {"min_inr":4140000,"max_inr":8050000,"min_local":180000,"max_local":350000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"High"},
  "EU": {"min_inr":5460000,"max_inr":10010000,"min_local":60000,"max_local":110000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"High"}
}$json$::jsonb
WHERE career_name = 'Data Scientist';

-- ─── 8. Dentist ───────────────────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":400000,"max_inr":1200000,"min_local":400000,"max_local":1200000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"Low"},
  "US": {"min_inr":13440000,"max_inr":21000000,"min_local":160000,"max_local":250000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"Moderate"},
  "GB": {"min_inr":5830000,"max_inr":10600000,"min_local":55000,"max_local":100000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"Moderate"},
  "CA": {"min_inr":8060000,"max_inr":14260000,"min_local":130000,"max_local":230000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"Moderate"},
  "AU": {"min_inr":7150000,"max_inr":12100000,"min_local":130000,"max_local":220000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":6300000,"max_inr":12600000,"min_local":100000,"max_local":200000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Moderate"},
  "HK": {"min_inr":7700000,"max_inr":13200000,"min_local":700000,"max_local":1200000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"Moderate"},
  "AE": {"min_inr":4600000,"max_inr":9200000,"min_local":200000,"max_local":400000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"High"},
  "EU": {"min_inr":5915000,"max_inr":10920000,"min_local":65000,"max_local":120000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Dentist';

-- ─── 9. Doctor (MBBS) ────────────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":600000,"max_inr":2500000,"min_local":600000,"max_local":2500000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"High"},
  "US": {"min_inr":16800000,"max_inr":29400000,"min_local":200000,"max_local":350000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"High"},
  "GB": {"min_inr":7420000,"max_inr":12720000,"min_local":70000,"max_local":120000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"High"},
  "CA": {"min_inr":12400000,"max_inr":21700000,"min_local":200000,"max_local":350000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"High"},
  "AU": {"min_inr":8800000,"max_inr":16500000,"min_local":160000,"max_local":300000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":6300000,"max_inr":12600000,"min_local":100000,"max_local":200000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"High"},
  "HK": {"min_inr":8800000,"max_inr":16500000,"min_local":800000,"max_local":1500000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"High"},
  "AE": {"min_inr":9200000,"max_inr":16100000,"min_local":400000,"max_local":700000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"Very High"},
  "EU": {"min_inr":7280000,"max_inr":13650000,"min_local":80000,"max_local":150000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Doctor (MBBS)';

-- ─── 10. Economist / Business Analyst ────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":500000,"max_inr":1800000,"min_local":500000,"max_local":1800000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"High"},
  "US": {"min_inr":6720000,"max_inr":12600000,"min_local":80000,"max_local":150000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"High"},
  "GB": {"min_inr":5300000,"max_inr":9540000,"min_local":50000,"max_local":90000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"High"},
  "CA": {"min_inr":4340000,"max_inr":8060000,"min_local":70000,"max_local":130000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"High"},
  "AU": {"min_inr":4400000,"max_inr":7700000,"min_local":80000,"max_local":140000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":3780000,"max_inr":7560000,"min_local":60000,"max_local":120000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"High"},
  "HK": {"min_inr":5500000,"max_inr":10450000,"min_local":500000,"max_local":950000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"High"},
  "AE": {"min_inr":3220000,"max_inr":6440000,"min_local":140000,"max_local":280000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"High"},
  "EU": {"min_inr":5005000,"max_inr":9100000,"min_local":55000,"max_local":100000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"High"}
}$json$::jsonb
WHERE career_name = 'Economist / Business Analyst';

-- ─── 11. Environmental Scientist ─────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":350000,"max_inr":1000000,"min_local":350000,"max_local":1000000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"High"},
  "US": {"min_inr":5040000,"max_inr":8400000,"min_local":60000,"max_local":100000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"Very High"},
  "GB": {"min_inr":3710000,"max_inr":6890000,"min_local":35000,"max_local":65000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"High"},
  "CA": {"min_inr":3410000,"max_inr":6200000,"min_local":55000,"max_local":100000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"High"},
  "AU": {"min_inr":3575000,"max_inr":6050000,"min_local":65000,"max_local":110000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"Very High"},
  "SG": {"min_inr":2835000,"max_inr":5355000,"min_local":45000,"max_local":85000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"High"},
  "HK": {"min_inr":3520000,"max_inr":6600000,"min_local":320000,"max_local":600000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"High"},
  "AE": {"min_inr":2070000,"max_inr":3910000,"min_local":90000,"max_local":170000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"High"},
  "EU": {"min_inr":3640000,"max_inr":6825000,"min_local":40000,"max_local":75000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Very High"}
}$json$::jsonb
WHERE career_name = 'Environmental Scientist';

-- ─── 12. Event Manager / PR Professional ─────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":300000,"max_inr":1000000,"min_local":300000,"max_local":1000000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"Moderate"},
  "US": {"min_inr":4200000,"max_inr":7560000,"min_local":50000,"max_local":90000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"Moderate"},
  "GB": {"min_inr":3180000,"max_inr":6360000,"min_local":30000,"max_local":60000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"Moderate"},
  "CA": {"min_inr":2790000,"max_inr":5270000,"min_local":45000,"max_local":85000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"Moderate"},
  "AU": {"min_inr":3025000,"max_inr":4950000,"min_local":55000,"max_local":90000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"Moderate"},
  "SG": {"min_inr":2520000,"max_inr":5040000,"min_local":40000,"max_local":80000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Moderate"},
  "HK": {"min_inr":3300000,"max_inr":6600000,"min_local":300000,"max_local":600000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"Moderate"},
  "AE": {"min_inr":1840000,"max_inr":3680000,"min_local":80000,"max_local":160000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"Moderate"},
  "EU": {"min_inr":3185000,"max_inr":5915000,"min_local":35000,"max_local":65000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Event Manager / PR Professional';

-- ─── 13. Fashion Designer ─────────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":300000,"max_inr":1200000,"min_local":300000,"max_local":1200000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"Moderate"},
  "US": {"min_inr":4200000,"max_inr":8400000,"min_local":50000,"max_local":100000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"Moderate"},
  "GB": {"min_inr":3180000,"max_inr":6890000,"min_local":30000,"max_local":65000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"Moderate"},
  "CA": {"min_inr":2790000,"max_inr":5580000,"min_local":45000,"max_local":90000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"Moderate"},
  "AU": {"min_inr":2750000,"max_inr":4950000,"min_local":50000,"max_local":90000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"Moderate"},
  "SG": {"min_inr":2205000,"max_inr":5040000,"min_local":35000,"max_local":80000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Moderate"},
  "HK": {"min_inr":3300000,"max_inr":7700000,"min_local":300000,"max_local":700000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"High"},
  "AE": {"min_inr":1840000,"max_inr":4140000,"min_local":80000,"max_local":180000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"Moderate"},
  "EU": {"min_inr":3185000,"max_inr":6825000,"min_local":35000,"max_local":75000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Fashion Designer';

-- ─── 14. Film / Media Producer ────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":400000,"max_inr":1500000,"min_local":400000,"max_local":1500000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"High"},
  "US": {"min_inr":5880000,"max_inr":12600000,"min_local":70000,"max_local":150000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"High"},
  "GB": {"min_inr":4240000,"max_inr":9540000,"min_local":40000,"max_local":90000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"Moderate"},
  "CA": {"min_inr":3410000,"max_inr":6820000,"min_local":55000,"max_local":110000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"Moderate"},
  "AU": {"min_inr":3300000,"max_inr":6050000,"min_local":60000,"max_local":110000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"Moderate"},
  "SG": {"min_inr":2835000,"max_inr":5670000,"min_local":45000,"max_local":90000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Moderate"},
  "HK": {"min_inr":3850000,"max_inr":8250000,"min_local":350000,"max_local":750000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"Moderate"},
  "AE": {"min_inr":2070000,"max_inr":4600000,"min_local":90000,"max_local":200000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"Moderate"},
  "EU": {"min_inr":3640000,"max_inr":7280000,"min_local":40000,"max_local":80000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Film / Media Producer';

-- ─── 15. Graphic Designer ─────────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":300000,"max_inr":1000000,"min_local":300000,"max_local":1000000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"High"},
  "US": {"min_inr":4620000,"max_inr":8400000,"min_local":55000,"max_local":100000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"High"},
  "GB": {"min_inr":3180000,"max_inr":6360000,"min_local":30000,"max_local":60000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"High"},
  "CA": {"min_inr":2790000,"max_inr":5270000,"min_local":45000,"max_local":85000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"High"},
  "AU": {"min_inr":3025000,"max_inr":4950000,"min_local":55000,"max_local":90000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":2205000,"max_inr":4725000,"min_local":35000,"max_local":75000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"High"},
  "HK": {"min_inr":3300000,"max_inr":6600000,"min_local":300000,"max_local":600000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"High"},
  "AE": {"min_inr":1840000,"max_inr":3680000,"min_local":80000,"max_local":160000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"Moderate"},
  "EU": {"min_inr":3185000,"max_inr":5915000,"min_local":35000,"max_local":65000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"High"}
}$json$::jsonb
WHERE career_name = 'Graphic Designer';

-- ─── 16. Hotel Management Professional ────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":300000,"max_inr":900000,"min_local":300000,"max_local":900000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"Moderate"},
  "US": {"min_inr":4200000,"max_inr":8400000,"min_local":50000,"max_local":100000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"Moderate"},
  "GB": {"min_inr":3180000,"max_inr":6360000,"min_local":30000,"max_local":60000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"Moderate"},
  "CA": {"min_inr":2790000,"max_inr":5580000,"min_local":45000,"max_local":90000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"Moderate"},
  "AU": {"min_inr":3025000,"max_inr":5500000,"min_local":55000,"max_local":100000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"Moderate"},
  "SG": {"min_inr":2520000,"max_inr":5040000,"min_local":40000,"max_local":80000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"High"},
  "HK": {"min_inr":3300000,"max_inr":7150000,"min_local":300000,"max_local":650000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"High"},
  "AE": {"min_inr":2070000,"max_inr":4140000,"min_local":90000,"max_local":180000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"Very High"},
  "EU": {"min_inr":3185000,"max_inr":5915000,"min_local":35000,"max_local":65000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Hotel Management Professional';

-- ─── 17. Journalist ───────────────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":300000,"max_inr":1000000,"min_local":300000,"max_local":1000000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"Moderate"},
  "US": {"min_inr":4200000,"max_inr":7560000,"min_local":50000,"max_local":90000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"Moderate"},
  "GB": {"min_inr":3180000,"max_inr":6360000,"min_local":30000,"max_local":60000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"Moderate"},
  "CA": {"min_inr":2790000,"max_inr":5270000,"min_local":45000,"max_local":85000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"Moderate"},
  "AU": {"min_inr":3025000,"max_inr":4950000,"min_local":55000,"max_local":90000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"Moderate"},
  "SG": {"min_inr":2520000,"max_inr":5040000,"min_local":40000,"max_local":80000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Moderate"},
  "HK": {"min_inr":3300000,"max_inr":6600000,"min_local":300000,"max_local":600000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"Moderate"},
  "AE": {"min_inr":1840000,"max_inr":3680000,"min_local":80000,"max_local":160000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"Moderate"},
  "EU": {"min_inr":3185000,"max_inr":5915000,"min_local":35000,"max_local":65000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Journalist';

-- ─── 18. Mechanical Engineer ──────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":350000,"max_inr":1500000,"min_local":350000,"max_local":1500000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"Moderate"},
  "US": {"min_inr":5880000,"max_inr":10080000,"min_local":70000,"max_local":120000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"High"},
  "GB": {"min_inr":4240000,"max_inr":7420000,"min_local":40000,"max_local":70000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"High"},
  "CA": {"min_inr":4030000,"max_inr":6820000,"min_local":65000,"max_local":110000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"High"},
  "AU": {"min_inr":4125000,"max_inr":7150000,"min_local":75000,"max_local":130000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":3465000,"max_inr":6300000,"min_local":55000,"max_local":100000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Moderate"},
  "HK": {"min_inr":3850000,"max_inr":7700000,"min_local":350000,"max_local":700000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"Moderate"},
  "AE": {"min_inr":2760000,"max_inr":5520000,"min_local":120000,"max_local":240000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"High"},
  "EU": {"min_inr":4095000,"max_inr":7280000,"min_local":45000,"max_local":80000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"High"}
}$json$::jsonb
WHERE career_name = 'Mechanical Engineer';

-- ─── 19. Nurse ────────────────────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":300000,"max_inr":800000,"min_local":300000,"max_local":800000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"High"},
  "US": {"min_inr":6300000,"max_inr":9240000,"min_local":75000,"max_local":110000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"Very High"},
  "GB": {"min_inr":3180000,"max_inr":5300000,"min_local":30000,"max_local":50000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"High"},
  "CA": {"min_inr":4030000,"max_inr":6200000,"min_local":65000,"max_local":100000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"Very High"},
  "AU": {"min_inr":3850000,"max_inr":6050000,"min_local":70000,"max_local":110000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"Very High"},
  "SG": {"min_inr":2520000,"max_inr":4410000,"min_local":40000,"max_local":70000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"High"},
  "HK": {"min_inr":3850000,"max_inr":6600000,"min_local":350000,"max_local":600000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"High"},
  "AE": {"min_inr":2070000,"max_inr":3680000,"min_local":90000,"max_local":160000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"Very High"},
  "EU": {"min_inr":2730000,"max_inr":5005000,"min_local":30000,"max_local":55000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"High"}
}$json$::jsonb
WHERE career_name = 'Nurse';

-- ─── 20. Pharmacist ───────────────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":300000,"max_inr":900000,"min_local":300000,"max_local":900000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"Moderate"},
  "US": {"min_inr":9240000,"max_inr":12600000,"min_local":110000,"max_local":150000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"Moderate"},
  "GB": {"min_inr":4240000,"max_inr":7420000,"min_local":40000,"max_local":70000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"Moderate"},
  "CA": {"min_inr":4960000,"max_inr":8060000,"min_local":80000,"max_local":130000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"High"},
  "AU": {"min_inr":4400000,"max_inr":6600000,"min_local":80000,"max_local":120000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":3150000,"max_inr":5670000,"min_local":50000,"max_local":90000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Moderate"},
  "HK": {"min_inr":4400000,"max_inr":7700000,"min_local":400000,"max_local":700000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"Moderate"},
  "AE": {"min_inr":2300000,"max_inr":4140000,"min_local":100000,"max_local":180000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"High"},
  "EU": {"min_inr":3185000,"max_inr":6370000,"min_local":35000,"max_local":70000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Pharmacist';

-- ─── 21. Psychologist ─────────────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":350000,"max_inr":1200000,"min_local":350000,"max_local":1200000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"High"},
  "US": {"min_inr":6720000,"max_inr":10920000,"min_local":80000,"max_local":130000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"High"},
  "GB": {"min_inr":4240000,"max_inr":7950000,"min_local":40000,"max_local":75000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"High"},
  "CA": {"min_inr":4340000,"max_inr":7440000,"min_local":70000,"max_local":120000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"High"},
  "AU": {"min_inr":4400000,"max_inr":7150000,"min_local":80000,"max_local":130000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":3465000,"max_inr":6300000,"min_local":55000,"max_local":100000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"High"},
  "HK": {"min_inr":4400000,"max_inr":8800000,"min_local":400000,"max_local":800000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"High"},
  "AE": {"min_inr":2300000,"max_inr":4600000,"min_local":100000,"max_local":200000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"High"},
  "EU": {"min_inr":4095000,"max_inr":7280000,"min_local":45000,"max_local":80000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"High"}
}$json$::jsonb
WHERE career_name = 'Psychologist';

-- ─── 22. Social Worker ────────────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":250000,"max_inr":700000,"min_local":250000,"max_local":700000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"Moderate"},
  "US": {"min_inr":3780000,"max_inr":6720000,"min_local":45000,"max_local":80000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"Moderate"},
  "GB": {"min_inr":2968000,"max_inr":5300000,"min_local":28000,"max_local":50000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"Moderate"},
  "CA": {"min_inr":2790000,"max_inr":4960000,"min_local":45000,"max_local":80000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"Moderate"},
  "AU": {"min_inr":3025000,"max_inr":4950000,"min_local":55000,"max_local":90000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"Moderate"},
  "SG": {"min_inr":2205000,"max_inr":4095000,"min_local":35000,"max_local":65000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Moderate"},
  "HK": {"min_inr":3300000,"max_inr":6050000,"min_local":300000,"max_local":550000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"Moderate"},
  "AE": {"min_inr":1610000,"max_inr":3220000,"min_local":70000,"max_local":140000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"Moderate"},
  "EU": {"min_inr":2730000,"max_inr":5005000,"min_local":30000,"max_local":55000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Social Worker';

-- ─── 23. Software Engineer ────────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":500000,"max_inr":2500000,"min_local":500000,"max_local":2500000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"High"},
  "US": {"min_inr":10080000,"max_inr":16800000,"min_local":120000,"max_local":200000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"Very High"},
  "GB": {"min_inr":7420000,"max_inr":12720000,"min_local":70000,"max_local":120000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"High"},
  "CA": {"min_inr":6200000,"max_inr":10540000,"min_local":100000,"max_local":170000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"Very High"},
  "AU": {"min_inr":5500000,"max_inr":9350000,"min_local":100000,"max_local":170000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":5040000,"max_inr":10080000,"min_local":80000,"max_local":160000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Very High"},
  "HK": {"min_inr":6600000,"max_inr":11000000,"min_local":600000,"max_local":1000000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"High"},
  "AE": {"min_inr":4600000,"max_inr":8740000,"min_local":200000,"max_local":380000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"High"},
  "EU": {"min_inr":5915000,"max_inr":10920000,"min_local":65000,"max_local":120000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"High"}
}$json$::jsonb
WHERE career_name = 'Software Engineer';

-- ─── 24. Sports Management Professional ──────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":400000,"max_inr":1200000,"min_local":400000,"max_local":1200000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"High"},
  "US": {"min_inr":4620000,"max_inr":9240000,"min_local":55000,"max_local":110000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"High"},
  "GB": {"min_inr":3710000,"max_inr":7420000,"min_local":35000,"max_local":70000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"High"},
  "CA": {"min_inr":3100000,"max_inr":6200000,"min_local":50000,"max_local":100000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"Moderate"},
  "AU": {"min_inr":3025000,"max_inr":5500000,"min_local":55000,"max_local":100000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"High"},
  "SG": {"min_inr":2520000,"max_inr":5040000,"min_local":40000,"max_local":80000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Moderate"},
  "HK": {"min_inr":3850000,"max_inr":7700000,"min_local":350000,"max_local":700000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"Moderate"},
  "AE": {"min_inr":2300000,"max_inr":4600000,"min_local":100000,"max_local":200000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"High"},
  "EU": {"min_inr":3640000,"max_inr":7280000,"min_local":40000,"max_local":80000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Sports Management Professional';

-- ─── 25. Teacher / Professor ──────────────────────────────────────────────────
UPDATE career_profiles SET country_salary = $json${
  "IN": {"min_inr":350000,"max_inr":1200000,"min_local":350000,"max_local":1200000,"currency_symbol":"₹","currency_code":"INR","growth_outlook":"Moderate"},
  "US": {"min_inr":4620000,"max_inr":8400000,"min_local":55000,"max_local":100000,"currency_symbol":"$","currency_code":"USD","growth_outlook":"Moderate"},
  "GB": {"min_inr":3710000,"max_inr":6890000,"min_local":35000,"max_local":65000,"currency_symbol":"£","currency_code":"GBP","growth_outlook":"Moderate"},
  "CA": {"min_inr":3410000,"max_inr":6200000,"min_local":55000,"max_local":100000,"currency_symbol":"CAD$","currency_code":"CAD","growth_outlook":"Moderate"},
  "AU": {"min_inr":3575000,"max_inr":6050000,"min_local":65000,"max_local":110000,"currency_symbol":"AUD$","currency_code":"AUD","growth_outlook":"Moderate"},
  "SG": {"min_inr":2835000,"max_inr":5670000,"min_local":45000,"max_local":90000,"currency_symbol":"S$","currency_code":"SGD","growth_outlook":"Moderate"},
  "HK": {"min_inr":3850000,"max_inr":7700000,"min_local":350000,"max_local":700000,"currency_symbol":"HK$","currency_code":"HKD","growth_outlook":"Moderate"},
  "AE": {"min_inr":2070000,"max_inr":4140000,"min_local":90000,"max_local":180000,"currency_symbol":"AED","currency_code":"AED","growth_outlook":"High"},
  "EU": {"min_inr":3185000,"max_inr":6370000,"min_local":35000,"max_local":70000,"currency_symbol":"€","currency_code":"EUR","growth_outlook":"Moderate"}
}$json$::jsonb
WHERE career_name = 'Teacher / Professor';

-- Sanity check: all 25 profiles should have country_salary populated.
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count FROM career_profiles WHERE country_salary IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION '% career profiles are still missing country_salary', missing_count;
  END IF;
  RAISE NOTICE 'country_salary populated for all % career profiles.', (SELECT COUNT(*) FROM career_profiles);
END$$;

COMMIT;
