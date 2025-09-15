import React, { useState, useEffect, useCallback } from 'react';

// Import all your components
import LeagueHistory from './lib/LeagueHistory';
import RecordBook from './lib/RecordBook';
import DPRAnalysis from './lib/DPRAnalysis';
import LuckRatingAnalysis from './lib/LuckRatingAnalysis';
import TeamDetailPage from './lib/TeamDetailPage';
import Head2HeadGrid from './lib/Head2HeadGrid';
import FinancialTracker from './components/FinancialTracker';
import Dashboard from './components/Dashboard';
import TeamsOverviewPage from './lib/TeamsOverviewPage';
import SeasonBreakdown from './lib/SeasonBreakdown';
import DraftAnalysis from './lib/DraftAnalysis'; // Import the new DraftAnalysis component
import HallOfChampions from './lib/HallOfChampions'; // Import the new HallOfChampions component
import Gamecenter from './components/Gamecenter'; // Import the new Gamecenter component
import Sportsbook from './components/Sportsbook'; // Import the new Sportsbook component

// Import the custom hook from your SleeperDataContext
import { SleeperDataProvider, useSleeperData } from './contexts/SleeperDataContext';

// Define the available tabs and their categories
const NAV_CATEGORIES = {
    HOME: { label: 'Dashboard', tab: 'dashboard' },
    GAMECENTER: { label: 'Gamecenter', tab: 'gamecenter' },
    SPORTSBOOK: { label: 'Sportsbook', tab: 'sportsbook' },
    LEAGUE_DATA: {
        label: 'League Data',
        subTabs: [
            { label: 'League History', tab: 'leagueHistory' },
            { label: 'Hall of Champions', tab: 'hallOfChampions' }, // New Hall of Champions sub-tab
            { label: 'Record Book', tab: 'recordBook' },
            { label: 'Head-to-Head', tab: 'headToHead' },
            { label: 'DPR Analysis', tab: 'dprAnalysis' },
            { label: 'Luck Rating', tab: 'luckRating' },
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
    HOME: 'dashboard',
    GAMECENTER: 'gamecenter',
    SPORTSBOOK: 'sportsbook',
    LEAGUE_HISTORY: 'leagueHistory',
    HALL_OF_CHAMPIONS: 'hallOfChampions',
    RECORD_BOOK: 'recordBook',
    HEAD_TO_HEAD: 'headToHead',
    DPR_ANALYSIS: 'dprAnalysis',
    LUCK_RATING: 'luckRating',
    TEAMS_OVERVIEW: 'teamsOverview',
    TEAMS: 'teams',
    ROSTER: 'roster',
    FINANCIALS: 'financials',
    TRANSACTIONS: 'transactions',
    SEASON_BREAKDOWN: 'seasonBreakdown',
    DRAFT_ANALYSIS: 'draftAnalysis',
};

const AppContent = () => {
    // Consume data from SleeperDataContext
    const {
        loading,
        error,
        historicalData,
        usersData // Make sure usersData is available here
    } = useSleeperData();

    const [activeTab, setActiveTab] = useState(TABS.HOME);
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

    // State to hold the top 3 finishers
    const [topFinishers, setTopFinishers] = useState([]); // Changed to array for top 3

    // Effect to determine the top 3 finishers once historicalData and usersData are loaded
    useEffect(() => {
        // Access rostersBySeason from historicalData
        const rostersBySeason = historicalData?.rostersBySeason;

        // Check if all necessary top-level data objects are available
        const isDataReady = !loading && !error && historicalData && usersData && rostersBySeason;

        if (isDataReady) {
            // Further check if the specific summary objects within historicalData are present
            const hasSummaryData = historicalData.seasonAwardsSummary || historicalData.awardsSummary || historicalData.winnersBracketBySeason;

            if (hasSummaryData) {
                let finishers = []; // Array to hold top 3 finishers
                let foundFinishers = false;

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
                    // Try to get top 3 finishers from winnersBracketBySeason
                    if (historicalData.winnersBracketBySeason && historicalData.winnersBracketBySeason[year]) {
                        const bracket = historicalData.winnersBracketBySeason[year];
                        
                        // Find championship game (p: 1)
                        const championshipGame = bracket.find(matchup => matchup.p === 1 && matchup.w);
                        // Find 3rd place game - try different position values
                        let thirdPlaceGame = bracket.find(matchup => matchup.p === 2 && matchup.w);
                        if (!thirdPlaceGame) {
                            // Sometimes 3rd place game might have different position value
                            thirdPlaceGame = bracket.find(matchup => matchup.p === 3 && matchup.w);
                        }
                        if (!thirdPlaceGame) {
                            // Look for any game that might be 3rd place by checking for consolation bracket
                            thirdPlaceGame = bracket.find(matchup => matchup.w && matchup.p > 1 && matchup.p <= 3);
                        }
                        
                        if (championshipGame && rostersBySeason[year]) {
                            const getTeamName = (rosterId) => {
                                const roster = rostersBySeason[year].find(r => String(r.roster_id) === String(rosterId));
                                if (roster && roster.owner_id) {
                                    return getUserDisplayName(roster.owner_id, usersData);
                                }
                                return null;
                            };

                            // 1st place - winner of championship
                            const firstPlace = getTeamName(championshipGame.w);
                            // 2nd place - loser of championship
                            const secondPlace = getTeamName(championshipGame.l);
                            // 3rd place - winner of 3rd place game (if exists)
                            const thirdPlace = thirdPlaceGame ? getTeamName(thirdPlaceGame.w) : null;

                            if (firstPlace) {
                                finishers = [
                                    { place: 1, name: firstPlace, emoji: '🥇' },
                                    ...(secondPlace ? [{ place: 2, name: secondPlace, emoji: '🥈' }] : []),
                                    ...(thirdPlace ? [{ place: 3, name: thirdPlace, emoji: '🥉' }] : [])
                                ];
                                foundFinishers = true;
                                break;
                            }
                        }
                    }

                    // Fallback to just champion if bracket data not available
                    if (!foundFinishers) {
                        let potentialChampionValue = '';

                        // Check seasonAwardsSummary
                        if (historicalData.seasonAwardsSummary && historicalData.seasonAwardsSummary[year]) {
                            const summary = historicalData.seasonAwardsSummary[year];
                            if (summary.champion && summary.champion !== 'N/A' && summary.champion.trim() !== '') {
                                potentialChampionValue = summary.champion.trim();
                            }
                        }

                        // Check awardsSummary if not found
                        if (!potentialChampionValue && historicalData.awardsSummary && historicalData.awardsSummary[year]) {
                            const summary = historicalData.awardsSummary[year];
                            const champKey = summary.champion || summary["Champion"];
                            if (champKey && champKey !== 'N/A' && String(champKey).trim() !== '') {
                                potentialChampionValue = String(champKey).trim();
                            }
                        }

                        if (potentialChampionValue) {
                            const resolvedName = getUserDisplayName(potentialChampionValue, usersData);
                            const championName = resolvedName !== 'Unknown Champion' ? resolvedName : potentialChampionValue;
                            
                            finishers = [{ place: 1, name: championName, emoji: '🥇' }];
                            foundFinishers = true;
                            break;
                        }
                    }
                }

                setTopFinishers(finishers);
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
                    <div className="text-center p-6 bg-white rounded-lg shadow-md max-w-md w-full mx-4">
                        <div className="mb-6">
                            <img
                                src={process.env.PUBLIC_URL + '/LeagueLogoNoBack.PNG'}
                                alt="League Logo"
                                className="h-16 w-16 mx-auto mb-4 object-contain"
                            />
                            <p className="text-lg font-semibold text-gray-700 mb-2">Loading Sleeper fantasy data...</p>
                            <p className="text-sm text-gray-500">This might take a moment as we fetch historical league information.</p>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full animate-progress shadow-sm"></div>
                        </div>
                        
                        <div className="text-xs text-gray-400">
                            Fetching league data and historical matchups...
                        </div>
                    </div>
                    
                    <style jsx>{`
                        @keyframes progress {
                            0% {
                                width: 0%;
                                transform: translateX(-100%);
                            }
                            50% {
                                width: 100%;
                                transform: translateX(0%);
                            }
                            100% {
                                width: 100%;
                                transform: translateX(100%);
                            }
                        }
                        .animate-progress {
                            animation: progress 2s ease-in-out infinite;
                        }
                    `}</style>
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
            case TABS.GAMECENTER:
                return <Gamecenter />;
            case TABS.SPORTSBOOK:
                return <Sportsbook />;
            case TABS.LEAGUE_HISTORY:
                return <LeagueHistory />;
            case TABS.HALL_OF_CHAMPIONS: // New case for Hall of Champions
                return <HallOfChampions />;
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
            case TABS.SEASON_BREAKDOWN:
                return <SeasonBreakdown />;
            case TABS.DRAFT_ANALYSIS: // New case for Draft Analysis
                return <DraftAnalysis />;
            default:
                return <Dashboard />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col font-inter overflow-x-hidden">
            {/* Header - Mobile Optimized */}
            <header className="bg-gray-800 text-white shadow-md safe-area-top relative">
                <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 max-w-6xl w-full mx-auto">
                    {/* Logo and Title */}
                    <div className="flex items-center flex-1 min-w-0">
                        <img
                            src={process.env.PUBLIC_URL + '/LeagueLogoNoBack.PNG'}
                            alt="League Logo"
                            className="h-10 w-10 md:h-14 md:w-14 mr-2 md:mr-4 object-contain flex-shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                            <h1 className="text-sm sm:text-base md:text-2xl font-bold truncate">
                                <span className="sm:hidden">TLOED</span>
                                <span className="hidden sm:inline">The League of Extraordinary Douchebags</span>
                            </h1>
                            {/* Top 3 Finishers */}
                            {topFinishers.length > 0 && (
                                <div className="flex items-center gap-1 sm:gap-2 mt-1">
                                    {topFinishers.map((finisher, index) => (
                                        <div key={index} className="flex items-center gap-1" title={`${finisher.place === 1 ? 'Champion' : finisher.place === 2 ? 'Runner-up' : '3rd Place'}`}>
                                            <span className="text-xs sm:text-sm md:text-base">{finisher.emoji}</span>
                                            <span className="font-medium text-white text-xs sm:text-sm md:text-base max-w-16 sm:max-w-24 md:max-w-none truncate">
                                                {finisher.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <button 
                        className="md:hidden text-white text-2xl touch-friendly flex items-center justify-center" 
                        onClick={toggleMobileMenu} 
                        aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                    >
                        {isMobileMenuOpen ? '✕' : '☰'}
                    </button>
                </div>
            </header>

            {/* Navigation - Mobile Optimized */}
            <nav className={`bg-gray-700 text-white shadow-lg transition-all duration-300 md:block relative z-50 ${
                isMobileMenuOpen ? 'block max-h-screen' : 'hidden max-h-0'
            } md:max-h-none`}>
                <div className="max-w-6xl w-full mx-auto">
                    {/* Mobile Navigation */}
                    <ul className="md:hidden flex flex-col">
                        {/* Main Nav Items */}
                        <li>
                            <button 
                                className="w-full px-4 py-3 text-left hover:bg-gray-600 active:bg-gray-500 touch-friendly border-b border-gray-600"
                                onClick={() => handleTabClick(NAV_CATEGORIES.HOME.tab)}
                            >
                                <span className="text-base font-medium">🏠 {NAV_CATEGORIES.HOME.label}</span>
                            </button>
                        </li>
                        <li>
                            <button 
                                className="w-full px-4 py-3 text-left hover:bg-gray-600 active:bg-gray-500 touch-friendly border-b border-gray-600"
                                onClick={() => handleTabClick(NAV_CATEGORIES.GAMECENTER.tab)}
                            >
                                <span className="text-base font-medium">🎮 {NAV_CATEGORIES.GAMECENTER.label}</span>
                            </button>
                        </li>
                        <li>
                            <button 
                                className="w-full px-4 py-3 text-left hover:bg-gray-600 active:bg-gray-500 touch-friendly border-b border-gray-600"
                                onClick={() => handleTabClick(NAV_CATEGORIES.SPORTSBOOK.tab)}
                            >
                                <span className="text-base font-medium">💰 {NAV_CATEGORIES.SPORTSBOOK.label}</span>
                            </button>
                        </li>
                        
                        {/* League Data Submenu */}
                        <li>
                            <button 
                                className="w-full px-4 py-3 text-left hover:bg-gray-600 active:bg-gray-500 touch-friendly border-b border-gray-600 flex items-center justify-between"
                                onClick={() => toggleSubMenu('leagueData')}
                            >
                                <span className="text-base font-medium">📊 {NAV_CATEGORIES.LEAGUE_DATA.label}</span>
                                <span className={`transform transition-transform duration-200 ${openSubMenu === 'leagueData' ? 'rotate-180' : ''}`}>
                                    ▼
                                </span>
                            </button>
                            {openSubMenu === 'leagueData' && (
                                <ul className="bg-gray-600">
                                    {NAV_CATEGORIES.LEAGUE_DATA.subTabs.map(subTab => (
                                        <li key={subTab.tab}>
                                            <button 
                                                className="w-full px-8 py-3 text-left hover:bg-gray-500 active:bg-gray-400 touch-friendly text-sm border-b border-gray-500 last:border-b-0"
                                                onClick={(e) => { e.stopPropagation(); handleSubTabClick(subTab.tab); }}
                                            >
                                                {subTab.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                        
                        <li>
                            <button 
                                className="w-full px-4 py-3 text-left hover:bg-gray-600 active:bg-gray-500 touch-friendly border-b border-gray-600"
                                onClick={() => handleTabClick(NAV_CATEGORIES.TEAMS.tab)}
                            >
                                <span className="text-base font-medium">👥 {NAV_CATEGORIES.TEAMS.label}</span>
                            </button>
                        </li>
                        <li>
                            <button 
                                className="w-full px-4 py-3 text-left hover:bg-gray-600 active:bg-gray-500 touch-friendly border-b border-gray-600"
                                onClick={() => handleTabClick(NAV_CATEGORIES.SEASON_BREAKDOWN.tab)}
                            >
                                <span className="text-base font-medium">📈 {NAV_CATEGORIES.SEASON_BREAKDOWN.label}</span>
                            </button>
                        </li>
                        <li>
                            <button 
                                className="w-full px-4 py-3 text-left hover:bg-gray-600 active:bg-gray-500 touch-friendly border-b border-gray-600"
                                onClick={() => handleTabClick(NAV_CATEGORIES.DRAFT.tab)}
                            >
                                <span className="text-base font-medium">🎯 {NAV_CATEGORIES.DRAFT.label}</span>
                            </button>
                        </li>
                        <li>
                            <button 
                                className="w-full px-4 py-3 text-left hover:bg-gray-600 active:bg-gray-500 touch-friendly"
                                onClick={() => handleTabClick(NAV_CATEGORIES.FINANCIALS.tab)}
                            >
                                <span className="text-base font-medium">💸 {NAV_CATEGORIES.FINANCIALS.label}</span>
                            </button>
                        </li>
                    </ul>

                    {/* Desktop Navigation */}
                    <ul className="hidden md:flex md:flex-row md:justify-center py-2">
                        {/* Home Tab */}
                        <li className="px-3 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 text-lg text-center touch-friendly"
                            onClick={() => handleTabClick(NAV_CATEGORIES.HOME.tab)}>
                            {NAV_CATEGORIES.HOME.label}
                        </li>
                        {/* Gamecenter Tab */}
                        <li className="px-3 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 text-lg text-center touch-friendly"
                            onClick={() => handleTabClick(NAV_CATEGORIES.GAMECENTER.tab)}>
                            {NAV_CATEGORIES.GAMECENTER.label}
                        </li>
                        {/* Sportsbook Tab */}
                        <li className="px-3 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 text-lg text-center touch-friendly"
                            onClick={() => handleTabClick(NAV_CATEGORIES.SPORTSBOOK.tab)}>
                            {NAV_CATEGORIES.SPORTSBOOK.label}
                        </li>
                        {/* League Data Submenu */}
                        <li className="relative px-3 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 text-lg text-center touch-friendly"
                            onClick={() => toggleSubMenu('leagueData')}>
                            {NAV_CATEGORIES.LEAGUE_DATA.label} <span className="ml-1">▼</span>
                            {openSubMenu === 'leagueData' && (
                                <ul className="absolute left-0 top-full bg-gray-700 shadow-lg rounded-md mt-2 w-48 z-10">
                                    {NAV_CATEGORIES.LEAGUE_DATA.subTabs.map(subTab => (
                                        <li key={subTab.tab} className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md text-base touch-friendly"
                                            onClick={(e) => { e.stopPropagation(); handleSubTabClick(subTab.tab); }}>
                                            {subTab.label}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                        {/* Teams Tab */}
                        <li className="px-3 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 text-lg text-center touch-friendly"
                            onClick={() => handleTabClick(NAV_CATEGORIES.TEAMS.tab)}>
                            {NAV_CATEGORIES.TEAMS.label}
                        </li>
                        {/* Season Breakdown Tab */}
                        <li className="px-3 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 text-lg text-center touch-friendly"
                            onClick={() => handleTabClick(NAV_CATEGORIES.SEASON_BREAKDOWN.tab)}>
                            {NAV_CATEGORIES.SEASON_BREAKDOWN.label}
                        </li>
                        {/* Draft Tab */}
                        <li className="px-3 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 text-lg text-center touch-friendly"
                            onClick={() => handleTabClick(NAV_CATEGORIES.DRAFT.tab)}>
                            {NAV_CATEGORIES.DRAFT.label}
                        </li>
                        {/* Financials Tab */}
                        <li className="px-3 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 text-lg text-center touch-friendly"
                            onClick={() => handleTabClick(NAV_CATEGORIES.FINANCIALS.tab)}>
                            {NAV_CATEGORIES.FINANCIALS.label}
                        </li>
                    </ul>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-grow w-full max-w-6xl mx-auto p-3 sm:p-4 md:p-6 safe-area-bottom">
                <div className="mobile-scroll">
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
