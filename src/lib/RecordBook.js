// src/components/RecordBook.js
import React from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import LeagueRecords from '../lib/LeagueRecords';
import SeasonRecords from '../lib/SeasonRecords'; // NEW IMPORT
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the calculation function

const RecordBook = () => {
    // LeagueRecords still needs calculateAllLeagueMetrics, historicalData, and getTeamName as props.
    // SeasonRecords now consumes processedSeasonalRecords and getTeamName directly from useSleeperData.
    const { historicalMatchups, getTeamName, isLoading: dataIsLoading, error: dataError } = useSleeperData();

    if (dataIsLoading) {
        return <div className="text-center py-8 text-xl font-semibold">Loading league data...</div>;
    }

    if (dataError) {
        return <div className="text-center py-8 text-red-600">Error loading data: {dataError.message}</div>;
    }

    // You might want to add a check for historicalMatchups being empty here too
    if (!historicalMatchups || Object.keys(historicalMatchups).length === 0 || !historicalMatchups.matchupsBySeason || Object.keys(historicalMatchups.matchupsBySeason).length === 0) {
        return <div className="text-center py-8 text-gray-600">No historical data available. Please ensure your league ID is correct and data has been fetched.</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-10 text-center">League Record Book</h1>

            {/* LeagueRecords displays all-time records */}
            <LeagueRecords
                historicalData={historicalMatchups} // Pass the raw historical data
                getTeamName={getTeamName}
                calculateAllLeagueMetrics={calculateAllLeagueMetrics} // Pass the function directly
            />

            {/* NEW: Render the SeasonRecords component */}
            {/* SeasonRecords now fetches its own data from context, so no props needed here */}
            <SeasonRecords />

            {/* You can add other record book sections here, e.g., Player Records, Draft Records */}
            {/* <PlayerRecords /> */}
            {/* <DraftRecords /> */}
        </div>
    );
};

export default RecordBook;
