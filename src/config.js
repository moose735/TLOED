// config.js

// Google Apps Script URL for Power Rankings
// NOTE: This URL is used by PowerRankings.js directly.
export const GOOGLE_SHEET_POWER_RANKINGS_API_URL = 'https://script.google.com/macros/s/AKfycbxU2TLDiOxoym2VETq3qrfwUCjE9O0c_gbwHhfAgnrk2faxcBt30EW0jJIq6WXwtYhPdw/exec';

// Google Apps Script URL for All Historical Matchups (used by MatchupHistory, RecordBook, DPRAnalysis, LuckRatingAnalysis, TeamDetailPage)
export const HISTORICAL_MATCHUPS_API_URL = 'https://script.google.com/macros/s/AKfycbxpo21zzZgNamYShESfqe-SX09miJz2LK7SpdlYrtHXQplneB3bF2xu2byy0HhjM8e-/exec';

export const CURRENT_LEAGUE_ID = '1312104042406612992';

// Default sportsbook vig applied across odds calculations (5.5% overround by default)
export const SPORTSBOOK_VIG = 0.055; // 5.5%

export const TEAM_NAME_TO_SLEEPER_ID_MAP = {
  'Ainsworth': '783790952367169536',
  'Bjarnar': '783761299275382784',
  'Blumbergs': '783789717920534528',
  'Boilard': '783789669597999104',
  'Dembski': '783767734491127808',
  'Irwin': '467074573125283840',
  'Meer': '783778036578418688',
  'Neufeglise': '783763304463147008',
  'O\'Donoghue': '783758716272009216',
  'ODonoghue': '783758716272009216', // Added alias for "ODonoghue"
  'Randall': '783754997035876352',
  'Schmitt': '783761892693905408',
  'Tomczak': '787044291066380288',
};

export const RETIRED_MANAGERS = new Set ([
  // ... other retired manager IDs
]);
// Custom team name mappings (Optional: for use if you want to map names from historical matchups to custom display names)
// Example: { "TeamA_from_Google_Sheet": "My Awesome Team", "TeamB_from_Google_Sheet": "Gridiron Heroes" }
// App.js will currently use names directly from HISTORICAL_MATCHUPS_API_URL for dropdown and display.
// You can integrate this mapping into getMappedTeamName if you need to apply custom names later.
export const NICKNAME_TO_SLEEPER_USER = {
  // Add your custom mappings here, e.g.:
  // "LastnameA": "Team Rocket",
  // "LastnameB": "The Mavericks",
};

// Dashboard countdowns (use explicit ISO timestamps with Eastern offsets)
// Trade deadline example: Nov 10 2025 20:15 Eastern -> After DST ends (EST, UTC-5)
export const TRADE_DEADLINE_ISO = '2025-11-10T20:15:00-05:00';
// Draft example: Sep 5 2026 18:00 Eastern -> During DST (EDT, UTC-4)
export const DRAFT_DATE_ISO = '2026-09-05T18:00:00-04:00';
