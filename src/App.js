import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import LOADING_SAYINGS from './data/loadingSayings';

// Import all your components
import LeagueHistory from './lib/LeagueHistory';
import RecordBook from './lib/RecordBook';
import DPRAnalysis from './lib/DPRAnalysis';
import MostTradedPlayers from './lib/MostTradedPlayers';
import LuckRatingAnalysis from './lib/LuckRatingAnalysis';
import TeamDetailPage from './lib/TeamDetailPage';
import Head2HeadGrid from './lib/Head2HeadGrid';
import FinancialTracker from './components/FinancialTracker';
import Dashboard from './components/Dashboard';
import TeamsOverviewPage from './lib/TeamsOverviewPage';
import SeasonBreakdown from './lib/SeasonBreakdown';
import DraftAnalysis from './lib/DraftAnalysis';
import HallOfChampions from './lib/HallOfChampions';
import Gamecenter from './components/Gamecenter';
import Sportsbook from './components/Sportsbook';
import KeeperList from './lib/KeeperList';
import MiniGames from './lib/MiniGames';
import PlayerHistory from './lib/PlayersHistory';
const MemesAndMemories = lazy(() => import('./lib/MemesAndMemories'));
import DesktopNav from './components/DesktopNav';
import PasswordLock from './components/PasswordLock';
import { useAuth } from './contexts/AuthContext';

import { SleeperDataProvider, useSleeperData } from './contexts/SleeperDataContext';
import logger from './utils/logger';

const NAV_CATEGORIES = {
    HOME: { label: 'Dashboard', tab: 'dashboard' },
    GAMECENTER: { label: 'Gamecenter', tab: 'gamecenter' },
    SPORTSBOOK: { label: 'Sportsbook', tab: 'sportsbook' },
    HEAD_TO_HEAD: { label: 'Head-to-Head', tab: 'headToHead' },
    LEAGUE_DATA: {
        label: 'League Data',
        subTabs: [
            { label: 'League History', tab: 'leagueHistory' },
            { label: 'Hall of Champions', tab: 'hallOfChampions' },
            { label: 'Keepers', tab: 'keepers' },
            { label: 'Record Book', tab: 'recordBook' },
            { label: 'Head-to-Head', tab: 'headToHead' },
            { label: 'Player History', tab: 'playerHistory' },
            { label: 'DPR Analysis', tab: 'dprAnalysis' },
            { label: 'Luck Rating', tab: 'luckRating' },
        ]
    },
    TEAMS: {
        label: 'Teams',
        tab: 'teamsOverview',
    },
    SEASON_BREAKDOWN: { label: 'Season Breakdown', tab: 'seasonBreakdown' },
    DRAFT: { label: 'Draft', tab: 'draftAnalysis' },
    MINIGAMES: { label: 'Mini-Games', tab: 'miniGames' },
    FINANCIALS: { label: 'Financials', tab: 'financials' },
};

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
    PLAYER_HISTORY: 'playerHistory',
    TEAMS_OVERVIEW: 'teamsOverview',
    TEAMS: 'teams',
    ROSTER: 'roster',
    FINANCIALS: 'financials',
    TRANSACTIONS: 'transactions',
    SEASON_BREAKDOWN: 'seasonBreakdown',
    DRAFT_ANALYSIS: 'draftAnalysis',
    KEEPERS: 'keepers',
    MINI_GAMES: 'miniGames',
    MEMES_AND_MEMORIES: 'memesAndMemories',
    ACHIEVEMENTS: 'achievements',
    TRADE_HISTORY: 'tradeHistory',
};

// ─── Mobile Nav Item Components ──────────────────────────────────────────────

