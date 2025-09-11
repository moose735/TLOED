import React, { useState, useEffect } from 'react';
import { getSleeperAvatarUrl } from '../utils/sleeperApi';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { calculateAllLeagueMetrics } from '../utils/calculations';

// Helper: Calculate DPR metrics for a season (copied from DPRAnalysis logic)
function calculateSeasonalDPRMetrics(historicalData, getTeamName, season, completedWeek) {
  const matchups = (historicalData.matchupsBySeason[season] || []).filter(m => parseInt(m.week) <= completedWeek);
  const rosters = historicalData.rostersBySeason[season] || [];
  const teamMap = new Map();
  rosters.forEach(roster => {
    teamMap.set(roster.owner_id, roster);
  });
  // Aggregate stats per team
  const teamStats = {};
  matchups.forEach(matchup => {
    [
      { owner_id: matchup.team1_details.owner_id, score: matchup.team1_score, oppScore: matchup.team2_score },
      { owner_id: matchup.team2_details.owner_id, score: matchup.team2_score, oppScore: matchup.team1_score }
    ].forEach(({ owner_id, score, oppScore }) => {
      if (!teamStats[owner_id]) {
        teamStats[owner_id] = { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, gamesPlayed: 0, expectedWins: 0, scores: [] };
      }
      teamStats[owner_id].pointsFor += score;
      teamStats[owner_id].pointsAgainst += oppScore;
      teamStats[owner_id].gamesPlayed += 1;
      teamStats[owner_id].scores.push(score);
      if (score > oppScore) teamStats[owner_id].wins += 1;
      else if (score < oppScore) teamStats[owner_id].losses += 1;
      else teamStats[owner_id].ties += 1;
    });
  });
  // Luck calculation: For each week, compare each team's score to all other teams that week
  for (let week = 1; week <= completedWeek; week++) {
    const weekMatchups = matchups.filter(m => parseInt(m.week) === week);
    const scores = [];
    weekMatchups.forEach(m => {
      scores.push({ owner_id: m.team1_details.owner_id, score: m.team1_score });
      scores.push({ owner_id: m.team2_details.owner_id, score: m.team2_score });
    });
    scores.forEach(({ owner_id, score }) => {
      let expectedWins = 0;
      scores.forEach(({ score: oppScore }) => {
        if (score > oppScore) expectedWins += 1;
        else if (score === oppScore) expectedWins += 0.5;
      });
      // Subtract 1 to not count self
      expectedWins = expectedWins - 1;
      teamStats[owner_id].expectedWins = (teamStats[owner_id].expectedWins || 0) + expectedWins;
    });
  }
  // Calculate DPR for each team using the correct formula
  const teams = Object.keys(teamStats);
  // Calculate league average Raw DPR for the season
  const teamRawDPRs = teams.map(ownerId => {
    const stats = teamStats[ownerId];
    const gamesPlayed = stats.gamesPlayed;
    const winPct = gamesPlayed > 0 ? ((stats.wins + 0.5 * stats.ties) / gamesPlayed) : 0;
    const pointsPerGame = gamesPlayed > 0 ? (stats.pointsFor / gamesPlayed) : 0;
    const highScore = stats.scores.length > 0 ? Math.max(...stats.scores) : 0;
    const lowScore = stats.scores.length > 0 ? Math.min(...stats.scores) : 0;
    // Raw DPR formula
    const rawDPR = (((pointsPerGame * 6) + ((highScore + lowScore) * 2) + ((winPct * 200) * 2)) / 10);
    return rawDPR;
  });
  const leagueAvgRawDPR = teamRawDPRs.length > 0 ? (teamRawDPRs.reduce((a, b) => a + b, 0) / teamRawDPRs.length) : 1;

  const dprStats = teams.map((ownerId, idx) => {
    const stats = teamStats[ownerId];
    const gamesPlayed = stats.gamesPlayed;
    const winPct = gamesPlayed > 0 ? ((stats.wins + 0.5 * stats.ties) / gamesPlayed) : 0;
    const pointsPerGame = gamesPlayed > 0 ? (stats.pointsFor / gamesPlayed) : 0;
    const highScore = stats.scores.length > 0 ? Math.max(...stats.scores) : 0;
    const lowScore = stats.scores.length > 0 ? Math.min(...stats.scores) : 0;
    const rawDPR = (((pointsPerGame * 6) + ((highScore + lowScore) * 2) + ((winPct * 200) * 2)) / 10);
    const adjustedDPR = leagueAvgRawDPR > 0 ? (rawDPR / leagueAvgRawDPR) : 1.0;
    // Luck rating: (actual wins - expected wins) / games played
    let luckRating = 0;
    if (gamesPlayed > 0) {
      luckRating = ((stats.wins + 0.5 * stats.ties) - stats.expectedWins) / gamesPlayed;
    }
    return {
      ownerId,
      team: getTeamName(ownerId, season),
      dpr: adjustedDPR,
      wins: stats.wins,
      losses: stats.losses,
      ties: stats.ties,
      pointsFor: stats.pointsFor,
      pointsAgainst: stats.pointsAgainst,
      luckRating,
    };
  });
  return dprStats;
}
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TEAM_NAME_TO_SLEEPER_ID_MAP, RETIRED_MANAGERS } from '../config';

