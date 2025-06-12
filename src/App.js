import React, { useState } from 'react';
import Header from './components/Header';
import TeamTicker from './components/TeamTicker';
import Navbar from './components/Navbar';
import TradeTicker from './components/TradeTicker';
import OddsSection from './components/OddsSection';
import BracketSection from './components/BracketSection';
import HistoryTable from './components/HistoryTable';
import ChampionsSection from './components/ChampionsSection';
import Footer from './components/Footer';
import useLeagueData from './hooks/useLeagueData';
import { NAV_CATEGORIES, TABS } from './utils/constants';
import { getMappedTeamName, renderTradeAsset } from './utils/helpers'; // Import these

const App = () => {
  const [activeTab, setActiveTab] = useState(TABS.TRADES); // Default to TRADES
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Use a single custom hook to fetch all necessary data
  const {
    sleeperLeagueData,
    leagueManagers,
    recentTrades,
    loadingTrades,
    errorTrades,
    weeklyOddsData,
    currentOddsWeek,
    totalOddsWeeks,
    setCurrentOddsWeek,
    loadingOdds,
    errorOdds,
    bracketData,
    loadingBracket,
    errorBracket,
    googleSheetHistory,
    loadingGoogleSheet,
    errorGoogleSheet,
    historicalChampions,
    loadingChampions,
    errorChampions,
  } = useLeagueData(); // This custom hook will contain all your API calls and data states

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      {/* Header Section */}
      <Header sleeperLeagueData={sleeperLeagueData} />

      {/* New Team Ticker */}
      <TeamTicker leagueManagers={leagueManagers} getMappedTeamName={getMappedTeamName} />

      {/* Dropdown Navigation */}
      <Navbar
        NAV_CATEGORIES={NAV_CATEGORIES}
        activeDropdown={activeDropdown}
        setActiveDropdown={setActiveDropdown}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <div className="content-container">
        {activeTab === TABS.TRADES && (
          <TradeTicker
            recentTrades={recentTrades}
            loadingTrades={loadingTrades}
            errorTrades={errorTrades}
            getMappedTeamName={getMappedTeamName}
            renderTradeAsset={renderTradeAsset}
          />
        )}

        {activeTab === TABS.ODDS && (
          <OddsSection
            weeklyOddsData={weeklyOddsData}
            currentOddsWeek={currentOddsWeek}
            totalOddsWeeks={totalOddsWeeks}
            setCurrentOddsWeek={setCurrentOddsWeek}
            loadingOdds={loadingOdds}
            errorOdds={errorOdds}
            getMappedTeamName={getMappedTeamName}
          />
        )}

        {activeTab === TABS.BRACKET && (
          <BracketSection
            bracketData={bracketData}
            loadingBracket={loadingBracket}
            errorBracket={errorBracket}
            getMappedTeamName={getMappedTeamName}
          />
        )}

        {activeTab === TABS.HISTORY && (
          <HistoryTable
            googleSheetHistory={googleSheetHistory}
            loadingGoogleSheet={loadingGoogleSheet}
            errorGoogleSheet={errorGoogleSheet}
            getMappedTeamName={getMappedTeamName}
          />
        )}

        {activeTab === TABS.CHAMPIONS && (
          <ChampionsSection
            historicalChampions={historicalChampions}
            loadingChampions={loadingChampions}
            errorChampions={errorChampions}
            getMappedTeamName={getMappedTeamName}
          />
        )}
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;
