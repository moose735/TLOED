import React from 'react';

const Header = ({ sleeperLeagueData }) => {
  return (
    <header className="w-full max-w-4xl bg-gradient-to-r from-[#0070c0] to-[#005f9f] text-white p-6 rounded-xl shadow-lg mb-8 text-center">
      <h1 className="text-4xl font-extrabold mb-2">The League of Extraordinary Douchebags</h1>
      {sleeperLeagueData && (
        <p className="text-xl">
          {sleeperLeagueData.season} Season
        </p>
      )}
    </header>
  );
};

export default Header;