const formatDPR = (dpr) => (typeof dpr === 'number' && !isNaN(dpr) ? dpr.toFixed(3) : 'N/A');
const renderRecordNoTies = (wins, losses) => `${wins || 0}-${losses || 0}`;
const formatPoints = (points) => (typeof points === 'number' && !isNaN(points) ? points.toFixed(2) : 'N/A');
const formatLuckRating = (luck) => (typeof luck === 'number' && !isNaN(luck) ? luck.toFixed(3) : 'N/A');

const CHART_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00c49f', '#ff0000',
  '#0088fe', '#bb3f85', '#7a421a', '#4a4a4a', '#a5d6a7', '#ef9a9a'
];

const CustomDPRRankTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const sortedPayload = [...payload].sort((a, b) => a.value - b.value);
    return (
      <div className="bg-white p-3 border border-gray-300 rounded-md shadow-lg text-sm">
        <p className="font-bold text-gray-800 mb-2">Week: {label}</p>
        {sortedPayload.map((entry, index) => (
          <p key={`item-${index}`} style={{ color: entry.color }}>
            {entry.name}: Rank {entry.value} ({entry.payload.dprValues[entry.name].toFixed(3)} DPR)
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const PowerRankings = () => {
  const {
    historicalData,
    getTeamName,
    loading: contextLoading,
    error: contextError,
    currentSeason,
    nflState
  } = useSleeperData();
  
  const [powerRankings, setPowerRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(0);
  const TIER_THRESHOLD = 0.0455; // 4.55% drop
  const TIER_COLORS = [
    'bg-green-200', // Tier 1 (top)
    'bg-lime-200',  // Tier 2
    'bg-yellow-200',// Tier 3
    'bg-orange-200',// Tier 4
    'bg-amber-200', // Tier 5
    'bg-pink-200',  // Tier 6
    'bg-red-200',   // Tier 7
    'bg-red-400'    // Tier 8 (bottom)
  ];

  useEffect(() => {
    // Defensive checks
    if (contextLoading || !historicalData || !historicalData.matchupsBySeason) {
      setLoading(true);
      setError(contextError || null);
      return;
    }

    // Determine the current season and completed week
    let season = currentSeason;
    if (!season) {
      const years = Object.keys(historicalData.matchupsBySeason);
      if (years.length > 0) {
        season = Math.max(...years.map(Number)).toString();
      }
    }

    const matchups = historicalData.matchupsBySeason[season];
    if (!matchups || matchups.length === 0) {
      setPowerRankings([]);
      setLoading(false);
      setError("No games have been played for the current season yet. Please check back after the first week's games have been completed.");
      return;
    }

    // Get current week from nflState, only use completed weeks
    const nflWeek = nflState && nflState.week ? parseInt(nflState.week) : 1;
    const completedWeek = nflWeek > 1 ? nflWeek - 1 : 1;
    setCurrentWeek(completedWeek);

    // Use centralized metrics for DPR and Luck
    try {
      const metricsResult = calculateAllLeagueMetrics(historicalData, null, getTeamName, nflState);
      const seasonalMetrics = metricsResult?.seasonalMetrics || {};
      const seasonMetrics = seasonalMetrics[season] || {};
      let rankedTeams = Object.keys(seasonMetrics)
        .map(rosterId => {
          const team = seasonMetrics[rosterId];
          return {
            ownerId: team.ownerId,
            team: getTeamName(team.ownerId, season),
            dpr: team.adjustedDPR,
            wins: team.wins,
            losses: team.losses,
            ties: team.ties,
            pointsFor: team.pointsFor,
            pointsAgainst: team.pointsAgainst,
            luckRating: team.luckRating,
            year: season
          };
        })
        .filter(team => team.wins + team.losses + team.ties > 0)
        .sort((a, b) => b.dpr - a.dpr);

      // --- Tiering Algorithm ---
      let tiers = [];
      let currentTier = 1;
      tiers.push(currentTier); // First team is always Tier 1
      for (let i = 1; i < rankedTeams.length; i++) {
        const prevDPR = rankedTeams[i - 1].dpr;
        const currDPR = rankedTeams[i].dpr;
        const percentDrop = 1 - (currDPR / prevDPR);
        if (percentDrop > TIER_THRESHOLD) {
          currentTier++;
        }
        tiers.push(currentTier);
      }
      // Assign tiers to teams
      rankedTeams = rankedTeams.map((team, idx) => ({
        ...team,
        rank: idx + 1,
        tier: tiers[idx]
      }));

      setPowerRankings(rankedTeams);
      setLoading(false);
      setError(null);
    } catch (err) {
      setPowerRankings([]);
      setLoading(false);
      setError("Failed to calculate power rankings: " + err.message);
    }
  }, [contextLoading, contextError, historicalData, getTeamName, currentSeason, nflState]);
// ...existing code...

  const renderMovement = (movement) => {
    if (movement === 0) {
      return <span className="text-gray-500">—</span>;
    } else if (movement > 0) {
      return (
        <span className="text-green-600 flex items-center justify-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
          </svg>
          {movement}
        </span>
      );
    } else {
      return (
        <span className="text-red-600 flex items-center justify-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
          </svg>
          {Math.abs(movement)}
        </span>
      );
    }
  };

		return (
			<div className="w-full max-w-4xl mx-auto p-4 md:p-8">
				<h2 className="text-3xl font-extrabold text-blue-800 mb-6 text-center tracking-tight">
					{powerRankings.length > 0
						? `Power Rankings (DPR) - ${powerRankings[0].year} Season (Week ${currentWeek})`
						: 'Current Power Rankings'}
				</h2>
				{loading ? (
					<div className="flex justify-center items-center h-32">
						<span className="text-lg text-gray-500 animate-pulse">Calculating power rankings...</span>
					</div>
				) : error ? (
					<div className="flex justify-center items-center h-32">
						<span className="text-lg text-red-500 font-semibold">{error}</span>
					</div>
				) : powerRankings.length > 0 ? (
					<div className="overflow-x-auto">
						<table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-md">
							<thead className="bg-blue-100 sticky top-0 z-10">
								<tr>
									<th className="py-3 px-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
									<th className="py-3 px-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
									<th className="py-3 px-4 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">DPR</th>
									<th className="py-3 px-4 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record</th>
									<th className="py-3 px-4 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">PF</th>
									<th className="py-3 px-4 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">PA</th>
									<th className="py-3 px-4 text-center text-xs font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Luck</th>
								</tr>
							</thead>
							<tbody>
								{powerRankings.map((row, idx) => (
									<tr key={row.ownerId} className={`${TIER_COLORS[(row.tier - 1) % TIER_COLORS.length]} ${idx % 2 === 0 ? '' : 'opacity-90'}`}>
										<td className="py-2 px-4 text-sm text-blue-700 font-bold border-b border-gray-200">{row.rank}</td>
										<td className="py-2 px-4 text-sm text-gray-800 font-semibold border-b border-gray-200 flex items-center gap-2">
											<img
												src={getSleeperAvatarUrl(row.ownerId)}
												alt={getTeamName(row.ownerId, row.year)}
												className="w-7 h-7 rounded-full border border-blue-300 mr-2"
												onError={e => { e.target.style.display = 'none'; }}
											/>
											<span className="truncate">{getTeamName(row.ownerId, row.year)}</span>
										</td>
										<td className="py-2 px-4 text-sm text-center border-b border-gray-200 font-mono">{formatDPR(row.dpr)}</td>
										<td className="py-2 px-4 text-sm text-center border-b border-gray-200 font-mono">{`${row.wins}-${row.losses}-${row.ties}`}</td>
										<td className="py-2 px-4 text-sm text-center border-b border-gray-200 font-mono text-green-700">{formatPoints(row.pointsFor)}</td>
										<td className="py-2 px-4 text-sm text-center border-b border-gray-200 font-mono text-red-700">{formatPoints(row.pointsAgainst)}</td>
										<td className={`py-2 px-4 text-sm text-center border-b border-gray-200 font-mono ${row.luckRating > 0 ? 'text-green-600' : row.luckRating < 0 ? 'text-red-600' : 'text-gray-700'}`}>{formatLuckRating(row.luckRating)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<div className="flex justify-center items-center h-32">
						<span className="text-lg text-gray-500">{error}</span>
					</div>
				)}
				<p className="mt-8 text-sm text-gray-500 text-center">
					Power Rankings are calculated based on DPR (Dominance Power Ranking) for the newest season available.
				</p>
			</div>
		);
};

export default PowerRankings;