// src/lib/RecordBook.js
import React, { useState } from 'react';
import LeagueRecords from './LeagueRecords';
import SeasonRecords from './SeasonRecords';
import MatchupRecords from './MatchupRecords';
import VersusRecords from './VersusRecords';
import StreaksRecords from './StreaksRecords';
import PlayoffRecords from './PlayoffRecords';
// DPRHistory import removed as it's being integrated into other components
// import DPRHistory from './DPRHistory'; 

// Define internal tabs for the RecordBook
const RECORD_TABS = {
  LEAGUE_RECORDS: 'leagueRecords',
  SEASON_RECORDS: 'seasonRecords',
  MATCHUP_RECORDS: 'matchupRecords',
  VERSUS_RECORDS: 'versusRecords',
  STREAKS_RECORDS: 'streaksRecords',
  PLAYOFF_RECORDS: 'playoffRecords',
  // DPR_HISTORY removed from tabs
};

const RecordBook = ({ historicalMatchups, loading, error, getDisplayTeamName }) => {
  const [activeRecordTab, setActiveRecordTab] = useState(RECORD_TABS.LEAGUE_RECORDS);

  console.log("RecordBook: activeRecordTab is", activeRecordTab);

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
            activeRecordTab === RECORD_TABS.STREAKS_RECORDS
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => setActiveRecordTab(RECORD_TABS.STREAKS_RECORDS)}
        >
          Streaks Records
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
        {/* DPR_HISTORY button removed */}
      </nav>

      {loading ? (
        <p className="text-center text-gray-600">Loading record book data...</p>
      ) : error ? (
        <p className="text-center text-red-500 font-semibold">{error}</p>
      ) : historicalMatchups.length === 0 ? (
        <p className="text-center text-gray-600">No historical matchup data found for the Record Book. Please check your Apps Script URL.</p>
      ) : (
        <>
          {activeRecordTab === RECORD_TABS.LEAGUE_RECORDS && (
            <LeagueRecords
              historicalMatchups={historicalMatchups}
              getDisplayTeamName={getDisplayTeamName}
            />
          )}
          {activeRecordTab === RECORD_TABS.SEASON_RECORDS && (
            <SeasonRecords
              historicalMatchups={historicalMatchups}
              getDisplayTeamName={getDisplayTeamName}
            />
          )}
          {activeRecordTab === RECORD_TABS.MATCHUP_RECORDS && (
            <MatchupRecords
              historicalMatchups={historicalMatchups}
              getDisplayTeamName={getDisplayTeamName}
            />
          )}
          {activeRecordTab === RECORD_TABS.VERSUS_RECORDS && (
            <VersusRecords
              historicalMatchups={historicalMatchups}
              getDisplayTeamName={getDisplayTeamName}
            />
          )}
          {activeRecordTab === RECORD_TABS.STREAKS_RECORDS && (
            <StreaksRecords
              historicalMatchups={historicalMatchups}
              getDisplayTeamName={getDisplayTeamName}
            />
          )}
          {activeRecordTab === RECORD_TABS.PLAYOFF_RECORDS && (
            <PlayoffRecords
              historicalMatchups={historicalMatchups}
              getDisplayTeamName={getDisplayTeamName}
            />
          )}
          {/* DPR_HISTORY component rendering removed */}
        </>
      )}
    </div>
  );
};

export default RecordBook;
