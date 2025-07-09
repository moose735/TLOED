// src/components/RecordBook.js
import React, { useState, useEffect } from 'react'; // Added useEffect for logging
import { useSleeperData } from '../contexts/SleeperDataContext';
import LeagueRecords from '../lib/LeagueRecords'; // Your existing component for Overall League Records
import SeasonRecords from '../lib/SeasonRecords'; // The component for Seasonal Records
import StreaksRecords from '../lib/StreaksRecords'; // NEW: Import the StreaksRecords component

// IMPORTANT: This import is absolutely crucial for calculateAllLeagueMetrics to be defined.
import { calculateAllLeagueMetrics } from '../utils/calculations';

const RecordBook = () => {
    // State to manage which tab is active: 'overall', 'seasonal', or 'streaks'
    const [activeTab, setActiveTab] = useState('overall'); // Default to 'overall'

    // Destructure all necessary data from the context
    const {
        historicalData,
        processedSeasonalRecords,
        getTeamName,
        isLoading: dataIsLoading,
        error: dataError
    } = useSleeperData();

    // Handle loading state
    if (dataIsLoading) {
        return <div className="text-center py-8 text-xl font-semibold">Loading league data...</div>;
    }

    // Handle error state
    if (dataError) {
        return <div className="text-center py-8 text-red-600">Error loading data: {dataError.message}</div>;
    }

    // Define flags for data availability for each tab
    const hasOverallData = historicalData && Object.keys(historicalData).length > 0 && historicalData.matchupsBySeason && Object.keys(historicalData.matchupsBySeason).length > 0;
    const hasSeasonalData = processedSeasonalRecords && Object.keys(processedSeasonalRecords).length > 0;
    // For streaks, we need historicalData.matchupsBySeason
    const hasStreaksData = historicalData && historicalData.matchupsBySeason && Object.keys(historicalData.matchupsBySeason).length > 0;


    // Display a general message if no data is available for *any* tab
    if (!hasOverallData && !hasSeasonalData && !hasStreaksData) {
        return <div className="text-center py-8 text-gray-600">No league data available. Please ensure your league ID is correct and data has been fetched.</div>;
    }

    // FIXED: Correctly flatten historicalMatchupsBySeason into a single array for StreaksRecords
    // The structure is historicalData.matchupsBySeason[year][week] = [matchup objects]
    const allHistoricalMatchupsFlat = [];
    if (historicalData?.matchupsBySeason) {
        for (const year in historicalData.matchupsBySeason) {
            const yearMatchups = historicalData.matchupsBySeason[year];
            if (yearMatchups) {
                for (const week in yearMatchups) {
                    const weekMatchups = yearMatchups[week];
                    if (Array.isArray(weekMatchups)) {
                        allHistoricalMatchupsFlat.push(...weekMatchups);
                    }
                }
            }
        }
    }

    // NEW: Log the flattened array before passing it to StreaksRecords
    useEffect(() => {
        console.log("RecordBook: allHistoricalMatchupsFlat for StreaksRecords:", allHistoricalMatchupsFlat);
        console.log("RecordBook: First 5 elements of allHistoricalMatchupsFlat:", allHistoricalMatchupsFlat.slice(0, 5));
        if (allHistoricalMatchupsFlat.length > 0) {
            console.log("RecordBook: Structure of first element in allHistoricalMatchupsFlat:", allHistoricalMatchupsFlat[0]);
        }
    }, [allHistoricalMatchupsFlat]);


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
                    {/* NEW TAB: Streaks Records */}
                    <li className="mr-2">
                        <button
                            className={`inline-block py-3 px-6 text-sm font-medium text-center rounded-t-lg border-b-2 ${
                                activeTab === 'streaks'
                                    ? 'text-blue-600 border-blue-600 active'
                                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                            }`}
                            onClick={() => setActiveTab('streaks')}
                            aria-current={activeTab === 'streaks' ? 'page' : undefined}
                        >
                            Streaks Records
                        </button>
                    </li>
                    {/* Add more tabs here if needed */}
                </ul>
            </nav>

            {/* Conditional Rendering of Tab Content */}
            <div className="tab-content">
                {activeTab === 'overall' && (
                    hasOverallData ? (
                        <LeagueRecords
                            historicalData={historicalData}
                            getTeamName={getTeamName}
                            calculateAllLeagueMetrics={calculateAllLeagueMetrics}
                        />
                    ) : (
                        <div className="text-center py-8 text-gray-600">No overall league data available.</div>
                    )
                )}

                {activeTab === 'seasonal' && (
                    hasSeasonalData ? (
                        <SeasonRecords />
                    ) : (
                        <div className="text-center py-8 text-gray-600">No seasonal data available for display.</div>
                    )
                )}

                {/* NEW: Streaks Records Content */}
                {activeTab === 'streaks' && (
                    hasStreaksData ? (
                        <StreaksRecords
                            historicalMatchups={allHistoricalMatchupsFlat} // Pass the correctly flattened array
                            // getDisplayTeamName is no longer needed as a prop since StreaksRecords uses useSleeperData
                        />
                    ) : (
                        <div className="text-center py-8 text-gray-600">No historical matchup data available to calculate streaks.</div>
                    )
                )}
            </div>
        </div>
    );
};

export default RecordBook;
