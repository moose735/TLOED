/**
 * @file config.js
 * @description Configuration file for the Fantasy League Dashboard.
 * This file holds various IDs, API URLs, and mappings for Sleeper and Google Sheet data.
 */

// IMPORTANT: Replace these with your actual Sleeper League IDs for each season.
// The key (year) should match the fantasy season.
export const SLEEPER_LEAGUE_IDS = {
  2021: 'YOUR_2021_SLEEPER_LEAGUE_ID_HERE',
  2022: '784200735733784576',
  2023: '918543989421416448',
  2024: '1048371694643060736',
  2025: '1181984921049018368', // This should be your *newest* league ID for the 2025 season
};

// Set the current fantasy season year. This will determine which league ID is used for "live" data.
export const CURRENT_FANTASY_SEASON_YEAR = 2025; // As per your request, 2025 is the current preseason/season
// --- API Configuration ---
// Replace with your actual Sleeper League ID
export const SLEEPER_LEAGUE_ID = '1048371694643060736';

// Replace with the deployed URL of your Google Apps Script Web App for general history/power rankings
export const GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxU2TLDiOxoym2VETq3qrfwUCjE9O0c_gbwHhfAgnrk2faxcBt30EW0jJIq6WXwtYhPdw/exec';

// Replace with the deployed URL of your Google Apps Script JSON API for the Trade Ticker
export const TRADE_TICKER_API_URL = 'https://script.google.com/macros/s/AKfycbxFZStkx9SvST6inAbnzfljrRr39H8CsprmEuRh9VUkjRLiAx_-5deo91r7lPegyDkC8A/exec';

// If you create a separate Apps Script for champions, use a new URL here
export const GOOGLE_SHEET_CHAMPIONS_API_URL = 'YOUR_GOOGLE_SHEET_CHAMPIONS_API_URL'; // Placeholder for specific champions data

// Replace with the deployed URL of your Google Apps Script JSON API for Weekly Odds
export const WEEKLY_ODDS_API_URL = 'https://script.google.com/macros/s/AKfycbxIrqBFK5peO8mSQ1V5mqUxVtfY2kf3-gDP2_Gw9Qxi5LllYbwgM_GcnEvAeGsGpwk4_w/exec';

// Replace with the deployed URL of your Google Apps Script JSON API for Playoff Bracket
export const BRACKET_API_URL = 'https://script.google.com/macros/s/AKfycbyARvrGYRVnIsHg28e689hOpKHLt2uQ85uDnFDpB8GfnUvknxQRSitrszGPlf4xKWFBrA/exec';


// --- Manager Name Mappings ---
// Mapping of nicknames/last names (as they might appear in Google Sheets)
// to their corresponding Sleeper display_name/username.
// This is used to find the correct manager in the Sleeper data to get their team name.
export const NICKNAME_TO_SLEEPER_USER = {
  "irwin": "irwin35",
  "randall": "DoctorBustdown",
  "o'donoghue": "MattOD54",
  "odonoghue": "MattOD54", // Support common variations
  "bjarnar": "jamiebjarnar",
  "schmitt": "joes35",
  "neufeglise": "TJNeuf31",
  "dembski": "jdembski2000",
  "meer": "saadmeer32",
  "boilard": "jblizzySwag",
  "blumbergs": "blumdick",
  "ainsworth": "wainsworth",
  "tomczak": "mavtzak",
};



