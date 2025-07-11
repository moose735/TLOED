// src/components/YahooDataLoader.js
import React, { useState } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext'; // Import the context hook

const YahooDataLoader = () => {
    const { setYahooHistoricalData, loading: contextLoading } = useSleeperData();
    const [jsonData, setJsonData] = useState('');
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState(''); // 'success' or 'error'

    const handleLoadData = () => {
        if (!jsonData.trim()) {
            setMessage('Please paste your Yahoo league data in JSON format.');
            setMessageType('error');
            return;
        }

        try {
            const parsedData = JSON.parse(jsonData);

            // Basic validation: Ensure it's an object and contains expected season keys
            if (typeof parsedData !== 'object' || parsedData === null || Object.keys(parsedData).length === 0) {
                setMessage('Invalid JSON structure. Expected an object with season years as keys.');
                setMessageType('error');
                return;
            }

            // More specific validation for each season's data structure could be added here
            // For example, checking if each year's data contains 'matchups', 'rosters', etc.
            // This is crucial for ensuring compatibility with calculateAllLeagueMetrics

            setYahooHistoricalData(parsedData); // Send the parsed data to the context
            setMessage('Yahoo league data loaded successfully! The site will now re-calculate metrics.');
            setMessageType('success');
            setJsonData(''); // Clear the textarea on success
        } catch (e) {
            setMessage(`Error parsing JSON: ${e.message}. Please ensure your data is valid JSON.`);
            setMessageType('error');
        }
    };

    // Define the multi-line JSON example as a string
    const jsonExample = `{
  "2021": {
    "matchupsBySeason": {
      "1": [
        {
          "team1_roster_id": "1",
          "team1_score": 120.5,
          "team2_roster_id": "2",
          "team2_score": 110.2,
          "week": "1",
          "year": "2021",
          "regSeason": true
        }
        // ... more matchups for 2021
      ]
    },
    "rostersBySeason": [
      { "roster_id": "1", "owner_id": "yahoo_owner_id_1", "team_name": "Yahoo Team A" },
      { "roster_id": "2", "owner_id": "yahoo_owner_id_2", "team_name": "Yahoo Team B" }
      // ... more rosters for 2021
    ],
    "usersBySeason": [
        { "user_id": "yahoo_owner_id_1", "display_name": "Yahoo User 1" },
        { "user_id": "yahoo_owner_id_2", "display_name": "Yahoo User 2" }
    ],
    "leaguesMetadataBySeason": {
        "settings": { "playoff_start_week": 15 }
    },
    "winnersBracketBySeason": [],
    "losersBracketBySeason": []
  }
}`;

    return (
        <div className="w-full bg-white p-8 rounded-lg shadow-md mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-3 text-center">
                Import Yahoo League Data
            </h2>
            <p className="text-sm text-gray-600 mb-4 text-center">
                If you have historical league data from Yahoo (or another source) that cannot be pulled
                automatically, you can paste it here in JSON format.
            </p>
            <p className="text-sm text-gray-600 mb-6 text-center font-semibold">
                Please ensure your data is structured correctly, with years as top-level keys,
                and each year containing objects like `matchupsBySeason`, `rostersBySeason`, etc.
                Refer to the `historicalData` structure in the `SleeperDataContext` for guidance.
            </p>

            <textarea
                className="w-full p-4 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 mb-4 font-mono text-sm"
                rows="15"
                placeholder={`Paste your Yahoo JSON data here. Example:\n${jsonExample}`}
                value={jsonData}
                onChange={(e) => {
                    setJsonData(e.target.value);
                    setMessage(''); // Clear message on new input
                }}
                disabled={contextLoading}
            ></textarea>

            {message && (
                <div className={`p-3 rounded-md mb-4 ${messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {message}
                </div>
            )}

            <button
                onClick={handleLoadData}
                className={`w-full py-3 px-6 rounded-md text-lg font-semibold transition-colors duration-200
                    ${contextLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50'}`}
                disabled={contextLoading}
            >
                {contextLoading ? 'Loading Data...' : 'Load Yahoo Data'}
            </button>
        </div>
    );
};

export default YahooDataLoader;
