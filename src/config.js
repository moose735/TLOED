// config.js

// Google Apps Script URL for Power Rankings
// NOTE: This URL is used by PowerRankings.js directly.
export const GOOGLE_SHEET_POWER_RANKINGS_API_URL = 'YOUR_GOOGLE_SHEET_POWER_RANKINGS_API_URL';

// Google Apps Script URL for All Historical Matchups (used by MatchupHistory, RecordBook, DPRAnalysis, LuckRatingAnalysis, TeamDetailPage)
export const HISTORICAL_MATCHUPS_API_URL = 'https://script.google.com/macros/s/AKfycbxpo21zzZgNamYShESfqe-SX09miJz2LK7SpdlYrtHXQplneB3bF2xu2byy0HhjM8e-/exec';

// If you have a Google Sheet for Champions/Awards, add its Apps Script URL here.
// Otherwise, mock data will be used in TeamDetailPage.
export const GOOGLE_SHEET_CHAMPIONS_API_URL = 'YOUR_GOOGLE_SHEET_CHAMPIONS_API_URL_OPTIONAL';

// Custom team name mappings (Optional: for use if you want to map names from historical matchups to custom display names)
// Example: { "TeamA_from_Google_Sheet": "My Awesome Team", "TeamB_from_Google_Sheet": "Gridiron Heroes" }
// App.js will currently use names directly from HISTORICAL_MATCHUPS_API_URL for dropdown and display.
// You can integrate this mapping into getMappedTeamName if you need to apply custom names later.
export const NICKNAME_TO_SLEEPER_USER = {
  // Add your custom mappings here, e.g.:
  // "LastnameA": "Team Rocket",
  // "LastnameB": "The Mavericks",
};
