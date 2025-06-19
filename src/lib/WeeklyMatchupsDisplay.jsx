// TLOED/src/lib/WeeklyMatchupsDisplay.jsx
import React, { useState, useEffect, useMemo } from 'react';

const WeeklyMatchupsDisplay = () => {
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // The URL for your Google Apps Script Web App
  const JSON_DATA_URL = 'https://script.google.com/macros/s/AKfycbzCdSKv-pJSyewZWljTIlyacgb3hBqwthsKGQjCRD6-zJaqX5lbFvMRFckEG-Kb_cMf/exec';

  useEffect(() => {
    const fetchWeeklyData = async () => {
      try {
        const response = await fetch(JSON_DATA_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setWeeklyData(data);
      } catch (e) {
        console.error("Error fetching weekly data:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyData();
  }, []); // Empty dependency array means this effect runs once on mount

  // Memoize the processed weekly matchups to avoid re-calculating on every render
  const processedWeeklyMatchups = useMemo(() => {
    if (!weeklyData || weeklyData.length === 0) return {};

    const matchupsByWeek = {};
    const weekHeaders = Object.keys(weeklyData[0] || {}).filter(key => key.startsWith('Week_'));

    weekHeaders.forEach(weekKey => {
      const weekNumber = weekKey.replace('Week_', '');
      matchupsByWeek[`Week ${weekNumber}`] = [];
      const seenPairs = new Set(); // To avoid duplicate matchups (e.g., A vs B and B vs A)

      weeklyData.forEach(playerRow => {
        const player1 = playerRow.Player;
        const player2 = playerRow[weekKey]; // This is the opponent for player1 in this week

        if (player1 && player2 && player1 !== '' && player2 !== '') {
          // Create a canonical pair key (e.g., "Boilard-Randall" or "Randall-Boilard")
          // by sorting the names alphabetically to ensure uniqueness.
          const canonicalPair = [player1, player2].sort().join('-');

          if (!seenPairs.has(canonicalPair)) {
            matchupsByWeek[`Week ${weekNumber}`].push({ player1: player1, player2: player2 });
            seenPairs.add(canonicalPair);
          }
        }
      });
    });
    return matchupsByWeek;
  }, [weeklyData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <p className="text-xl font-semibold text-blue-600">Loading weekly matchups...</p>
          <div className="mt-4 flex justify-center">
            {/* Simple loading spinner */}
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-red-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center border-2 border-red-500">
          <p className="text-xl font-semibold text-red-700">Error loading data:</p>
          <p className="text-gray-600 mt-2">{error}</p>
          <p className="text-sm text-gray-500 mt-4">Please ensure the Google Apps Script is deployed as a web app with "Anyone" access.</p>
        </div>
      </div>
    );
  }

  // Check if processed data is empty after loading
  if (Object.keys(processedWeeklyMatchups).length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <p className="text-xl font-semibold text-gray-700">No weekly matchup data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-inter">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-4 sm:p-8 overflow-hidden">
        <h1 className="text-3xl sm:text-4xl font-bold text-center text-blue-800 mb-6 border-b-2 pb-4">
          Weekly Matchups
        </h1>

        <div className="space-y-8"> {/* Container for weekly sections */}
          {Object.entries(processedWeeklyMatchups).sort(([weekA], [weekB]) => {
            // Sort weeks numerically (e.g., "Week 1" before "Week 10")
            const numA = parseInt(weekA.replace('Week ', ''));
            const numB = parseInt(weekB.replace('Week ', ''));
            return numA - numB;
          }).map(([weekTitle, matchups], index) => (
            <div key={index} className="bg-blue-50 p-6 rounded-lg shadow-md border border-blue-200">
              <h2 className="text-2xl font-semibold text-blue-700 mb-4 border-b pb-2">
                {weekTitle} Matchups
              </h2>
              <ul className="list-disc list-inside space-y-2 text-gray-800">
                {matchups.length > 0 ? (
                  matchups.map((match, matchIndex) => (
                    <li key={matchIndex} className="text-lg">
                      <span className="font-medium text-purple-700">{match.player1}</span> plays <span className="font-medium text-green-700">{match.player2}</span>
                    </li>
                  ))
                ) : (
                  <p className="text-gray-600">No matchups for this week.</p>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeeklyMatchupsDisplay;
