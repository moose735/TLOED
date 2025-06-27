import React, { useState, useEffect, useCallback } from 'react';
import { CURRENT_LEAGUE_ID } from './config'; // Fixed import
import { fetchAllHistoricalMatchups, fetchWinnersBracket, TEAM_NAME_TO_SLEEPER_ID_MAP, getTeamNameFromSleeperId, inferMatchupMetadata } from './utils/sleeperApi';
import PowerRankings from './lib/PowerRankings';
import LeagueHistory from './lib/LeagueHistory';
import RecordBook from './lib/RecordBook';
import DPRAnalysis from './lib/DPRAnalysis';
import LuckRatingAnalysis from './lib/LuckRatingAnalysis';
import TeamDetailPage from './lib/TeamDetailPage';
import Head2HeadGrid from './lib/Head2HeadGrid';
import FinancialTracker from './components/FinancialTracker';
import Dashboard from './components/Dashboard';

const NAV_CATEGORIES = {
  HOME: { label: 'Dashboard', tab: 'dashboard' },
  POWER_RANKINGS: { label: 'Power Rankings', tab: 'powerRankings' },
  LEAGUE_DATA: {
    label: 'League Data',
    subTabs: [
      { label: 'League History', tab: 'leagueHistory' },
      { label: 'Record Book', tab: 'recordBook' },
      { label: 'Head-to-Head', tab: 'headToHead' },
      { label: 'DPR Analysis', tab: 'dprAnalysis' },
      { label: 'Luck Rating', tab: 'luckRating' },
    ]
  },
  TEAMS: {
    label: 'Teams',
    subTabs: [],
  },
  FINANCIALS: { label: 'Financials', tab: 'financials' },
};

const TABS = {
  DASHBOARD: 'dashboard',
  POWER_RANKINGS: 'powerRankings',
  LEAGUE_HISTORY: 'leagueHistory',
  RECORD_BOOK: 'recordBook',
  HEAD_TO_HEAD: 'headToHead',
  DPR_ANALYSIS: 'dprAnalysis',
  LUCK_RATING: 'luckRating',
  TEAM_DETAIL: 'teamDetail',
  FINANCIALS: 'financials',
};

