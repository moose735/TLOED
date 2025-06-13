// src/lib/RecordBook.js
import React, { useState, useEffect, useCallback } from 'react';
import LeagueRecords from './LeagueRecords'; // Import the first sub-component

// Define internal tabs for the RecordBook
const RECORD_TABS = {
  LEAGUE_RECORDS: 'leagueRecords',
  SEASON_RECORDS: 'seasonRecords',
  MATCHUP_RECORDS: 'matchupRecords', // Placeholder for future
  VERSUS_RECORDS: 'versusRecords',   // Placeholder for future
  PLAYOFF_RECORDS: 'playoffRecords', // Placeholder for future
};

const RecordBook = ({ historicalMatchups, getDisplayTeamName }) => {
  const [activeRecordTab, setActiveRecordTab] = useState(RECORD_TABS.LEAGUE_RECORDS);

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

      {/* Conditional rendering of sub-components */}
      {activeRecordTab === RECORD_TABS.LEAGUE_RECORDS && (
        <LeagueRecords
          historicalMatchups={historicalMatchups}
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
    </div>
  );
};

export default RecordBook;
