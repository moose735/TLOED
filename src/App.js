// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    // HISTORICAL_MATCHUPS_API_URL, // No longer needed for Google Sheets
    // GOOGLE_SHEET_POWER_RANKINGS_API_URL, // Keep if other GAS APIs are still in use elsewhere
    CURRENT_LEAGUE_ID,
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
import { SleeperDataProvider, useSleeperData } from './contexts/SleeperDataContext';

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
        subTabs: [], // This will be populated dynamically from Sleeper data
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
    // Consume data from SleeperDataContext
    const {
        state: {
            loading,
            error,
            historicalData, // Contains historicalMatchups, historicalChampions, etc.
            rostersBySeason, // Useful for dynamic team lists
        },
        getTeamName, // The Sleeper-aware version of getMappedTeamName
    } = useSleeperData();

    const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openSubMenu, setOpenSubMenu] = useState(null);

    // Effect to dynamically populate team sub-tabs when rostersBySeason is available
    useEffect(() => {
        if (rostersBySeason && Object.keys(rostersBySeason).length > 0) {
            // Get unique team names from all seasons
            const allTeamNames = new Set();
            Object.values(rostersBySeason).forEach(seasonRosters => {
                seasonRosters.forEach(roster => {
                    allTeamNames.add(roster.teamName); // Assuming your roster object has a teamName property
                });
            });
            const uniqueTeams = Array.from(allTeamNames).sort();

            NAV_CATEGORIES.TEAMS.subTabs = uniqueTeams.map(team => ({
                label: team,
                tab: TABS.TEAM_DETAIL,
                teamName: team,
            }));
            // Force re-render if the active tab is 'teams' and subtabs change
            // This might not be strictly necessary if state updates naturally trigger re-renders,
            // but it's a safeguard if the NAV_CATEGORIES object mutation doesn't
            // immediately cause the component to re-render the menu.
            setActiveTab(prevTab => prevTab);
        }
    }, [rostersBySeason]);


    // Placeholder functions for UI interactions
    const handleTabClick = (tab) => {
        setActiveTab(tab);
        setSelectedTeam(null);
        setIsMobileMenuOpen(false);
        setOpenSubMenu(null);
    };

    const handleSubTabClick = (tab, teamName = null) => {
        setActiveTab(tab);
        setSelectedTeam(teamName);
        setIsMobileMenuOpen(false);
        setOpenSubMenu(null);
    };

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const toggleSubMenu = (category) => {
        setOpenSubMenu(openSubMenu === category ? null : category);
    };

    const renderContent = () => {
        // Use the loading and error states from SleeperDataContext
        if (loading) {
            return <div>Loading Sleeper fantasy data...</div>;
        }
        if (error) {
            return <div style={{ color: 'red' }}>Error: {error}</div>;
        }

        switch (activeTab) {
            case TABS.DASHBOARD:
                return <Dashboard />;
            case TABS.POWER_RANKINGS:
                return <PowerRankings />;
            case TABS.LEAGUE_HISTORY:
                // Pass historicalData.matchups and historicalData.champions directly
                return <LeagueHistory historicalMatchups={historicalData.matchups} historicalChampions={historicalData.champions} />;
            case TABS.RECORD_BOOK:
                return <RecordBook historicalMatchups={historicalData.matchups} />;
            case TABS.HEAD_TO_HEAD:
                return <Head2HeadGrid historicalMatchups={historicalData.matchups} />;
            case TABS.DPR_ANALYSIS:
                return <DPRAnalysis historicalMatchups={historicalData.matchups} />;
            case TABS.LUCK_RATING:
                return <LuckRatingAnalysis historicalMatchups={historicalData.matchups} />;
            case TABS.TEAM_DETAIL:
                // TeamDetailPage will now internally use getTeamName and historicalData
                return <TeamDetailPage teamName={selectedTeam} />;
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
                                {/* Map dynamically populated subTabs here */}
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
