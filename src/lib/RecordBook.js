// src/components/RecordBook.js
import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import LeagueRecords from '../lib/LeagueRecords';
import SeasonRecords from '../lib/SeasonRecords';
import StreaksRecords from '../lib/StreaksRecords';
import MatchupRecords from '../lib/MatchupRecords';
import PlayoffRecords from '../lib/PlayoffRecords';
import PlayerRecords from '../lib/PlayerRecords';
import MilestoneRecords from '../lib/MilestoneRecords';
// IMPORTANT: This import is absolutely crucial for calculateAllLeagueMetrics to be defined.
import { calculateAllLeagueMetrics } from '../utils/calculations';

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
    {
        id: 'overall',
        label: 'Overall',
        sub: 'Career Leaders',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
        activeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        dotClass: 'bg-blue-400',
    },
    {
        id: 'seasonal',
        label: 'Seasonal',
        sub: 'Single Season',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
        activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        dotClass: 'bg-emerald-400',
    },
    {
        id: 'streaks',
        label: 'Streaks',
        sub: 'Consecutive',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
        activeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        dotClass: 'bg-purple-400',
    },
    {
        id: 'matchup',
        label: 'Games',
        sub: 'Single Game',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        activeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
        dotClass: 'bg-orange-400',
    },
    {
        id: 'playoffs',
        label: 'Playoffs',
        sub: 'Postseason',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 3l14 9-14 9V3z" />
            </svg>
        ),
        activeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
        dotClass: 'bg-red-400',
    },
    {
        id: 'players',
        label: 'Players',
        sub: 'Individual Stars',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
        activeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        dotClass: 'bg-indigo-400',
    },
    {
        id: 'milestones',
        label: 'Milestones',
        sub: 'Career Milestones',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
        ),
        activeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
        dotClass: 'bg-yellow-400',
    },
];

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyState = ({ emoji, title, message }) => (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="text-5xl mb-4">{emoji}</div>
        <h3 className="text-base font-semibold text-gray-300 mb-1">{title}</h3>
        <p className="text-sm text-gray-600">{message}</p>
    </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const RecordBook = () => {
    const [activeTab, setActiveTab] = useState('overall');

    const {
        historicalData,
        processedSeasonalRecords,
        getTeamName,
        loading: dataIsLoading,
        error: dataError
    } = useSleeperData();

    // ── Loading ───────────────────────────────────────────────────────────────
    if (dataIsLoading) {
        return (
            <div className="flex items-center justify-center min-h-[240px]">
                <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-gray-400 animate-pulse">Loading league data…</p>
                </div>
            </div>
        );
    }

    // ── Error ─────────────────────────────────────────────────────────────────
    if (dataError) {
        return (
            <div className="flex items-center justify-center min-h-[160px]">
                <p className="text-sm text-red-400">Error loading data: {dataError.message}</p>
            </div>
        );
    }

    // ── Data flattening (logic untouched) ─────────────────────────────────────
    const allHistoricalMatchupsFlat = [];
    const processedMatchupIds = new Set();

    if (historicalData?.matchupsBySeason) {
        for (const yearStr in historicalData.matchupsBySeason) {
            const year = parseInt(yearStr);
            const yearMatchupsArray = historicalData.matchupsBySeason[yearStr];
            if (Array.isArray(yearMatchupsArray)) {
                yearMatchupsArray.forEach(match => {
                    const uniqueMatchId = `${match.matchup_id}-${match.season}-${match.week}-${match.team1_roster_id}-${match.team2_roster_id}`;
                    if (!processedMatchupIds.has(uniqueMatchId)) {
                        const team1RosterId = String(match.team1_roster_id);
                        const team2RosterId = String(match.team2_roster_id);
                        const rosterForTeam1 = historicalData.rostersBySeason?.[yearStr]?.find(r => String(r.roster_id) === team1RosterId);
                        const rosterForTeam2 = historicalData.rostersBySeason?.[yearStr]?.find(r => String(r.roster_id) === team2RosterId);
                        const team1OwnerId = rosterForTeam1?.owner_id;
                        const team2OwnerId = rosterForTeam2?.owner_id;
                        allHistoricalMatchupsFlat.push({
                            ...match,
                            year: year,
                            team1: getTeamName(team1OwnerId, year),
                            team2: getTeamName(team2OwnerId, year),
                            team1Score: match.team1_score,
                            team2Score: match.team2_score,
                            playoffs: false,
                            finalSeedingGame: null,
                            isWinnersBracket: false,
                            isLosersBracket: false
                        });
                        processedMatchupIds.add(uniqueMatchId);
                    }
                });
            }
        }
    }

    if (historicalData?.winnersBracketBySeason) {
        for (const yearStr in historicalData.winnersBracketBySeason) {
            const year = parseInt(yearStr);
            const bracketMatches = historicalData.winnersBracketBySeason[yearStr];
            if (Array.isArray(bracketMatches)) {
                bracketMatches.forEach(match => {
                    const uniqueBracketMatchId = `bracket-${match.m}-${yearStr}-${match.t1}-${match.t2}`;
                    if (!processedMatchupIds.has(uniqueBracketMatchId)) {
                        const team1RosterId = String(match.t1);
                        const team2RosterId = String(match.t2);
                        const rosterForTeam1 = historicalData.rostersBySeason?.[yearStr]?.find(r => String(r.roster_id) === team1RosterId);
                        const rosterForTeam2 = historicalData.rostersBySeason?.[yearStr]?.find(r => String(r.roster_id) === team2RosterId);
                        const team1OwnerId = rosterForTeam1?.owner_id;
                        const team2OwnerId = rosterForTeam2?.owner_id;
                        allHistoricalMatchupsFlat.push({
                            ...match,
                            matchup_id: match.m,
                            season: yearStr,
                            week: match.week,
                            team1_roster_id: team1RosterId,
                            team1Score: match.t1_score,
                            team2_roster_id: team2RosterId,
                            team2Score: match.t2_score,
                            team1: getTeamName(team1OwnerId, year),
                            team2: getTeamName(team2OwnerId, year),
                            year: year,
                            playoffs: match.playoffs || true,
                            finalSeedingGame: match.p || null,
                            isWinnersBracket: true,
                            isLosersBracket: false
                        });
                        processedMatchupIds.add(uniqueBracketMatchId);
                    }
                });
            }
        }
    }

    if (historicalData?.losersBracketBySeason) {
        for (const yearStr in historicalData.losersBracketBySeason) {
            const year = parseInt(yearStr);
            const bracketMatches = historicalData.losersBracketBySeason[yearStr];
            if (Array.isArray(bracketMatches)) {
                bracketMatches.forEach(match => {
                    const uniqueBracketMatchId = `bracket-loser-${match.m}-${yearStr}-${match.t1}-${match.t2}`;
                    if (!processedMatchupIds.has(uniqueBracketMatchId)) {
                        const team1RosterId = String(match.t1);
                        const team2RosterId = String(match.t2);
                        const rosterForTeam1 = historicalData.rostersBySeason?.[yearStr]?.find(r => String(r.roster_id) === team1RosterId);
                        const rosterForTeam2 = historicalData.rostersBySeason?.[yearStr]?.find(r => String(r.roster_id) === team2RosterId);
                        const team1OwnerId = rosterForTeam1?.owner_id;
                        const team2OwnerId = rosterForTeam2?.owner_id;
                        allHistoricalMatchupsFlat.push({
                            ...match,
                            matchup_id: match.m,
                            season: yearStr,
                            week: match.week,
                            team1_roster_id: team1RosterId,
                            team1Score: match.t1_score,
                            team2_roster_id: team2RosterId,
                            team2Score: match.t2_score,
                            team1: getTeamName(team1OwnerId, year),
                            team2: getTeamName(team2OwnerId, year),
                            year: year,
                            playoffs: match.playoffs || true,
                            finalSeedingGame: match.p || null,
                            isWinnersBracket: false,
                            isLosersBracket: true
                        });
                        processedMatchupIds.add(uniqueBracketMatchId);
                    }
                });
            }
        }
    }

    // ── Availability flags (logic untouched) ──────────────────────────────────
    const hasOverallData = historicalData && Object.keys(historicalData).length > 0
        && historicalData.matchupsBySeason
        && Object.keys(historicalData.matchupsBySeason).length > 0;
    const hasSeasonalData = processedSeasonalRecords && Object.keys(processedSeasonalRecords).length > 0;
    const hasStreaksAndMatchupData = allHistoricalMatchupsFlat.length > 0;
    const hasPlayoffData = historicalData
        && historicalData.winnersBracketBySeason
        && Object.keys(historicalData.winnersBracketBySeason).length > 0;

    // ── Active tab meta ───────────────────────────────────────────────────────
    const activeTabMeta = TABS.find(t => t.id === activeTab);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="w-full space-y-4 pb-6">

            {/* ── Page header ── */}
            <div className="flex items-center gap-3 px-1 pt-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-yellow-500/15 border border-yellow-500/25 flex-shrink-0">
                    <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-base font-bold text-white leading-tight">League Record Book</h1>
                    <p className="text-[10px] text-gray-500 mt-0.5">Greatest achievements in league history</p>
                </div>
            </div>

            {/* ── Tab strip ── */}
            <div className="bg-gray-800 border border-white/10 rounded-xl p-1.5 overflow-x-auto">
                <nav className="flex gap-1 min-w-max sm:min-w-0 sm:grid sm:grid-cols-7">
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                aria-current={isActive ? 'page' : undefined}
                                className={`
                                    flex flex-col items-center justify-center gap-1
                                    px-3 py-2.5 rounded-lg text-center
                                    transition-all duration-150 select-none
                                    border
                                    ${isActive
                                        ? `${tab.activeClass} shadow-sm`
                                        : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                    }
                                `}
                            >
                                <span className={`${isActive ? '' : 'opacity-60'}`}>{tab.icon}</span>
                                <span className="text-[11px] font-semibold leading-none whitespace-nowrap">{tab.label}</span>
                                <span className={`text-[9px] leading-none whitespace-nowrap hidden sm:block ${isActive ? 'opacity-70' : 'opacity-0'}`}>
                                    {tab.sub}
                                </span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* ── Active tab label (mobile) ── */}
            <div className="flex items-center gap-2 px-1 sm:hidden">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${activeTabMeta?.dotClass}`} />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {activeTabMeta?.label}
                </span>
                <span className="text-xs text-gray-600">— {activeTabMeta?.sub}</span>
            </div>

            {/* ── Content card ── */}
            <div className="bg-gray-800 border border-white/10 rounded-xl overflow-hidden">

                {activeTab === 'overall' && (
                    hasOverallData ? (
                        <LeagueRecords
                            historicalData={historicalData}
                            getTeamName={getTeamName}
                            calculateAllLeagueMetrics={calculateAllLeagueMetrics}
                        />
                    ) : (
                        <EmptyState emoji="📊" title="No Overall Data" message="No overall league data available yet." />
                    )
                )}

                {activeTab === 'seasonal' && (
                    hasSeasonalData ? (
                        <SeasonRecords />
                    ) : (
                        <EmptyState emoji="📅" title="No Seasonal Data" message="No seasonal data available for display." />
                    )
                )}

                {activeTab === 'streaks' && (
                    hasStreaksAndMatchupData ? (
                        <StreaksRecords historicalMatchups={allHistoricalMatchupsFlat} />
                    ) : (
                        <EmptyState emoji="🔥" title="No Streak Data" message="No historical matchup data available to calculate streaks." />
                    )
                )}

                {activeTab === 'matchup' && (
                    hasStreaksAndMatchupData ? (
                        <MatchupRecords />
                    ) : (
                        <EmptyState emoji="⚔️" title="No Matchup Data" message="No historical matchup data available to calculate matchup records." />
                    )
                )}

                {activeTab === 'playoffs' && (
                    hasPlayoffData ? (
                        <PlayoffRecords
                            historicalMatchups={allHistoricalMatchupsFlat}
                            getDisplayTeamName={getTeamName}
                        />
                    ) : (
                        <EmptyState emoji="🏆" title="No Playoff Data" message="No historical playoff data available." />
                    )
                )}

                {activeTab === 'players' && (
                    historicalData ? (
                        <PlayerRecords />
                    ) : (
                        <EmptyState emoji="⭐" title="No Player Data" message="No historical player data available." />
                    )
                )}

                {activeTab === 'milestones' && (
                    historicalData ? (
                        <MilestoneRecords />
                    ) : (
                        <EmptyState emoji="🏅" title="No Milestone Data" message="No historical data available to compute milestones." />
                    )
                )}

            </div>
        </div>
    );
};

export default RecordBook;