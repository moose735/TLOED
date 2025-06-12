import React, { useState, useEffect, useRef } from 'react';
import {
  SLEEPER_LEAGUE_IDS,
  CURRENT_FANTASY_SEASON_YEAR,
  GOOGLE_SHEET_API_URL,
  TRADE_TICKER_API_URL,
  GOOGLE_SHEET_CHAMPIONS_API_URL,
  WEEKLY_ODDS_API_URL,
  BRACKET_API_URL,
  NICKNAME_TO_SLEEPER_USER
} from './config';

// Define the available tabs and their categories for the dropdown
const NAV_CATEGORIES = {
  HOME: { label: 'Home', tab: 'Trades' }, // Home directly maps to Trades ticker
  LEAGUE_STATS: {
    label: 'League Stats',
    subTabs: [
      { label: 'Live Matchups', tab: 'Live Matchups' },
      { label: 'Weekly Odds', tab: 'Weekly Odds' },
      { label: 'Playoff Bracket', tab: 'Playoff Bracket' },
    ]
  },
  HISTORICAL_DATA: {
    label: 'Historical Data',
    subTabs: [
      { label: `League History (${CURRENT_FANTASY_SEASON_YEAR})`, tab: 'League History' }, // Updated label
      { label: `Champions & Awards (${CURRENT_FANTASY_SEASON_YEAR})`, tab: 'Champions' }, // Updated label
      // TODO: If you implement multi-year historical data, you might add a "Select Year" dropdown here
    ]
  }
};

// Flattened list of all possible tabs for conditional rendering
const TABS = {
  TRADES: 'Trades',
  LIVE_MATCHUPS: 'Live Matchups',
  ODDS: 'Weekly Odds',
  BRACKET: 'Playoff Bracket',
  HISTORY: 'League History',
  CHAMPIONS: 'Champions'
};

