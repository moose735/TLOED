// src/config.js

// Easily configurable current league ID.
// IMPORTANT: Update this to your league's current ID.
export const CURRENT_LEAGUE_ID = '1181984921049018368';

// Custom team name mappings (Optional: for use if you want to map specific Sleeper User IDs
// to custom display names for aesthetic purposes beyond the Sleeper display name).
// This map allows you to override or define preferred display names for user_ids.
// Example: { "SleeperUserID1": "My Awesome Team", "SleeperUserID2": "Gridiron Heroes" }
// This will be used in App.js's getMappedTeamName to prioritize custom names.
export const NICKNAME_TO_SLEEPER_USER = {
  // Add your custom mappings here. The key should be the Sleeper User ID,
  // and the value should be the custom display name.
  '783790952367169536': 'Ainsworth',
  '783761299275382784': 'Bjarnar',
  '783789717920534528': 'Blumbergs',
  '783789669597999104': 'Boilard',
  '783767734491127808': 'Dembski',
  '467074573125283840': 'Irwin',
  '783778036578418688': 'Meer',
  '783763304463147008': 'Neufeglise',
  '783758716272009216': 'O\'Donoghue',
  '783760455581896704': 'Reis',
  '783760119859560448': 'Reynolds',
  '783760799793188864': 'Rogers',
};

// You can add other global configuration variables here if needed.
