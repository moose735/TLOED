// PowerRankings.js
import React, { useState, useEffect } from 'react';
// Import your configuration variables from config.js (assuming config.js is in the parent directory)
import { GOOGLE_SHEET_POWER_RANKINGS_API_URL } from './config';

const PowerRankings = () => {
  // State to hold the power rankings data
  const [powerRankings, setPowerRankings] = useState([]);
  // State to manage loading status
  const [loading, setLoading] = useState(true);
  // State to manage any errors during data fetching
  const [error, setError] = useState(null);

  // useEffect hook to fetch data when the component mounts
  useEffect(() => {
    const fetchPowerRankings = async () => {
      // Display a loading message if the URL is still a placeholder
      if (GOOGLE_SHEET_POWER_RANKINGS_API_URL === 'YOUR_GOOGLE_SHEET_POWER_RANKINGS_API_URL') {
        setLoading(false);
        setError("Please update GOOGLE_SHEET_POWER_RANKINGS_API_URL in config.js with your actual Apps Script URL.");
        return;
      }

      setLoading(true); // Set loading to true before fetching
      setError(null);   // Clear any previous errors

      try {
        // Fetch data from the Google Apps Script URL
        // Using `mode: 'cors'` is important for cross-origin requests from web apps
        const response = await fetch(GOOGLE_SHEET_POWER_RANKINGS_API_URL, { mode: 'cors' });

        // Check if the HTTP response was successful
        if (!response.ok) {
          // If not successful, throw an error with the status and response text
          throw new Error(`HTTP error! Status: ${response.status}. Response: ${await response.text()}.`);
        }

        // Parse the JSON response
        const data = await response.json();

        // Check if the API response itself contains an error
        if (data.error) {
          throw new Error(data.error);
        }

        // Assuming the Apps Script returns data in the format { data: [...] }
        // Ensure data.data is an array before setting it to state
        setPowerRankings(Array.isArray(data.data) ? data.data : []);

      } catch (err) {
        console.error("Error fetching power rankings:", err);
        setError(
          `Failed to fetch power rankings: ${err.message}. ` +
          `Please ensure your Google Apps Script URL is correct and publicly accessible. ` +
          `You can try opening the URL (${GOOGLE_SHEET_POWER_RANKINGS_API_URL}) directly in your browser. ` +
          `If it doesn't show JSON data, there's an issue with your Apps Script deployment or code (check Apps Script 'Executions' logs!).`
        );
      } finally {
        setLoading(false); // Set loading to false after fetch attempt
      }
    };

    fetchPowerRankings(); // Call the fetch function
  }, [GOOGLE_SHEET_POWER_RANKINGS_API_URL]); // Dependency array: re-run if URL changes

  return (
    <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">Current Power Rankings</h2>
      {loading ? (
        <p className="text-center text-gray-600">Loading power rankings...</p>
      ) : error ? (
        <p className="text-center text-red-500 font-semibold">{error}</p>
      ) : powerRankings.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
            <thead className="bg-blue-100">
              <tr>
                {Object.keys(powerRankings[0]).map((headerKey) => (
                  <th key={headerKey} className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">
                    {headerKey.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {powerRankings.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  {Object.values(row).map((cellValue, cellIndex) => (
                    <td key={cellIndex} className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                      {cellValue}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-gray-600">No power rankings data found. Please ensure your Google Sheet has data.</p>
      )}
      <p className="mt-4 text-sm text-gray-500 text-center">
        This data is fetched from your Google Sheet via Google Apps Script.
      </p>
    </div>
  );
};

export default PowerRankings;
