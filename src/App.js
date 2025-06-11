import React, { useState, useEffect } from 'react';

// Main App component
const App = () => {
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

  // New states for Weekly Odds
  const [weeklyOddsData, setWeeklyOddsData] = useState({}); // Cache for fetched weeks
  const [currentOddsWeek, setCurrentOddsWeek] = useState(null); // 0-indexed current week for odds
  const [totalOddsWeeks, setTotalOddsWeeks] = useState(14); // Default, will be updated by API
  const [loadingOdds, setLoadingOdds] = useState(true);
  const [errorOdds, setErrorOdds] = useState(null);

  // New states for Playoff Bracket
  const [bracketData, setBracketData] = useState(null);
  const [loadingBracket, setLoadingBracket] = useState(true);
  const [errorBracket, setErrorBracket] = useState(null);

  // State to store a map of nickname/last name (from Google Sheets) to actual Sleeper team names
  const [playerNameToTeamNameMap, setPlayerNameToTeamNameMap] = useState({});


  // States for loading indicators
  const [loadingSleeper, setLoadingSleeper] = useState(true);
  const [loadingGoogleSheet, setLoadingGoogleSheet] = useState(true);
  const [loadingManagers, setLoadingManagers] = useState(true);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [loadingChampions, setLoadingChampions] = useState(true);

  // States for error messages
  const [errorSleeper, setErrorSleeper] = useState(null);
  const [errorGoogleSheet, setErrorGoogleSheet] = useState(null);
  const [errorManagers, setErrorManagers] = useState(null);
  const [errorTrades, setErrorTrades] = useState(null);
  const [errorChampions, setErrorChampions] = useState(null);

  // --- Configuration ---
  // Replace with your actual Sleeper League ID
  const SLEEPER_LEAGUE_ID = '1048371694643060736';
  // Replace with the deployed URL of your Google Apps Script Web App for general history/power rankings
  const GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxU2TLDiOxoym2VETq3qrfwUCjE9O0c_gbwHhfAgnrk2faxcBt30EW0jJIq6WXwtYhPdw/exec';
  // New: Replace with the deployed URL of your Google Apps Script JSON API for the Trade Ticker
  const TRADE_TICKER_API_URL = 'https://script.google.com/macros/s/AKfycbxFZStkx9SvST6inAbnzfljrRr39H8CsprmEuRh9VUkjRLiAx_-5deo91r7lPegyDkC8A/exec';
  // If you create a separate Apps Script for champions, use a new URL here
  const GOOGLE_SHEET_CHAMPIONS_API_URL = 'YOUR_GOOGLE_SHEET_CHAMPIONS_API_URL'; // Placeholder for specific champions data
  // NEW: Replace with the deployed URL of your Google Apps Script JSON API for Weekly Odds
  const WEEKLY_ODDS_API_URL = 'https://script.google.com/macros/s/AKfycbxIrqBFK5peO8mSQ1V5mqUxVtfY2kf3-gDP2_Gw9Qxi5LllYbwgM_GcnEvAeGsGpwk4_w/exec';
  // NEW: Replace with the deployed URL of your Google Apps Script JSON API for Playoff Bracket
  const BRACKET_API_URL = 'https://script.google.com/macros/s/AKfycbyARvrGYRVnIsHg28e689hOpKHLt2uQ85uDnFDpB8GfnUvknxQRSitrszGPlf4xWFBrA/exec';

  // Mapping of nicknames/last names (as they might appear in Google Sheets)
  // to their corresponding Sleeper display_name/username.
  // This is used to find the correct manager in the Sleeper data.
  const NICKNAME_TO_SLEEPER_USER = {
    "irwin": "irwin35",
    "irwin35": "irwin35",
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


  // Helper function to replace a given name (from Google Sheet) with its mapped Sleeper team name.
  // Uses the `playerNameToTeamNameMap` populated from Sleeper data.
  const getMappedTeamName = (originalName) => {
    if (!originalName || typeof originalName !== 'string') return originalName;
    const normalizedName = originalName.trim().toLowerCase();
    return playerNameToTeamNameMap[normalizedName] || originalName;
  };


  // Effect hook to fetch general league data from Sleeper API
  useEffect(() => {
    const fetchSleeperData = async () => {
      if (SLEEPER_LEAGUE_ID === 'YOUR_SLEEPER_LEAGUE_ID') {
        setLoadingSleeper(false);
        setErrorSleeper("Please update SLEEPER_LEAGUE_ID in App.js with your actual league ID.");
        return;
      }

      try {
        const sleeperApiUrl = `https://api.sleeper.app/v1/league/${SLEEPER_LEAGUE_ID}`;
        const response = await fetch(sleeperApiUrl);

        if (!response.ok) {
          throw new Error(`Sleeper API HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setSleeperLeagueData(data);
      } catch (error) {
        console.error("Error fetching Sleeper data:", error);
        setErrorSleeper(error.message);
      } finally {
        setLoadingSleeper(false);
      }
    };

    fetchSleeperData();
  }, [SLEEPER_LEAGUE_ID]);


  // Helper function to format manager display name by replacing last name with team name
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
  useEffect(() => {
    const fetchManagersData = async () => {
      if (SLEEPER_LEAGUE_ID === 'YOUR_SLEEPER_LEAGUE_ID') {
        setLoadingManagers(false);
        return;
      }

      try {
        const usersApiUrl = `https://api.sleeper.app/v1/league/${SLEEPER_LEAGUE_ID}/users`;
        const rostersApiUrl = `https://api.sleeper.app/v1/league/${SLEEPER_LEAGUE_ID}/rosters`;

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
            formattedDisplayNameForManagerLine: getFormattedManagerName(displayName, teamName),
            wins: userRoster ? userRoster.settings.wins : 0,
            losses: userRoster ? userRoster.settings.losses : 0,
            avatar: user.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : 'https://placehold.co/40x40/cccccc/333333?text=M'
          };
        });
        setLeagueManagers(combinedManagers);

        // Build the playerNameToTeamNameMap
        const newPlayerNameToTeamNameMap = {};
        Object.entries(NICKNAME_TO_SLEEPER_USER).forEach(([nicknameKey, sleeperUserIdentifier]) => {
          const matchingManager = combinedManagers.find(manager =>
            manager.displayName.toLowerCase() === sleeperUserIdentifier.toLowerCase()
          );
          if (matchingManager) {
            newPlayerNameToTeamNameMap[nicknameKey.toLowerCase()] = matchingManager.teamName; // Store in lowercase for consistent lookup
            console.log(`Mapped "${nicknameKey}" to "${matchingManager.teamName}"`); // For debugging
          } else {
            console.log(`No Sleeper manager found for "${sleeperUserIdentifier}" (from nickname "${nicknameKey}")`); // For debugging
          }
        });
        setPlayerNameToTeamNameMap(newPlayerNameToTeamNameMap);


      } catch (error) {
        console.error("Error fetching managers data:", error);
        setErrorManagers(error.message);
      } finally {
        setLoadingManagers(false);
      }
    };

    fetchManagersData();
  }, [SLEEPER_LEAGUE_ID]);


  // Effect hook to fetch recent trades data from the new Apps Script JSON API
  useEffect(() => {
    const fetchTradesData = async () => {
      if (TRADE_TICKER_API_URL === 'YOUR_TRADE_TICKER_APPS_SCRIPT_URL') {
        setLoadingTrades(false);
        setErrorTrades("Please update TRADE_TICKER_API_URL in App.js with your actual Apps Script URL for trades.");
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
  useEffect(() => {
    const fetchGoogleSheetData = async () => {
      if (GOOGLE_SHEET_API_URL === 'YOUR_GOOGLE_SHEET_APPS_SCRIPT_URL') {
        setLoadingGoogleSheet(false);
        setErrorGoogleSheet("Please update GOOGLE_SHEET_API_URL in App.js with your actual Apps Script URL for general history.");
        return;
      }

      try {
        const response = await fetch(GOOGLE_SHEET_API_URL, { mode: 'cors' });

        if (!response.ok) {
          throw new Error(`Google Sheet API HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setGoogleSheetHistory(data);
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


  // Effect hook to fetch historical champions data (if using a separate Apps Script or static data)
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
  useEffect(() => {
    const fetchWeeklyOdds = async (weekNum) => {
      if (WEEKLY_ODDS_API_URL === 'YOUR_WEEKLY_ODDS_APPS_SCRIPT_URL_HERE') {
        setLoadingOdds(false);
        setErrorOdds("Please update WEEKLY_ODDS_API_URL in App.js with your actual Apps Script URL for weekly odds.");
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
        // Append week parameter to the URL
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
          `Try opening this URL directly in your browser with '?week=0' appended. If it doesn't show JSON data, there's an issue with your Apps Script deployment or code.`
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


  // NEW: Effect hook to fetch Playoff Bracket data from Apps Script JSON API
  useEffect(() => {
    const fetchBracketData = async () => {
      if (BRACKET_API_URL === 'YOUR_BRACKET_APPS_SCRIPT_URL_HERE') {
        setLoadingBracket(false);
        setErrorBracket("Please update BRACKET_API_URL in App.js with your actual Apps Script URL for the playoff bracket.");
        return;
      }

      setLoadingBracket(true);
      setErrorBracket(null);

      try {
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


  // Helper function to render an individual player or pick item within a trade card
  const renderTradeAsset = (item, type) => {
    const signClass = type === 'received' ? 'text-green-500' : 'text-red-500';
    const signText = type === 'received' ? '+' : '−';

    if (item.type === 'pick') {
      return (
        <div key={item.name} className="flex items-center justify-center gap-1 text-[9px] font-semibold text-gray-700">
          <span className={`${signClass} font-extrabold w-3 h-3 rounded-full flex items-center justify-center text-center mr-0.5 select-none flex-shrink-0`}>{signText}</span>
          <span className="text-orange-800">{item.name}</span>
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
        #trade-ticker-container {
          scrollbar-width: none; /* Firefox */
        }
        #trade-ticker-container::-webkit-scrollbar {
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
          background: #e0e0e0;
          padding: 8px 12px; /* Increased padding for better touch targets */
          border-radius: 25px; /* More rounded */
          font-weight: bold;
          font-size: 15px; /* Slightly larger odds font */
          min-width: 55px; /* Wider bubbles */
          text-align: center;
          white-space: nowrap;
          border: 1px solid #ccc; /* Subtle border */
          transition: background 0.2s ease-in-out, border-color 0.2s ease-in-out;

          /* Flexbox for perfect vertical and horizontal centering */
          display: flex;
          justify-content: center;
          align-items: center;
        }
        /* Specific centering for .odds-ou-box as it has two lines */
        .odds-ou-box {
          flex-direction: column;
          line-height: 1.2; /* Retain for multi-line OU box for spacing */
        }

        .odds-ou-box small {
          font-size: 0.7em; /* Keep small text readable */
          font-weight: normal;
          color: #666;
        }
        .odds-score {
          margin-left: 10px; /* More space after name */
          font-size: 14px; /* Slightly larger score font */
          color: #444; /* Darker score color */
          font-weight: 700; /* Bolder score */
        }
        .odds-win {
            background: linear-gradient(135deg, #4CAF50 0%, #689F38 100%) !important;
            color: white !important;
            border-color: #388E3C !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2); /* Subtle shadow for wins */
        }
        .odds-lose {
            background: #F5F5F5 !important;
            color: #888 !important;
            border-color: #E0E0E0 !important;
            opacity: 0.85; /* Slightly less opaque */
        }
        .odds-button {
          margin: 12px; /* More margin around buttons */
          padding: 12px 20px; /* Larger buttons */
          background: linear-gradient(135deg, #3f51b5 0%, #303F9F 100%); /* Gradient background */
          color: white;
          border: none;
          border-radius: 8px; /* More rounded buttons */
          cursor: pointer;
          font-weight: bold;
          font-size: 16px;
          transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out, background 0.2s ease-in-out;
          box-shadow: 0 3px 6px rgba(0,0,0,0.2);
        }
        .odds-button:hover {
          transform: translateY(-2px); /* Lift effect on hover */
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%); /* Green hover */
        }
        .odds-button:disabled {
          background: #cccccc;
          cursor: not-allowed;
          transform: translateY(0);
          box-shadow: none;
          opacity: 0.7;
        }

        .week-nav-button {
          background: #e0e0e0;
          color: #3f51b5;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s, color 0.2s, transform 0.1s;
          border: 1px solid #ccc;
          margin: 4px;
          min-width: 40px; /* Ensure buttons have a minimum width */
        }

        .week-nav-button:hover {
          background: #cddc39; /* Light green on hover */
          color: #333;
          transform: translateY(-1px);
        }

        .week-nav-button.active {
          background: #3f51b5; /* Blue for active week */
          color: white;
          border-color: #303F9F;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          transform: translateY(-1px);
        }

        /* Adjustments for better wrapping on small screens for week buttons */
        .week-buttons-container {
            display: flex;
            flex-wrap: wrap; /* Allow buttons to wrap to the next line */
            justify-content: center;
            gap: 8px; /* Space between buttons */
            margin-bottom: 1rem;
            max-width: 100%; /* Ensure it doesn't overflow horizontally */
            overflow-x: auto; /* Allow horizontal scrolling if buttons don't fit */
            padding-bottom: 8px; /* Add some padding if scrollbar appears */
            scrollbar-width: none; /* Hide scrollbar for firefox */
        }
        .week-buttons-container::-webkit-scrollbar {
            display: none; /* Hide scrollbar for webkit browsers */
        }

        /* Playoff Bracket Specific Styles */
        .bracket-container {
          display: flex;
          justify-content: center;
          gap: 20px; /* Space between rounds */
          flex-wrap: nowrap; /* Prevent rounds from wrapping */
          overflow-x: auto; /* Allow horizontal scrolling if necessary */
          max-width: 100%;
          padding: 10px; /* Added padding for better mobile view */
          scrollbar-width: thin; /* Firefox */
          scrollbar-color: #cbd5e0 #f1f5f9; /* Thumb and Track for Firefox */
        }
        .bracket-container::-webkit-scrollbar {
            height: 8px; /* Height of the scrollbar */
        }
        .bracket-container::-webkit-scrollbar-track {
            background: #f1f5f9; /* Color of the track */
            border-radius: 10px;
        }
        .bracket-container::-webkit-scrollbar-thumb {
            background-color: #cbd5e0; /* Color of the scroll thumb */
            border-radius: 10px;
            border: 2px solid #f1f5f9; /* Padding around thumb */
        }


        .bracket-round {
          display: flex;
          flex-direction: col
