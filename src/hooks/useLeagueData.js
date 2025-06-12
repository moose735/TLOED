import { useState, useEffect, useCallback } from 'react';

// Define your API URLs here or pass them as arguments to the hook
const SLEEPER_API_URL = 'YOUR_SLEEPER_API_URL';
const TRADES_API_URL = 'YOUR_TRADES_APPS_SCRIPT_URL';
const ODDS_API_URL = 'YOUR_ODDS_APPS_SCRIPT_URL';
const BRACKET_API_URL = 'YOUR_BRACKET_APPS_SCRIPT_URL';
const GOOGLE_SHEET_HISTORY_API_URL = 'YOUR_GOOGLE_SHEET_HISTORY_APPS_SCRIPT_URL';
const GOOGLE_SHEET_CHAMPIONS_API_URL = 'YOUR_GOOGLE_SHEET_CHAMPIONS_APPS_SCRIPT_URL';


const useLeagueData = () => {
  // Sleeper League Data
  const [sleeperLeagueData, setSleeperLeagueData] = useState(null);
  const [leagueManagers, setLeagueManagers] = useState([]);
  const [loadingSleeper, setLoadingSleeper] = useState(true);
  const [errorSleeper, setErrorSleeper] = useState(null);

  // Recent Trades
  const [recentTrades, setRecentTrades] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [errorTrades, setErrorTrades] = useState(null);

  // Weekly Odds
  const [weeklyOddsData, setWeeklyOddsData] = useState({});
  const [currentOddsWeek, setCurrentOddsWeek] = useState(null);
  const [totalOddsWeeks, setTotalOddsWeeks] = useState(0);
  const [loadingOdds, setLoadingOdds] = useState(true);
  const [errorOdds, setErrorOdds] = useState(null);

  // Playoff Bracket
  const [bracketData, setBracketData] = useState(null);
  const [loadingBracket, setLoadingBracket] = useState(true);
  const [errorBracket, setErrorBracket] = useState(null);

  // Google Sheet History
  const [googleSheetHistory, setGoogleSheetHistory] = useState(null);
  const [loadingGoogleSheet, setLoadingGoogleSheet] = useState(true);
  const [errorGoogleSheet, setErrorGoogleSheet] = useState(null);

  // Historical Champions
  const [historicalChampions, setHistoricalChampions] = useState([]);
  const [loadingChampions, setLoadingChampions] = useState(true);
  const [errorChampions, setErrorChampions] = useState(null);

  // Fetch Sleeper League Data
  useEffect(() => {
    const fetchSleeperData = async () => {
      setLoadingSleeper(true);
      try {
        const response = await fetch(SLEEPER_API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSleeperLeagueData(data.leagueData);
        setLeagueManagers(data.managers);
      } catch (error) {
        setErrorSleeper(error.message);
      } finally {
        setLoadingSleeper(false);
      }
    };

    fetchSleeperData();
  }, []); // Empty dependency array means this runs once on mount

  // Fetch Recent Trades
  useEffect(() => {
    const fetchTrades = async () => {
      setLoadingTrades(true);
      try {
        const response = await fetch(TRADES_API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setRecentTrades(data);
      } catch (error) {
        setErrorTrades(error.message);
      } finally {
        setLoadingTrades(false);
      }
    };
    fetchTrades();
  }, []);

  // Fetch Weekly Odds
  useEffect(() => {
    const fetchOdds = async () => {
      setLoadingOdds(true);
      try {
        const response = await fetch(ODDS_API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setWeeklyOddsData(data);
        const weeks = Object.keys(data).length;
        setTotalOddsWeeks(weeks);
        if (weeks > 0) {
          setCurrentOddsWeek(weeks - 1); // Set to the last week by default
        }
      } catch (error) {
        setErrorOdds(error.message);
      } finally {
        setLoadingOdds(false);
      }
    };
    fetchOdds();
  }, []);

  // Fetch Playoff Bracket
  useEffect(() => {
    const fetchBracket = async () => {
      setLoadingBracket(true);
      try {
        const response = await fetch(BRACKET_API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setBracketData(data);
      } catch (error) {
        setErrorBracket(error.message);
      } finally {
        setLoadingBracket(false);
      }
    };
    fetchBracket();
  }, []);

  // Fetch Google Sheet History
  useEffect(() => {
    const fetchGoogleSheetHistory = async () => {
      setLoadingGoogleSheet(true);
      try {
        const response = await fetch(GOOGLE_SHEET_HISTORY_API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setGoogleSheetHistory(data);
      } catch (error) {
        setErrorGoogleSheet(error.message);
      } finally {
        setLoadingGoogleSheet(false);
      }
    };
    fetchGoogleSheetHistory();
  }, []);

  // Fetch Historical Champions
  useEffect(() => {
    const fetchChampions = async () => {
      setLoadingChampions(true);
      try {
        const response = await fetch(GOOGLE_SHEET_CHAMPIONS_API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setHistoricalChampions(data);
      } catch (error) {
        setErrorChampions(error.message);
      } finally {
        setLoadingChampions(false);
      }
    };
    fetchChampions();
  }, []);


  return {
    sleeperLeagueData,
    leagueManagers,
    loadingSleeper,
    errorSleeper,
    recentTrades,
    loadingTrades,
    errorTrades,
    weeklyOddsData,
    currentOddsWeek,
    totalOddsWeeks,
    setCurrentOddsWeek,
    loadingOdds,
    errorOdds,
    bracketData,
    loadingBracket,
    errorBracket,
    googleSheetHistory,
    loadingGoogleSheet,
    errorGoogleSheet,
    historicalChampions,
    loadingChampions,
    errorChampions,
  };
};

export default useLeagueData;
