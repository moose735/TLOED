
		// (No top-level debug logs; all debug output is inside useEffect after variables are defined)
// Error function approximation (same as sportsbook)
function erf(x) {
	const sign = x >= 0 ? 1 : -1;
	x = Math.abs(x);
	const a1 =  0.254829592, a2 = -0.284496736, a3 = 1.421413741;
	const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
	const t = 1.0 / (1.0 + p * x);
	const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
	return sign * y;
}

// Helper: Calculate mean and variance for a team (season or recent)
function getMeanAndVariance(rosterId, season, matchups, N = null) {
	// Support both t1/t2 and team1_roster_id/team2_roster_id
	let teamMatchups = matchups.filter(m => {
		const t1 = m.t1 !== undefined ? m.t1 : m.team1_roster_id;
		const t2 = m.t2 !== undefined ? m.t2 : m.team2_roster_id;
		return String(t1) === String(rosterId) || String(t2) === String(rosterId);
	});
	if (N) teamMatchups = teamMatchups.slice(-N);
	const scores = teamMatchups.map(m => {
		const t1 = m.t1 !== undefined ? m.t1 : m.team1_roster_id;
		return String(t1) === String(rosterId)
			? (m.t1_score !== undefined ? m.t1_score : m.team1_score)
			: (m.t2_score !== undefined ? m.t2_score : m.team2_score);
	}).filter(s => typeof s === 'number');
	if (scores.length === 0) return { mean: 0, variance: 0, count: 0, recentMean: 0 };
	const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
	const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
	// Calculate recent mean (last 3 games)
	const last3 = scores.slice(-3);
	const recentMean = last3.length > 0 ? last3.reduce((a, b) => a + b, 0) / last3.length : mean;
	return { mean, variance, count: scores.length, recentMean };
}
import React, { useState, useEffect } from 'react';
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
const renderRecord = (wins, losses, ties) => {
	if (ties > 0) {
		return `${wins || 0}-${losses || 0}-${ties}`;
	}
	return `${wins || 0}-${losses || 0}`;
};
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
		getTeamDetails,
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

		// --- Projected Wins/Losses Calculation ---

	const allMatchups = historicalData.matchupsBySeason[season] || [];
	const rosters = historicalData.rostersBySeason[season] || [];
	const totalWeeks = 14;
	// Build a map from roster_id to owner_id
	const rosterIdToOwnerId = {};
	rosters.forEach(r => { rosterIdToOwnerId[String(r.roster_id)] = r.owner_id; });

	// Build a map of actual wins for each ownerId
	const actualWins = {};
	rosters.forEach(r => { actualWins[r.owner_id] = 0; });
	allMatchups.filter(m => parseInt(m.week) <= completedWeek && parseInt(m.week) <= 14).forEach(m => {
		// Only count regular season games (weeks 1-14)
		const t1Id = m.t1 !== undefined ? m.t1 : m.team1_roster_id;
		const t2Id = m.t2 !== undefined ? m.t2 : m.team2_roster_id;
		const t1Owner = rosterIdToOwnerId[String(t1Id)] || t1Id;
		const t2Owner = rosterIdToOwnerId[String(t2Id)] || t2Id;
		const t1Score = m.t1_score !== undefined ? m.t1_score : m.team1_score;
		const t2Score = m.t2_score !== undefined ? m.t2_score : m.team2_score;
		if (t1Score > t2Score) actualWins[t1Owner] = (actualWins[t1Owner] || 0) + 1;
		else if (t2Score > t1Score) actualWins[t2Owner] = (actualWins[t2Owner] || 0) + 1;
		// Ties not counted as win
	});

	// For each future matchup, add win probability to each team only once
	const projectedFutureWins = {};
	const remainingOppAverages = {};
	rosters.forEach(r => { projectedFutureWins[r.owner_id] = 0; remainingOppAverages[r.owner_id] = []; });
	// Precompute season average points for each team (using completed games only)
	const teamSeasonAverages = {};
	rosters.forEach(r => {
		const completedGames = allMatchups.filter(m => (m.t1 === r.roster_id || m.team1_roster_id === r.roster_id || m.t2 === r.roster_id || m.team2_roster_id === r.roster_id) && parseInt(m.week) <= completedWeek);
		let total = 0, count = 0;
		completedGames.forEach(m => {
			if (m.t1 === r.roster_id || m.team1_roster_id === r.roster_id) {
				total += m.t1_score !== undefined ? m.t1_score : m.team1_points;
				count++;
			} else if (m.t2 === r.roster_id || m.team2_roster_id === r.roster_id) {
				total += m.t2_score !== undefined ? m.t2_score : m.team2_points;
				count++;
			}
		});
		teamSeasonAverages[r.owner_id] = count > 0 ? total / count : 0;
	});
	for (let week = completedWeek + 1; week <= 14; week++) {
		const weekMatchups = allMatchups.filter(m => parseInt(m.week) === week);
		// Only use completed games for stats
		const completedMatchups = allMatchups.filter(x => parseInt(x.week) <= completedWeek);
		weekMatchups.forEach(m => {
			const t1Id = m.t1 !== undefined ? m.t1 : m.team1_roster_id;
			const t2Id = m.t2 !== undefined ? m.t2 : m.team2_roster_id;
			const t1Owner = rosterIdToOwnerId[String(t1Id)] || t1Id;
			const t2Owner = rosterIdToOwnerId[String(t2Id)] || t2Id;
			// Calculate win probability for both teams using only completed games
			const t1Stats = getMeanAndVariance(t1Id, season, completedMatchups, 4);
			const t2Stats = getMeanAndVariance(t2Id, season, completedMatchups, 4);
			const t1Mean = t1Stats.mean;
			const t2Mean = t2Stats.mean;
			const t1Var = t1Stats.variance;
			const t2Var = t2Stats.variance;
			const t1N = t1Stats.count >= 2 ? t1Stats.count : 1;
			const t2N = t2Stats.count >= 2 ? t2Stats.count : 1;
			const diff = t1Mean - t2Mean;
			const stdErr = Math.sqrt((t1Var / t1N) + (t2Var / t2N));
			let t1WinProb = 0.5;
			if (stdErr > 0) {
				t1WinProb = 0.5 + 0.5 * erf(diff / (Math.sqrt(2) * stdErr));
			}
			// Cap win probabilities to [0.05, 0.95] to reflect fantasy randomness
			t1WinProb = Math.max(0.05, Math.min(0.95, t1WinProb));
			let t2WinProb = 1 - t1WinProb;
			t2WinProb = Math.max(0.05, Math.min(0.95, t2WinProb));
			projectedFutureWins[t1Owner] += t1WinProb;
			projectedFutureWins[t2Owner] += t2WinProb;
			// For SOS: each team, store the season average points of their opponent
			remainingOppAverages[t1Owner].push(teamSeasonAverages[t2Owner]); // t1's opp is t2
			remainingOppAverages[t2Owner].push(teamSeasonAverages[t1Owner]); // t2's opp is t1
		});
	}

		try {
			const metricsResult = calculateAllLeagueMetrics(historicalData, null, getTeamName, nflState);
			const seasonalMetrics = metricsResult?.seasonalMetrics || {};
			const seasonMetrics = seasonalMetrics[season] || {};
					// Use calculateSeasonalDPRMetrics to get rankings for current and previous week

							// Helper to get ranked teams for a given week using the same DPR logic as the main table
							const getRankedTeams = (week) => {
								// Deep clone historicalData and filter matchups for the season up to the given week
								const filteredHistoricalData = JSON.parse(JSON.stringify(historicalData));
								if (filteredHistoricalData.matchupsBySeason && filteredHistoricalData.matchupsBySeason[season]) {
									filteredHistoricalData.matchupsBySeason[season] = filteredHistoricalData.matchupsBySeason[season].filter(m => parseInt(m.week) <= week);
								}
								// Use the same calculation as the main table
								const metricsResult = calculateAllLeagueMetrics(filteredHistoricalData, null, getTeamName, nflState);
								const seasonalMetrics = metricsResult?.seasonalMetrics || {};
								const seasonMetrics = seasonalMetrics[season] || {};
								return Object.keys(seasonMetrics)
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
									.sort((a, b) => b.dpr - a.dpr)
									.map((team, idx) => ({ ...team, rank: idx + 1 }));
							};

					// Get current and previous week rankings

					// DEBUG: Log actualWins, projectedFutureWins, and ownerIds in currentRankings
					console.log('DEBUG actualWins:', actualWins);
					console.log('DEBUG projectedFutureWins:', projectedFutureWins);

					const currentRankings = getRankedTeams(completedWeek);
					console.log('DEBUG currentRankings ownerIds:', currentRankings.map(t => t.ownerId));
					const prevRankings = completedWeek > 1 ? getRankedTeams(completedWeek - 1) : [];

					// Map ownerId to previous rank
					const prevRankMap = {};
					prevRankings.forEach(team => {
						prevRankMap[team.ownerId] = team.rank;
					});

					// --- Tiering Algorithm ---
					let tiers = [];
					let currentTier = 1;
					tiers.push(currentTier); // First team is always Tier 1
					for (let i = 1; i < currentRankings.length; i++) {
						const prevDPR = currentRankings[i - 1].dpr;
						const currDPR = currentRankings[i].dpr;
						const percentDrop = 1 - (currDPR / prevDPR);
						if (percentDrop > TIER_THRESHOLD) {
							currentTier++;
						}
						tiers.push(currentTier);
					}

					// Calculate SOS: average opponent season points for each team
					const sosValues = {};
					Object.keys(remainingOppAverages).forEach(ownerId => {
						const arr = remainingOppAverages[ownerId];
						sosValues[ownerId] = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
					});
					// Rank teams by SOS (1 = hardest, 12 = easiest)
					const sortedSOS = Object.entries(sosValues).sort((a, b) => b[1] - a[1]); // higher avg opp points = harder
					const sosRankMap = {};
					sortedSOS.forEach(([ownerId], idx) => {
						sosRankMap[ownerId] = idx + 1; // 1 = hardest, 12 = easiest
					});

					// Assign tiers, movement, and SOS to teams
					const rankedTeams = currentRankings.map((team, idx) => {
						const prevRank = prevRankMap[team.ownerId];
						let movement = 0;
						if (prevRank !== undefined) {
							movement = prevRank - team.rank;
						}
						// Projected wins/losses
						const actual = actualWins[team.ownerId] || 0;
						const proj = projectedFutureWins[team.ownerId] || 0;
						const totalProjWins = Math.round(actual + proj);
						const totalProjLosses = totalWeeks - totalProjWins;
						const projectedRecord = `${totalProjWins}-${totalProjLosses}`;
						const sosRank = sosRankMap[team.ownerId] || 1;
						return {
							...team,
							tier: tiers[idx],
							movement,
							projectedWins: totalProjWins,
							projectedLosses: totalProjLosses,
							projectedRecord,
							sosRank
						};
					});

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
			<span className="flex items-center justify-center gap-1 text-green-600">
				<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
				</svg>
				<span className="text-green-600 font-bold">{movement}</span>
			</span>
		);
	} else {
		return (
			<span className="flex items-center justify-center gap-1 text-red-600">
				<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
				</svg>
				<span className="text-red-600 font-bold">{Math.abs(movement)}</span>
			</span>
		);
	}
};

		return (
			<div className="w-full max-w-5xl mx-auto p-2 sm:p-4 md:p-8 font-inter">
				<h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-800 mb-4 sm:mb-6 md:mb-8 text-center tracking-tight px-2">
					{powerRankings.length > 0
						? `Power Rankings (DPR) - ${powerRankings[0].year} Season (Week ${currentWeek})`
						: 'Current Power Rankings'}
				</h2>
				{loading ? (
					<div className="flex justify-center items-center h-32">
						<span className="text-sm sm:text-lg text-gray-500 animate-pulse">Calculating power rankings...</span>
					</div>
				) : error ? (
					<div className="flex justify-center items-center h-32">
						<span className="text-sm sm:text-lg text-red-500 font-semibold text-center px-4">{error}</span>
					</div>
				) : powerRankings.length > 0 ? (
					<>
						{/* Mobile Cards View */}
						<div className="sm:hidden space-y-3">
							{powerRankings.map((row, idx) => {
								const isNewTier = idx > 0 && powerRankings[idx - 1].tier !== row.tier;
								
								return (
									<React.Fragment key={row.ownerId}>
										{isNewTier && (
											<div className="flex items-center justify-center py-3">
												<div className="flex-1 h-px bg-blue-300"></div>
												<span className="px-3 text-xs font-semibold text-blue-600 uppercase tracking-wide">
													Tier {row.tier}
												</span>
												<div className="flex-1 h-px bg-blue-300"></div>
											</div>
										)}
										<div className="bg-white rounded-lg shadow-md mobile-card p-4 border-l-4 border-blue-500">
											<div className="flex items-center justify-between mb-3">
												<div className="flex items-center space-x-3">
													<div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
														{row.rank}
													</div>
													<img
														src={getTeamDetails(row.ownerId, row.year)?.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
														alt={getTeamName(row.ownerId, row.year)}
														className="w-10 h-10 rounded-full border-2 border-blue-300 shadow-sm object-cover flex-shrink-0"
														onError={(e) => { 
															e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`;
														}}
													/>
													<div className="min-w-0 flex-1">
														<h3 className="font-semibold text-gray-800 text-sm truncate">{getTeamName(row.ownerId, row.year)}</h3>
														<p className="text-xs text-gray-500">Tier {row.tier}</p>
													</div>
													</div>

													{/* Projected Record and Remaining SOS for mobile */}
													<div className="mt-3 grid grid-cols-2 gap-3 text-sm">
														<div className="bg-gray-50 rounded-lg p-2">
															<div className="text-xs text-gray-500 mb-1">Proj. Record</div>
															<div className="font-semibold text-blue-700">{row.projectedRecord}</div>
														</div>
														<div className="bg-gray-50 rounded-lg p-2">
															<div className="text-xs text-gray-500 mb-1">Rem. SOS</div>
															{(() => {
																const min = 1, max = 12;
																const percent = (row.sosRank - min) / (max - min);
																const r = Math.round(220 + (22 - 220) * percent);
																const g = Math.round(38 + (163 - 38) * percent);
																const b = Math.round(38 + (74 - 38) * percent);
																const color = `rgb(${r},${g},${b})`;
																return <div className="font-bold" style={{color}}>{row.sosRank}</div>;
															})()}
														</div>
													</div>
												<div className="text-right">
													<div className="text-lg font-bold text-blue-800">{formatDPR(row.dpr)}</div>
													<div className="text-xs text-gray-500">DPR</div>
												</div>
											</div>
											
											<div className="grid grid-cols-2 gap-3 text-sm">
												<div className="bg-gray-50 rounded-lg p-2">
													<div className="text-xs text-gray-500 mb-1">Record</div>
													<div className="font-semibold">{renderRecord(row.wins, row.losses, row.ties)}</div>
												</div>
												<div className="bg-gray-50 rounded-lg p-2">
													<div className="text-xs text-gray-500 mb-1">Points For</div>
													<div className="font-semibold text-green-700">{formatPoints(row.pointsFor)}</div>
												</div>
												<div className="bg-gray-50 rounded-lg p-2">
													<div className="text-xs text-gray-500 mb-1">Points Against</div>
													<div className="font-semibold text-red-700">{formatPoints(row.pointsAgainst)}</div>
												</div>
												<div className="bg-gray-50 rounded-lg p-2">
													<div className="text-xs text-gray-500 mb-1">Luck Rating</div>
													<div className={`font-semibold ${row.luckRating > 0 ? 'text-green-600' : row.luckRating < 0 ? 'text-red-600' : 'text-gray-700'}`}>
														{formatLuckRating(row.luckRating)}
													</div>
												</div>
											</div>
										</div>
									</React.Fragment>
								);
							})}
						</div>

						{/* Desktop Table View */}
						<div className="hidden sm:block overflow-x-auto shadow-lg rounded-lg">
							<table className="min-w-full bg-white border border-gray-200 rounded-lg">
								<thead className="bg-blue-100 sticky top-0 z-10">
									<tr>
										<th className="py-3 md:py-4 px-3 md:px-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
										<th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Change</th>
										<th className="py-3 md:py-4 px-3 md:px-4 text-left text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
										<th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">DPR</th>
										<th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record</th>
										<th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">PF</th>
										<th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">PA</th>
										<th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Luck</th>
										<th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Proj. Record</th>
										<th className="py-3 md:py-4 px-3 md:px-4 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-gray-200">Rem. SOS</th>
									</tr>
								</thead>
								<tbody>
									{powerRankings.map((row, idx) => {
										// Check if this is the start of a new tier
										const isNewTier = idx > 0 && powerRankings[idx - 1].tier !== row.tier;
										
										return (
											<React.Fragment key={row.ownerId}>
												{isNewTier && (
													<tr className="bg-blue-50">
														<td colSpan="10" className="py-1 px-3 md:px-4 text-center">
															<div className="flex items-center justify-center w-full">
																<div className="flex-1 h-px bg-blue-300"></div>
																<span className="px-3 text-xs font-semibold text-blue-600 uppercase tracking-wide">
																	Tier {row.tier}
																</span>
																<div className="flex-1 h-px bg-blue-300"></div>
															</div>
														</td>
													</tr>
												)}
												<tr className="hover:bg-gray-50 transition-colors touch-friendly">
													<td className="py-2 md:py-3 px-3 md:px-4 text-sm text-blue-700 font-bold border-b border-gray-200">{row.rank}</td>
													<td className="py-2 md:py-3 px-3 md:px-4 text-sm text-center border-b border-gray-200">
														{renderMovement(row.movement)}
													</td>
													<td className="py-2 md:py-3 px-3 md:px-4 text-sm text-gray-800 font-medium border-b border-gray-200">
														<div className="flex items-center gap-2 md:gap-3">
															<img
																src={getTeamDetails(row.ownerId, row.year)?.avatar || `https://sleepercdn.com/avatars/default_avatar.png`}
																alt={getTeamName(row.ownerId, row.year)}
																className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-blue-300 shadow-sm object-cover flex-shrink-0"
																onError={(e) => { 
																	e.target.src = `https://sleepercdn.com/avatars/default_avatar.png`;
																}}
															/>
															<span className="truncate font-semibold text-xs md:text-sm flex items-center gap-1">
																{getTeamName(row.ownerId, row.year)}
																{row.movement >= 3 && <span title="Hot team" className="ml-1">🔥</span>}
																{row.movement <= -3 && <span title="Cold team" className="ml-1">❄️</span>}
															</span>
														</div>
													</td>
													<td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold text-blue-800">{formatDPR(row.dpr)}</td>
													<td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold">{renderRecord(row.wins, row.losses, row.ties)}</td>
													<td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold text-green-700">{formatPoints(row.pointsFor)}</td>
													<td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold text-red-700">{formatPoints(row.pointsAgainst)}</td>
													<td className={`py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold ${row.luckRating > 0 ? 'text-green-600' : row.luckRating < 0 ? 'text-red-600' : 'text-gray-700'}`}>{formatLuckRating(row.luckRating)}</td>
													<td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-semibold text-blue-700">{row.projectedRecord}</td>
													{/* Smooth red-to-green gradient for SOS rank: 1 (hardest, red) to 12 (easiest, green) */}
													{(() => {
														// 1 = hardest (red), 12 = easiest (green)
														const min = 1, max = 12;
														const percent = (row.sosRank - min) / (max - min);
														// Interpolate from red (rgb(220,38,38)) to green (rgb(22,163,74))
														const r = Math.round(220 + (22 - 220) * percent);
														const g = Math.round(38 + (163 - 38) * percent);
														const b = Math.round(38 + (74 - 38) * percent);
														const color = `rgb(${r},${g},${b})`;
														return (
															<td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-center border-b border-gray-200 font-bold" style={{color}}>{row.sosRank}</td>
														);
													})()}
												</tr>
											</React.Fragment>
										);
									})}
								</tbody>
							</table>
						</div>
					</>
				) : (
					<div className="flex justify-center items-center h-32">
						<span className="text-sm sm:text-lg text-gray-500 text-center px-4">{error}</span>
					</div>
				)}
				<p className="mt-4 sm:mt-6 md:mt-8 text-xs sm:text-sm text-gray-500 text-center px-2">
					Power Rankings are calculated based on DPR (Dominance Power Ranking) for the newest season available. 
					Teams are automatically grouped into tiers based on significant performance gaps.
				</p>
			</div>
		);
};

export default PowerRankings;