const App = () => {
  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [historicalMatchups, setHistoricalMatchups] = useState([]);
  const [historicalChampions, setHistoricalChampions] = useState([]);
  const [loadingHistoricalData, setLoadingHistoricalData] = useState(true);
  const [historicalDataError, setHistoricalDataError] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openSubMenu, setOpenSubMenu] = useState(null);

  const toggleSubMenu = (menuName) => {
    setOpenSubMenu(openSubMenu === menuName ? null : menuName);
  };

  const getMappedTeamName = useCallback((teamName) => {
    if (typeof teamName !== 'string' || !teamName) return '';
    return teamName.trim();
  }, []);

  useEffect(() => {
    const fetchHistoricalData = async () => {
      setLoadingHistoricalData(true);
      setHistoricalDataError(null);

      try {
        const allMatchups = await fetchAllHistoricalMatchups();
        if (!allMatchups || Object.keys(allMatchups).length === 0) {
          throw new Error('No historical matchup data available from Sleeper API');
        }

        // Transform Sleeper data to match Google Sheets format
        const flattenedMatchups = await Promise.all(
          Object.entries(allMatchups).flatMap(([year, weeks]) =>
            Object.entries(weeks).map(async ([week, matchups]) => {
              // Infer metadata for matchups
              const enrichedMatchups = await inferMatchupMetadata(matchups, CURRENT_LEAGUE_ID, year, week);
              // Group by matchup_id to pair teams
              const matchupGroups = {};
              enrichedMatchups.forEach(match => {
                if (!matchupGroups[match.matchup_id]) {
                  matchupGroups[match.matchup_id] = [];
                }
                matchupGroups[match.matchup_id].push(match);
              });

              return Object.values(matchupGroups).map(group => {
                const [team1Data, team2Data] = group.length === 2 ? group : [group[0], null];
                const team1 = team1Data ? getTeamNameFromSleeperId(team1Data.roster_id) : 'Unknown';
                const team2 = team2Data ? getTeamNameFromSleeperId(team2Data.roster_id) : 'Unknown';
                const team1Score = team1Data ? team1Data.points : 0;
                const team2Score = team2Data ? team2Data.points : 0;
                const winner = team1Score > team2Score ? team1 : team2Score > team1Score ? team2 : 'Tie';

                return {
                  year,
                  week,
                  team1,
                  team2,
                  team1Score,
                  team2Score,
                  winner,
                  regSeason: team1Data?.regSeason || false,
                  pointsOnlyBye: team1Data?.pointsOnlyBye || team2Data?.pointsOnlyBye || false,
                  playoffs: team1Data?.playoffs || team2Data?.playoffs || false,
                  finalSeedingGame: team1Data?.finalSeedingGame || team2Data?.finalSeedingGame || null,
                };
              });
            })
          )
        ).then(results => results.flat());

        setHistoricalMatchups(flattenedMatchups);
        console.log('Transformed historicalMatchups:', flattenedMatchups);

        // Populate team tabs
        const uniqueTeams = [...new Set(
          flattenedMatchups.flatMap(match => [match.team1, match.team2]).filter(Boolean)
        )].sort();
        NAV_CATEGORIES.TEAMS.subTabs = uniqueTeams.map(team => ({
          label: team,
          tab: TABS.TEAM_DETAIL,
          teamName: team,
        }));

        // Fetch champions from winners bracket
        const winners = await fetchWinnersBracket(CURRENT_LEAGUE_ID);
        const champions = winners
          .filter(match => match.r === 1) // Championship round
          .map(match => ({
            year: match.season || year,
            champion: getTeamNameFromSleeperId(match.w),
          }));
        setHistoricalChampions(champions.length > 0 ? champions : [
          { year: 2023, champion: "Mock Champion 2023" },
          { year: 2022, champion: "Mock Champion 2022" },
        ]);
      } catch (error) {
        console.error('Error fetching historical data from Sleeper API:', error);
        setHistoricalDataError('Failed to load league data from Sleeper API. Please check your network or API configuration.');
      } finally {
        setLoadingHistoricalData(false);
      }
    };

    fetchHistoricalData();
  }, [getMappedTeamName]);

  const handleTabChange = (tab, teamName = null) => {
    setActiveTab(tab);
    setSelectedTeam(teamName);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans antialiased text-gray-900 flex flex-col items-center">
      <header className="bg-white shadow-md py-4 px-6 flex justify-between items-center relative z-10 w-full">
        <div className="flex items-center">
          <h1 className="text-xl md:text-2xl font-bold text-blue-800">The League of Extraordinary Douchebags</h1>
        </div>
        <nav className="hidden md:flex items-center space-x-6">
          <button
            onClick={() => handleTabChange(TABS.DASHBOARD)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === TABS.DASHBOARD ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {NAV_CATEGORIES.HOME.label}
          </button>
          <button
            onClick={() => handleTabChange(TABS.POWER_RANKINGS)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === TABS.POWER_RANKINGS ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {NAV_CATEGORIES.POWER_RANKINGS.label}
          </button>
          <div className="relative group">
            <button className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none flex items-center transition-colors duration-200">
              {NAV_CATEGORIES.LEAGUE_DATA.label}
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20">
              {NAV_CATEGORIES.LEAGUE_DATA.subTabs.map((item) => (
                <button
                  key={item.tab}
                  onClick={() => handleTabChange(item.tab)}
                  className={`block w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${activeTab === item.tab ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {NAV_CATEGORIES.TEAMS.subTabs.length > 0 && (
            <div className="relative group">
              <button className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none flex items-center transition-colors duration-200">
                {NAV_CATEGORIES.TEAMS.label}
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 max-h-60 overflow-y-auto z-20">
                {NAV_CATEGORIES.TEAMS.subTabs.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleTabChange(item.tab, item.teamName)}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${selectedTeam === item.teamName && activeTab === TABS.TEAM_DETAIL ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => handleTabChange(TABS.FINANCIALS)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === TABS.FINANCIALS ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {NAV_CATEGORIES.FINANCIALS.label}
          </button>
        </nav>
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-gray-800 focus:outline-none p-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
            aria-label="Toggle mobile menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
            </svg>
          </button>
        </div>
      </header>
      {isMobileMenuOpen && (
        <div className={`fixed inset-0 bg-white z-50 overflow-y-auto p-4 md:hidden transform transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-gray-800 focus:outline-none p-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
              aria-label="Close mobile menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <nav className="flex flex-col space-y-4">
            <button
              onClick={() => handleTabChange(TABS.DASHBOARD)}
              className={`block w-full text-left py-3 px-4 text-lg font-semibold rounded-md transition-colors duration-200 ${activeTab === TABS.DASHBOARD ? 'bg-blue-100 text-blue-700' : 'text-gray-800 hover:bg-gray-100'}`}
            >
              {NAV_CATEGORIES.HOME.label}
            </button>
            <button
              onClick={() => handleTabChange(TABS.POWER_RANKINGS)}
              className={`block w-full text-left py-3 px-4 text-lg font-semibold rounded-md transition-colors duration-200 ${activeTab === TABS.POWER_RANKINGS ? 'bg-blue-100 text-blue-700' : 'text-gray-800 hover:bg-gray-100'}`}
            >
              {NAV_CATEGORIES.POWER_RANKINGS.label}
            </button>
            <div className="border-b border-gray-200 pb-2">
              <button
                className="flex justify-between items-center w-full py-3 px-4 text-lg font-semibold text-gray-800 hover:bg-gray-100 rounded-md transition-colors duration-200"
                onClick={() => toggleSubMenu('LEAGUE_DATA')}
              >
                {NAV_CATEGORIES.LEAGUE_DATA.label}
                <svg className={`w-5 h-5 transition-transform duration-200 ${openSubMenu === 'LEAGUE_DATA' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              {openSubMenu === 'LEAGUE_DATA' && (
                <ul className="pl-6 mt-2 space-y-2 transition-all duration-300 ease-in-out origin-top">
                  {NAV_CATEGORIES.LEAGUE_DATA.subTabs.map((subTab) => (
                    <li key={subTab.tab}>
                      <button
                        onClick={() => handleTabChange(subTab.tab)}
                        className={`block w-full text-left py-2 px-3 rounded-md text-base transition-colors duration-200 ${activeTab === subTab.tab ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        {subTab.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {NAV_CATEGORIES.TEAMS.subTabs.length > 0 && (
              <div className="border-b border-gray-200 pb-2">
                <button
                  className="flex justify-between items-center w-full py-3 px-4 text-lg font-semibold text-gray-800 hover:bg-gray-100 rounded-md transition-colors duration-200"
                  onClick={() => toggleSubMenu('TEAMS')}
                >
                  {NAV_CATEGORIES.TEAMS.label}
                  <svg className={`w-5 h-5 transition-transform duration-200 ${openSubMenu === 'TEAMS' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                {openSubMenu === 'TEAMS' && (
                  <ul className="pl-6 mt-2 space-y-2 transition-all duration-300 ease-in-out origin-top">
                    {NAV_CATEGORIES.TEAMS.subTabs.map((subTab) => (
                      <li key={subTab.label}>
                        <button
                          onClick={() => handleTabChange(subTab.tab, subTab.teamName)}
                          className={`block w-full text-left py-2 px-3 rounded-md text-base transition-colors duration-200 ${selectedTeam === subTab.teamName && activeTab === TABS.TEAM_DETAIL ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {subTab.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <button
              onClick={() => handleTabChange(TABS.FINANCIALS)}
              className={`block w-full text-left py-3 px-4 text-lg font-semibold rounded-md transition-colors duration-200 ${activeTab === TABS.FINANCIALS ? 'bg-blue-100 text-blue-700' : 'text-gray-800 hover:bg-gray-100'}`}
            >
              {NAV_CATEGORIES.FINANCIALS.label}
            </button>
          </nav>
        </div>
      )}
      <main className="flex-grow w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 mt-4">
        {loadingHistoricalData ? (
          <div className="flex flex-col items-center justify-center min-h-[200px] text-blue-600">
            <svg className="animate-spin h-10 w-10 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg font-medium">Loading league data...</p>
          </div>
        ) : historicalDataError ? (
          <p className="text-center text-red-600 text-lg">
            {historicalDataError}
          </p>
        ) : (
          <div className="w-full">
            {activeTab === TABS.DASHBOARD && (
              <Dashboard getDisplayTeamName={getMappedTeamName} />
            )}
            {activeTab === TABS.POWER_RANKINGS && (
              <PowerRankings
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.LEAGUE_HISTORY && (
              <LeagueHistory
                historicalMatchups={historicalMatchups}
                loading={loadingHistoricalData}
                error={historicalDataError}
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.RECORD_BOOK && (
              <RecordBook
                historicalMatchups={historicalMatchups}
                loading={loadingHistoricalData}
                error={historicalDataError}
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.HEAD_TO_HEAD && (
              <Head2HeadGrid
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.DPR_ANALYSIS && (
              <DPRAnalysis
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.LUCK_RATING && (
              <LuckRatingAnalysis
                historicalMatchups={historicalMatchups}
                getDisplayTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.TEAM_DETAIL && selectedTeam && (
              <TeamDetailPage
                teamName={selectedTeam}
                historicalMatchups={historicalMatchups}
                getMappedTeamName={getMappedTeamName}
              />
            )}
            {activeTab === TABS.FINANCIALS && (
              <FinancialTracker
                getDisplayTeamName={getMappedTeamName}
                historicalMatchups={historicalMatchups}
              />
            )}
          </div>
        )}
      </main>
      <footer className="mt-8 text-center text-gray-600 text-sm pb-8 px-4">
        <p>This site displays league data powered by the Sleeper API.</p>
        <p className="mt-2">
          For Sleeper API details, visit:{" "}
          <a href="https://docs.sleeper.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Sleeper API Documentation
          </a>
        </p>
      </footer>
    </div>
  );
};

export default App;
