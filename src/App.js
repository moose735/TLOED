// App.js
import React, { useState, useEffect } from 'react';
// Import your configuration variables from config.js
import { GOOGLE_SHEET_POWER_RANKINGS_API_URL } from './config';

const App = () => {
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
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      {/* Tailwind CSS CDN for styling */}
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />

      <header className="w-full max-w-4xl bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-xl shadow-lg mb-8 text-center">
        <h1 className="text-4xl font-extrabold mb-2">Fantasy League Power Rankings</h1>
        <p className="text-xl">Your current league standings and power analysis</p>
      </header>

      <main className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md">
        {loading ? (
          // Display loading message
          <p className="text-center text-gray-600">Loading power rankings...</p>
        ) : error ? (
          // Display error message if there's an error
          <p className="text-center text-red-500 font-semibold">{error}</p>
        ) : powerRankings.length > 0 ? (
          // Display the table if data is available
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-blue-100">
                <tr>
                  {/* Dynamically render table headers from the first data object's keys */}
                  {Object.keys(powerRankings[0]).map((headerKey) => (
                    <th key={headerKey} className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">
                      {/* Convert snake_case or camelCase headers to more readable format */}
                      {headerKey.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Map through powerRankings data to render table rows */}
                {powerRankings.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    {/* Map through each value in the row */}
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
          // Message if no data is available after loading
          <p className="text-center text-gray-600">No power rankings data found. Please ensure your Google Sheet has data.</p>
        )}
      </main>

      <footer className="mt-8 text-center text-gray-600 text-sm pb-8">
        <p>This data is fetched from your Google Sheet via Google Apps Script.</p>
        <p className="mt-2">
          Make sure your Apps Script is deployed as a Web App with access set to "Anyone".
          <br />
          For Apps Script deployment instructions, visit:{" "}
          <a href="https://developers.google.com/apps-script/guides/web" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Google Apps Script Web Apps Guide
          </a>
        </p>
      </footer>
    </div>
  );
};

export default App;
