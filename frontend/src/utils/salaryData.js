export const COUNTRIES = [
  { code: 'IN', label: 'India',      flag: '🇮🇳', currencySymbol: '₹',     currencyCode: 'INR' },
  { code: 'US', label: 'USA',        flag: '🇺🇸', currencySymbol: '$',     currencyCode: 'USD' },
  { code: 'GB', label: 'UK',         flag: '🇬🇧', currencySymbol: '£',     currencyCode: 'GBP' },
  { code: 'CA', label: 'Canada',     flag: '🇨🇦', currencySymbol: 'CAD$',  currencyCode: 'CAD' },
  { code: 'AU', label: 'Australia',  flag: '🇦🇺', currencySymbol: 'AUD$',  currencyCode: 'AUD' },
  { code: 'SG', label: 'Singapore',  flag: '🇸🇬', currencySymbol: 'S$',    currencyCode: 'SGD' },
  { code: 'HK', label: 'Hong Kong',  flag: '🇭🇰', currencySymbol: 'HK$',   currencyCode: 'HKD' },
  { code: 'AE', label: 'UAE',        flag: '🇦🇪', currencySymbol: 'AED',   currencyCode: 'AED' },
  { code: 'EU', label: 'Europe',     flag: '🇪🇺', currencySymbol: '€',     currencyCode: 'EUR' },
];

/**
 * Returns the country_salary entry for a given career and country code.
 * Reads career_details[careerName].country_salary[countryCode].
 * Returns null if not found (caller should fall back to salary_min_inr/max_inr).
 */
export function getSalaryForCountry(careerName, countryCode, careerDetails) {
  return careerDetails?.[careerName]?.country_salary?.[countryCode] ?? null;
}
