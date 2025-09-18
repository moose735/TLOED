import React from 'react';

export default function DesktopNav({ handleTabClick, handleSubTabClick, openSubMenu, toggleSubMenu, NAV_CATEGORIES }) {
  return (
    <ul className="hidden md:flex md:flex-row md:justify-center py-2">
      {/* Dashboard */}
      <li className="px-3 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 text-lg text-center touch-friendly"
        onClick={() => handleTabClick(NAV_CATEGORIES.HOME.tab)}>
        {NAV_CATEGORIES.HOME.label}
      </li>
      {/* Games Dropdown */}
      <li className="relative px-3 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 text-lg text-center touch-friendly"
        onClick={() => toggleSubMenu('games')}>
        Games <span className="ml-1">▼</span>
        {openSubMenu === 'games' && (
          <ul className="absolute left-0 top-full bg-gray-700 shadow-lg rounded-md mt-2 w-48 z-10">
            <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md text-base touch-friendly"
              onClick={e => { e.stopPropagation(); handleTabClick(NAV_CATEGORIES.GAMECENTER.tab); }}>
              {NAV_CATEGORIES.GAMECENTER.label}
            </li>
            <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md text-base touch-friendly"
              onClick={e => { e.stopPropagation(); handleTabClick(NAV_CATEGORIES.SPORTSBOOK.tab); }}>
              {NAV_CATEGORIES.SPORTSBOOK.label}
            </li>
            <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md text-base touch-friendly"
              onClick={e => { e.stopPropagation(); handleTabClick(NAV_CATEGORIES.HEAD_TO_HEAD.tab); }}>
              {NAV_CATEGORIES.HEAD_TO_HEAD.label}
            </li>
          </ul>
        )}
      </li>
      {/* League Dropdown */}
      <li className="relative px-3 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 text-lg text-center touch-friendly"
        onClick={() => toggleSubMenu('league')}>
        League <span className="ml-1">▼</span>
        {openSubMenu === 'league' && (
          <ul className="absolute left-0 top-full bg-gray-700 shadow-lg rounded-md mt-2 w-56 z-10">
            <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md text-base touch-friendly"
              onClick={e => { e.stopPropagation(); handleTabClick('hallOfChampions'); }}>
              Hall of Champions
            </li>
                <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md text-base touch-friendly"
                  onClick={e => { e.stopPropagation(); handleTabClick('keepers'); }}>
                  Keepers
                </li>
            <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md text-base touch-friendly"
              onClick={e => { e.stopPropagation(); handleTabClick('leagueHistory'); }}>
              League History
            </li>
            <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md text-base touch-friendly"
              onClick={e => { e.stopPropagation(); handleTabClick('recordBook'); }}>
              Record Book
            </li>
            <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md text-base touch-friendly"
              onClick={e => { e.stopPropagation(); handleTabClick('seasonBreakdown'); }}>
              Season Breakdown
            </li>
            <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md text-base touch-friendly"
              onClick={e => { e.stopPropagation(); handleTabClick('financials'); }}>
              Finances
            </li>
          </ul>
        )}
      </li>
      {/* Teams */}
      <li className="px-3 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 text-lg text-center touch-friendly"
        onClick={() => handleTabClick('teamsOverview')}>
        Teams
      </li>
      {/* Analysis Dropdown */}
      <li className="relative px-3 py-2 hover:bg-gray-600 cursor-pointer rounded-md mx-1 text-lg text-center touch-friendly"
        onClick={() => toggleSubMenu('analysis')}>
        Analysis <span className="ml-1">▼</span>
        {openSubMenu === 'analysis' && (
          <ul className="absolute left-0 top-full bg-gray-700 shadow-lg rounded-md mt-2 w-48 z-10">
            <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md text-base touch-friendly"
              onClick={e => { e.stopPropagation(); handleTabClick('draftAnalysis'); }}>
              Draft
            </li>
            <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md text-base touch-friendly"
              onClick={e => { e.stopPropagation(); handleTabClick('dprAnalysis'); }}>
              DPR Analysis
            </li>
            <li className="px-4 py-2 hover:bg-gray-600 cursor-pointer rounded-md text-base touch-friendly"
              onClick={e => { e.stopPropagation(); handleTabClick('luckRating'); }}>
              Luck Rating
            </li>
          </ul>
        )}
      </li>
    </ul>
  );
}
