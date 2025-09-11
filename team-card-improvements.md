// Updated statBubble function for cleaner team cards
const statBubble = (rank, label, value, className) => (
    <div className={className + ' flex flex-col items-center justify-center aspect-[4/3] w-full h-full rounded-lg shadow-sm p-1'}>
        <span className="block text-sm font-bold mb-0.5">{rank}</span>
        <span className="block text-xs font-semibold text-center leading-tight">{label}</span>
        <span className="block text-xs font-normal text-center">({value})</span>
    </div>
);

// Updated team card container
<div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 flex flex-col items-center text-center">
    <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold text-lg mb-2">
        {currentTeamDisplayName.charAt(0)}
    </div>
    <h4 className="text-lg font-bold text-gray-800 mb-3">{currentTeamDisplayName}</h4>
    <div className="grid grid-cols-3 gap-2 w-full text-xs font-medium text-gray-700">
        {statBubble(totalWinsRank, 'Total Wins', totalWins !== null ? totalWins : 'N/A', getComparisonClass(totalWins, oppTotalWins))}
        {statBubble(winPercentageRank, 'Win %', winPercentage !== null ? winPercentage.toFixed(3) + '%' : 'N/A', winPctClass)}
        {statBubble(careerDPRRank, 'Career DPR', careerDPR !== null ? careerDPR.toFixed(3) : 'N/A', getComparisonClass(careerDPR, oppCareerDPR))}
        {statBubble(calculateRank(weeklyHighScoreCount, Object.values(weeklyHighScoreCounts), true), 'Weekly High', weeklyHighScoreCount, weeklyHighScoreCountClass)}
        {statBubble(totalPointsScoredRank, 'Total Points', totalPointsScored !== null ? totalPointsScored.toFixed(0) : 'N/A', getComparisonClass(totalPointsScored, oppTotalPointsScored))}
        {statBubble(medalScoreRank, 'Medal Score', medalScore, medalScoreClass)}
    </div>
</div>