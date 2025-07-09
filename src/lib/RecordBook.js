// src/lib/RecordBook.js
import React, { useState } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import the hook

import LeagueRecords from './LeagueRecords';
import SeasonRecords from './SeasonRecords';
import MatchupRecords from './MatchupRecords';
import VersusRecords from './VersusRecords';
import StreaksRecords from './StreaksRecords';
import PlayoffRecords from './PlayoffRecords';

// Define internal tabs for the RecordBook
const RECORD_TABS = {
    LEAGUE_RECORDS: 'leagueRecords',
    SEASON_RECORDS: 'seasonRecords',
    MATCHUP_RECORDS: 'matchupRecords',
    VERSUS_RECORDS: 'versusRecords',
    STREAKS_RECORDS: 'streaksRecords',
    PLAYOFF_RECORDS: 'playoffRecords',
};

// RecordBook component no longer accepts props directly from App.js
const RecordBook = () => {
    // Consume data from SleeperDataContext
    const {
        loading,
        error,
        historicalData, // This now contains matchupsBySeason, rostersBySeason, etc.
        getTeamName, // The Sleeper-aware version for displaying team names
        // Add any other data you might need here that's provided by the context
    } = useSleeperData();

    const [activeRecordTab, setActiveRecordTab] = useState(RECORD_TABS.LEAGUE_RECORDS);

    console.log("RecordBook: activeRecordTab is", activeRecordTab);

    // Conditional rendering based on loading/error states
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
                <div className="text-center p-6 bg-white rounded-lg shadow-md">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-lg font-semibold text-gray-700">Loading Record Book data...</p>
                    <p className="text-sm text-gray-500 mt-2">Fetching historical league information to compile records.</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
                <div className="text-center p-6 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-md">
                    <p className="font-bold text-xl mb-2">Error Loading Record Book</p>
                    <p className="text-base">Failed to load historical data: {error}</p>
                    <p className="text-sm mt-2">Please ensure your Sleeper API configuration is correct.</p>
                </div>
            </div>
        );
    }

    // Ensure historicalData.matchupsBySeason is available before rendering sub-components
    // This check is important as historicalData might be empty if the league has no past seasons or if initial fetch somehow failed silently for matchups
    if (!historicalData || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0) {
        return (
            <div className="w-full bg-white p-8 rounded-lg shadow-md mt-8">
                <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center border-b pb-2">
                    League Record Book
                </h2>
                <p className="text-center text-gray-600">
                    No historical matchup data found for the Record Book. This could mean your league has no past seasons or there was an issue fetching the data.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full bg-white p-8 rounded-lg shadow-md mt-8">
            <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center border-b pb-2">
                League Record Book
            </h2>

            {/* Internal Navigation Tabs for Record Book */}
            <nav className="w-full bg-gray-50 rounded-lg shadow-sm mb-6 p-2 flex flex-wrap justify-center space-x-2 md:space-x-4">
                <button
                    className={`px-4 py-2 rounded-md font-semibold text-md transition-colors ${
                        activeRecordTab === RECORD_TABS.LEAGUE_RECORDS
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    onClick={() => setActiveRecordTab(RECORD_TABS.LEAGUE_RECORDS)}
                >
                    League Records
                </button>
                <button
                    className={`px-4 py-2 rounded-md font-semibold text-md transition-colors ${
                        activeRecordTab === RECORD_TABS.SEASON_RECORDS
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    onClick={() => setActiveRecordTab(RECORD_TABS.SEASON_RECORDS)}
                >
                    Season Records
                </button>
                <button
                    className={`px-4 py-2 rounded-md font-semibold text-md transition-colors ${
                        activeRecordTab === RECORD_TABS.MATCHUP_RECORDS
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    onClick={() => setActiveRecordTab(RECORD_TABS.MATCHUP_RECORDS)}
                >
                    Matchup Records
                </button>
                <button
                    className={`px-4 py-2 rounded-md font-semibold text-md transition-colors ${
                        activeRecordTab === RECORD_TABS.VERSUS_RECORDS
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    onClick={() => setActiveRecordTab(RECORD_TABS.VERSUS_RECORDS)}
                >
                    Versus Records
                </button>
                <button
                    className={`px-4 py-2 rounded-md font-semibold text-md transition-colors ${
                        activeRecordTab === RECORD_TABS.STREAKS_RECORDS
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    onClick={() => setActiveRecordTab(RECORD_TABS.STREAKS_RECORDS)}
                >
                    Streaks Records
                </button>
                <button
                    className={`px-4 py-2 rounded-md font-semibold text-md transition-colors ${
                        activeRecordTab === RECORD_TABS.PLAYOFF_RECORDS
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    onClick={() => setActiveRecordTab(RECORD_TABS.PLAYOFF_RECORDS)}
                >
                    Playoff Records
                </button>
            </nav>

            <>
                {activeRecordTab === RECORD_TABS.LEAGUE_RECORDS && (
                    <LeagueRecords
                        historicalMatchups={historicalData.matchupsBySeason}
                        historicalRosters={historicalData.rostersBySeason} // Pass rosters for team name lookups
                        leaguesMetadata={historicalData.leaguesMetadataBySeason} // Pass league metadata for champion info
                        usersBySeason={historicalData.usersBySeason} // Pass users for more direct user info
                        getTeamName={getTeamName}
                    />
                )}
                {activeRecordTab === RECORD_TABS.SEASON_RECORDS && (
                    <SeasonRecords
                        historicalMatchups={historicalData.matchupsBySeason}
                        historicalRosters={historicalData.rostersBySeason}
                        getTeamName={getTeamName}
                    />
                )}
                {activeRecordTab === RECORD_TABS.MATCHUP_RECORDS && (
                    <MatchupRecords
                        historicalMatchups={historicalData.matchupsBySeason}
                        getTeamName={getTeamName}
                    />
                )}
                {activeRecordTab === RECORD_TABS.VERSUS_RECORDS && (
                    <VersusRecords
                        historicalMatchups={historicalData.matchupsBySeason}
                        getTeamName={getTeamName}
                    />
                )}
                {activeRecordTab === RECORD_TABS.STREAKS_RECORDS && (
                    <StreaksRecords
                        historicalMatchups={historicalData.matchupsBySeason}
                        getTeamName={getTeamName}
                    />
                )}
                {activeRecordTab === RECORD_TABS.PLAYOFF_RECORDS && (
                    <PlayoffRecords
                        historicalMatchups={historicalData.matchupsBySeason}
                        winnersBracketBySeason={historicalData.winnersBracketBySeason}
                        losersBracketBySeason={historicalData.losersBracketBySeason}
                        leaguesMetadata={historicalData.leaguesMetadataBySeason}
                        getTeamName={getTeamName}
                    />
                )}
            </>
        </div>
    );
};

export default RecordBook;