const MobileNavButton = ({ icon, label, onClick, isActive }) => (
    <button
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 border-b border-white/5 ${
            isActive
                ? 'bg-blue-600/20 text-blue-300 border-l-2 border-l-blue-400'
                : 'text-gray-200 hover:bg-white/5 hover:text-white active:bg-white/10'
        }`}
        onClick={onClick}
    >
        <span className="text-base w-5 text-center flex-shrink-0">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
    </button>
);

const MobileDropdown = ({ icon, label, isOpen, onToggle, children }) => (
    <li>
        <button
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-200 hover:bg-white/5 hover:text-white active:bg-white/10 transition-all duration-150 border-b border-white/5"
            onClick={onToggle}
        >
            <span className="text-base w-5 text-center flex-shrink-0">{icon}</span>
            <span className="text-sm font-medium flex-1">{label}</span>
            <svg
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </button>
        {isOpen && (
            <ul className="bg-black/20 border-b border-white/5">
                {children}
            </ul>
        )}
    </li>
);

const MobileSubItem = ({ label, onClick }) => (
    <li>
        <button
            className="w-full flex items-center gap-2 pl-12 pr-4 py-2.5 text-left text-gray-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition-all duration-150 text-sm border-b border-white/5 last:border-b-0"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
            <span className="w-1 h-1 rounded-full bg-gray-500 flex-shrink-0" />
            {label}
        </button>
    </li>
);

// ─── Finisher Badge ───────────────────────────────────────────────────────────

const FinisherBadges = ({ finishers }) => {
    if (!finishers.length) return null;
    return (
        <div className="flex items-center gap-1 sm:gap-2 mt-0.5 flex-wrap">
            {/* Mobile: 1st only */}
            <div className="sm:hidden flex items-center gap-1">
                <span className="text-xs leading-none">{finishers[0].emoji}</span>
                <span className="text-xs font-medium text-gray-200 truncate max-w-[80px]">
                    {finishers[0].name}
                </span>
            </div>
            {/* Desktop: all */}
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
                {finishers.map((f, i) => (
                    <div key={i} className="flex items-center gap-1">
                        <span className="text-xs sm:text-sm">{f.emoji}</span>
                        <span className="text-xs sm:text-sm font-medium text-gray-200 truncate max-w-[90px] md:max-w-none">
                            {f.name}
                        </span>
                        {i < finishers.length - 1 && (
                            <span className="text-gray-600 text-xs ml-1">·</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── AppContent ───────────────────────────────────────────────────────────────

const AppContent = () => {
    const { logout } = useAuth();

    const {
        loading,
        error,
        historicalData,
        usersData
    } = useSleeperData();

    const [activeTab, setActiveTab] = useState(TABS.HOME);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openSubMenu, setOpenSubMenu] = useState(null);
    const [showLoadingAlert, setShowLoadingAlert] = useState(false);
    const [selectedTeamName, setSelectedTeamName] = useState('');
    const [navigationHistory, setNavigationHistory] = useState([]);
    const [loadingSaying, setLoadingSaying] = useState('');
    const [topFinishers, setTopFinishers] = useState([]);

    // Loading timeout
    useEffect(() => {
        let timeoutId;
        if (loading) {
            timeoutId = setTimeout(() => setShowLoadingAlert(true), 15000);
        } else {
            setShowLoadingAlert(false);
        }
        return () => { if (timeoutId) clearTimeout(timeoutId); };
    }, [loading]);

    useEffect(() => {
        if (loading) {
            const pick = LOADING_SAYINGS[Math.floor(Math.random() * LOADING_SAYINGS.length)];
            setLoadingSaying(pick);
        } else {
            setLoadingSaying('');
        }
    }, [loading]);

    // Browser history
    useEffect(() => {
        const initialState = { tab: activeTab, selectedTeamName };
        window.history.replaceState(initialState, '', window.location.pathname);

        const handlePopState = (event) => {
            logger.debug('Pop state event:', event.state);
            if (event.state) {
                setActiveTab(event.state.tab || TABS.DASHBOARD);
                setSelectedTeamName(event.state.selectedTeamName || '');
                setNavigationHistory(prev => prev.slice(0, -1));
            } else {
                setActiveTab(TABS.DASHBOARD);
                setSelectedTeamName('');
                setNavigationHistory([]);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const getUserDisplayName = useCallback((userId, usersData) => {
        if (!userId || !usersData) return 'Unknown Champion';
        const user = usersData.find(u => u.user_id === userId);
        if (user) {
            return user.metadata?.team_name || user.display_name;
        }
        return 'Unknown Champion';
    }, [usersData]);

    // Top finishers effect
    useEffect(() => {
        const rostersBySeason = historicalData?.rostersBySeason;
        const isDataReady = !loading && !error && historicalData && usersData && rostersBySeason;
        if (!isDataReady) return;

        const hasSummaryData = historicalData.seasonAwardsSummary || historicalData.awardsSummary || historicalData.winnersBracketBySeason;
        if (!hasSummaryData) return;

        let finishers = [];
        let foundFinishers = false;

        const allYears = new Set();
        if (historicalData.seasonAwardsSummary) Object.keys(historicalData.seasonAwardsSummary).forEach(y => allYears.add(Number(y)));
        if (historicalData.awardsSummary) Object.keys(historicalData.awardsSummary).forEach(y => allYears.add(Number(y)));
        if (historicalData.winnersBracketBySeason) Object.keys(historicalData.winnersBracketBySeason).forEach(y => allYears.add(Number(y)));
        const sortedYears = Array.from(allYears).sort((a, b) => b - a);

        for (const year of sortedYears) {
            if (historicalData.winnersBracketBySeason?.[year]) {
                const bracket = historicalData.winnersBracketBySeason[year];
                const championshipGame = bracket.find(m => m.p === 1 && m.w);
                let thirdPlaceGame = bracket.find(m => m.p === 2 && m.w)
                    || bracket.find(m => m.p === 3 && m.w)
                    || bracket.find(m => m.w && m.p > 1 && m.p <= 3);

                if (championshipGame && rostersBySeason[year]) {
                    const getTeamName = (rosterId) => {
                        const roster = rostersBySeason[year].find(r => String(r.roster_id) === String(rosterId));
                        return roster?.owner_id ? getUserDisplayName(roster.owner_id, usersData) : null;
                    };

                    const firstPlace = getTeamName(championshipGame.w);
                    const secondPlace = getTeamName(championshipGame.l);
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

            if (!foundFinishers) {
                let potentialChampionValue = '';

                if (historicalData.seasonAwardsSummary?.[year]) {
                    const s = historicalData.seasonAwardsSummary[year];
                    if (s.champion && s.champion !== 'N/A' && s.champion.trim() !== '') {
                        potentialChampionValue = s.champion.trim();
                    }
                }
                if (!potentialChampionValue && historicalData.awardsSummary?.[year]) {
                    const s = historicalData.awardsSummary[year];
                    const champKey = s.champion || s["Champion"];
                    if (champKey && champKey !== 'N/A' && String(champKey).trim() !== '') {
                        potentialChampionValue = String(champKey).trim();
                    }
                }
                if (potentialChampionValue) {
                    const resolved = getUserDisplayName(potentialChampionValue, usersData);
                    const championName = resolved !== 'Unknown Champion' ? resolved : potentialChampionValue;
                    finishers = [{ place: 1, name: championName, emoji: '🥇' }];
                    foundFinishers = true;
                    break;
                }
            }
        }

        setTopFinishers(finishers);
    }, [loading, error, historicalData, usersData, getUserDisplayName]);

    // Page title
    useEffect(() => {
        const titles = {
            [TABS.HOME]: 'Dashboard', [TABS.GAMECENTER]: 'Gamecenter',
            [TABS.SPORTSBOOK]: 'Sportsbook', [TABS.LEAGUE_HISTORY]: 'League History',
            [TABS.HALL_OF_CHAMPIONS]: 'Hall of Champions', [TABS.RECORD_BOOK]: 'Record Book',
            [TABS.HEAD_TO_HEAD]: 'Head-to-Head', [TABS.DPR_ANALYSIS]: 'DPR Analysis',
            [TABS.LUCK_RATING]: 'Luck Rating',
            [TABS.TEAMS_OVERVIEW]: selectedTeamName || 'Teams',
            [TABS.FINANCIALS]: 'Financials', [TABS.SEASON_BREAKDOWN]: 'Season Breakdown',
            [TABS.DRAFT_ANALYSIS]: 'Draft Analysis', [TABS.MEMES_AND_MEMORIES]: 'Memes & Memories',
            [TABS.ACHIEVEMENTS]: 'Achievements',
        };
        document.title = `TLOED - ${titles[activeTab] || 'Dashboard'}`;
    }, [activeTab, selectedTeamName]);

    // Navigation handlers
    const handleTabClick = (tab) => {
        setActiveTab(tab);
        setIsMobileMenuOpen(false);
        setOpenSubMenu(null);
    };

    const handleSubTabClick = (tab) => {
        setActiveTab(tab);
        setIsMobileMenuOpen(false);
        setOpenSubMenu(null);
    };

    const toggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);
    const toggleSubMenu = (category) => setOpenSubMenu(prev => prev === category ? null : category);
    const handleRefresh = () => window.location.reload();

    const handleTeamNameClick = (teamName) => {
        const currentState = { tab: activeTab, selectedTeamName };
        window.history.pushState(currentState, '', window.location.pathname);
        setNavigationHistory(prev => [...prev, { tab: activeTab, teamName: selectedTeamName }]);
        setSelectedTeamName(teamName);
        setActiveTab(TABS.TEAMS_OVERVIEW);
        setIsMobileMenuOpen(false);
        setOpenSubMenu(null);
        window.history.pushState({ tab: TABS.TEAMS_OVERVIEW, selectedTeamName: teamName }, '', window.location.pathname);
    };

    const handleGoBack = () => {
        window.history.back();
        if (navigationHistory.length > 0) setNavigationHistory(prev => prev.slice(0, -1));
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-gray-950">
                    <div className="text-center p-8 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full mx-4">
                        <img
                            src={process.env.PUBLIC_URL + '/LeagueLogoNoBack.PNG'}
                            alt="League Logo"
                            className="h-16 w-16 mx-auto mb-5 object-contain opacity-90"
                        />
                        <p className="text-base font-semibold text-white mb-1">Loading Sleeper data…</p>
                        {loadingSaying && (
                            <p className="text-xs text-gray-400 italic mb-5">{loadingSaying}</p>
                        )}
                        <div className="w-full bg-gray-800 rounded-full h-1.5 mb-4 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full animate-progress" />
                        </div>
                        {showLoadingAlert && (
                            <div className="bg-amber-900/40 border border-amber-500/40 text-amber-200 p-4 rounded-xl mt-4 text-left">
                                <p className="font-semibold text-sm mb-1">Taking longer than usual?</p>
                                <p className="text-xs text-amber-300/80 mb-3">
                                    The Sleeper API may be slow. Try refreshing the page.
                                </p>
                                <button
                                    onClick={handleRefresh}
                                    className="bg-amber-500 hover:bg-amber-400 text-amber-950 px-4 py-1.5 rounded-lg font-semibold text-xs transition-colors"
                                >
                                    Refresh
                                </button>
                            </div>
                        )}
                    </div>
                    <style>{`
                        @keyframes progress {
                            0% { width: 0%; transform: translateX(-100%); }
                            50% { width: 100%; transform: translateX(0%); }
                            100% { width: 100%; transform: translateX(100%); }
                        }
                        .animate-progress { animation: progress 2s ease-in-out infinite; }
                    `}</style>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-gray-950">
                    <div className="text-center p-6 bg-red-950/60 border border-red-500/30 text-red-300 rounded-2xl shadow-xl max-w-sm mx-4">
                        <p className="font-bold text-lg mb-2">Error Loading Data</p>
                        <p className="text-sm text-red-400">{error.message || String(error)}</p>
                        <p className="text-xs mt-2 text-red-500/70">Check your connection or Sleeper API config.</p>
                    </div>
                </div>
            );
        }

        const allMatchups = historicalData?.matchupsBySeason
            ? Object.values(historicalData.matchupsBySeason).flat()
            : [];

        switch (activeTab) {
            case TABS.HOME: return <Dashboard />;
            case TABS.GAMECENTER: return <Gamecenter />;
            case TABS.SPORTSBOOK: return <Sportsbook />;
            case TABS.LEAGUE_HISTORY: return <LeagueHistory />;
            case TABS.HALL_OF_CHAMPIONS: return <HallOfChampions />;
            case TABS.RECORD_BOOK: return <RecordBook historicalMatchups={allMatchups} />;
            case TABS.HEAD_TO_HEAD: return <Head2HeadGrid historicalMatchups={allMatchups} getDisplayTeamName={getUserDisplayName} />;
            case TABS.DPR_ANALYSIS: return <DPRAnalysis />;
            case TABS.LUCK_RATING: return <LuckRatingAnalysis />;
            case TABS.PLAYER_HISTORY: return <PlayerHistory />;
            case TABS.KEEPERS: return <KeeperList />;
            case TABS.TEAMS_OVERVIEW: return <TeamsOverviewPage selectedTeamName={selectedTeamName} />;
            case TABS.FINANCIALS: return <FinancialTracker />;
            case TABS.SEASON_BREAKDOWN: return <SeasonBreakdown />;
            case TABS.DRAFT_ANALYSIS: return <DraftAnalysis />;
            case TABS.MINI_GAMES: return <MiniGames />;
            case TABS.MEMES_AND_MEMORIES:
                return (
                    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400"><p>Loading gallery…</p></div>}>
                        <MemesAndMemories />
                    </Suspense>
                );
            case TABS.ACHIEVEMENTS: return <Dashboard />;
            default: return <Dashboard />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col font-inter overflow-x-hidden">

            {/* ── Header ─────────────────────────────────────────────── */}
            <header className="bg-gray-900 border-b border-white/10 text-white shadow-xl safe-area-top">
                <div className="flex items-center justify-between px-3 py-1.5 md:px-6 md:py-2 max-w-6xl w-full mx-auto gap-3">

                    {/* Logo + Title */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <button
                            onClick={() => {
                                setActiveTab(TABS.HOME);
                                setSelectedTeamName('');
                                setNavigationHistory([]);
                                try {
                                    window.history.pushState({ tab: TABS.HOME, selectedTeamName: '' }, '', window.location.pathname);
                                } catch (e) {}
                            }}
                            aria-label="Go to dashboard"
                            className="p-0 bg-transparent border-0 flex-shrink-0 rounded-xl overflow-hidden hover:opacity-80 transition-opacity"
                        >
                            <img
                                src={process.env.PUBLIC_URL + '/LeagueLogoNoBack.PNG'}
                                alt="League Logo"
                                className="h-14 w-14 md:h-20 md:w-20 object-contain"
                            />
                        </button>

                        <div className="flex flex-col min-w-0 flex-1">
                            <h1 className="font-bold leading-tight tracking-tight">
                                <span className="sm:hidden text-sm text-white">TLOED</span>
                                <span className="hidden sm:inline text-base md:text-xl text-white">
                                    The League of Extraordinary Douchebags
                                </span>
                            </h1>
                            <FinisherBadges finishers={topFinishers} />
                        </div>
                    </div>

                    {/* Right controls */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {navigationHistory.length > 0 && (
                            <button
                                className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                                onClick={handleGoBack}
                                aria-label="Go back"
                                title="Go back"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}

                        {/* Hamburger – mobile only */}
                        <button
                            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                            onClick={toggleMobileMenu}
                            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                        >
                            {isMobileMenuOpen ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>

                        {logout && (
                            <button
                                onClick={logout}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600/80 hover:bg-red-600 active:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors border border-red-500/30"
                                title="Logout"
                            >
                                <span className="hidden md:inline">Logout</span>
                                <svg className="w-3.5 h-3.5 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Navigation ──────────────────────────────────────────── */}
            <nav className={`bg-gray-800 border-b border-white/10 text-white shadow-md transition-all duration-300 md:block relative z-50 ${
                isMobileMenuOpen ? 'block' : 'hidden'
            }`}>
                <div className="max-w-6xl w-full mx-auto">

                    {/* Mobile nav */}
                    <ul className="md:hidden flex flex-col py-1">
                        <li>
                            <MobileNavButton
                                icon="🏠"
                                label="Dashboard"
                                onClick={() => handleTabClick(NAV_CATEGORIES.HOME.tab)}
                                isActive={activeTab === NAV_CATEGORIES.HOME.tab}
                            />
                        </li>

                        <MobileDropdown
                            icon="🎮"
                            label="Games"
                            isOpen={openSubMenu === 'games'}
                            onToggle={() => toggleSubMenu('games')}
                        >
                            <MobileSubItem label="Gamecenter" onClick={() => handleTabClick(NAV_CATEGORIES.GAMECENTER.tab)} />
                            <MobileSubItem label="Sportsbook" onClick={() => handleTabClick(NAV_CATEGORIES.SPORTSBOOK.tab)} />
                            <MobileSubItem label="Head-to-Head" onClick={() => handleTabClick(NAV_CATEGORIES.HEAD_TO_HEAD.tab)} />
                            <MobileSubItem label="Mini-Games" onClick={() => handleTabClick(NAV_CATEGORIES.MINIGAMES.tab)} />
                        </MobileDropdown>

                        <MobileDropdown
                            icon="🏆"
                            label="League"
                            isOpen={openSubMenu === 'league'}
                            onToggle={() => toggleSubMenu('league')}
                        >
                            <MobileSubItem label="Hall of Champions" onClick={() => handleTabClick('hallOfChampions')} />
                            <MobileSubItem label="Keepers" onClick={() => handleTabClick('keepers')} />
                            <MobileSubItem label="League History" onClick={() => handleTabClick('leagueHistory')} />
                            <MobileSubItem label="Record Book" onClick={() => handleTabClick('recordBook')} />
                            <MobileSubItem label="Player History" onClick={() => handleTabClick('playerHistory')} />
                            <MobileSubItem label="Season Breakdown" onClick={() => handleTabClick('seasonBreakdown')} />
                            <MobileSubItem label="Finances" onClick={() => handleTabClick('financials')} />
                            <MobileSubItem label="Memes & Memories" onClick={() => handleTabClick('memesAndMemories')} />
                        </MobileDropdown>

                        <li>
                            <MobileNavButton
                                icon="👥"
                                label="Teams"
                                onClick={() => handleTabClick(NAV_CATEGORIES.TEAMS.tab)}
                                isActive={activeTab === NAV_CATEGORIES.TEAMS.tab}
                            />
                        </li>

                        <MobileDropdown
                            icon="📊"
                            label="Analysis"
                            isOpen={openSubMenu === 'analysis'}
                            onToggle={() => toggleSubMenu('analysis')}
                        >
                            <MobileSubItem label="Draft" onClick={() => handleTabClick('draftAnalysis')} />
                            <MobileSubItem label="DPR Analysis" onClick={() => handleTabClick('dprAnalysis')} />
                            <MobileSubItem label="Luck Rating" onClick={() => handleTabClick('luckRating')} />
                        </MobileDropdown>
                    </ul>

                    {/* Desktop nav — unchanged, passed to your existing DesktopNav */}
                    <DesktopNav
                        handleTabClick={handleTabClick}
                        handleSubTabClick={handleSubTabClick}
                        openSubMenu={openSubMenu}
                        toggleSubMenu={toggleSubMenu}
                        NAV_CATEGORIES={NAV_CATEGORIES}
                    />
                </div>
            </nav>

            {/* ── Main Content ─────────────────────────────────────────── */}
            <main className="flex-grow w-full max-w-6xl mx-auto p-3 sm:p-4 md:p-6 safe-area-bottom">
                <div className="mobile-scroll">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

const App = () => (
    <PasswordLock>
        <SleeperDataProvider>
            <AppContent />
        </SleeperDataProvider>
    </PasswordLock>
);

export default App;