// Main App component
const App = () => {
  // Determine the current league ID based on the configured year
  const currentLeagueId = SLEEPER_LEAGUE_IDS[CURRENT_FANTASY_SEASON_YEAR];

  // State to store data fetched from Sleeper API (League details)
  const [sleeperLeagueData, setSleeperLeagueData] = useState(null);
  // State to store data fetched from Google Sheet API (General historical data like power rankings)
  const [googleSheetHistory, setGoogleSheetHistory] = useState(null);
  // State to store league managers/teams data from Sleeper API
  const [leagueManagers, setLeagueManagers] = useState(null);
  // State to store recent transactions data from the new Apps Script JSON API
  const [recentTrades, setRecentTrades] = useState(null);
  // State to store historical champions/awards data (potentially from Google Sheet or hardcoded)
  const [historicalChampions, setHistoricalChampions] = useState(null);

  // States for Weekly Odds
  const [weeklyOddsData, setWeeklyOddsData] = useState({}); // Cache for fetched weeks
  const [currentOddsWeek, setCurrentOddsWeek] = useState(null); // 0-indexed current week for odds
  const [totalOddsWeeks, setTotalOddsWeeks] = useState(14); // Default, will be updated by API
  const [loadingOdds, setLoadingOdds] = useState(true);
  const [errorOdds, setErrorOdds] = useState(null);

  // States for Playoff Bracket
  const [bracketData, setBracketData] = useState(null);
  const [loadingBracket, setLoadingBracket] = useState(true);
  const [errorBracket, setErrorBracket] = useState(null);

  // States for Live Matchups
  const [liveMatchups, setLiveMatchups] = useState([]);
  const [currentNFLWeek, setCurrentNFLWeek] = useState(null);
  const [loadingLiveMatchups, setLoadingLiveMatchups] = useState(true);
  const [errorLiveMatchups, setErrorLiveMatchups] = useState(null);
  const intervalRef = useRef(null); // Ref to hold the interval ID

  // State to store a map of nickname/last name (from Google Sheets) to actual Sleeper team names.
  // This map will be built based on the *current* league managers.
  const [playerNameToTeamNameMap, setPlayerNameToTeamNameMap] = useState({});

  // State for active tab (now derived from dropdown selection)
  const [activeTab, setActiveTab] = useState(TABS.TRADES); // Default to Trades (Home) tab

  // State for dropdown visibility
  const [activeDropdown, setActiveDropdown] = useState(null); // Stores the label of the currently open dropdown

  // States for loading indicators
  const [loadingGoogleSheet, setLoadingGoogleSheet] = useState(true);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [loadingChampions, setLoadingChampions] = useState(true);

  // States for error messages
  const [errorGoogleSheet, setErrorGoogleSheet] = useState(null);
  const [errorTrades, setErrorTrades] = useState(null);
  const [errorChampions, setErrorChampions] = useState(null);


  // Helper function to replace a given name (from Google Sheet) with its mapped Sleeper team name.
  // Uses the `playerNameToTeamNameMap` populated from Sleeper data.
  const getMappedTeamName = (originalName) => {
    if (!originalName || typeof originalName !== 'string') return originalName;
    const normalizedName = originalName.trim().toLowerCase();
    return playerNameToTeamNameMap[normalizedName] || originalName;
  };


  // Effect hook to fetch general league data from Sleeper API (for header display)
  // Now uses currentLeagueId
  useEffect(() => {
    const fetchSleeperData = async () => {
      if (!currentLeagueId || currentLeagueId.includes('YOUR_')) {
        // console.warn("Sleeper League ID not set or is a placeholder. Skipping Sleeper league data fetch.");
        setSleeperLeagueData(null); // Clear data if ID is invalid
        return;
      }

      try {
        const sleeperApiUrl = `https://api.sleeper.app/v1/league/${currentLeagueId}`;
        const response = await fetch(sleeperApiUrl);

        if (!response.ok) {
          throw new Error(`Sleeper API HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setSleeperLeagueData(data);
      } catch (error) {
        console.error("Error fetching Sleeper data for header:", error);
      }
    };

    fetchSleeperData();
  }, [currentLeagueId]); // Dependency on currentLeagueId


  // Helper function to format manager display name by replacing last name with team name (KEPT FOR MAP)
  // This is no longer used for display, but kept for consistency if needed in the future.
  const getFormattedManagerName = (displayName, teamName) => {
    if (!displayName || !teamName) return displayName || teamName;

    const nameParts = displayName.trim().split(/\s+/);
    if (nameParts.length > 1) {
      nameParts[nameParts.length - 1] = teamName;
      return nameParts.join(' ');
    }
    return displayName;
  };


  // Effect hook to fetch league managers/users data from Sleeper API and build the team name map
  // Now uses currentLeagueId
  useEffect(() => {
    const fetchManagersData = async () => {
      if (!currentLeagueId || currentLeagueId.includes('YOUR_')) {
        setLeagueManagers([]); // Set empty array if ID not configured
        setPlayerNameToTeamNameMap({}); // Clear map
        return;
      }

      try {
        const usersApiUrl = `https://api.sleeper.app/v1/league/${currentLeagueId}/users`;
        const rostersApiUrl = `https://api.sleeper.app/v1/league/${currentLeagueId}/rosters`;

        const [usersResponse, rostersResponse] = await Promise.all([
          fetch(usersApiUrl),
          fetch(rostersApiUrl)
        ]);

        if (!usersResponse.ok) throw new Error(`Users API HTTP error! status: ${usersResponse.status}`);
        if (!rostersResponse.ok) throw new Error(`Rosters API HTTP error! status: ${rostersResponse.status}`);

        const usersData = await usersResponse.json();
        const rostersData = await rostersResponse.json();

        const combinedManagers = usersData.map(user => {
          const userRoster = rostersData.find(roster => roster.owner_id === user.user_id);
          const teamName = user.metadata?.team_name || userRoster?.metadata?.team_name || `Team ${user.display_name || user.username}`;
          const displayName = user.display_name || user.username;

          return {
            userId: user.user_id,
            displayName: displayName,
            teamName: teamName,
            formattedDisplayNameForManagerLine: getFormattedManagerName(displayName, teamName), // Retained but not used for display
            wins: userRoster ? userRoster.settings.wins : 0,
            losses: userRoster ? userRoster.settings.losses : 0,
            avatar: user.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : 'https://placehold.co/40x40/cccccc/333333?text=M'
          };
        });
        setLeagueManagers(combinedManagers);

        // Build the playerNameToTeamNameMap for the CURRENT league
        const newPlayerNameToTeamNameMap = {};
        Object.entries(NICKNAME_TO_SLEEPER_USER).forEach(([nicknameKey, sleeperUserIdentifier]) => {
          const matchingManager = combinedManagers.find(manager =>
            manager.displayName.toLowerCase() === sleeperUserIdentifier.toLowerCase()
          );
          if (matchingManager) {
            newPlayerNameToTeamNameMap[nicknameKey.toLowerCase()] = matchingManager.teamName;
          }
        });
        setPlayerNameToTeamNameMap(newPlayerNameToTeamNameMap);

      } catch (error) {
        console.error("Error fetching managers data for map and ticker:", error);
      }
    };

    fetchManagersData();
  }, [currentLeagueId]); // Dependency on currentLeagueId


  // Effect hook to fetch recent trades data from the new Apps Script JSON API
  // This API (TRADE_TICKER_API_URL) is assumed to already be configured to fetch
  // trades for the appropriate current league/season based on its own backend logic.
  // If it needs the currentLeagueId, you'd have to pass it as a URL parameter.
  useEffect(() => {
    const fetchTradesData = async () => {
      if (TRADE_TICKER_API_URL === 'YOUR_TRADE_TICKER_APPS_SCRIPT_URL') {
        setLoadingTrades(false);
        setErrorTrades("Please update TRADE_TICKER_API_URL in config.js with your actual Apps Script URL for trades.");
        return;
      }

      try {
        const response = await fetch(TRADE_TICKER_API_URL, { mode: 'cors' });

        if (!response.ok) {
          throw new Error(`Trade Ticker API HTTP error! status: ${response.status}. Response: ${await response.text()}.`);
        }

        const data = await response.json();
        setRecentTrades(data.data); // Assuming the Apps Script returns { data: [...] }

      } catch (error) {
        console.error("Error fetching trades data:", error);
        setErrorTrades(
          `Error: ${error.message}. ` +
          `Please ensure your Trade Ticker Apps Script URL (${TRADE_TICKER_API_URL}) is correct and publicly accessible. ` +
          `**Crucially, try opening this URL directly in your browser. If it doesn't show JSON data, there's an issue with your Apps Script deployment or code (check Apps Script 'Executions' logs!).**`
        );
      } finally {
        setLoadingTrades(false);
      }
    };

    fetchTradesData();
  }, [TRADE_TICKER_API_URL]);


  // Effect hook to fetch data from Google Sheet API (general historical data like power rankings)
  // This currently fetches for one sheet. If you want multi-year history, you'd need
  // to extend GOOGLE_SHEET_API_URL to accept a 'year' parameter, or have multiple URLs.
  // For now, this will fetch data for the sheet linked to the current configuration.
  useEffect(() => {
    const fetchGoogleSheetData = async () => {
      if (GOOGLE_SHEET_API_URL === 'YOUR_GOOGLE_SHEET_APPS_SCRIPT_URL') {
        setLoadingGoogleSheet(false);
        setErrorGoogleSheet("Please update GOOGLE_SHEET_API_URL in config.js with your actual Apps Script URL for general history.");
        return;
      }

      try {
        // If your Apps Script can take a 'year' parameter:
        // const apiUrl = `${GOOGLE_SHEET_API_URL}?year=${CURRENT_FANTASY_SEASON_YEAR}`;
        // For now, assume it's just fetching the default sheet's data.
        const response = await fetch(GOOGLE_SHEET_API_URL, { mode: 'cors' });

        if (!response.ok) {
          throw new Error(`Google Sheet API HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setGoogleSheetHistory(data); // This data will be for the sheet's default year
      } catch (error) {
        console.error("Error fetching Google Sheet data:", error);
        setErrorGoogleSheet(
          `Error: ${error.message}. ` +
          `Please ensure your Google Apps Script web app URL (${GOOGLE_SHEET_API_URL}) is correct and publicly accessible. ` +
          `Try opening this URL directly in your browser. If it doesn't show JSON data, there's an issue with your Apps Script deployment or code.`
        );
      } finally {
        setLoadingGoogleSheet(false);
      }
    };

    fetchGoogleSheetData();
  }, [GOOGLE_SHEET_API_URL]);


  // Effect hook to fetch historical champions data
  // Similar to googleSheetHistory, this assumes fetching for one sheet/year.
  useEffect(() => {
    const fetchHistoricalChampions = async () => {
      // For demonstration, let's use some hardcoded data if no specific API URL is provided.
      if (GOOGLE_SHEET_CHAMPIONS_API_URL === 'YOUR_GOOGLE_SHEET_CHAMPIONS_API_URL') {
        setHistoricalChampions([
          { year: 2023, champion: "The GOATs", runnerUp: "Fantasy Fails", mvp: "Patrick Mahomes" },
          { year: 2022, champion: "Gridiron Gurus", runnerUp: "Touchdown Titans", mvp: "Justin Jefferson" },
          { year: 2021, champion: "Fantasy Pharaohs", runnerUp: "League Legends", mvp: "Jonathan Taylor" },
        ]);
        setLoadingChampions(false);
        return;
      }

      try {
        // If your Apps Script can take a 'year' parameter:
        // const apiUrl = `${GOOGLE_SHEET_CHAMPIONS_API_URL}?year=${CURRENT_FANTASY_SEASON_YEAR}`;
        // For now, assume it's just fetching the default sheet's data.
        const response = await fetch(GOOGLE_SHEET_CHAMPIONS_API_URL, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`Champions API HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setHistoricalChampions(data.data); // Assuming 'data' key as per previous Apps Script structure
      } catch (error) {
        console.error("Error fetching historical champions:", error);
        setErrorChampions(
          `Error: ${error.message}. ` +
          `Ensure '${GOOGLE_SHEET_CHAMPIONS_API_URL}' is a valid Apps Script URL returning JSON. ` +
          `If not, consider using the hardcoded example or setting up a new Apps Script.`
        );
      } finally {
        setLoadingChampions(false);
      }
    };

    fetchHistoricalChampions();
  }, [GOOGLE_SHEET_CHAMPIONS_API_URL]);


  // Effect hook to fetch Weekly Odds data from Apps Script JSON API
  // This API is assumed to implicitly get data for the current league/season based on its own backend logic.
  // If it needs the currentLeagueId, you'd have to pass it as a URL parameter.
  useEffect(() => {
    const fetchWeeklyOdds = async (weekNum) => {
      if (WEEKLY_ODDS_API_URL === 'YOUR_WEEKLY_ODDS_APPS_SCRIPT_URL_HERE') {
        setLoadingOdds(false);
        setErrorOdds("Please update WEEKLY_ODDS_API_URL in config.js with your actual Apps Script URL for weekly odds.");
        return;
      }

      // Check cache first
      if (weeklyOddsData[weekNum]) {
        setCurrentOddsWeek(weekNum);
        return;
      }

      setLoadingOdds(true);
      setErrorOdds(null);

      try {
        // If your Apps Script can take a 'year' parameter:
        // const apiUrl = `${WEEKLY_ODDS_API_URL}?week=${weekNum}&year=${CURRENT_FANTASY_SEASON_YEAR}`;
        const apiUrl = `${WEEKLY_ODDS_API_URL}?week=${weekNum}`;
        const response = await fetch(apiUrl, { mode: 'cors' });

        if (!response.ok) {
          throw new Error(`Weekly Odds API HTTP error! status: ${response.status}. Response: ${await response.text()}.`);
        }

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }

        setWeeklyOddsData(prevData => ({
          ...prevData,
          [weekNum]: data.matches
        }));
        setCurrentOddsWeek(data.currentWeekInSheet - 1); // Set current week to the one just loaded
        setTotalOddsWeeks(data.totalWeeks); // Update total weeks from API
      } catch (error) {
        console.error("Error fetching weekly odds data:", error);
        setErrorOdds(
          `Error: ${error.message}. ` +
          `Please ensure your Weekly Odds Apps Script URL (${WEEKLY_ODDS_API_URL}) is correct and publicly accessible. ` +
          `Try opening this URL directly in your browser with '?week=0' appended. If it doesn't show JSON data, there's an issue with your Apps Script deployment or code (check Apps Script 'Executions' logs!).`
        );
      } finally {
        setLoadingOdds(false);
      }
    };

    // Initial load: Fetch the current week from the sheet via the API without a 'week' parameter
    if (currentOddsWeek === null && WEEKLY_ODDS_API_URL !== 'YOUR_WEEKLY_ODDS_APPS_SCRIPT_URL_HERE') {
      const fetchInitialWeek = async () => {
        setLoadingOdds(true);
        setErrorOdds(null);
        try {
          // If your Apps Script can take a 'year' parameter:
          // const apiUrl = `${WEEKLY_ODDS_API_URL}?year=${CURRENT_FANTASY_SEASON_YEAR}`;
          const response = await fetch(WEEKLY_ODDS_API_URL, { mode: 'cors' });
          if (!response.ok) {
            throw new Error(`Initial Weekly Odds API HTTP error! status: ${response.status}. Response: ${await response.text()}.`);
          }
          const data = await response.json();
          if (data.error) {
            throw new Error(data.error);
          }
          setWeeklyOddsData(prevData => ({
            ...prevData,
            [data.currentWeekInSheet - 1]: data.matches
          }));
          setCurrentOddsWeek(data.currentWeekInSheet - 1);
          setTotalOddsWeeks(data.totalWeeks);
        } catch (error) {
          console.error("Error fetching initial weekly odds data:", error);
          setErrorOdds(`Error fetching initial odds: ${error.message}`);
        } finally {
          setLoadingOdds(false);
        }
      };
      fetchInitialWeek();
    } else if (currentOddsWeek !== null) {
      fetchWeeklyOdds(currentOddsWeek);
    }

  }, [WEEKLY_ODDS_API_URL, currentOddsWeek]);


  // Effect hook to fetch Playoff Bracket data from Apps Script JSON API
  // This API is assumed to implicitly get data for the current league/season based on its own backend logic.
  // If it needs the currentLeagueId, you'd have to pass it as a URL parameter.
  useEffect(() => {
    const fetchBracketData = async () => {
      if (BRACKET_API_URL === 'YOUR_BRACKET_APPS_SCRIPT_URL_HERE') {
        setLoadingBracket(false);
        setErrorBracket("Please update BRACKET_API_URL in config.js with your actual Apps Script URL for the playoff bracket.");
        return;
      }

      setLoadingBracket(true);
      setErrorBracket(null);

      try {
        // If your Apps Script can take a 'year' parameter:
        // const apiUrl = `${BRACKET_API_URL}?year=${CURRENT_FANTASY_SEASON_YEAR}`;
        const response = await fetch(BRACKET_API_URL, { mode: 'cors' });

        if (!response.ok) {
          throw new Error(`Bracket API HTTP error! status: ${response.status}. Response: ${await response.text()}.`);
        }

        const data = await response.json();
        setBracketData(data);
      } catch (error) {
        console.error("Error fetching bracket data:", error);
        setErrorBracket(
          `Error: ${error.message}. ` +
          `Please ensure your Bracket Apps Script URL (${BRACKET_API_URL}) is correct and publicly accessible. ` +
          `Try opening this URL directly in your browser. If it doesn't show JSON data, there's an issue with your Apps Script deployment or code.`
        );
      } finally {
        setLoadingBracket(false);
      }
    };

    fetchBracketData();
  }, [BRACKET_API_URL]);

  // Effect hook for Live Matchups (fetch current week and then matchups)
  // This now explicitly uses currentLeagueId
  useEffect(() => {
    const fetchCurrentNFLWeek = async () => {
      try {
        const response = await fetch('https://api.sleeper.app/v1/state/nfl');
        if (!response.ok) throw new Error(`Sleeper NFL State API HTTP error! status: ${response.status}`);
        const data = await response.json();
        setCurrentNFLWeek(data.week); // Set the current NFL week
        return data.week;
      } catch (error) {
        console.error("Error fetching current NFL week:", error);
        setErrorLiveMatchups(`Failed to get current NFL week: ${error.message}`);
        return null;
      }
    };

    const fetchLiveMatchups = async (week) => {
      if (!week || !currentLeagueId || currentLeagueId.includes('YOUR_')) {
        setLoadingLiveMatchups(false);
        setErrorLiveMatchups("Sleeper League ID not set or current NFL week not determined.");
        return;
      }

      setLoadingLiveMatchups(true);
      setErrorLiveMatchups(null); // Clear previous errors

      try {
        const response = await fetch(`https://api.sleeper.app/v1/league/${currentLeagueId}/matchups/${week}`);
        if (!response.ok) throw new Error(`Sleeper Matchups API HTTP error! status: ${response.status}`);
        const matchupsData = await response.json();

        // Process matchups to group them by matchup_id
        const groupedMatchups = {};
        matchupsData.forEach(team => {
          if (!groupedMatchups[team.matchup_id]) {
            groupedMatchups[team.matchup_id] = [];
          }
          groupedMatchups[team.matchup_id].push(team);
        });

        // Convert the grouped matchups into an array of objects,
        // each containing team1 and team2, along with their scores.
        const formattedMatchups = Object.values(groupedMatchups).map(matchup => {
          // Assuming there are always exactly two teams per matchup_id for regular season
          const team1 = matchup[0];
          const team2 = matchup[1];

          // Find team names using leagueManagers data
          const manager1 = leagueManagers?.find(m => m.userId === team1.owner_id);
          const manager2 = leagueManagers?.find(m => m.userId === team2.owner_id);

          return {
            matchupId: team1.matchup_id,
            team1: {
              rosterId: team1.roster_id,
              ownerId: team1.owner_id,
              name: manager1 ? manager1.teamName : `Team ${team1.roster_id}`,
              score: team1.points,
              avatar: manager1 ? manager1.avatar : 'https://placehold.co/40x40/cccccc/333333?text=M'
            },
            team2: {
              rosterId: team2.roster_id,
              ownerId: team2.owner_id,
              name: manager2 ? manager2.teamName : `Team ${team2.roster_id}`,
              score: team2.points,
              avatar: manager2 ? manager2.avatar : 'https://placehold.co/40x40/cccccc/333333?text=M'
            }
          };
        });
        setLiveMatchups(formattedMatchups);
      } catch (error) {
        console.error("Error fetching live matchups:", error);
        setErrorLiveMatchups(`Failed to fetch live matchups: ${error.message}`);
      } finally {
        setLoadingLiveMatchups(false);
      }
    };

    // This effect runs when activeTab changes, or on initial load
    if (activeTab === TABS.LIVE_MATCHUPS) {
      // Clear any existing interval when switching tabs or re-initializing
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      const initiatePolling = async () => {
        const week = await fetchCurrentNFLWeek();
        if (week) {
          fetchLiveMatchups(week); // Initial fetch
          // Set up polling (e.g., every 15 minutes)
          intervalRef.current = setInterval(() => {
            fetchLiveMatchups(week);
          }, 900000); // 15 minutes (15 * 60 * 1000)
        }
      };

      initiatePolling();

      // Cleanup function: clear the interval when the component unmounts or activeTab changes
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      // If not on the Live Matchups tab, ensure the interval is cleared
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [activeTab, currentLeagueId, leagueManagers]); // Depend on currentLeagueId and leagueManagers


  // Helper function to render an individual player or pick item within a trade card
  const renderTradeAsset = (item, type) => {
    const signClass = type === 'received' ? 'text-[#0070c0]' : 'text-[#ff0000]'; // Blue for received, Red for sent
    const signText = type === 'received' ? '+' : '−';

    if (item.type === 'pick') {
      return (
        <div key={item.name} className="flex items-center justify-center gap-1 text-[9px] font-semibold text-gray-700">
          <span className={`${signClass} font-extrabold w-3 h-3 rounded-full flex items-center justify-center text-center mr-0.5 select-none flex-shrink-0`}>{signText}</span>
          <span className="text-orange-800">{item.name}</span> {/* Keep orange for picks */}
        </div>
      );
    } else { // Player
      const imageUrl = item.id ? `https://sleepercdn.com/content/nfl/players/${item.id}.jpg` : 'https://placehold.co/16x16/cccccc/333333?text=?';
      return (
        <div key={item.id} className="flex items-center justify-center gap-1 text-[9px] text-gray-800">
          <span className={`${signClass} font-extrabold w-3 h-3 rounded-full flex items-center justify-center text-center mr-0.5 select-none flex-shrink-0`}>{signText}</span>
          <img src={imageUrl} alt={item.name} className="w-4 h-4 rounded-full object-cover border border-gray-300 flex-shrink-0" onError={(e) => e.target.src = 'https://placehold.co/16x16/cccccc/333333?text=?' } />
          <span className="font-medium">{item.name}</span>
        </div>
      );
    }
  };


  return (
    // Main container with Tailwind CSS for styling
    <div className="w-full bg-gray-100 flex flex-col items-center p-4 font-inter text-gray-800">
      <script src="https://cdn.tailwindcss.com"></script> {/* Tailwind CSS CDN */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      <style>{`
        /* Hide scrollbar for the entire page */
        html, body {
          overflow-x: hidden; /* Prevent horizontal scroll */
          overflow-y: scroll; /* Allow vertical scroll */
          scrollbar-width: none;  /* For Firefox */
        }

        html::-webkit-scrollbar, body::-webkit-scrollbar {
          display: none; /* For Chrome, Safari, and Opera */
        }

        /* Hide scrollbar for the trade ticker container */
        #trade-ticker-container, #team-ticker-container {
          scrollbar-width: none; /* Firefox */
        }
        #trade-ticker-container::-webkit-scrollbar, #team-ticker-container::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }

        /* Ticker animation styles */
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker-scroll {
          animation: ticker-scroll 175s linear infinite; /* Adjust speed as needed */
          animation-play-state: running; /* Ensure animation is running */
        }
        .animate-ticker-scroll:hover {
          animation-play-state: paused; /* Pause on hover */
        }

        /* Styles for Weekly Odds section */
        .odds-matchup {
          background: white;
          margin: 15px 0;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1); /* Stronger shadow */
          transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out; /* Smooth transitions */
          overflow-x: auto;
          max-width: 500px;
          width: 100%;
        }
        .odds-matchup:hover {
          transform: translateY(-3px); /* Subtle lift effect */
          box-shadow: 0 6px 16px rgba(0,0,0,0.15); /* More prominent shadow on hover */
        }
        .odds-player {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          margin: 8px 0; /* Increased vertical margin */
          font-size: 17px; /* Slightly larger player name font */
          font-weight: 600; /* Bolder player names */
          color: #333; /* Darker player names */
          flex-wrap: nowrap;
        }
        .odds-player > div:first-child {
          flex-shrink: 1;
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          margin-right: 15px; /* More space before odds bubbles */
        }
        .odds-bubbles {
          display: flex;
          flex-direction: row;
          gap: 8px; /* Slightly more space between bubbles */
          flex-shrink: 0;
          min-width: 120px;
          justify-content: flex-end;
        }
        .odds-value, .odds-ou-box {
          background: #bfbfbf; /* Light Grey */
          padding: 8px 12px;
          border-radius: 25px;
          font-weight: bold;
          font-size: 15px;
          min-width: 55px;
          text-align: center;
          white-space: nowrap;
          border: 1px solid #a0a0a0; /* Slightly darker grey border */
          transition: background 0.2s ease-in-out, border-color 0.2s ease-in-out;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .odds-ou-box {
          flex-direction: column;
          line-height: 1.2;
        }

        .odds-ou-box small {
          font-size: 0.7em;
          font-weight: normal;
          color: #666; /* Default dark grey text */
        }
        .odds-win {
            background: linear-gradient(135deg, #0070c0 0%, #005f9f 100%) !important; /* Blue gradient */
            color: white !important;
            border-color: #005f9f !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        /* FIX: Ensure -110 text is visible on blue background */
        .odds-ou-box.odds-win small {
            color: white !important; /* Make the small text white when the box is winning */
        }
        .odds-lose {
            background: #ffffff !important; /* White for loser */
            color: #888 !important;
            border-color: #bfbfbf !important; /* Light grey border */
            opacity: 0.85;
        }
        .odds-score {
          margin-left: 10px;
          font-size: 14px;
          color: #444;
          font-weight: 700;
        }
        .odds-button {
          margin: 12px;
          padding: 12px 20px;
          background: linear-gradient(135deg, #0070c0 0%, #005f9f 100%); /* Primary blue gradient */
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          font-size: 16px;
          transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out, background 0.2s ease-in-out;
          box-shadow: 0 3px 6px rgba(0,0,0,0.2);
        }
        .odds-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          background: linear-gradient(135deg, #005f9f 0%, #004c80 100%); /* Darker blue on hover */
        }
        .odds-button:disabled {
          background: #cccccc;
          cursor: not-allowed;
          transform: translateY(0);
          box-shadow: none;
          opacity: 0.7;
        }

        .week-nav-button {
          background: #bfbfbf; /* Light Grey */
          color: #0070c0; /* Primary Blue */
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s, color 0.2s, transform 0.1s;
          border: 1px solid #a0a0a0; /* Slightly darker grey border */
          margin: 4px;
          min-width: 40px;
        }

        .week-nav-button:hover {
          background: #e0e0e0; /* Lighter grey on hover */
          color: #005f9f; /* Darker blue on hover */
          transform: translateY(-1px);
        }

        .week-nav-button.active {
          background: #0070c0; /* Primary Blue for active week */
          color: white;
          border-color: #005f9f;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          transform: translateY(-1px);
        }

        /* Adjustments for better wrapping on small screens for week buttons */
        .week-buttons-container {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 8px;
            margin-bottom: 1rem;
            max-width: 100%;
            overflow-x: auto;
            padding-bottom: 8px;
            scrollbar-width: none;
        }
        .week-buttons-container::-webkit-scrollbar {
            display: none;
        }

        /* Playoff Bracket Specific Styles */
        .bracket-container {
          display: flex;
          justify-content: center;
          gap: 20px;
          flex-wrap: nowrap;
          overflow-x: auto;
          max-width: 100%;
          padding: 10px;
          scrollbar-width: thin;
          scrollbar-color: #bfbfbf #f1f5f9; /* Light grey thumb and track */
        }
        .bracket-container::-webkit-scrollbar {
            height: 8px;
        }
        .bracket-container::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 10px;
        }
        .bracket-container::-webkit-scrollbar-thumb {
            background-color: #bfbfbf; /* Light Grey */
            border-radius: 10px;
            border: 2px solid #f1f5f9;
        }


        .bracket-round {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 180px;
          text-align: center;
          background: #fff;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          flex-shrink: 0;
        }

        .bracket-round-label {
          font-weight: bold;
          margin-bottom: 15px;
          font-size: 18px;
          color: #0070c0; /* Primary Blue */
          border-bottom: 2px solid #bfbfbf; /* Light Grey */
          padding-bottom: 8px;
          width: 100%;
        }

        .bracket-match {
          background: #ffffff; /* White background */
          padding: 12px;
          border: 1px solid #bfbfbf; /* Light grey border */
          margin: 10px 0;
          border-radius: 6px;
          box-shadow: 1px 1px 4px rgba(0,0,0,0.05);
          font-size: 15px;
          min-width: 160px;
          width: 100%;
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

        /* Live Matchups specific styles */
        .live-matchup-card {
            background: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            margin-bottom: 15px;
            padding: 15px;
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 450px; /* Adjust as needed */
        }

        .live-team-display {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 1.1em;
            font-weight: 600;
            border-bottom: 1px dashed #cccccc;
        }
        .live-team-display:last-of-type {
            border-bottom: none;
        }

        .live-team-info {
            display: flex;
            align-items: center;
            flex-grow: 1;
        }

        .live-team-info img {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            object-fit: cover;
            margin-right: 10px;
            border: 2px solid #0070c0;
        }

        .live-score {
            font-size: 1.3em;
            font-weight: bold;
            color: #0070c0;
        }

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
        <h1 className="text-4xl font-extrabold mb-2">The League of Extraordinary Douchebags</h1>
        {/* Display the current fantasy season year */}
        <p className="text-xl">
          {CURRENT_FANTASY_SEASON_YEAR} Season
        </p>
      </header>

      {/* New Team Ticker */}
      <section id="team-ticker-container">
        {leagueManagers && leagueManagers.length > 0 ? (
          <div className="inline-flex animate-ticker-scroll items-center h-full">
            {/* Duplicate content for continuous scrolling effect */}
            {[...leagueManagers, ...leagueManagers].map((manager, index) => (
              <div key={`${manager.userId}-${index}`} className="team-ticker-item">
                <img src={manager.avatar} alt={`${manager.teamName} avatar`} onError={(e) => e.target.src = 'https://placehold.co/30x30/cccccc/333333?text=M' } />
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
              // Display nothing while loading
              <></>
            ) : errorTrades ? (
              <p className="text-red-500 px-4 md:px-0 text-center">Error: {errorTrades}</p>
            ) : recentTrades && recentTrades.length > 0 ? (
              <div id="trade-ticker-container" className="overflow-x-auto whitespace-nowrap"> {/* Removed py-2 here */}
                <div className="inline-flex gap-4 animate-ticker-scroll items-center"> {/* Increased gap to gap-4 */}
                  {/* Duplicate content for continuous scrolling effect */}
                  {[...recentTrades, ...recentTrades].map((trade, index) => (
                    <div
                      key={`${trade.transaction_id}-${index}`}
                      className="border border-[#bfbfbf] rounded-md shadow-sm p-2.5 flex flex-col flex-shrink-0 min-w-[280px] min-h-[220px] overflow-y-hidden"
                    >
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
                                <img src={participant.managerAvatar} alt={`${participant.teamName} avatar`} onError={(e) => e.target.src = 'https://placehold.co/32x32/cccccc/333333?text=M' } />
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
              <p className="text-gray-600 px-4 md:px-0 text-center">No recent trades data available. Please ensure your Trade Ticker Apps Script URL is correct and data is being returned.</p>
            )}
          </section>
        )}

        {activeTab === TABS.LIVE_MATCHUPS && (
          <section className="w-full flex flex-col items-center">
            <h2 className="text-2xl font-bold text-[#0070c0] mb-4 border-b-2 border-[#bfbfbf] pb-2 w-full text-center">
              Live Matchups (Week {currentNFLWeek || '...'})
            </h2>
            {loadingLiveMatchups ? (
              <p className="text-gray-600">Loading live matchups and scores...</p>
            ) : errorLiveMatchups ? (
              <p className="text-red-500">Error: {errorLiveMatchups}</p>
            ) : liveMatchups && liveMatchups.length > 0 ? (
              <div className="flex flex-col items-center w-full">
                {liveMatchups.map((matchup) => (
                  <div key={matchup.matchupId} className="live-matchup-card">
                    <div className="live-team-display">
                      <div className="live-team-info">
                        <img src={matchup.team1.avatar} alt={`${matchup.team1.name} avatar`} onError={(e) => e.target.src = 'https://placehold.co/32x32/cccccc/333333?text=M' } />
                        <span>{matchup.team1.name}</span>
                      </div>
                      <span className="live-score">{matchup.team1.score}</span>
                    </div>
                    <div className="live-team-display">
                      <div className="live-team-info">
                        <img src={matchup.team2.avatar} alt={`${matchup.team2.name} avatar`} onError={(e) => e.target.src = 'https://placehold.co/32x32/cccccc/333333?text=M' } />
                        <span>{matchup.team2.name}</span>
                      </div>
                      <span className="live-score">{matchup.team2.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No live matchups found for the current week. The season might not be active, or there might be an issue fetching data.</p>
            )}
            <p className="mt-4 text-sm text-gray-500">Scores update automatically every 15 minutes.</p>
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
                            <div className={`odds-ou-box ${ouOClass}`}>O {match.ou}<br/><small>-110</small></div>
                          </div>
                        </div>
                        <div className="odds-player">
                          <div dangerouslySetInnerHTML={{ __html: `${displayP2Name} ${p2ScoreDisplay}` }}></div>
                          <div className="odds-bubbles">
                            <div className={`odds-value ${p2Class}`}>{match.p2Odds}</div>
                            <div className={`odds-ou-box ${ouUClass}`}>U {match.ou}<br/><small>-110</small></div>
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
              League History (Power Rankings / General Data) - {CURRENT_FANTASY_SEASON_YEAR}
            </h2>
            {/* TODO: To display historical data for ALL years, you would need to:
                1. Modify your GOOGLE_SHEET_API_URL Apps Script to accept a 'year' parameter,
                   and fetch data from the corresponding sheet for that year.
                2. In this App.js, loop through SLEEPER_LEAGUE_IDS to fetch data for each year,
                   storing it in a state like `allYearsGoogleSheetHistory = { 2021: data, 2022: data, ... }`.
                3. Add a dropdown or buttons here to allow users to select which year's history to view.
            */}
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
                  <p className="text-gray-600">No general historical data found in Google Sheet for {CURRENT_FANTASY_SEASON_YEAR}.</p>
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
              Historical Champions & Awards - {CURRENT_FANTASY_SEASON_YEAR}
            </h2>
            {/* TODO: Similar to League History, to display historical champions for ALL years:
                1. Modify your GOOGLE_SHEET_CHAMPIONS_API_URL Apps Script to accept a 'year' parameter.
                2. In this App.js, loop through SLEEPER_LEAGUE_IDS to fetch data for each year,
                   storing it in a state like `allYearsHistoricalChampions = { 2021: data, ... }`.
                3. Add a dropdown or buttons here to allow users to select which year's champions to view.
            */}
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
                    {champion.runnerUp && <p className="text-md text-gray-700}>🥈 Runner-Up: {getMappedTeamName(champion.runnerUp)}</p>}
                    {champion.mvp && <p className="text-md text-gray-700}>⭐ MVP: {getMappedTeamName(champion.mvp)}</p>}
                    {/* Add more fields for other awards as needed */}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No historical champions/awards data available for {CURRENT_FANTASY_SEASON_YEAR}. Consider populating a Google Sheet for this section.</p>
            )}
            <p className="mt-4 text-sm text-gray-500">
              If you want to fetch this data from a Google Sheet, you'll need to set up a dedicated Apps Script deployment for it,
              similar to how you did for the power rankings, and update `GOOGLE_SHEET_CHAMPIONS_API_URL`.
            </p>
          </section>
        )}
      </div>


      {/* Footer / Instructions */}
      <footer className="mt-8 text-center text-gray-600 text-sm pb-8">
        {/* Removed all original footer text */}
      </footer>
    </div>
  );
};

export default App;
