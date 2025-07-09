// src/components/RecordBook.js
import React from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Corrected path to 'contexts'
import LeagueRecords from '../lib/LeagueRecords';
import SeasonRecords from '../lib/SeasonRecords'; // <--- NEW IMPORT
import { calculateAllLeagueMetrics } from '../utils/calculations'; // Import the calculation function

const RecordBook = () => {
    // You no longer need to pass calculateAllLeagueMetrics to LeagueRecords directly
    // since it's used internally by SleeperDataContext to populate historicalData.seasonalMetrics
    const { historicalData, getTeamName, isLoading: dataIsLoading, error: dataError } = useSleeperData();

    if (dataIsLoading) {
        return <div className="text-center py-8 text-xl font-semibold">Loading league data...</div>;
    }

    if (dataError) {
        return <div className="text-center py-8 text-red-600">Error loading data: {dataError.message}</div>;
    }

    // You might want to add a check for historicalData being empty here too
    if (!historicalData || Object.keys(historicalData).length === 0 || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0) {
        return <div className="text-center py-8 text-gray-600">No historical data available. Please ensure your league ID is correct and data has been fetched.</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-10 text-center">League Record Book</h1>

            {/* Pass the full historicalData object and the calculation function */}
            <LeagueRecords
                historicalData={historicalData}
                getTeamName={getTeamName}
                // calculateAllLeagueMetrics={calculateAllLeagueMetrics} // Not needed here anymore, as it's used internally by useSleeperData
            />

            {/* NEW: Render the SeasonRecords component */}
            <SeasonRecords
                historicalData={historicalData}
                getTeamName={getTeamName}
            />

            {/* You can add other record book sections here, e.g., Player Records, Draft Records */}
            {/* <PlayerRecords /> */}
            {/* <DraftRecords /> */}
        </div>
    );
};

export default RecordBook;
