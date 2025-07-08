// App.js (TEMPORARY MODIFICATION FOR TESTING)
import React, { useState, useEffect, useCallback } from 'react';
import {
    HISTORICAL_MATCHUPS_API_URL,
    GOOGLE_SHEET_POWER_RANKINGS_API_URL,
    CURRENT_LEAGUE_ID,
} from './config';

// Import all your components, but we'll only render the tester for now
import PowerRankings from './lib/PowerRankings';
import LeagueHistory from './lib/LeagueHistory';
import RecordBook from './lib/RecordBook';
import DPRAnalysis from './lib/DPRAnalysis';
import LuckRatingAnalysis from './lib/LuckRatingAnalysis';
import TeamDetailPage from './lib/TeamDetailPage';
import Head2HeadGrid from './lib/Head2HeadGrid';
import FinancialTracker from './components/FinancialTracker';
import Dashboard from './components/Dashboard';
import MatchupHistory from './components/MatchupHistory';

// Import the custom hook from your SleeperDataContext (still imported but not used directly in App's render)
import { SleeperDataProvider } from './contexts/SleeperDataContext'; // We need the provider here
// Import the tester component
import SleeperMatchupTester from './components/SleeperMatchupTester'; // <--- NEW IMPORT

// Define the available tabs and their categories (keep for structural integrity, even if not rendered)
const NAV_CATEGORIES = {
    HOME: { label: 'Dashboard', tab: 'dashboard' },
    POWER_RANKINGS: { label: 'Power Rankings', tab: 'powerRankings' },
    LEAGUE_DATA: {
        label: 'League Data',
        subTabs: [
            { label: 'League History', tab: 'leagueHistory' },
            { label: 'Record Book', tab: 'recordBook' },
            { label: 'Head-to-Head', tab: 'headToHead' },
            { label: 'DPR Analysis', tab: 'dprAnalysis' },
            { label: 'Luck Rating', tab: 'luckRating' },
            { label: 'Matchup History', tab: 'matchupHistory' },
        ]
    },
    TEAMS: {
        label: 'Teams',
        subTabs: [],
    },
    FINANCIALS: { label: 'Financials', tab: 'financials' },
};

// Flattened list of all possible tabs (keep for structural integrity)
const TABS = {
    DASHBOARD: 'dashboard',
    POWER_RANKINGS: 'powerRankings',
    LEAGUE_HISTORY: 'leagueHistory',
    RECORD_BOOK: 'recordBook',
    HEAD_TO_HEAD: 'headToHead',
    DPR_ANALYSIS: 'dprAnalysis',
    LUCK_RATING: 'luckRating',
    TEAM_DETAIL: 'teamDetail',
    FINANCIALS: 'financials',
    MATCHUP_HISTORY: 'matchupHistory',
};


const App = () => {
    // Keep these states, but they won't be actively driving the main display for now
    const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
    const [historicalMatchups, setHistoricalMatchups] = useState([]);
    const [historicalChampions, setHistoricalChampions] = useState([]);
    const [loadingHistoricalData, setLoadingHistoricalData] = useState(true);
    const [historicalDataError, setHistoricalDataError] = useState(null);
    const [selectedTeam, setSelectedTeam] = useState(null);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openSubMenu, setOpenSubMenu] = useState(null);

    const getMappedTeamName = useCallback((teamName) => {
        if (typeof teamName !== 'string' || !teamName) return '';
        const trimmedName = teamName.trim();
        return trimmedName;
    }, []);

    // Original useEffect for Google Sheet data remains (it's not impacted by Sleeper Context)
    useEffect(() => {
        const fetchGoogleSheetData = async () => {
            setLoadingHistoricalData(true);
            setHistoricalDataError(null);

            let fetchedMatchupData = [];
            try {
                if (HISTORICAL_MATCHUPS_API_URL === 'YOUR_GOOGLE_SHEET_HISTORICAL_MATCHUPS_API_URL') {
                    throw new Error("HISTORICAL_MATCHUPS_API_URL not configured in config.js. Please update it or note that historical data won't load.");
                }
                const response = await fetch(HISTORICAL_MATCHUPS_API_URL, { mode: 'cors' });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} - Could not load historical matchup data.`);
                }

                const textResponse = await response.text();
                try {
                    const parsedData = JSON.parse(textResponse);
                    if (parsedData && typeof parsedData === 'object' && Array.isArray(parsedData.data)) {
                        fetchedMatchupData = parsedData.data;
                        setHistoricalMatchups(fetchedMatchupData);
                    } else {
                        console.error("API response for historical matchups is not in the expected format (object with 'data' array):", parsedData);
                        throw new Error("Historical matchup data is not in the expected array format. Raw response: " + textResponse);
                    }
                } catch (jsonError) {
                    console.error("Error parsing historical matchup data JSON. Raw response:", textResponse, jsonError);
                    setHistoricalDataError(`Failed to load historical matchup data: The API response was not valid JSON. Please ensure your Google Apps Script for HISTORICAL_MATCHUPS_API_URL is correctly deployed as a Web App and returns JSON (e.g., using ContentService.MimeType.JSON). Raw response snippet: ${textResponse.substring(0, 200)}...`);
                    setLoadingHistoricalData(false);
                    return;
                }

                const uniqueTeamsSet = new Set();
                if (Array.isArray(fetchedMatchupData)) {
                    fetchedMatchupData.forEach(match => {
                        const team1 = getMappedTeamName(match.team1);
                        const team2 = getMappedTeamName(match.team2);
                        if (team1) uniqueTeamsSet.add(team1);
                        if (team2) uniqueTeamsSet.add(team2);
                    });
                } else {
                    console.warn("fetchedMatchupData is not an array after processing, cannot populate team list.");
                }

                const uniqueTeams = Array.from(uniqueTeamsSet).sort();

                NAV_CATEGORIES.TEAMS.subTabs = uniqueTeams.map(team => ({
                    label: team,
                    tab: TABS.TEAM_DETAIL,
                    teamName: team,
                }));

            } catch (error) {
                console.error("Error fetching historical matchup data:", error);
                setHistoricalDataError(`Failed to load historical data: ${error.message}. Please check your HISTORICAL_MATCHUPS_API_URL in config.js and ensure your Google Apps Script is deployed correctly as a Web App (Execute as: Me, Who has access: Anyone).`);
                setLoadingHistoricalData(false);
                return;
            } finally {
                setLoadingHistoricalData(false);
            }

            setHistoricalChampions([
                { year: 2023, champion: "Mock Champion 2023" },
                { year: 2022, champion: "Mock Champion 2022" },
            ]);
        };

        fetchGoogleSheetData();
    }, [getMappedTeamName]);


    // TEMPORARY: Render only the tester component
    return (
        <SleeperDataProvider> {/* Important: Wrap the tester in the provider so it can fetch data */}
            <SleeperMatchupTester />
        </SleeperDataProvider>
    );
};

export default App;
