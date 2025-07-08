// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    HISTORICAL_MATCHUPS_API_URL,
    GOOGLE_SHEET_POWER_RANKINGS_API_URL, // Still here, assuming you might have other GAS APIs
    CURRENT_LEAGUE_ID, // This is for Sleeper and will be used by SleeperDataProvider's internals
} from './config';

// Import all your components
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

// Import the custom hook from your SleeperDataContext
import { SleeperDataProvider, useSleeperData } from './contexts/SleeperDataContext'; // Now we'll use both

// Define the available tabs and their categories
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
        subTabs: [], // This will be populated dynamically from Sleeper data later
    },
    FINANCIALS: { label: 'Financials', tab: 'financials' },
};

// Flattened list of all possible tabs
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


const AppContent = () => {
    // These states and useEffect are *still* fetching from Google Sheets.
    // We will progressively replace these within individual components.
    const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
    const [historicalMatchups, setHistoricalMatchups] = useState([]);
    const [historicalChampions, setHistoricalChampions] = useState([]);
    const [loadingHistoricalData, setLoadingHistoricalData] = useState(true);
    const [historicalDataError, setHistoricalDataError] = useState(null);
    const [selectedTeam, setSelectedTeam] = useState(null);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openSubMenu, setOpenSubMenu] = useState(null);

    // This getMappedTeamName is currently used by the Google Sheet fetching logic.
    // It will eventually be replaced by the getTeamName from SleeperDataContext.
    const getMappedTeamName = useCallback((teamName) => {
        if (typeof teamName !== 'string' || !teamName) return '';
        const trimmedName = teamName.trim();
        return trimmedName;
    }, []);

    // Original useEffect for Google Sheet data remains for now.
    // We will remove this *after* all components that depend on it are migrated.
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

                // This section for populating NAV_CATEGORIES.TEAMS.subTabs will be replaced
                // by using `historicalData.rostersBySeason` from the Sleeper Context.
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


    // Placeholder functions for UI interactions (you likely have these already)
    const handleTabClick = (tab) => {
        setActiveTab(tab);
        setSelectedTeam(null); // Clear selected team when switching main tabs
        setIsMobileMenuOpen(false); // Close mobile menu on tab click
        setOpenSubMenu(null); // Close any open sub-menus
    };

    const handleSubTabClick = (tab, teamName = null) => {
        setActiveTab(tab);
        setSelectedTeam(teamName);
        setIsMobileMenuOpen(false); // Close mobile menu on sub-tab click
        setOpenSubMenu(null); // Close any open sub-menus
    };

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const toggleSubMenu = (category) => {
        setOpenSubMenu(openSubMenu === category ? null : category);
    };

    const renderContent = () => {
        if (loadingHistoricalData) {
            return <div>Loading initial Google Sheet data...</div>;
        }
        if (historicalDataError) {
            return <div style={{ color: 'red' }}>Error: {historicalDataError}</div>;
        }

        switch (activeTab) {
            case TABS.DASHBOARD:
                return <Dashboard />; // This will eventually use Sleeper Context
            case TABS.POWER_RANKINGS:
                return <PowerRankings />; // This will need Sleeper Context for team names, etc.
            case TABS.LEAGUE_HISTORY:
                return <LeagueHistory historicalMatchups={historicalMatchups} historicalChampions={historicalChampions} getMappedTeamName={getMappedTeamName} />;
            case TABS.RECORD_BOOK:
                return <RecordBook historicalMatchups={historicalMatchups} getMappedTeamName={getMappedTeamName} />;
            case TABS.HEAD_TO_HEAD:
                return <Head2HeadGrid historicalMatchups={historicalMatchups} getMappedTeamName={getMappedTeamName} />;
            case TABS.DPR_ANALYSIS:
                return <DPRAnalysis historicalMatchups={historicalMatchups} getMappedTeamName={getMappedTeamName} />;
            case TABS.LUCK_RATING:
                return <LuckRatingAnalysis historicalMatchups={historicalMatchups} getMappedTeamName={getMappedTeamName} />;
            case TABS.TEAM_DETAIL:
                return <TeamDetailPage teamName={selectedTeam} historicalMatchups={historicalMatchups} getMappedTeamName={getMappedTeamName} />;
            case TABS.FINANCIALS:
                return <FinancialTracker />;
            case TABS.MATCHUP_HISTORY:
                return <MatchupHistory />;
            default:
                return <Dashboard />;
        }
    };

    return (
        <div className="app-container">
            {/* Minimal Header/Nav - you'll likely have a more styled one */}
            <nav className="main-nav">
                <button className="mobile-menu-toggle" onClick={toggleMobileMenu}>
                    ☰
                </button>
                <ul className={`nav-list ${isMobileMenuOpen ? 'open' : ''}`}>
                    <li onClick={() => handleTabClick(NAV_CATEGORIES.HOME.tab)}>
                        {NAV_CATEGORIES.HOME.label}
                    </li>
                    <li onClick={() => handleTabClick(NAV_CATEGORIES.POWER_RANKINGS.tab)}>
                        {NAV_CATEGORIES.POWER_RANKINGS.label}
                    </li>
                    <li className="has-submenu" onClick={() => toggleSubMenu('leagueData')}>
                        {NAV_CATEGORIES.LEAGUE_DATA.label} ▼
                        {openSubMenu === 'leagueData' && (
                            <ul className="submenu">
                                {NAV_CATEGORIES.LEAGUE_DATA.subTabs.map(subTab => (
                                    <li key={subTab.tab} onClick={(e) => { e.stopPropagation(); handleSubTabClick(subTab.tab); }}>
                                        {subTab.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                    <li className="has-submenu" onClick={() => toggleSubMenu('teams')}>
                        {NAV_CATEGORIES.TEAMS.label} ▼
                        {openSubMenu === 'teams' && (
                            <ul className="submenu">
                                {NAV_CATEGORIES.TEAMS.subTabs.map(subTab => (
                                    <li key={subTab.label} onClick={(e) => { e.stopPropagation(); handleSubTabClick(subTab.tab, subTab.teamName); }}>
                                        {subTab.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                    <li onClick={() => handleTabClick(NAV_CATEGORIES.FINANCIALS.tab)}>
                        {NAV_CATEGORIES.FINANCIALS.label}
                    </li>
                </ul>
            </nav>

            <div className="content">
                {renderContent()}
            </div>
        </div>
    );
};

// This is the outer App component that provides the Sleeper Context
const App = () => {
    return (
        <SleeperDataProvider>
            <AppContent />
        </SleeperDataProvider>
    );
};

export default App;
