// src/components/MatchupHistory.js
import React, { useState, useEffect, useCallback } from 'react';
// No longer need to import fetchRostersWithDetails or CURRENT_LEAGUE_ID directly
// import { fetchRostersWithDetails } from '../utils/sleeperApi';
// import { CURRENT_LEAGUE_ID } from '../config';

// Import the custom hook from your SleeperDataContext
import { useSleeperData } from '../contexts/SleeperDataContext';

const MatchupHistory = () => {
    // Consume data and functions from SleeperDataContext
    const {
        loading,
        error,
        historicalData, // Contains matchupsBySeason, rostersBySeason, leaguesMetadataBySeason, etc.
        getTeamName,    // Utility function to get team display name from owner_id or roster_id
    } = useSleeperData();

    // State for the currently selected year in the dropdown
    const [selectedYear, setSelectedYear] = useState(null);

    // Effect to initialize selectedYear to the newest available year
    useEffect(() => {
        // Only proceed if historicalData is loaded and not in an error state
        if (!loading && !error && historicalData && Object.keys(historicalData.leaguesMetadataBySeason).length > 0) {
            const sortedYears = Object.keys(historicalData.leaguesMetadataBySeason).sort((a, b) => parseInt(b) - parseInt(a));
            if (sortedYears.length > 0 && selectedYear === null) {
                setSelectedYear(parseInt(sortedYears[0])); // Set to the newest year by default
            }
        }
    }, [historicalData, loading, error, selectedYear]); // selectedYear dependency prevents re-initializing if user changes it

    // Handle year selection from dropdown
    const handleYearChange = useCallback((event) => {
        setSelectedYear(parseInt(event.target.value));
    }, []);

    // Get all available years from the historical data, sorted descending
    const allAvailableYears = historicalData ? Object.keys(historicalData.leaguesMetadataBySeason).sort((a, b) => parseInt(b) - parseInt(a)) : [];

    // --- Render Logic ---
    // Display a loading spinner if primary data is loading or no year is selected yet
    if (loading || selectedYear === null) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-blue-600">
                <svg className="animate-spin h-10 w-10 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-lg font-medium">Loading matchup history and league data...</p>
            </div>
        );
    }

    // Display error messages if there's an issue with primary data
    if (error) {
        return (
            <div className="text-center text-red-600 p-4 bg-red-100 border border-red-400 rounded-md">
                <p className="font-semibold text-lg">Error loading Matchup History:</p>
                <p>{error.message || error}</p>
                <p className="mt-2 text-sm">Please check your Sleeper API configuration and network connection.</p>
            </div>
        );
    }

    // Display a message if no historical matchup data is available at all
    if (!historicalData || Object.keys(historicalData.leaguesMetadataBySeason).length === 0) {
        return (
            <div className="text-center p-4 bg-yellow-100 border border-yellow-400 rounded-md">
                <p className="text-lg font-medium text-yellow-800">No historical matchup data available from Sleeper API.</p>
                <p className="text-yellow-700 text-sm">This might mean the league ID is incorrect, or there's no data for previous seasons.</p>
            </div>
        );
    }

    // Get data for the currently selected year from historicalData
    const selectedYearMetadata = historicalData.leaguesMetadataBySeason[selectedYear];
    const weeksData = historicalData.matchupsBySeason[selectedYear];

    // Display a message if no matchup data is found for the specifically selected year
    if (!selectedYearMetadata || !weeksData || Object.keys(weeksData).length === 0) {
        return (
            <div className="text-center p-4 bg-orange-100 border border-orange-400 rounded-md">
                <p className="text-lg font-medium text-orange-800">No matchup data found for the selected {selectedYear} season.</p>
                <p className="text-orange-700 text-sm">Please select another year, or verify data for this season.</p>
                {/* Year dropdown still visible in this error state for user interaction */}
                <div className="flex justify-center mt-4">
                    <label htmlFor="year-select" className="mr-2 text-gray-700 font-medium">Select Season:</label>
                    <select
                        id="year-select"
                        value={selectedYear}
                        onChange={handleYearChange}
                        className="p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {allAvailableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
            </div>
        );
    }

    // Sort weeks numerically for display
    const sortedWeeks = Object.keys(weeksData).sort((a, b) => parseInt(a) - parseInt(b));

    return (
        <div className="container mx-auto p-4">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">Historical Matchup Data (Sleeper API)</h2>
            <p className="text-lg text-gray-700 mb-8 text-center max-w-2xl mx-auto">
                Select a season from the dropdown below to view its historical matchup data.
            </p>

            {/* Year Selection Dropdown */}
            <div className="flex justify-center mb-8">
                <label htmlFor="year-select" className="mr-2 text-gray-700 font-medium">Select Season:</label>
                <select
                    id="year-select"
                    value={selectedYear}
                    onChange={handleYearChange}
                    className="p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    {allAvailableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
            </div>

            {/* Display data for the selected year only */}
            <div key={selectedYear} className="bg-white shadow-lg rounded-xl p-6 mb-8 border border-gray-200">
                <h3 className="text-2xl font-bold text-blue-700 mb-5 border-b-2 border-blue-100 pb-3">Season: {selectedYear}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedWeeks.length > 0 ? (
                        sortedWeeks.map(week => (
                            <div key={`${selectedYear}-week-${week}`} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                                <h4 className="text-lg font-semibold text-gray-800 mb-3">Week {week}</h4>
                                {weeksData[week] && weeksData[week].length > 0 ? (
                                    <ul className="space-y-3">
                                        {/* Iterate directly over the processed matchup objects */}
                                        {weeksData[week].map((matchup, index) => (
                                            <li key={`matchup-${selectedYear}-${week}-${matchup.matchup_id}`} className="flex flex-col space-y-1 p-2 bg-white border border-gray-200 rounded-md shadow-sm">
                                                <div className="flex justify-between text-sm text-gray-700">
                                                    <span className="font-medium">
                                                        {/* Pass selectedYear to getTeamName for season-specific names */}
                                                        {getTeamName(matchup.team1_roster_id, selectedYear)}
                                                    </span>
                                                    <span className="font-bold text-blue-600">{matchup.team1_score ? matchup.team1_score.toFixed(2) : 'N/A'}</span>
                                                </div>
                                                <div className="flex justify-between text-sm text-gray-700">
                                                    <span className="font-medium">
                                                        {/* Pass selectedYear to getTeamName for season-specific names */}
                                                        {getTeamName(matchup.team2_roster_id, selectedYear)}
                                                    </span>
                                                    <span className="font-bold text-blue-600">{matchup.team2_score ? matchup.team2_score.toFixed(2) : 'N/A'}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    Winner: <strong>{matchup.winner_roster_id ? getTeamName(matchup.winner_roster_id, selectedYear) : 'Tie'}</strong>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-600 text-sm italic">No matchup data for this week.</p>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-600 italic col-span-full">No matchup data found for the selected season.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MatchupHistory;
