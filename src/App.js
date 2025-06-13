// App.js
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback for memoization later
import {
  SLEEPER_LEAGUE_ID,
  GOOGLE_SHEET_API_URL,
  // TRADE_TICKER_API_URL, // No longer directly used for Sleeper API trades
  GOOGLE_SHEET_CHAMPIONS_API_URL,
  WEEKLY_ODDS_API_URL,
  BRACKET_API_URL,
  HISTORICAL_MATCHUPS_API_URL,
  NICKNAME_TO_SLEEPER_USER
} from './config';

// Define the available tabs and their categories for the dropdown
const NAV_CATEGORIES = {
  HOME: { label: 'Home', tab: 'Trades' },
  LEAGUE_STATS: {
    label: 'League Stats',
    subTabs: [
      { label: 'Weekly Odds', tab: 'Weekly Odds' },
      { label: 'Playoff Bracket', tab: 'Playoff Bracket' },
    ]
  },
  HISTORICAL_DATA: {
    label: 'Historical Data',
    subTabs: [
      { label: 'League History', tab: 'League History' },
      { label: 'Champions & Awards', tab: 'Champions' },
      { label: 'All Matchups', tab: 'All Matchups' }, // <<< ADD THIS ENTRY
      // { label: 'Team Records', tab: 'Team Records' }, // Future: Uncomment when ready
      // { label: 'Head-to-Head', tab: 'Head-to-Head' }, // Future: Uncomment when ready
      // { label: 'Points Champions', tab: 'Points Champions' }, // Future: Uncomment when ready
    ]
  }
};

// Flattened list of all possible tabs for conditional rendering
const TABS = {
  TRADES: 'Trades',
  ODDS: 'Weekly Odds',
  BRACKET: 'Playoff Bracket',
  HISTORY: 'League History',
  CHAMPIONS: 'Champions',
  ALL_MATCHUPS: 'All Matchups' // <<< ADD THIS ENTRY
};

