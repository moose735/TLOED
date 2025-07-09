// App.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    // GOOGLE_SHEET_POWER_RANKINGS_API_URL, // Keep if other GAS APIs are still in use elsewhere
    // CURRENT_LEAGUE_ID, // This is for Sleeper and will be used by SleeperDataProvider's internals, no direct use here
} from './config';

// Import all your components
import PowerRankings from './lib/PowerRankings';
import LeagueHistory from './lib/LeagueHistory';
import RecordBook from './components/RecordBook'; // Updated path to components
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
// NOTE: NAV_CATEGORIES should ideally be defined outside the component
// or memoized if it changes based on props, but for now, we'll modify it directly.
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
    // Consume data from SleeperDataContext
    const {
        loading,
        error,
        processedSeasonalRecords, // Now available from context
        allTimeRecords,           // Now available from context
        getTeamName,              // Still available from context
        // historicalData, // REMOVED: No longer directly provided by context
        // rostersBySeason, // REMOVED: No longer directly provided by context
        // usersData // REMOVED: No longer directly provided by context
    } = useSleeperData();

    const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openSubMenu, setOpenSubMenu] = useState(null);

    // Effect to dynamically populate team sub-tabs when processed data is available
    useEffect(() => {
        // We now rely on processedSeasonalRecords which contains teamName and ownerId
        // and getTeamName from context which uses the internal maps.
        if (processedSeasonalRecords && Object.keys(processedSeasonalRecords).length > 0 && getTeamName) {
            const allTeamNames = new Set();
            Object.values(processedSeasonalRecords).forEach(seasonTeams => {
                if (Array.isArray(seasonTeams)) {
                    seasonTeams.forEach(teamStats => {
                        // Use the teamName directly from processedSeasonalRecords
                        // or fall back to getTeamName if needed (though teamName should be present)
                        const teamDisplayName = teamStats.teamName || getTeamName(teamStats.rosterId, teamStats.year);
                        if (teamDisplayName && teamDisplayName !== 'Loading Team...' && !teamDisplayName.startsWith('Team ')) {
                            allTeamNames.add(teamDisplayName);
                        }
                    });
                }
            });

            const uniqueTeams = Array.from(allTeamNames).sort();

            NAV_CATEGORIES.TEAMS.subTabs = uniqueTeams.map(team => ({
                label: team,
                tab: TABS.TEAM_DETAIL,
                teamName: team, // Pass teamName for the TeamDetailPage
            }));
        }
    }, [processedSeasonalRecords, getTeamName]); // Dependencies for this effect: processed data and getTeamName

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
        if (loading) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
                    <div className="text-center p-6 bg-white rounded-lg shadow-md">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                        <p className="text-lg font-semibold text-gray-700">Loading Sleeper fantasy data...</p>
                        <p className="text-sm text-gray-500 mt-2">This might take a moment as we fetch historical league information.</p>
                    </div>
                </div>
            );
        }
        if (error) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
                    <div className="text-center p-6 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-md">
                        <p className="font-bold text-xl mb-2">Error Loading Data</p>
                        <p className="text-base">Failed to load historical data: {error.message}</p> {/* Use error.message */}
                        <p className="text-sm mt-2">Please check your internet connection or the Sleeper API configuration in `config.js` and `sleeperApi.js`.</p>
                    </div>
                </div>
            );
        }

        // Render components based on activeTab, passing necessary data from context
        switch (activeTab) {
            case TABS.DASHBOARD:
                return <Dashboard />;
            case TABS.POWER_RANKINGS:
                return <PowerRankings />;
            case TABS.LEAGUE_HISTORY:
                return <LeagueHistory />;
            case TABS.RECORD_BOOK:
                // RecordBook now gets data internally via useSleeperData
                return <RecordBook />;
            case TABS.HEAD_TO_HEAD:
                return <Head2HeadGrid />;
            case TABS.DPR_ANALYSIS:
                return <DPRAnalysis />; // DPRAnalysis will need to use useSleeperData internally
            case TABS.LUCK_RATING:
                return <LuckRatingAnalysis />; // LuckRatingAnalysis will need to use useSleeperData internally
            case TABS.TEAM_DETAIL:
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
        <div className="min-h-screen bg-gray-100 flex flex-col font-inter">
            {/* Tailwind CSS Script - Always include this in the head of your HTML or equivalent */}
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

            {/* Header */}
            <header className="bg-gray-800 text-white p-4 shadow-md">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Fantasy Football History</h1>
                    <button className="md:hidden text-white text-2xl" onClick={toggleMobileMenu}>
                        ☰
                    </button>
                </div>
            </header>

            {/* Navigation */}
            <nav className={`bg-gray-700 text-white shadow-lg md:block ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
                <ul className="flex flex-col md:flex-row md:justify-center py-2">
                    {/* Home Tab */}
                    <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 my-0.5 md:my-0"
                        onClick={() => handleTabClick(NAV_CATEGORIES.HOME.tab)}>
                        {NAV_CATEGORIES.HOME.label}
                    </li>
                    {/* Power Rankings Tab */}
                    <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 my-0.5 md:my-0"
                        onClick={() => handleTabClick(NAV_CATEGORIES.POWER_RANKINGS.tab)}>
                        {NAV_CATEGORIES.POWER_RANKINGS.label}
                    </li>
                    {/* League Data Submenu */}
                    <li className="relative px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 my-0.5 md:my-0"
                        onClick={() => toggleSubMenu('leagueData')}>
                        {NAV_CATEGORIES.LEAGUE_DATA.label} <span className="ml-1">▼</span>
                        {openSubMenu === 'leagueData' && (
                            <ul className="absolute md:top-full md:left-0 bg-gray-700 shadow-lg rounded-md mt-2 w-48 z-10">
                                {NAV_CATEGORIES.LEAGUE_DATA.subTabs.map(subTab => (
                                    <li key={subTab.tab} className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md"
                                        onClick={(e) => { e.stopPropagation(); handleSubTabClick(subTab.tab); }}>
                                        {subTab.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                    {/* Teams Submenu (Dynamically populated) */}
                    <li className="relative px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 my-0.5 md:my-0"
                        onClick={() => toggleSubMenu('teams')}>
                        {NAV_CATEGORIES.TEAMS.label} <span className="ml-1">▼</span>
                        {openSubMenu === 'teams' && (
                            <ul className="absolute md:top-full md:left-0 bg-gray-700 shadow-lg rounded-md mt-2 w-48 z-10 max-h-60 overflow-y-auto">
                                {NAV_CATEGORIES.TEAMS.subTabs.map(subTab => (
                                    <li key={subTab.label} className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md"
                                        onClick={(e) => { e.stopPropagation(); handleSubTabClick(subTab.tab, subTab.teamName); }}>
                                        {subTab.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                    {/* Financials Tab */}
                    <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 my-0.5 md:my-0"
                        onClick={() => handleTabClick(NAV_CATEGORIES.FINANCIALS.tab)}>
                        {NAV_CATEGORIES.FINANCIALS.label}
                    </li>
                </ul>
            </nav>

            {/* Main Content Area */}
            <main className="flex-grow container mx-auto p-4">
                {renderContent()}
            </main>

            {/* Footer (Optional) */}
            <footer className="bg-gray-800 text-white text-center p-3 mt-auto">
                <p>&copy; {new Date().getFullYear()} Fantasy Football History. All rights reserved.</p>
            </footer>
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
