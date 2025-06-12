import React from 'react';

const ChampionsSection = ({ historicalChampions, loadingChampions, errorChampions, getMappedTeamName }) => {
  return (
    <section className="w-full">
      <h2 className="text-2xl font-bold text-[#0070c0] mb-4 border-b-2 border-[#bfbfbf] pb-2 text-center">
        Historical Champions & Awards
      </h2>
      {loadingChampions ? (
        <p className="text-gray-600">Loading historical champions data...</p>
      ) : errorChampions ? (
        <p className="text-red-500">Error: {errorChampions}</p>
      ) : historicalChampions && historicalChampions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {historicalChampions.map((champion, index) => (
            <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-[#bfbfbf]">
              {champion.champion && <p className="font-semibold text-lg text-[#0070c0]">🏆 {champion.year} Champion: {getMappedTeamName(champion.champion)}</p>}
              {champion.runnerUp && <p className="text-md text-gray-700">🥈 Runner-Up: {getMappedTeamName(champion.runnerUp)}</p>}
              {champion.mvp && <p className="text-md text-gray-700">⭐ MVP: {getMappedTeamName(champion.mvp)}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600">No historical champions/awards data available. Consider populating a Google Sheet for this section.</p>
      )}
      <p className="mt-4 text-sm text-gray-500">
        If you want to fetch this data from a Google Sheet, you'll need to set up a dedicated Apps Script deployment for it,
        similar to how you did for the power rankings, and update `GOOGLE_SHEET_CHAMPIONS_API_URL`.
      </p>
    </section>
  );
};

export default ChampionsSection;