// Main App component
const App = () => {
  // --- State Variables ---
  const [sleeperLeagueData, setSleeperLeagueData] = useState(null);
  const [leagueManagers, setLeagueManagers] = useState([]);
  const [playerNameToTeamNameMap, setPlayerNameToTeamNameMap] = useState({}); // New map for display names
  const [activeTab, setActiveTab] = useState(TABS.TRADES); // Default active tab
  const [activeDropdown, setActiveDropdown] = useState(null); // State for active dropdown menu

  // Trade Ticker States
  const [recentTrades, setRecentTrades] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [errorTrades, setErrorTrades] = useState(null);
  const [playerDetailsMap, setPlayerDetailsMap] = useState({}); // Stores full player details from Sleeper

  // Weekly Odds States
  const [weeklyOddsData, setWeeklyOddsData] = useState({});
  const [currentOddsWeek, setCurrentOddsWeek] = useState(null); // Use null initially to derive from data
  const [totalOddsWeeks, setTotalOddsWeeks] = useState(0);
  const [loadingOdds, setLoadingOdds] = useState(true);
  const [errorOdds, setErrorOdds] = useState(null);

  // Playoff Bracket States
  const [bracketData, setBracketData] = useState(null);
  const [loadingBracket, setLoadingBracket] = useState(true);
  const [errorBracket, setErrorBracket] = useState(null);

  // Google Sheet History (Power Rankings/General Data) States
  const [googleSheetHistory, setGoogleSheetHistory] = useState(null);
  const [loadingGoogleSheet, setLoadingGoogleSheet] = useState(true);
  const [errorGoogleSheet, setErrorGoogleSheet] = useState(null);

  // Historical Champions States
  const [historicalChampions, setHistoricalChampions] = useState([]);
  const [loadingChampions, setLoadingChampions] = useState(true);
  const [errorChampions, setErrorChampions] = useState(null);

  // Historical Matchups States
  const [historicalMatchups, setHistoricalMatchups] = useState([]);
  const [loadingMatchups, setLoadingMatchups] = useState(true);
  const [errorMatchups, setErrorMatchups] = useState(null);


  // --- Helper Functions ---
  // Universal function to get mapped team name from any source
  const getMappedTeamName = useCallback((originalName) => {
    if (!originalName) return originalName; // Handle null/undefined input

    // First, try direct mapping from Sleeper display_name/username
    if (playerNameToTeamNameMap[originalName]) {
      return playerNameToTeamNameMap[originalName];
    }

    // If not found, try the NICKNAME_TO_SLEEPER_USER mapping
    const mappedSleeperUser = NICKNAME_TO_SLEEPER_USER[originalName.toLowerCase()];
    if (mappedSleeperUser && playerNameToTeamNameMap[mappedSleeperUser]) {
      return playerNameToTeamNameMap[mappedSleeperUser];
    }

    // Handle cases where Google Sheet names might be just the Sleeper team_name
    const foundManager = leagueManagers.find(manager => manager.teamName === originalName);
    if (foundManager) {
      return originalName;
    }

    // Fallback for names not found, or if it's already a seed number
    if (!isNaN(originalName) && !isNaN(parseFloat(originalName))) {
      return originalName; // If it looks like a number (seed), return as is
    }

    // Final fallback if no mapping or direct match is found
    return originalName;
  }, [playerNameToTeamNameMap, leagueManagers]); // Dependencies for useCallback

  const renderTradeAsset = (asset, type) => {
    const textColor = type === 'received' ? 'text-green-600' : 'text-red-600';
    const sign = type === 'received' ? '+' : '-';

    if (asset.type === 'player') {
      return (
        <div className={`text-[10px] ${textColor} font-semibold flex items-center gap-1`}>
          {sign} {asset.name} <span className="text-gray-500 font-normal">({asset.position})</span>
        </div>
      );
    } else if (asset.type === 'pick') {
      return (
        <div className={`text-[10px] ${textColor} font-semibold flex items-center gap-1`}>
          {sign} {asset.year} Pick {asset.round}{asset.originalPick ? `.${asset.originalPick}` : ''}
          {asset.original_roster_name && <span className="text-gray-500 font-normal"> ({asset.original_roster_name})</span>}
        </div>
      );
    }
    return null;
  };


  // --- useEffect Hooks for Data Fetching ---

  // Effect hook to fetch Sleeper League data and Managers
  useEffect(() => {
    const fetchSleeperData = async () => {
      try {
        // Fetch league data
        const leagueResponse = await fetch(`https://api.sleeper.app/v1/league/${SLEEPER_LEAGUE_ID}`);
        if (!leagueResponse.ok) throw new Error('Failed to fetch league data');
        const leagueData = await leagueResponse.json();
        setSleeperLeagueData(leagueData);

        // Fetch users and rosters
        const [usersResponse, rostersResponse] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${SLEEPER_LEAGUE_ID}/users`),
          fetch(`https://api.sleeper.app/v1/league/${SLEEPER_LEAGUE_ID}/rosters`)
        ]);

        if (!usersResponse.ok) throw new Error('Failed to fetch users data');
        if (!rostersResponse.ok) throw new Error('Failed to fetch rosters data');

        const usersData = await usersResponse.json();
        const rostersData = await rostersResponse.json();

        // Create a map from user_id to display_name/username
        const userIdToUserMap = {};
        usersData.forEach(user => {
          userIdToUserMap[user.user_id] = user.display_name || user.username;
        });

        // Create an initial playerNameToTeamNameMap (user_id/display_name -> team_name)
        const initialPlayerToTeamMap = {};
        const managers = rostersData.map(roster => {
          const user = usersData.find(u => u.user_id === roster.owner_id);
          const teamName = user ? (user.metadata?.team_name || user.display_name || user.username) : 'Unknown Team';
          const avatar = user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : 'https://placehold.co/30x30/cccccc/333333?text=M'; // Placeholder avatar

          // Populate the map for direct Sleeper display names/usernames
          if (user) {
            initialPlayerToTeamMap[user.display_name] = teamName;
            initialPlayerToTeamMap[user.username] = teamName;
            if (user.metadata?.team_name) {
              initialPlayerToTeamMap[user.metadata.team_name] = teamName;
            }
          }

          return {
            userId: roster.owner_id,
            rosterId: roster.roster_id, // Add rosterId for direct linking
            teamName: teamName,
            avatar: avatar,
            wins: roster.settings.wins,
            losses: roster.settings.losses,
            ties: roster.settings.ties
          };
        });
        setLeagueManagers(managers);
        setPlayerNameToTeamNameMap(initialPlayerToTeamMap); // Set the initial map
      } catch (error) {
        console.error("Error fetching Sleeper data:", error);
        // Handle error for sleeper data, maybe display a message on the header
      }
    };
    fetchSleeperData();
  }, [SLEEPER_LEAGUE_ID]);


  // Effect hook to fetch all NFL player data (for trade player name resolution)
  useEffect(() => {
    const fetchPlayerDetails = async () => {
      try {
        const response = await fetch('https://api.sleeper.app/v1/players/nfl');
        if (!response.ok) throw new Error('Failed to fetch NFL player data');
        const data = await response.json();
        setPlayerDetailsMap(data);
      } catch (error) {
        console.error("Error fetching NFL player data:", error);
      }
    };
    fetchPlayerDetails();
  }, []); // Run once on component mount

  // Effect hook to fetch Sleeper API Trade Ticker data
  useEffect(() => {
    const fetchSleeperTrades = async () => {
      if (SLEEPER_LEAGUE_ID === 'YOUR_SLEEPER_LEAGUE_ID') {
        setLoadingTrades(false);
        setErrorTrades("Please update SLEEPER_LEAGUE_ID in config.js to fetch trades directly from Sleeper API.");
        return;
      }

      setLoadingTrades(true);
      setErrorTrades(null);
      let allTrades = [];

      try {
        // Determine the current week to fetch recent trades from
        // For simplicity, fetch the last 4 weeks of transactions.
        // In a live app, you might get current week from Sleeper API or config.
        const currentYear = new Date().getFullYear();
        const currentSeason = sleeperLeagueData?.season || currentYear.toString(); // Use actual season or current year

        // Fetch transaction data for a few recent weeks
        // Sleeper API doesn't have a 'latest transactions' endpoint across all weeks.
        // We'll fetch from a reasonable range (e.g., Week 1 to 18 or less if the season is not that long yet)
        const fetchWeeks = [];
        // Assuming regular season weeks are 1-18 for simplicity, adjust as needed
        const maxWeeks = 18; // Or fetch from sleeperLeagueData.settings.playoff_week if available

        for (let week = 1; week <= maxWeeks; week++) {
          fetchWeeks.push(week);
        }

        const fetchPromises = fetchWeeks.map(async (week) => {
          const response = await fetch(`https://api.sleeper.app/v1/league/${SLEEPER_LEAGUE_ID}/transactions/${week}`);
          if (!response.ok) {
            console.warn(`Failed to fetch transactions for week ${week}: ${response.statusText}`);
            return [];
          }
          return response.json();
        });

        const transactionsByWeek = await Promise.all(fetchPromises);

        transactionsByWeek.forEach(txns => {
          if (Array.isArray(txns)) { // Ensure it's an array
            const tradesInWeek = txns.filter(t => t.type === 'trade');
            allTrades = allTrades.concat(tradesInWeek);
          }
        });

        // Sort by most recent (status_updated or created timestamp)
        allTrades.sort((a, b) => (b.status_updated || b.created) - (a.status_updated || a.created));

        // Process trades to match the structure expected by renderTradeAsset
        const processedTrades = allTrades.map(trade => {
          const participants = {}; // Key: roster_id, Value: { received: [], sent: [] }

          // Initialize participants for all rosters involved in the trade for display purposes
          // This covers both active trade participants and those affected by pick changes
          const allRosterIdsInTrade = new Set([
            ...(trade.roster_ids || []), // Rosters directly involved in player adds/drops
            ...(trade.draft_picks || []).map(p => p.owner_id),
            ...(trade.draft_picks || []).map(p => p.previous_owner_id)
          ].filter(Boolean)); // Filter out null/undefined

          allRosterIdsInTrade.forEach(rosterId => {
            participants[rosterId] = { receivedAssets: [], sentAssets: [] };
          });


          // Process players (adds and drops)
          if (trade.adds) {
            Object.entries(trade.adds).forEach(([playerId, rosterId]) => {
              const player = playerDetailsMap[playerId];
              if (player) {
                participants[rosterId].receivedAssets.push({
                  type: 'player',
                  id: playerId,
                  name: player.full_name || `${player.first_name} ${player.last_name}`,
                  position: player.position,
                  avatar: `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`,
                });
              } else {
                participants[rosterId].receivedAssets.push({
                  type: 'player',
                  id: playerId,
                  name: `Unknown Player (${playerId})`,
                  position: 'N/A',
                  avatar: 'https://placehold.co/12x12/cccccc/333333?text=P',
                });
              }
            });
          }

          if (trade.drops) {
            Object.entries(trade.drops).forEach(([playerId, rosterId]) => {
              const player = playerDetailsMap[playerId];
              if (player) {
                participants[rosterId].sentAssets.push({
                  type: 'player',
                  id: playerId,
                  name: player.full_name || `${player.first_name} ${player.last_name}`,
                  position: player.position,
                  avatar: `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`,
                });
              } else {
                participants[rosterId].sentAssets.push({
                  type: 'player',
                  id: playerId,
                  name: `Unknown Player (${playerId})`,
                  position: 'N/A',
                  avatar: 'https://placehold.co/12x12/cccccc/333333?text=P',
                });
              }
            });
          }

          // Process draft picks
          if (trade.draft_picks) {
            trade.draft_picks.forEach(pick => {
              // The pick is RECEIVED by `pick.owner_id`
              if (participants[pick.owner_id]) {
                const originalRosterManager = leagueManagers.find(m => m.rosterId === pick.previous_owner_id);
                participants[pick.owner_id].receivedAssets.push({
                  type: 'pick',
                  year: pick.season,
                  round: pick.round,
                  originalPick: pick.draft_slot || '?', // draft_slot is the original pick number in that round
                  original_roster_name: originalRosterManager ? originalRosterManager.teamName : `Roster ${pick.previous_owner_id}`
                });
              }
              // The pick is SENT by `pick.previous_owner_id`
              if (participants[pick.previous_owner_id]) {
                const originalRosterManager = leagueManagers.find(m => m.rosterId === pick.owner_id);
                 participants[pick.previous_owner_id].sentAssets.push({
                  type: 'pick',
                  year: pick.season,
                  round: pick.round,
                  originalPick: pick.draft_slot || '?',
                  original_roster_name: originalRosterManager ? originalRosterManager.teamName : `Roster ${pick.owner_id}`
                });
              }
            });
          }

          // Convert participants object to an array for rendering
          const participantsArray = Object.keys(participants).map(rosterId => {
            const manager = leagueManagers.find(m => m.rosterId === rosterId);
            return {
              rosterId: rosterId,
              teamName: manager ? manager.teamName : getMappedTeamName(`Roster ${rosterId}`),
              managerAvatar: manager ? manager.avatar : 'https://placehold.co/32x32/cccccc/333333?text=M',
              receivedAssets: participants[rosterId].receivedAssets,
              sentAssets: participants[rosterId].sentAssets,
            };
          });

          return {
            transaction_id: trade.transaction_id,
            week: trade.metadata?.scoring_period || trade.leg || 'N/A', // Use scoring_period or leg for week, fallback to N/A
            status_updated: trade.status_updated,
            participants: participantsArray,
          };
        });

        setRecentTrades(processedTrades);
      } catch (error) {
        console.error("Error fetching Sleeper trade data:", error);
        setErrorTrades(
          `Error fetching trades: ${error.message}. ` +
          `Please ensure your SLEEPER_LEAGUE_ID is correct and check your network connection.`
        );
      } finally {
        setLoadingTrades(false);
      }
    };

    // Only fetch trades if league managers and player details are loaded
    if (SLEEPER_LEAGUE_ID !== 'YOUR_SLEEPER_LEAGUE_ID' && leagueManagers.length > 0 && Object.keys(playerDetailsMap).length > 0) {
      fetchSleeperTrades();
    } else if (SLEEPER_LEAGUE_ID === 'YOUR_SLEEPER_LEAGUE_ID') {
        setLoadingTrades(false);
        setErrorTrades("Please update SLEEPER_LEAGUE_ID in config.js to fetch trades directly from Sleeper API.");
    }
  }, [SLEEPER_LEAGUE_ID, leagueManagers, playerDetailsMap, getMappedTeamName, sleeperLeagueData]);


  // Effect hook to fetch Google Sheet history data
  useEffect(() => {
    const fetchGoogleSheetData = async () => {
      if (GOOGLE_SHEET_API_URL === 'YOUR_GOOGLE_SHEET_API_URL') {
        setLoadingGoogleSheet(false);
        setErrorGoogleSheet("Please update GOOGLE_SHEET_API_URL in config.js with your actual Apps Script URL.");
        return;
      }

      setLoadingGoogleSheet(true);
      setErrorGoogleSheet(null);
      try {
        const response = await fetch(GOOGLE_SHEET_API_URL, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}. Response: ${await response.text()}.`);
        }
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        setGoogleSheetHistory(data); // Assuming data is { data: [], lastUpdated: '' }
      } catch (error) {
        console.error("Error fetching Google Sheet data:", error);
        setErrorGoogleSheet(
          `Error: ${error.message}. ` +
          `Please ensure your Google Sheet Apps Script URL (${GOOGLE_SHEET_API_URL}) is correct and publicly accessible. ` +
          `Try opening this URL directly in your browser.`
        );
      } finally {
        setLoadingGoogleSheet(false);
      }
    };

    fetchGoogleSheetData();
  }, [GOOGLE_SHEET_API_URL]);


  // Effect hook to fetch Weekly Odds data
  useEffect(() => {
    const fetchWeeklyOdds = async () => {
      if (WEEKLY_ODDS_API_URL === 'YOUR_WEEKLY_ODDS_API_URL') {
        setLoadingOdds(false);
        setErrorOdds("Please update WEEKLY_ODDS_API_URL in config.js with your actual Apps Script URL.");
        return;
      }

      setLoadingOdds(true);
      setErrorOdds(null);
      try {
        const response = await fetch(WEEKLY_ODDS_API_URL, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`Weekly Odds API HTTP error! status: ${response.status}. Response: ${await response.text()}.`);
        }
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        // Assuming data is an object where keys are week numbers and values are arrays of matches
        setWeeklyOddsData(data.weeks);
        const weeks = Object.keys(data.weeks);
        if (weeks.length > 0) {
          setTotalOddsWeeks(weeks.length);
          // Set current week to the last available week
          setCurrentOddsWeek(weeks.length - 1);
        }
      } catch (error) {
        console.error("Error fetching weekly odds data:", error);
        setErrorOdds(
          `Error: ${error.message}. ` +
          `Please ensure your Weekly Odds Apps Script URL (${WEEKLY_ODDS_API_URL}) is correct and publicly accessible. ` +
          `Try opening this URL directly in your browser.`
        );
      } finally {
        setLoadingOdds(false);
      }
    };

    fetchWeeklyOdds();
  }, [WEEKLY_ODDS_API_URL]);

  // Effect hook to fetch Playoff Bracket data
  useEffect(() => {
    const fetchPlayoffBracket = async () => {
      if (BRACKET_API_URL === 'YOUR_BRACKET_API_URL') {
        setLoadingBracket(false);
        setErrorBracket("Please update BRACKET_API_URL in config.js with your actual Apps Script URL.");
        return;
      }

      setLoadingBracket(true);
      setErrorBracket(null);
      try {
        const response = await fetch(BRACKET_API_URL, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`Playoff Bracket API HTTP error! status: ${response.status}. Response: ${await response.text()}.`);
        }
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        setBracketData(data); // Assuming data structure directly matches
      } catch (error) {
        console.error("Error fetching playoff bracket data:", error);
        setErrorBracket(
          `Error: ${error.message}. ` +
          `Please ensure your Playoff Bracket Apps Script URL (${BRACKET_API_URL}) is correct and publicly accessible. ` +
          `Try opening this URL directly in your browser.`
        );
      } finally {
        setLoadingBracket(false);
      }
    };

    fetchPlayoffBracket();
  }, [BRACKET_API_URL]);

  // Effect hook to fetch Historical Champions data
  useEffect(() => {
    const fetchHistoricalChampions = async () => {
      // If a specific API URL is provided, try to fetch from it
      if (GOOGLE_SHEET_CHAMPIONS_API_URL && GOOGLE_SHEET_CHAMPIONS_API_URL !== 'YOUR_GOOGLE_SHEET_CHAMPIONS_API_URL') {
        setLoadingChampions(true);
        setErrorChampions(null);
        try {
          const response = await fetch(GOOGLE_SHEET_CHAMPIONS_API_URL, { mode: 'cors' });
          if (!response.ok) {
            throw new Error(`Champions API HTTP error! status: ${response.status}. Response: ${await response.text()}.`);
          }
          const data = await response.json();
          if (data.error) {
            throw new Error(data.error);
          }
          setHistoricalChampions(data.data); // Assuming { data: [...] }
        } catch (error) {
          console.error("Error fetching historical champions data:", error);
          setErrorChampions(
            `Error: ${error.message}. ` +
            `Please ensure your Champions Apps Script URL (${GOOGLE_SHEET_CHAMPIONS_API_URL}) is correct and publicly accessible.`
          );
          // Fallback to hardcoded if API fails
          setHistoricalChampions([
            // { year: 2023, champion: "Default Champ 2023", runnerUp: "Default RunnerUp 2023", mvp: "Default MVP 2023" },
            // { year: 2022, champion: "Default Champ 2022", runnerUp: "Default RunnerUp 2022", mvp: "Default MVP 2022" },
          ]);
        } finally {
          setLoadingChampions(false);
        }
      } else {
        // Fallback to hardcoded data if no valid API URL is set
        setLoadingChampions(false);
        setErrorChampions(null);
        setHistoricalChampions([
          { year: 2023, champion: "Irwin", runnerUp: "Blumbergs", mvp: "Irwin" },
          { year: 2022, champion: "Boilard", runnerUp: "Irwin", mvp: "Boilard" },
          { year: 2021, champion: "Randall", runnerUp: "Meer", mvp: "Randall" },
          { year: 2020, champion: "Tomczak", runnerUp: "Boilard", mvp: "Tomczak" },
          { year: 2019, champion: "Neufeglise", runnerUp: "Blumbergs", mvp: "Neufeglise" },
        ]);
      }
    };

    fetchHistoricalChampions();
  }, [GOOGLE_SHEET_CHAMPIONS_API_URL]);


  // Historical Matchups
  useEffect(() => {
    const fetchHistoricalMatchups = async () => {
      if (HISTORICAL_MATCHUPS_API_URL === 'YOUR_NEW_HISTORICAL_MATCHUPS_APPS_SCRIPT_URL') {
        setLoadingMatchups(false);
        setErrorMatchups("Please update HISTORICAL_MATCHUPS_API_URL in config.js with your actual Apps Script URL for historical matchups.");
        return;
      }

      setLoadingMatchups(true);
      setErrorMatchups(null);

      try {
        const response = await fetch(HISTORICAL_MATCHUPS_API_URL, { mode: 'cors' });

        if (!response.ok) {
          throw new Error(`Historical Matchups API HTTP error! status: ${response.status}. Response: ${await response.text()}.`);
        }

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        // Ensure data.data is an array before setting state
        setHistoricalMatchups(Array.isArray(data.data) ? data.data : []); // Ensure it's an array

      } catch (error) {
        console.error("Error fetching historical matchups data:", error);
        setErrorMatchups(
          `Error: ${error.message}. ` +
          `Please ensure your Historical Matchups Apps Script URL (${HISTORICAL_MATCHUPS_API_URL}) is correct and publicly accessible. ` +
          `Try opening this URL directly in your browser. If it doesn't show JSON data, there's an issue with your Apps Script deployment or code (check Apps Script 'Executions' logs!).`
        );
      } finally {
        setLoadingMatchups(false);
      }
    };

    fetchHistoricalMatchups();
  }, [HISTORICAL_MATCHUPS_API_URL]);


  // --- JSX (Return Statement) ---
  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col items-center p-4">
      {/* Tailwind CSS CDN - ONLY FOR DEVELOPMENT/DEMO. For production, install via npm. */}
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />

      {/* Custom CSS for specific elements and animations */}
      <style>{`
         /* Global Styles & Utilities */
         body {
             font-family: 'Inter', sans-serif;
             background-color: #f0f2f5; /* Light background */
         }

         .max-w-4xl {
             max-width: 900px;
         }

         /* Animations */
         @keyframes ticker-scroll {
             0% { transform: translateX(0%); }
             100% { transform: translateX(-50%); } /* Scrolls half the width of duplicated content */
         }

         .animate-ticker-scroll {
             animation: ticker-scroll linear infinite;
             animation-duration: 40s; /* Adjust speed as needed */
             animation-play-state: running;
         }

         .animate-ticker-scroll:hover {
             animation-play-state: paused; /* Pause on hover */
         }

         /* Odds Section Specific Styles */
         .week-buttons-container {
             display: flex;
             flex-wrap: wrap;
             justify-content: center;
             gap: 8px;
             margin-bottom: 20px;
             max-width: 800px;
             width: 100%;
             padding: 0 10px;
         }

         .week-nav-button {
             background-color: #e0e0e0;
             color: #333;
             border: 1px solid #bfbfbf;
             border-radius: 4px;
             padding: 6px 12px;
             font-size: 14px;
             cursor: pointer;
             transition: background-color 0.2s ease, transform 0.1s ease;
             min-width: 40px;
         }

         .week-nav-button:hover {
             background-color: #d0d0d0;
             transform: translateY(-1px);
         }

         .week-nav-button.active {
             background-color: #0070c0; /* Primary blue */
             color: white;
             border-color: #0070c0;
             font-weight: 600;
         }

         .odds-matchup {
             display: flex;
             flex-direction: column;
             background: #ffffff;
             border: 1px solid #e0e0e0;
             border-radius: 8px;
             padding: 15px;
             margin-bottom: 12px;
             width: 100%;
             max-width: 450px;
             box-shadow: 0 2px 5px rgba(0,0,0,0.05);
             font-size: 15px;
         }

         .odds-player {
             display: flex;
             justify-content: space-between;
             align-items: center;
             padding: 8px 0;
             border-bottom: 1px solid #f0f0f0;
             font-weight: 500;
         }
         .odds-player:last-of-type {
             border-bottom: none;
         }

         .odds-bubbles {
             display: flex;
             gap: 8px;
             align-items: center;
         }

         .odds-value {
             background: #0070c0; /* Blue for default/player odds */
             color: white;
             padding: 6px 10px;
             border-radius: 20px;
             font-weight: 600;
             min-width: 60px;
             text-align: center;
             box-shadow: 0 1px 3px rgba(0,0,0,0.1);
             flex-shrink: 0;
         }

         .odds-ou-box {
             background: #4a5568; /* Dark grey for OU default */
             color: white;
             padding: 4px 8px;
             border-radius: 6px;
             font-size: 11px;
             line-height: 1.2;
             min-width: 55px;
             text-align: center;
             box-shadow: 0 1px 3px rgba(0,0,0,0.1);
             flex-shrink: 0;
         }

         /* Win/Loss Styles for Odds */
         .odds-win {
             background-color: #28a745; /* Green for win */
         }
         .odds-lose {
             background-color: #dc3545; /* Red for loss */
         }
         .odds-score {
             font-weight: 700;
             color: #2D3748;
             margin-left: 8px;
         }

         /* Bracket Specific Styles */
         .bracket-container {
             display: flex;
             justify-content: center;
             gap: 20px;
             flex-wrap: wrap;
             max-width: 700px; /* Adjust as needed */
             width: 100%;
         }

         .bracket-round {
             display: flex;
             flex-direction: column;
             align-items: center;
             flex-grow: 1;
             min-width: 200px; /* Ensure rounds don't collapse too much */
         }

         .bracket-round-label {
             font-size: 1.1em;
             font-weight: 600;
             color: #0070c0;
             margin-bottom: 15px;
             padding-bottom: 5px;
             border-bottom: 2px solid #bfbfbf;
             width: 100%;
             text-align: center;
         }

         .bracket-match {
             background: #fdfdfd;
             border: 1px solid #e0e0e0;
             border-radius: 8px;
             padding: 10px 15px;
             margin-bottom: 20px; /* Space between matches */
             width: 100%;
             box-shadow: 0 2px 4px rgba(0,0,0,0.05);
             display: flex;
             flex-direction: column;
             align-items: center;
         }

         .bracket-match-player {
             display: flex;
             align-items: center;
             font-weight: 500;
             margin-bottom: 4px;
         }
         .bracket-match-player:last-of-type {
             margin-bottom: 0;
         }

         .bracket-match-player strong {
             color: #0070c0; /* Primary Blue for seeds */
             flex-shrink: 0;
             margin-right: 6px;
         }

         .bracket-match-player span {
             flex-grow: 1;
             text-align: left;
             overflow: hidden;
             text-overflow: ellipsis;
             white-space: nowrap;
         }

         .bracket-vs {
           margin: 6px 0;
           font-size: 13px;
           color: #666;
           font-style: italic;
           font-weight: normal;
         }

         .bracket-bye {
           color: #888;
           font-style: italic;
           font-size: 14px;
           font-weight: normal;
         }

         .dotted-line {
           border-top: 1px dotted #bfbfbf; /* Light Grey */
           margin: 40px auto 30px;
           max-width: 500px;
           width: 90%;
         }

         .lower-seeds-grid {
           display: flex;
           flex-wrap: wrap;
           justify-content: center;
           gap: 12px;
           text-align: center;
           max-width: 600px;
           width: 100%;
         }

         .lower-seed-box {
           background: #f8f8f8; /* Very light grey, almost white */
           padding: 10px 15px;
           border: 1px solid #bfbfbf; /* Light Grey */
           border-radius: 6px;
           box-shadow: 1px 1px 3px rgba(0,0,0,0.05);
           font-size: 14px;
           min-width: 110px;
           flex-basis: calc(33% - 12px);
           max-width: calc(33% - 12px);
           box-sizing: border-box;
           display: flex;
           flex-direction: column;
           align-items: center;
           justify-content: center;
         }
         .lower-seed-box strong {
             color: #0070c0; /* Primary Blue for seeds */
         }
         .lower-seed-box span {
             color: #2D3748; /* Darker text */
         }

         /* Dropdown Navigation Styles */
         .navbar {
             display: flex;
             justify-content: center;
             width: 100%;
             max-width: 4xl;
             background: #0070c0; /* Darker blue for navbar */
             border-radius: 8px;
             box-shadow: 0 4px 8px rgba(0,0,0,0.2);
             padding: 0 10px;
             z-index: 1000; /* Ensure it stays on top */
             position: relative;
         }

         .nav-item {
             position: relative;
             cursor: pointer;
             padding: 15px 20px;
             color: white;
             font-weight: 600;
             transition: background-color 0.3s ease;
             white-space: nowrap; /* Prevent wrapping */
         }

         .nav-item:hover {
             background-color: #005f9f; /* Slightly darker on hover */
         }

         .nav-item.active-category {
             background-color: #005f9f; /* Active category styling */
         }

         .dropdown-content {
             display: none;
             position: absolute;
             background-color: #f9f9f9; /* Light background for dropdown */
             min-width: 160px;
             box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
             z-index: 1001;
             left: 0; /* Align dropdown with its parent nav-item */
             top: 100%; /* Position below the nav-item */
             border-radius: 0 0 8px 8px;
             overflow: hidden;
             border-top: 2px solid #0070c0; /* Blue line at top of dropdown */
         }

         .nav-item:hover .dropdown-content, .dropdown-content.active {
             display: block;
         }

         .dropdown-item {
             color: #333;
             padding: 12px 16px;
             text-decoration: none;
             display: block;
             text-align: left;
             font-weight: normal;
         }

         .dropdown-item:hover {
             background-color: #e0e0e0;
             color: #0070c0;
         }
         .dropdown-item.active-tab {
             background-color: #0070c0; /* Active tab in dropdown */
             color: white;
         }


         .content-container {
             background: white;
             padding: 25px;
             border-radius: 8px;
             box-shadow: 0 4px 12px rgba(0,0,0,0.1);
             width: 100%;
             max-width: 4xl;
             min-height: 400px;
             display: flex;
             flex-direction: column;
             align-items: center;
             margin-top: 20px; /* Space between nav and content */
         }

         /* Team Ticker specific styles */
         #team-ticker-container {
           overflow-x: auto;
           white-space: nowrap;
           padding: 8px 0;
           width: 100%;
           background: #e0e0e0; /* Light grey background */
           margin-bottom: 20px; /* Space between team ticker and navbar */
           box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
         }

         .team-ticker-item {
           display: inline-flex; /* Use inline-flex to allow flex properties while being in a row */
           flex-direction: column;
           align-items: center;
           justify-content: center;
           padding: 0 15px;
           margin: 0 5px;
           border-right: 1px solid #bfbfbf; /* Separator */
           height: 70px; /* Fixed height for consistent alignment */
           flex-shrink: 0;
           font-size: 13px;
           color: #444;
         }
         .team-ticker-item:last-child {
             border-right: none;
         }
         .team-ticker-item img {
           width: 30px;
           height: 30px;
           border-radius: 50%;
           object-fit: cover;
           margin-bottom: 4px;
           border: 1px solid #0070c0;
         }
         .team-ticker-item .team-name {
           font-weight: 600;
           color: #0070c0;
           white-space: nowrap;
         }
         .team-ticker-item .team-record {
           font-size: 11px;
           color: #666;
           white-space: nowrap;
         }

         /* Trade Ticker Container (now transparent) */
         #trade-ticker-container {
             background-color: transparent;
             box-shadow: none;
             padding: 0; /* Remove vertical padding specific to this container */
             border-radius: 0;
         }

         /* No specific .trade-ticker-card CSS needed beyond Tailwind classes */


         @media (max-width: 600px) {
           .navbar {
             padding: 0;
             flex-wrap: wrap; /* Allow nav items to wrap */
             border-radius: 8px; /* Maintain rounded corners if wrapped */
           }
           .nav-item {
             padding: 10px 12px;
             font-size: 0.9em;
           }
           .dropdown-content {
             width: 100%; /* Full width for dropdown on small screens */
             left: 0;
             border-radius: 0 0 8px 8px; /* Adjust if navbar wraps */
             position: static; /* Stack vertically for simpler mobile dropdowns */
             box-shadow: none; /* Remove shadow to blend */
             border-top: none;
           }
           .nav-item:hover .dropdown-content, .dropdown-content.active {
             display: block; /* Always show when active for category */
           }
           .dropdown-item {
             padding: 10px 12px;
           }
           .content-container {
             padding: 15px;
           }
           .team-ticker-item {
             padding: 0 10px;
           }
           .trade-ticker-card {
             min-width: 250px;
             min-height: 180px; /* Adjust for smaller screens if needed */
           }
         }
       `}</style>

      {/* Header Section */}
      <header className="w-full max-w-4xl bg-gradient-to-r from-[#0070c0] to-[#005f9f] text-white p-6 rounded-xl shadow-lg mb-8 text-center">
        <h1 className="text-4xl font-extrabold mb-2">Fantasy League Dashboard</h1>
        {sleeperLeagueData && (
          <p className="text-xl">
            {sleeperLeagueData.name} ({sleeperLeagueData.season} Season)
          </p>
        )}
        {!sleeperLeagueData && (
          <p className="text-xl">Your one-stop shop for league insights!</p>
        )}
      </header>

      {/* New Team Ticker */}
      <section id="team-ticker-container">
        {leagueManagers && leagueManagers.length > 0 ? (
          <div className="inline-flex animate-ticker-scroll items-center h-full">
            {/* Duplicate content for continuous scrolling effect */}
            {[...leagueManagers, ...leagueManagers].map((manager, index) => (
              <div key={`manager-${manager.userId}-${index}`} className="team-ticker-item">
                <img src={manager.avatar} alt={`${manager.teamName} avatar`} onError={(e) => e.target.src = 'https://placehold.co/30x30/cccccc/333333?text=M'} />
                <span className="team-name">{manager.teamName}</span>
                <span className="team-record">{manager.wins}-{manager.losses}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-center py-2">Loading team data for ticker...</p>
        )}
      </section>

      {/* Dropdown Navigation */}
      <nav className="navbar mb-0">
        {Object.entries(NAV_CATEGORIES).map(([categoryKey, category]) => (
          <div
            key={categoryKey}
            className={`nav-item ${activeDropdown === categoryKey ? 'active-category' : ''}`}
            onMouseEnter={() => category.subTabs && setActiveDropdown(categoryKey)}
            onMouseLeave={() => setActiveDropdown(null)}
            onClick={() => { // For categories without sub-tabs (like Home)
              if (!category.subTabs) {
                setActiveTab(category.tab);
                setActiveDropdown(null); // Close any open dropdowns
              }
            }}
          >
            {category.label}
            {category.subTabs && (
              <div className={`dropdown-content ${activeDropdown === categoryKey ? 'active' : ''}`}>
                {category.subTabs.map((subTab) => (
                  <a
                    key={subTab.tab}
                    href="#" // Use href="#" or onClick for proper link behavior in A tag
                    className={`dropdown-item ${activeTab === subTab.tab ? 'active-tab' : ''}`}
                    onClick={(e) => {
                      e.preventDefault(); // Prevent default link behavior
                      setActiveTab(subTab.tab);
                      setActiveDropdown(null); // Close dropdown after selection
                    }}
                  >
                    {subTab.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Main Content Area */}
      <div className="content-container">
        {/* Conditional rendering based on activeTab */}
        {activeTab === TABS.TRADES && (
          <section className="w-full">
            {/* Removed heading for Trade Ticker */}
            {loadingTrades ? (
              <p className="text-gray-600 text-center">Loading recent trades data...</p>
            ) : errorTrades ? (
              <p className="text-red-500 px-4 md:px-0 text-center">Error: {errorTrades}</p>
            ) : recentTrades && recentTrades.length > 0 ? (
              <div id="trade-ticker-container" className="overflow-x-auto whitespace-nowrap"> {/* Removed py-2 here */}
                <div className="inline-flex gap-4 animate-ticker-scroll items-center"> {/* Increased gap to gap-4 */}
                  {/* Duplicate content for continuous scrolling effect */}
                  {[...recentTrades, ...recentTrades].map((trade, index) => (
                    <div key={`trade-${trade.transaction_id}-${index}`} className="
                      bg-white border border-[#bfbfbf] rounded-md shadow-sm p-2.5
                      flex flex-col flex-shrink-0
                      min-w-[280px] min-h-[220px]
                      overflow-y-hidden
                    ">
                      <h3 className="
                        flex justify-center font-semibold text-[11px] text-gray-700 tracking-wide
                        pb-1 mb-1 border-b-2 border-[#0070c0] text-center
                      ">
                        Trade Completed - Week {trade.week}
                      </h3>
                      <div className="flex flex-nowrap justify-center items-start w-full h-full gap-0">
                        {trade.participants.map((participant, pIndex) => (
                          <React.Fragment key={participant.rosterId}>
                            <div className="flex flex-col flex-shrink-0 items-center p-0.5 min-w-[120px]">
                              <div className="flex flex-col items-center gap-1 mb-1 pb-1.5 border-b border-[#ff0000] w-full"> {/* Red border for trades */}
                                <img src={participant.managerAvatar} alt={`${participant.teamName} avatar`} className="w-5 h-5 rounded-full object-cover border border-[#ff0000]" onError={(e) => e.target.src = 'https://placehold.co/32x32/cccccc/333333?text=M'} />
                                <span className="font-semibold text-[10px] text-[#0070c0] text-center break-words max-w-full">{getMappedTeamName(participant.teamName)}</span>
                              </div>
                              <div className="flex flex-col gap-1 flex-grow w-full">
                                {/* Received Assets */}
                                {participant.receivedAssets.length > 0 && participant.receivedAssets.map((asset, assetIndex) => <div key={assetIndex}>{renderTradeAsset(asset, 'received')}</div>)}
                                {/* Sent Assets (add separator if both exist) */}
                                {participant.receivedAssets.length > 0 && participant.sentAssets.length > 0 && (
                                  <div className="pt-2"></div>
                                )}
                                {participant.sentAssets.length > 0 && participant.sentAssets.map((asset, assetIndex) => <div key={assetIndex}>{renderTradeAsset(asset, 'sent')}</div>)}
                              </div>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-600 px-4 md:px-0 text-center">No recent trades data available. Please ensure your Sleeper League ID is correct and there are trades in your league.</p>
            )}
          </section>
        )}

        {activeTab === TABS.ODDS && (
          <section className="w-full flex flex-col items-center">
            <h2 className="text-2xl font-bold text-[#0070c0] mb-4 border-b-2 border-[#bfbfbf] pb-2 w-full text-center">
              Weekly Odds & Results (Week {currentOddsWeek !== null ? currentOddsWeek + 1 : '...'})
            </h2>
            {loadingOdds ? (
              <p className="text-gray-600">Loading weekly odds data...</p>
            ) : errorOdds ? (
              <p className="text-red-500">Error: {errorOdds}</p>
            ) : weeklyOddsData[currentOddsWeek] && weeklyOddsData[currentOddsWeek].length > 0 ? (
              <>
                <div className="week-buttons-container">
                  {Array.from({ length: totalOddsWeeks }, (_, i) => (
                    <button
                      key={i}
                      className={`week-nav-button ${currentOddsWeek === i ? 'active' : ''}`}
                      onClick={() => setCurrentOddsWeek(i)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col items-center w-full">
                  {weeklyOddsData[currentOddsWeek].map((match, idx) => {
                    // Apply team name replacement using the universal helper
                    const displayP1Name = getMappedTeamName(match.p1Name);
                    const displayP2Name = getMappedTeamName(match.p2Name);

                    const p1Class = match.winner === 1 ? 'odds-win' : match.winner === 2 ? 'odds-lose' : '';
                    const p2Class = match.winner === 2 ? 'odds-win' : match.winner === 1 ? 'odds-lose' : '';
                    const ouOClass = match.ouResult === 1 ? 'odds-win' : match.ouResult === 2 ? 'odds-lose' : '';
                    const ouUClass = match.ouResult === 2 ? 'odds-win' : match.ouResult === 1 ? 'odds-lose' : '';

                    const hasScores = match.p1Score !== '' && match.p2Score !== '';
                    const p1ScoreDisplay = hasScores ? `<span class="odds-score">${match.p1Score}</span>` : '';
                    const p2ScoreDisplay = hasScores ? `<span class="odds-score">${match.p2Score}</span>` : '';

                    return (
                      <div key={idx} className="odds-matchup">
                        <div className="odds-player">
                          <div dangerouslySetInnerHTML={{ __html: `${displayP1Name} ${p1ScoreDisplay}` }}></div>
                          <div className="odds-bubbles">
                            <div className={`odds-value ${p1Class}`}>{match.p1Odds}</div>
                            <div className={`odds-ou-box ${ouOClass}`}>O {match.ou}<br /><small>-110</small></div>
                          </div>
                        </div>
                        <div className="odds-player">
                          <div dangerouslySetInnerHTML={{ __html: `${displayP2Name} ${p2ScoreDisplay}` }}></div>
                          <div className="odds-bubbles">
                            <div className={`odds-value ${p2Class}`}>{match.p2Odds}</div>
                            <div className={`odds-ou-box ${ouUClass}`}>U {match.ou}<br /><small>-110</small></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-gray-600">No weekly odds data available for this week. Check your Apps Script and Google Sheet.</p>
            )}
          </section>
        )}

        {activeTab === TABS.BRACKET && (
          <section className="w-full flex flex-col items-center">
            <h2 className="text-2xl font-bold text-[#0070c0] mb-4 border-b-2 border-[#bfbfbf] pb-2 w-full text-center">
              Projected Playoff Bracket
            </h2>
            {loadingBracket ? (
              <p className="text-gray-600">Loading playoff bracket data...</p>
            ) : errorBracket ? (
              <p className="text-red-500">Error: {errorBracket}</p>
            ) : bracketData ? (
              <>
                <div className="bracket-container">
                  {/* Round 1 */}
                  <div className="bracket-round">
                    <div className="bracket-round-label">Round 1</div>
                    {bracketData.round1.map((match, index) => {
                      // Apply team name replacement using the universal helper
                      const displayTeam1 = getMappedTeamName(match.team1);
                      const displayTeam2 = getMappedTeamName(match.team2);

                      return (
                        <div key={`r1-match-${index}`} className="bracket-match">
                          <div className="bracket-match-player">
                            <strong>{match.seed1}</strong> <span>{displayTeam1 || <span className="bracket-bye">Bye</span>}</span>
                          </div>
                          <div className="bracket-vs">vs</div>
                          <div className="bracket-match-player">
                            <strong>{match.seed2}</strong> <span>{displayTeam2 || <span className="bracket-bye">Bye</span>}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Round 2 */}
                  <div className="bracket-round">
                    <div className="bracket-round-label">Round 2</div>
                    {bracketData.round2.map((match, index) => {
                      // Apply team name replacement using the universal helper
                      const displayTeam = getMappedTeamName(match.team);

                      return (
                        <div key={`r2-match-${index}`} className="bracket-match">
                          <div className="bracket-match-player">
                            <strong>{match.seed}</strong> <span>{displayTeam || <span className="bracket-bye">Bye</span>}</span>
                          </div>
                          <div className="bracket-vs">vs</div>
                          {/* Placeholder text for remaining seeds as per original */}
                          <div className="bracket-bye">
                            {index === 0 ? "Lowest Seed Remaining" : "Highest Seed Remaining"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="dotted-line"></div>

                {/* Lower seeds grid */}
                <h3 className="text-xl font-bold text-gray-700 mb-4 mt-6 w-full text-center">
                  Remaining Seeds
                </h3>
                <div className="lower-seeds-grid">
                  {bracketData.lowerSeeds.map((entry, index) => {
                    // Apply team name replacement using the universal helper
                    const displayTeam = getMappedTeamName(entry.team);

                    return (
                      <div key={`lower-seed-${index}`} className="lower-seed-box">
                        <strong>{entry.seed}</strong> <span>{displayTeam || <span className="bracket-bye">Bye</span>}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-gray-600">No playoff bracket data available. Check your Apps Script and Google Sheet.</p>
            )}
          </section>
        )}

        {activeTab === TABS.HISTORY && (
          <section className="w-full">
            <h2 className="text-2xl font-bold text-[#0070c0] mb-4 border-b-2 border-[#bfbfbf] pb-2 text-center">
              League History (Power Rankings / General Data)
            </h2>
            {loadingGoogleSheet ? (
              <p className="text-gray-600">Loading league history from Google Sheet...</p>
            ) : errorGoogleSheet ? (
              <p className="text-red-500">Error: {errorGoogleSheet}</p>
            ) : googleSheetHistory ? (
              <div>
                {googleSheetHistory.data && googleSheetHistory.data.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white rounded-lg overflow-hidden shadow">
                      <thead className="bg-[#bfbfbf]"> {/* Light Grey header background */}
                        <tr>
                          {Object.keys(googleSheetHistory.data[0]).map((header) => (
                            <th key={header} className="py-3 px-4 text-left text-sm font-semibold text-[#0070c0] uppercase tracking-wider">
                              {header.replace(/_/g, ' ')} {/* Replace underscores with spaces for display */}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {googleSheetHistory.data.map((row, index) => {
                          // Apply team name replacement for each cell in the row
                          const processedRow = Object.values(row).map(value =>
                            getMappedTeamName(value)
                          );
                          return (
                            <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                              {processedRow.map((value, idx) => (
                                <td key={idx} className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                                  {value}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-600">No general historical data found in Google Sheet.</p>
                )}
              </div>
            ) : (
              <p className="text-gray-600">No Google Sheet history data available.</p>
            )}
            <p className="mt-4 text-sm text-gray-500">
              <a href="https://developers.google.com/apps-script/guides/web" target="_blank" rel="noopener noreferrer" className="text-[#0070c0] hover:underline">
                Learn how to expose your Google Sheet as an API using Google Apps Script.
              </a>
            </p>
          </section>
        )}

        {activeTab === TABS.CHAMPIONS && (
          <section className="w-full">
            <h2 className="text-2xl font-bold text-[#0070c0] mb-4 border-b-2 border-[#bfbfbf] pb-2 text-center">
              Historical Champions & Awards
            </h2>
            {loadingChampions ? (
              <p className="text-gray-600">Loading historical champions data...</p>
            ) : errorChampions ? (
              <p className="text-red-500">Error: {errorChampions}</p>
            ) : historicalChampions && historicalChampions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {historicalChampions.map((champion, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-[#bfbfbf]">
                    {/* Apply team name replacement for champion, runnerUp, mvp */}
                    {champion.champion && <p className="font-semibold text-lg text-[#0070c0]">🏆 {champion.year} Champion: {getMappedTeamName(champion.champion)}</p>}
                    {champion.runnerUp && <p className="text-md text-gray-700">🥈 Runner-Up: {getMappedTeamName(champion.runnerUp)}</p>}
                    {champion.mvp && <p className="text-md text-gray-700">⭐ MVP: {getMappedTeamName(champion.mvp)}</p>}
                    {/* Add more fields for other awards as needed */}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No historical champions/awards data available. Consider populating a Google Sheet for this section.</p>
            )}
            <p className="mt-4 text-sm text-gray-500">
              If you want to fetch this data from a Google Sheet, you'll need to set up a dedicated Apps Script deployment for it,
              similar to how you did for the power rankings, and update `GOOGLE_SHEET_CHAMPIONS_API_URL`.
            </p>
          </section>
        )}

        {/* <<< START NEW SECTION FOR ALL HISTORICAL MATCHUPS >>> */}
        {activeTab === TABS.ALL_MATCHUPS && (
          <section className="w-full">
            <h2 className="text-2xl font-bold text-[#0070c0] mb-4 border-b-2 border-[#bfbfbf] pb-2 text-center">
              All Historical Matchups
            </h2>
            {loadingMatchups ? (
              <p className="text-gray-600">Loading all historical matchup data...</p>
            ) : errorMatchups ? (
              <p className="text-red-500">Error: {errorMatchups}</p>
            ) : (historicalMatchups && Array.isArray(historicalMatchups) && historicalMatchups.length > 0) ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white rounded-lg overflow-hidden shadow">
                  <thead className="bg-[#bfbfbf]">
                    <tr>
                      {/* Added check for historicalMatchups[0] and its type for robustness */}
                      {historicalMatchups[0] && typeof historicalMatchups[0] === 'object' && Object.keys(historicalMatchups[0]).map((header) => (
                        <th key={header} className="py-3 px-4 text-left text-sm font-semibold text-[#0070c0] uppercase tracking-wider">
                          {header.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} {/* Converts camelCase to "Camel Case" for display */}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historicalMatchups.map((match, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        {/* Added check for 'match' and its type for robustness */}
                        {match && typeof match === 'object' && Object.entries(match).map(([key, value], idx) => (
                          <td key={idx} className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                            {/* Apply team name mapping only to relevant team name columns */}
                            {key.includes('team1') || key.includes('team2') ? getMappedTeamName(value) : value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600">No historical matchup data available. Please ensure your Apps Script is deployed correctly and your Google Sheet has data.</p>
            )}
            <p className="mt-4 text-sm text-gray-500">
              This section loads all historical league matchups from a dedicated Google Sheet via Google Apps Script.
            </p>
          </section>
        )}
        {/* <<< END NEW SECTION FOR ALL HISTORICAL MATCHUPS >>> */}

      </div>


      {/* Footer / Instructions */}
      <footer className="mt-8 text-center text-gray-600 text-sm pb-8">
        <p>Remember to replace placeholder `YOUR_SLEEPER_LEAGUE_ID`, `YOUR_GOOGLE_SHEET_API_URL`, etc., with your actual values.</p>
        <p className="mt-2">
          For Sleeper API documentation, visit:{" "}
          <a href="https://docs.sleeper.com/" target="_blank" rel="noopener noreferrer" className="text-[#0070c0] hover:underline">
            https://docs.sleeper.com/
          </a>
        </p>
      </footer>
    </div>
  );
};

export default App;
