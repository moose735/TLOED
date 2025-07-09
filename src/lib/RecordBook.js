// src/components/RecordBook.js
import React, { useState } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import LeagueRecords from '../lib/LeagueRecords'; // This component will display 'Overall League Records'
import SeasonRecords from '../lib/SeasonRecords'; // This component will display 'Seasonal Records'

// Import the calculation function if it's used directly in RecordBook,
// though typically it's handled within the context or sub-components.
// import { calculateAllLeagueMetrics } from '../utils/calculations';

const RecordBook = () => {
    // State to manage which tab is active: 'overall' or 'seasonal'
    const [activeTab, setActiveTab] = useState('overall'); // Default to 'overall'

    const {
        historicalData,
        processedSeasonalRecords, // We need this for the SeasonRecords component
        getTeamName,
        isLoading: dataIsLoading,
        error: dataError
    } = useSleeperData();

    if (dataIsLoading) {
        return <div className="text-center py-8 text-xl font-semibold">Loading league data...</div>;
    }

    if (dataError) {
        return <div className="text-center py-8 text-red-600">Error loading data: {dataError.message}</div>;
    }

    // Comprehensive check for essential data before rendering content
    const noOverallData = !historicalData || Object.keys(historicalData).length === 0 || !historicalData.matchupsBySeason || Object.keys(historicalData.matchupsBySeason).length === 0;
    const noSeasonalData = !processedSeasonalRecords || Object.keys(processedSeasonalRecords).length === 0;

    // Display a general message if no data is available for either tab
    if (noOverallData && noSeasonalData) {
        return <div className="text-center py-8 text-gray-600">No league data available. Please ensure your league ID is correct and data has been fetched.</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-6 text-center">League Record Book</h1>

            {/* Tab Navigation */}
            <nav className="mb-8 border-b border-gray-200">
                <ul className="flex flex-wrap -mb-px">
                    <li className="mr-2">
                        <button
                            className={`inline-block py-3 px-6 text-sm font-medium text-center rounded-t-lg border-b-2 ${
                                activeTab === 'overall'
                                    ? 'text-blue-600 border-blue-600 active'
                                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                            }`}
                            onClick={() => setActiveTab('overall')}
                            aria-current={activeTab === 'overall' ? 'page' : undefined}
                        >
                            Overall League Records
                        </button>
                    </li>
                    <li className="mr-2">
                        <button
                            className={`inline-block py-3 px-6 text-sm font-medium text-center rounded-t-lg border-b-2 ${
                                activeTab === 'seasonal'
                                    ? 'text-blue-600 border-blue-600 active'
                                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                            }`}
                            onClick={() => setActiveTab('seasonal')}
                            aria-current={activeTab === 'seasonal' ? 'page' : undefined}
                        >
                            Seasonal Records
                        </button>
                    </li>
                    {/* Add more tabs here if needed for Player Records, Draft Records, etc. */}
                </ul>
            </nav>

            {/* Conditional Rendering of Tab Content */}
            <div className="tab-content">
                {activeTab === 'overall' && (
                    noOverallData ? (
                        <div className="text-center py-8 text-gray-600">No overall league data available.</div>
                    ) : (
                        <LeagueRecords
                            historicalData={historicalData}
                            getTeamName={getTeamName}
                            // calculateAllLeagueMetrics is likely used within LeagueRecords,
                            // ensure it's imported there if needed or passed if it's a prop it expects
                            // calculateAllLeagueMetrics={calculateAllLeagueMetrics} // Uncomment if LeagueRecords needs it as a prop
                        />
                    )
                )}

                {activeTab === 'seasonal' && (
                    noSeasonalData ? (
                        <div className="text-center py-8 text-gray-600">No seasonal data available for display.</div>
                    ) : (
                        // SeasonRecords component already consumes processedSeasonalRecords from context
                        <SeasonRecords />
                    )
                )}
            </div>

            {/* You can add other record book sections here, e.g., Player Records, Draft Records */}
            {/* <PlayerRecords /> */}
            {/* <DraftRecords /> */}
        </div>
    );
};

export default RecordBook;
