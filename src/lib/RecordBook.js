// src/components/RecordBook.js
import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import LeagueRecords from '../lib/LeagueRecords';
import SeasonRecords from '../lib/SeasonRecords';
import StreaksRecords from '../lib/StreaksRecords';
import MatchupRecords from '../lib/MatchupRecords';
import PlayoffRecords from '../lib/PlayoffRecords'; // Import the PlayoffRecords component
import PlayerRecords from '../lib/PlayerRecords'; // Import the new PlayerRecords component
import MilestoneRecords from '../lib/MilestoneRecords'; // Import MilestoneRecords to expose milestones in Record Book

// IMPORTANT: This import is absolutely crucial for calculateAllLeagueMetrics to be defined.
import { calculateAllLeagueMetrics } from '../utils/calculations';

const RecordBook = () => {
    // State to manage which tab is active: 'overall', 'seasonal', 'streaks', 'matchup', 'playoffs', or 'players'
    const [activeTab, setActiveTab] = useState('overall'); // Default to 'overall'

    // Destructure all necessary data from the context
    const {
        historicalData,
        processedSeasonalRecords,
        getTeamName,
        loading: dataIsLoading,
        error: dataError
    } = useSleeperData();

    

    // Handle loading state
    if (dataIsLoading) {
        return (
            <div className="text-center py-8 text-xl font-semibold">
                Loading league data...
            </div>
        );
    }

    // Handle error state
    if (dataError) {
        return (
            <div className="text-center py-8 text-red-600">
                Error loading data: {dataError.message}
            </div>
        );
    }

    // Correctly flatten ALL historical matchups, including enriched bracket data, into a single array
    const allHistoricalMatchupsFlat = [];
    const processedMatchupIds = new Set(); // To prevent duplicates if a match appears in both raw and bracket data

    // 1. Add all regular season and raw playoff week matchups first
    if (historicalData?.matchupsBySeason) {
        for (const yearStr in historicalData.matchupsBySeason) {
            const year = parseInt(yearStr);
            // yearMatchupsArray is already a flat array of matchups for the year from SleeperDataContext
            const yearMatchupsArray = historicalData.matchupsBySeason[yearStr];
            if (Array.isArray(yearMatchupsArray)) { // Ensure it's an array
                yearMatchupsArray.forEach(match => {
                    // Use a unique identifier for the match (e.g., combination of matchup_id, season, week)
                    // Note: matchup_id might not be unique across seasons, so include year/week
                    const uniqueMatchId = `${match.matchup_id}-${match.season}-${match.week}-${match.team1_roster_id}-${match.team2_roster_id}`;
                    if (!processedMatchupIds.has(uniqueMatchId)) {
                        // Explicitly look up owner_id from the merged historicalData.rostersBySeason
                        const team1RosterId = String(match.team1_roster_id);
                        const team2RosterId = String(match.team2_roster_id);

                        const rosterForTeam1 = historicalData.rostersBySeason?.[yearStr]?.find(r => String(r.roster_id) === team1RosterId);
                        const rosterForTeam2 = historicalData.rostersBySeason?.[yearStr]?.find(r => String(r.roster_id) === team2RosterId);

                        const team1OwnerId = rosterForTeam1?.owner_id;
                        const team2OwnerId = rosterForTeam2?.owner_id;

                        allHistoricalMatchupsFlat.push({
                            ...match,
                            year: year, // Ensure year is a number
                            team1: getTeamName(team1OwnerId, year), // Pass year for historical name resolution
                            team2: getTeamName(team2OwnerId, year), // Pass year for historical name resolution
                            team1Score: match.team1_score,
                            team2Score: match.team2_score,
                            // Explicitly set playoff/finalSeedingGame to false/null for regular matches
                            playoffs: false,
                            finalSeedingGame: null,
                            isWinnersBracket: false, // Flag for winners bracket
                            isLosersBracket: false   // Flag for losers bracket
                        });
                        processedMatchupIds.add(uniqueMatchId);
                    }
                });
            }
        }
    }

    // 2. Now, add enriched winners bracket matches (these should have 'playoffs' and 'finalSeedingGame' flags)
    if (historicalData?.winnersBracketBySeason) {
        for (const yearStr in historicalData.winnersBracketBySeason) {
            const year = parseInt(yearStr);
            const bracketMatches = historicalData.winnersBracketBySeason[yearStr];
            if (Array.isArray(bracketMatches)) {
                bracketMatches.forEach(match => {
                    // Use a unique identifier for the match (e.g., combination of bracket match_id, season)
                    // Note: bracket match_id (m) is unique per bracket, but not across seasons, so include year
                    const uniqueBracketMatchId = `bracket-${match.m}-${yearStr}-${match.t1}-${match.t2}`; // Use match.t1 and match.t2
                    if (!processedMatchupIds.has(uniqueBracketMatchId)) {
                        // Explicitly look up owner_id from the merged historicalData.rostersBySeason
                        const team1RosterId = String(match.t1); // Correctly use match.t1
                        const team2RosterId = String(match.t2); // Correctly use match.t2

                        const rosterForTeam1 = historicalData.rostersBySeason?.[yearStr]?.find(r => String(r.roster_id) === team1RosterId);
                        const rosterForTeam2 = historicalData.rostersBySeason?.[yearStr]?.find(r => String(r.roster_id) === team2RosterId);

                        const team1OwnerId = rosterForTeam1?.owner_id;
                        const team2OwnerId = rosterForTeam2?.owner_id;

                        allHistoricalMatchupsFlat.push({
                            ...match,
                            // Map bracket properties to the expected format for PlayoffRecords
                            matchup_id: match.m, // Use bracket's match ID
                            season: yearStr,
                            week: match.week, // Use the correct 'week' from enriched bracket match
                            team1_roster_id: team1RosterId,
                            team1Score: match.t1_score,
                            team2_roster_id: team2RosterId,
                            team2Score: match.t2_score,
                            team1: getTeamName(team1OwnerId, year), // Pass year for historical name resolution
                            team2: getTeamName(team2OwnerId, year), // Pass year for historical name resolution
                            year: year, // Ensure year is a number
                            playoffs: match.playoffs || true, // Ensure it's true
                            finalSeedingGame: match.p || null, // Correctly map 'p' to finalSeedingGame
                            isWinnersBracket: true, // This match is from the winners bracket
                            isLosersBracket: false
                        });
                        processedMatchupIds.add(uniqueBracketMatchId);
                    }
                });
            }
        }
    }

    // 3. Add enriched losers bracket matches
    if (historicalData?.losersBracketBySeason) {
        for (const yearStr in historicalData.losersBracketBySeason) {
            const year = parseInt(yearStr);
            const bracketMatches = historicalData.losersBracketBySeason[yearStr];
            if (Array.isArray(bracketMatches)) {
                bracketMatches.forEach(match => {
                    const uniqueBracketMatchId = `bracket-loser-${match.m}-${yearStr}-${match.t1}-${match.t2}`; // Use match.t1 and match.t2
                    if (!processedMatchupIds.has(uniqueBracketMatchId)) {
                        // Explicitly look up owner_id from the merged historicalData.rostersBySeason
                        const team1RosterId = String(match.t1); // Correctly use match.t1
                        const team2RosterId = String(match.t2); // Correctly use match.t2

                        const rosterForTeam1 = historicalData.rostersBySeason?.[yearStr]?.find(r => String(r.roster_id) === team1RosterId);
                        const rosterForTeam2 = historicalData.rostersBySeason?.[yearStr]?.find(r => String(r.roster_id) === team2RosterId);

                        const team1OwnerId = rosterForTeam1?.owner_id;
                        const team2OwnerId = rosterForTeam2?.owner_id;

                        allHistoricalMatchupsFlat.push({
                            ...match,
                            matchup_id: match.m,
                            season: yearStr,
                            week: match.week, // Use the correct 'week' from enriched bracket match
                            team1_roster_id: team1RosterId,
                            team1Score: match.t1_score,
                            team2_roster_id: team2RosterId,
                            team2Score: match.t2_score,
                            team1: getTeamName(team1OwnerId, year), // Pass year for historical name resolution
                            team2: getTeamName(team2OwnerId, year), // Pass year for historical name resolution
                            year: year,
                            playoffs: match.playoffs || true,
                            finalSeedingGame: match.p || null, // Correctly map 'p' to finalSeedingGame
                            isWinnersBracket: false,
                            isLosersBracket: true
                        });
                        processedMatchupIds.add(uniqueBracketMatchId);
                    }
                });
            }
        }
    }

    // Define flags for data availability for each tab
    const hasOverallData = historicalData && Object.keys(historicalData).length > 0 && historicalData.matchupsBySeason && Object.keys(historicalData.matchupsBySeason).length > 0;
    const hasSeasonalData = processedSeasonalRecords && Object.keys(processedSeasonalRecords).length > 0;
    // Check if allHistoricalMatchupsFlat has data for streaks and matchups
    const hasStreaksAndMatchupData = allHistoricalMatchupsFlat.length > 0;
    const hasPlayoffData = historicalData && historicalData.winnersBracketBySeason && Object.keys(historicalData.winnersBracketBySeason).length > 0;


    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            <div className="container mx-auto px-4 py-12 max-w-7xl">
                {/* Header Section */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-black text-gray-900 mb-4 tracking-tight">
                        🏆 League Record Book
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Discover the greatest achievements and records in our league's history
                    </p>
                </div>

                {/* Modern Tab Navigation */}
                <div className="mb-10">
                    <div className="bg-white rounded-2xl shadow-lg p-2 border border-gray-200">
                        <nav className="flex flex-col sm:flex-row gap-2 sm:gap-1">
                            <button
                                className={`w-full sm:flex-1 py-3 px-4 sm:py-4 sm:px-6 text-sm font-semibold rounded-xl transition-all duration-200 ${
                                    activeTab === 'overall'
                                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                                onClick={() => setActiveTab('overall')}
                                aria-current={activeTab === 'overall' ? 'page' : undefined}
                            >
                                <span className="block text-center">Overall Records</span>
                                <span className="block text-xs opacity-80 mt-1">Career Leaders</span>
                            </button>
                            <button
                                className={`w-full sm:flex-1 py-3 px-4 sm:py-4 sm:px-6 text-sm font-semibold rounded-xl transition-all duration-200 ${
                                    activeTab === 'seasonal'
                                        ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                                onClick={() => setActiveTab('seasonal')}
                                aria-current={activeTab === 'seasonal' ? 'page' : undefined}
                            >
                                <span className="block text-center">Seasonal Records</span>
                                <span className="block text-xs opacity-80 mt-1">Single Season</span>
                            </button>
                            <button
                                className={`w-full sm:flex-1 py-3 px-4 sm:py-4 sm:px-6 text-sm font-semibold rounded-xl transition-all duration-200 ${
                                    activeTab === 'streaks'
                                        ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                                onClick={() => setActiveTab('streaks')}
                                aria-current={activeTab === 'streaks' ? 'page' : undefined}
                            >
                                <span className="block text-center">Streak Records</span>
                                <span className="block text-xs opacity-80 mt-1">Consecutive</span>
                            </button>
                            <button
                                className={`w-full sm:flex-1 py-3 px-4 sm:py-4 sm:px-6 text-sm font-semibold rounded-xl transition-all duration-200 ${
                                    activeTab === 'matchup'
                                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                                onClick={() => setActiveTab('matchup')}
                                aria-current={activeTab === 'matchup' ? 'page' : undefined}
                            >
                                <span className="block text-center">Game Records</span>
                                <span className="block text-xs opacity-80 mt-1">Single Game</span>
                            </button>
                            <button
                                className={`w-full sm:flex-1 py-3 px-4 sm:py-4 sm:px-6 text-sm font-semibold rounded-xl transition-all duration-200 ${
                                    activeTab === 'playoffs'
                                        ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                                onClick={() => setActiveTab('playoffs')}
                                aria-current={activeTab === 'playoffs' ? 'page' : undefined}
                            >
                                <span className="block text-center">Playoff Records</span>
                                <span className="block text-xs opacity-80 mt-1">Postseason</span>
                            </button>
                            <button
                                className={`w-full sm:flex-1 py-3 px-4 sm:py-4 sm:px-6 text-sm font-semibold rounded-xl transition-all duration-200 ${
                                    activeTab === 'players'
                                        ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                                onClick={() => setActiveTab('players')}
                                aria-current={activeTab === 'players' ? 'page' : undefined}
                            >
                                <span className="block text-center">Player Records</span>
                                <span className="block text-xs opacity-80 mt-1">Individual Stars</span>
                            </button>
                            <button
                                className={`w-full sm:flex-1 py-3 px-4 sm:py-4 sm:px-6 text-sm font-semibold rounded-xl transition-all duration-200 ${
                                    activeTab === 'milestones'
                                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                                onClick={() => setActiveTab('milestones')}
                                aria-current={activeTab === 'milestones' ? 'page' : undefined}
                            >
                                <span className="block text-center">Milestones</span>
                                <span className="block text-xs opacity-80 mt-1">Career Milestones</span>
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                    {activeTab === 'overall' && (
                        hasOverallData ? (
                            <LeagueRecords
                                historicalData={historicalData}
                                getTeamName={getTeamName}
                                calculateAllLeagueMetrics={calculateAllLeagueMetrics}
                            />
                        ) : (
                            <div className="text-center py-16 px-6">
                                <div className="text-6xl mb-4">📊</div>
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Overall Data</h3>
                                <p className="text-gray-500">No overall league data available yet.</p>
                            </div>
                        )
                    )}

                    

                    {activeTab === 'seasonal' && (
                        hasSeasonalData ? (
                            <SeasonRecords />
                        ) : (
                            <div className="text-center py-16 px-6">
                                <div className="text-6xl mb-4">📅</div>
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Seasonal Data</h3>
                                <p className="text-gray-500">No seasonal data available for display.</p>
                            </div>
                        )
                    )}

                    {activeTab === 'streaks' && (
                        hasStreaksAndMatchupData ? (
                            <StreaksRecords
                                historicalMatchups={allHistoricalMatchupsFlat} // Pass the correctly flattened array
                            />
                        ) : (
                            <div className="text-center py-16 px-6">
                                <div className="text-6xl mb-4">🔥</div>
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Streak Data</h3>
                                <p className="text-gray-500">No historical matchup data available to calculate streaks.</p>
                            </div>
                        )
                    )}

                    {activeTab === 'matchup' && (
                        hasStreaksAndMatchupData ? (
                            <MatchupRecords />
                        ) : (
                            <div className="text-center py-16 px-6">
                                <div className="text-6xl mb-4">⚔️</div>
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Matchup Data</h3>
                                <p className="text-gray-500">No historical matchup data available to calculate matchup records.</p>
                            </div>
                        )
                    )}

                    {activeTab === 'playoffs' && (
                        hasPlayoffData ? (
                            <PlayoffRecords
                                historicalMatchups={allHistoricalMatchupsFlat} // Pass the now fully flattened matchups
                                getDisplayTeamName={getTeamName} // Pass the team name resolver
                            />
                        ) : (
                            <div className="text-center py-16 px-6">
                                <div className="text-6xl mb-4">🏆</div>
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Playoff Data</h3>
                                <p className="text-gray-500">No historical playoff data available.</p>
                            </div>
                        )
                    )}

                    {activeTab === 'players' && (
                        historicalData ? (
                            <PlayerRecords />
                        ) : (
                            <div className="text-center py-16 px-6">
                                <div className="text-6xl mb-4">⭐</div>
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Player Data</h3>
                                <p className="text-gray-500">No historical player data available.</p>
                            </div>
                        )
                    )}

                    {activeTab === 'milestones' && (
                        historicalData ? (
                            <MilestoneRecords />
                        ) : (
                            <div className="text-center py-16 px-6">
                                <div className="text-6xl mb-4">🏆</div>
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Milestone Data</h3>
                                <p className="text-gray-500">No historical data available to compute milestones.</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecordBook;
