import React, { useState, useEffect, useCallback } from 'react';

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
// Removed: import MatchupHistory from './lib/MatchupHistory';
import TeamsOverviewPage from './lib/TeamsOverviewPage';
import SeasonBreakdown from './lib/SeasonBreakdown';
import DraftAnalysis from './lib/DraftAnalysis'; // Import the new DraftAnalysis component

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
            // Removed: { label: 'Matchup History', tab: 'matchupHistory' },
        ]
    },
    TEAMS: {
        label: 'Teams',
        tab: 'teamsOverview',
    },
    SEASON_BREAKDOWN: { label: 'Season Breakdown', tab: 'seasonBreakdown' },
    DRAFT: { label: 'Draft', tab: 'draftAnalysis' }, // New tab for Draft Analysis
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
    // Removed: MATCHUP_HISTORY: 'matchupHistory',
    TEAMS_OVERVIEW: 'teamsOverview',
    SEASON_BREAKDOWN: 'seasonBreakdown',
    DRAFT_ANALYSIS: 'draftAnalysis', // New tab for Draft Analysis
};

const AppContent = () => {
    // Consume data from SleeperDataContext
    const {
        loading,
        error,
        historicalData,
        usersData // Make sure usersData is available here
        // Removed rostersBySeason from direct destructuring as it's inside historicalData
    } = useSleeperData();

    const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openSubMenu, setOpenSubMenu] = useState(null);

    // Helper function to get user display name from user ID
    const getUserDisplayName = useCallback((userId, usersData) => {
        if (!userId || !usersData) {
            return 'Unknown Champion';
        }
        const user = usersData.find(u => u.user_id === userId);
        if (user) {
            // Prioritize team_name from metadata, otherwise use display_name
            const nameToDisplay = user.metadata?.team_name || user.display_name;
            return nameToDisplay;
        } else {
            return 'Unknown Champion';
        }
    }, [usersData]); // Memoize this function, re-create only if usersData changes

    // State to hold the reigning champion's display name
    const [reigningChampion, setReigningChampion] = useState(''); // Changed initial state to empty string

    // Effect to determine the reigning champion once historicalData and usersData are loaded
    useEffect(() => {
        // Access rostersBySeason from historicalData
        const rostersBySeason = historicalData?.rostersBySeason;

        // Check if all necessary top-level data objects are available
        const isDataReady = !loading && !error && historicalData && usersData && rostersBySeason;

        if (isDataReady) {
            // Further check if the specific summary objects within historicalData are present
            const hasSummaryData = historicalData.seasonAwardsSummary || historicalData.awardsSummary || historicalData.winnersBracketBySeason;

            if (hasSummaryData) {
                let championDisplayName = ''; // Initialize as empty string here too
                let foundChampion = false;

                // Get all years from all relevant sources, sort them descending
                const allYears = new Set();
                if (historicalData.seasonAwardsSummary) {
                    Object.keys(historicalData.seasonAwardsSummary).forEach(year => allYears.add(Number(year)));
                }
                if (historicalData.awardsSummary) {
                    Object.keys(historicalData.awardsSummary).forEach(year => allYears.add(Number(year)));
                }
                if (historicalData.winnersBracketBySeason) {
                    Object.keys(historicalData.winnersBracketBySeason).forEach(year => allYears.add(Number(year)));
                }
                const sortedYears = Array.from(allYears).sort((a, b) => b - a);

                for (const year of sortedYears) {
                    let potentialChampionValue = '';
                    let championRosterId = '';

                    // --- PRIORITY 1: Check winnersBracketBySeason for the championship game (p: 1) ---
                    if (historicalData.winnersBracketBySeason && historicalData.winnersBracketBySeason[year]) {
                        const championshipGame = historicalData.winnersBracketBySeason[year].find(
                            matchup => matchup.p === 1 && matchup.w // Find the playoff game with position 1 and a winner
                        );
                        if (championshipGame) {
                            championRosterId = String(championshipGame.w).trim();

                            // Now, map roster_id to user_id using rostersBySeason for that year
                            if (rostersBySeason[year]) {
                                const winningRoster = rostersBySeason[year].find(
                                    roster => String(roster.roster_id) === championRosterId
                                );
                                if (winningRoster && winningRoster.owner_id) {
                                    potentialChampionValue = winningRoster.owner_id; // This is the user_id
                                }
                            }
                        }
                    }

                    // --- PRIORITY 2: Check seasonAwardsSummary if not found in winnersBracket ---
                    if (!potentialChampionValue && historicalData.seasonAwardsSummary && historicalData.seasonAwardsSummary[year]) {
                        const summary = historicalData.seasonAwardsSummary[year];
                        if (summary.champion && summary.champion !== 'N/A' && summary.champion.trim() !== '') {
                            potentialChampionValue = summary.champion.trim();
                        }
                    }

                    // --- PRIORITY 3: Check awardsSummary if not found in previous sources ---
                    if (!potentialChampionValue && historicalData.awardsSummary && historicalData.awardsSummary[year]) {
                        const summary = historicalData.awardsSummary[year];
                        const champKey = summary.champion || summary["Champion"];
                        if (champKey && champKey !== 'N/A' && String(champKey).trim() !== '') {
                            potentialChampionValue = String(champKey).trim();
                        }
                    }

                    // If a potential champion value was found for this year, try to resolve it
                    if (potentialChampionValue) {
                        const resolvedName = getUserDisplayName(potentialChampionValue, usersData);
                        if (resolvedName !== 'Unknown Champion') {
                            championDisplayName = resolvedName;
                            foundChampion = true;
                            break; // Found the most recent champion, stop
                        } else {
                            // If it's not a user ID (e.g., if it's already a display name from Google Sheet data), use it directly
                            championDisplayName = potentialChampionValue;
                            foundChampion = true;
                            break; // Found the most recent champion, stop
                        }
                    }
                }

                setReigningChampion(championDisplayName);
            }
        }
    }, [loading, error, historicalData, usersData, getUserDisplayName]);


    // Placeholder functions for UI interactions
    const handleTabClick = (tab) => {
        setActiveTab(tab);
        setIsMobileMenuOpen(false); // Close mobile menu on tab click
        setOpenSubMenu(null); // Close any open sub-menus
    };

    // Simplified handleSubTabClick - teamName is no longer passed from main nav
    const handleSubTabClick = (tab) => {
        setActiveTab(tab);
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
        // Use the loading and error states from SleeperDataContext
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
                        <p className="text-base">Failed to load historical data: {error.message || String(error)}</p>
                        <p className="text-sm mt-2">Please check your internet connection or the Sleeper API configuration in `config.js` and `sleeperApi.js`.</p>
                    </div>
                </div>
            );
        }

        // Flatten historical matchups from the object structure to a single array
        // This is kept here because other components (RecordBook, Head2HeadGrid) still need it
        const allMatchups = historicalData && historicalData.matchupsBySeason
            ? Object.values(historicalData.matchupsBySeason).flat()
            : [];

        // Render components based on activeTab, passing necessary data from context
        switch (activeTab) {
            case TABS.DASHBOARD:
                return <Dashboard />;
            case TABS.POWER_RANKINGS:
                return <PowerRankings />;
            case TABS.LEAGUE_HISTORY:
                return <LeagueHistory />;
            case TABS.RECORD_BOOK:
                return <RecordBook historicalMatchups={allMatchups} />;
            case TABS.HEAD_TO_HEAD:
                return <Head2HeadGrid historicalMatchups={allMatchups} getDisplayTeamName={getUserDisplayName} />;
            case TABS.DPR_ANALYSIS:
                return <DPRAnalysis />;
            case TABS.LUCK_RATING:
                return <LuckRatingAnalysis />;
            case TABS.TEAMS_OVERVIEW:
                return <TeamsOverviewPage />;
            case TABS.FINANCIALS:
                return <FinancialTracker />;
            // Removed: case TABS.MATCHUP_HISTORY:
            // Removed:    return <MatchupHistory />;
            case TABS.SEASON_BREAKDOWN:
                return <SeasonBreakdown />;
            case TABS.DRAFT_ANALYSIS: // New case for Draft Analysis
                return <DraftAnalysis />;
            default:
                return <Dashboard />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col font-inter">
            {/* Header */}
            <header className="bg-gray-800 text-white p-4 shadow-md">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center">
                        <img
                            src={process.env.PUBLIC_URL + '/LeagueLogoNoBack.PNG'}
                            alt="League Logo"
                            className="h-14 w-14 mr-4 object-contain"
                        />
                        <h1 className="text-2xl font-bold">The League of Extraordinary Douchebags</h1>
                    </div>
                    {/* Gold Trophy and Champion Name (FontAwesome, same as LeagueHistory) */}
                    <div className="flex items-center gap-2">
                        {reigningChampion && ( // Conditionally render the trophy icon
                            <span title="Reigning Champion">
                                <i className="fas fa-trophy text-[#eab308] text-2xl mr-1"></i>
                            </span>
                        )}
                        <span className="font-semibold text-[#eab308] text-lg">
                            {reigningChampion}
                        </span>
                    </div>
                    <button className="md:hidden text-white text-2xl ml-2" onClick={toggleMobileMenu}>
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
                    {/* Teams Tab (now a direct link to TeamsOverviewPage) */}
                    <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 my-0.5 md:my-0"
                        onClick={() => handleTabClick(NAV_CATEGORIES.TEAMS.tab)}>
                        {NAV_CATEGORIES.TEAMS.label}
                    </li>
                    {/* Season Breakdown Tab */}
                    <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 my-0.5 md:my-0"
                        onClick={() => handleTabClick(NAV_CATEGORIES.SEASON_BREAKDOWN.tab)}>
                        {NAV_CATEGORIES.SEASON_BREAKDOWN.label}
                    </li>
                    {/* New Draft Tab */}
                    <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 my-0.5 md:my-0"
                        onClick={() => handleTabClick(NAV_CATEGORIES.DRAFT.tab)}>
                        {NAV_CATEGORIES.DRAFT.label}
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
                <div>
                    {renderContent()}
                </div>
            </main>
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
