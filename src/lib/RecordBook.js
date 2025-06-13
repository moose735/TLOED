// src/lib/RecordBook.js
import React, { useState, useEffect, useCallback } from 'react';
import LeagueRecords from './LeagueRecords';
import { HISTORICAL_MATCHUPS_API_URL } from '../config'; // Import the URL for fetching

// Define internal tabs for the RecordBook
const RECORD_TABS = {
  LEAGUE_RECORDS: 'leagueRecords',
  SEASON_RECORDS: 'seasonRecords',
  MATCHUP_RECORDS: 'matchupRecords',
  VERSUS_RECORDS: 'versusRecords',
  PLAYOFF_RECORDS: 'playoffRecords',
};

const RecordBook = ({ getDisplayTeamName }) => { // Removed historicalMatchups from props, will fetch here
  const [activeRecordTab, setActiveRecordTab] = useState(RECORD_TABS.LEAGUE_RECORDS);
  const [historicalMatchups, setHistoricalMatchups] = useState([]); // New state for fetched data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Data Fetching (Moved from MatchupHistory to RecordBook) ---
  useEffect(() => {
    const fetchMatchups = async () => {
      if (HISTORICAL_MATCHUPS_API_URL === 'YOUR_NEW_HISTORICAL_MATCHUPS_APPS_SCRIPT_URL' || !HISTORICAL_MATCHUPS_API_URL) {
        setLoading(false);
        setError("Please update HISTORICAL_MATCHUPS_API_URL in config.js with your actual Apps Script URL for historical matchups.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(HISTORICAL_MATCHUPS_API_URL, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}. Response: ${await response.text()}.`);
        }
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        setHistoricalMatchups(Array.isArray(data.data) ? data.data : []);
      } catch (err) {
        console.error("Error fetching historical matchups in RecordBook:", err);
        setError(
          `Failed to fetch historical matchups: ${err.message}. ` +
          `Ensure your Apps Script URL (${HISTORICAL_MATCHUPS_API_URL}) is correct and publicly accessible.`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMatchups();
  }, [HISTORICAL_MATCHUPS_API_URL]);


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
            activeRecordTab === RECORD_TABS.PLAYOFF_RECORDS
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => setActiveRecordTab(RECORD_TABS.PLAYOFF_RECORDS)}
        >
          Playoff Records
        </button>
      </nav>

      {loading ? (
        <p className="text-center text-gray-600">Loading record book data...</p>
      ) : error ? (
        <p className="text-center text-red-500 font-semibold">{error}</p>
      ) : historicalMatchups.length === 0 ? (
        <p className="text-center text-gray-600">No historical matchup data found for the Record Book. Please check your Apps Script URL.</p>
      ) : (
        <>
          {/* Conditional rendering of sub-components */}
          {activeRecordTab === RECORD_TABS.LEAGUE_RECORDS && (
            <LeagueRecords
              historicalMatchups={historicalMatchups} // Pass fetched data
              getDisplayTeamName={getDisplayTeamName}
            />
          )}
          {activeRecordTab === RECORD_TABS.SEASON_RECORDS && (
            <div className="p-4 text-center text-gray-600">Season Records content will go here.</div>
          )}
          {activeRecordTab === RECORD_TABS.MATCHUP_RECORDS && (
            <div className="p-4 text-center text-gray-600">Matchup Records content will go here.</div>
          )}
          {activeRecordTab === RECORD_TABS.VERSUS_RECORDS && (
            <div className="p-4 text-center text-gray-600">Versus Records content will go here.</div>
          )}
          {activeRecordTab === RECORD_TABS.PLAYOFF_RECORDS && (
            <div className="p-4 text-center text-gray-600">Playoff Records content will go here.</div>
          )}
        </>
      )}
    </div>
  );
};

export default RecordBook;
