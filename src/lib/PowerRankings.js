// src/lib/PowerRankings.js
import React, { useState, useEffect } from 'react';
import { getSleeperAvatarUrl } from '../utils/sleeperApi';
import { useSleeperData } from '../contexts/SleeperDataContext';
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
    currentSeason
  } = useSleeperData();
  
  const [powerRankings, setPowerRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weeklyChartData, setWeeklyChartData] = useState([]);
  const [chartTeams, setChartTeams] = useState([]);
  const [maxTeamsInChart, setMaxTeamsInChart] = useState(1);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [sleeperUsersMap, setSleeperUsersMap] = useState({});

  useEffect(() => {
    let newestYear = currentSeason;
    if (!newestYear && historicalData?.matchupsBySeason) {
      const years = Object.keys(historicalData.matchupsBySeason);
      if (years.length > 0) {
        newestYear = Math.max(...years.map(Number)).toString();
      }
    }

    if (
      contextLoading || 
      !historicalData || 
      !historicalData.matchupsBySeason ||
      !historicalData.rostersBySeason || 
      !historicalData.usersBySeason
    ) {
      setLoading(true);
      setError(contextError);
      return;
    }

    const newestYearMatchups = historicalData.matchupsBySeason[newestYear];
    const rostersInNewestYear = historicalData.rostersBySeason[newestYear];
    
    // Check if there is any matchup data for the newest year
    if (!newestYearMatchups || newestYearMatchups.length === 0) {
      setPowerRankings([]);
      setLoading(false);
      setError("No games have been played for the current season yet. Please check back after the first week's games have been completed.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const usersMap = {};
      Object.values(historicalData.usersBySeason).forEach(usersArray => {
        usersArray.forEach(user => {
          usersMap[user.user_id] = user;
        });
      });
      setSleeperUsersMap(usersMap);
      
      const uniqueTeamsInNewestYear = Object.values(historicalData.usersBySeason[newestYear] || {})
        .filter(user => !RETIRED_MANAGERS.has(user.display_name))
        .map(user => getTeamName(user.user_id, newestYear));

      const maxWeek = newestYearMatchups.reduce((max, match) => Math.max(max, parseInt(match.week) || 0), 0);
      setCurrentWeek(maxWeek);

      const weeklyDPRsChartData = [];
      const teamMetrics = {};

      for (const teamName of uniqueTeamsInNewestYear) {
        teamMetrics[teamName] = { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, gamesPlayed: 0 };
      }

      for (let week = 1; week <= maxWeek; week++) {
        const matchupsThisWeek = newestYearMatchups.filter(match => parseInt(match.week) === week);
        
        const matchupsById = matchupsThisWeek.reduce((acc, matchup) => {
          if (!acc[matchup.matchup_id]) {
            acc[matchup.matchup_id] = [];
          }
          acc[matchup.matchup_id].push(matchup);
          return acc;
        }, {});

        for (const matchupId in matchupsById) {
          const matchupPair = matchupsById[matchupId];
          if (matchupPair.length === 2) {
            const team1Data = matchupPair[0];
            const team2Data = matchupPair[1];

            const roster1 = rostersInNewestYear.find(r => r.roster_id === team1Data.roster_id);
            const roster2 = rostersInNewestYear.find(r => r.roster_id === team2Data.roster_id);

            const team1Name = getTeamName(roster1?.owner_id, newestYear);
            const team2Name = getTeamName(roster2?.owner_id, newestYear);

            if (team1Name && team2Name) {
              if (team1Data.points > team2Data.points) {
                  teamMetrics[team1Name].wins++;
                  teamMetrics[team2Name].losses++;
              } else if (team1Data.points < team2Data.points) {
                  teamMetrics[team1Name].losses++;
                  teamMetrics[team2Name].wins++;
              } else {
                  teamMetrics[team1Name].ties++;
                  teamMetrics[team2Name].ties++;
              }
              teamMetrics[team1Name].pointsFor += team1Data.points;
              teamMetrics[team1Name].pointsAgainst += team2Data.points;
              teamMetrics[team1Name].gamesPlayed++;

              teamMetrics[team2Name].pointsFor += team2Data.points;
              teamMetrics[team2Name].pointsAgainst += team1Data.points;
              teamMetrics[team2Name].gamesPlayed++;
            }
          }
        }
        
        const totalGamesPlayed = uniqueTeamsInNewestYear.reduce((sum, team) => sum + teamMetrics[team].gamesPlayed, 0);
        const cumulativeAveragePoints = totalGamesPlayed > 0 ? Object.values(teamMetrics).reduce((sum, team) => sum + team.pointsFor, 0) / totalGamesPlayed : 0;
        
        const teamsDPRsForThisWeek = uniqueTeamsInNewestYear.map(teamName => {
          const metrics = teamMetrics[teamName];
          const gamesPlayed = metrics.gamesPlayed;
          const wins = metrics.wins;
          const pointsFor = metrics.pointsFor;
          
          let dpr = 0;
          if (gamesPlayed > 0 && cumulativeAveragePoints > 0) {
            const avgPoints = pointsFor / gamesPlayed;
            const pointsFactor = avgPoints / cumulativeAveragePoints;
            const winFactor = wins / gamesPlayed;
            dpr = (pointsFactor + winFactor) / 2;
          }
          return { team: teamName, dpr: dpr };
        });

        const rankedTeamsForWeek = teamsDPRsForThisWeek.sort((a, b) => b.dpr - a.dpr);
        const weeklyEntry = { week: week, dprValues: {} };
        rankedTeamsForWeek.forEach((rankedTeam, index) => {
          weeklyEntry[rankedTeam.team] = index + 1;
          weeklyEntry.dprValues[rankedTeam.team] = rankedTeam.dpr;
        });
        weeklyDPRsChartData.push(weeklyEntry);
      }

      setWeeklyChartData(weeklyDPRsChartData);

      const activeChartTeams = uniqueTeamsInNewestYear.filter(team =>
        weeklyDPRsChartData.some(weekData => weekData[team] !== undefined)
      );
      setChartTeams(activeChartTeams);
      setMaxTeamsInChart(uniqueTeamsInNewestYear.length || 1);

      const finalPowerRankingsForTable = uniqueTeamsInNewestYear
        .map(teamName => {
            const metrics = teamMetrics[teamName];
            const wins = metrics.wins;
            const losses = metrics.losses;
            const pointsFor = metrics.pointsFor;
            const pointsAgainst = metrics.pointsAgainst;

            const currentDPR = weeklyDPRsChartData.length > 0 ? weeklyDPRsChartData[weeklyDPRsChartData.length - 1].dprValues[teamName] : 0;
            const currentRank = weeklyDPRsChartData.length > 0 ? weeklyDPRsChartData[weeklyDPRsChartData.length - 1][teamName] : 0;

            let previousRank = 0;
            if (weeklyDPRsChartData.length > 1) {
              const previousWeekData = weeklyDPRsChartData[weeklyDPRsChartData.length - 2];
              previousRank = previousWeekData[teamName] || 0;
            }
            const movement = currentRank && previousRank ? previousRank - currentRank : 0;

            let luckRating = 0;
            if (wins + losses > 0) {
              const expectedWins = (pointsFor / (pointsFor + pointsAgainst)) * (wins + losses);
              luckRating = (wins - expectedWins) / (wins + losses);
            }

            return {
              team: teamName,
              rank: currentRank,
              movement,
              dpr: currentDPR || 0,
              wins: wins || 0,
              losses: losses || 0,
              ties: metrics.ties || 0,
              pointsFor: pointsFor || 0,
              pointsAgainst: pointsAgainst || 0,
              luckRating: luckRating || 0,
              year: newestYear,
            };
        })
        .filter(team => team.rank !== 0 && team.rank !== undefined)
        .sort((a, b) => a.rank - b.rank);

      setPowerRankings(finalPowerRankingsForTable);
      setLoading(false);
    } catch (err) {
      console.error("Error calculating power rankings or chart data:", err);
      setError(`Failed to calculate power rankings or chart data: ${err.message}.`);
      setLoading(false);
    }
  }, [contextLoading, contextError, historicalData, getTeamName, currentSeason]);

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
    <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md mt-4">
      <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">
        {powerRankings.length > 0
          ? `Power Rankings (DPR) - ${powerRankings[0].year} Season (Week ${currentWeek})`
          : 'Current Power Rankings'}
      </h2>
      {loading ? (
        <p className="text-center text-gray-600">Calculating power rankings...</p>
      ) : error ? (
        <p className="text-center text-red-500 font-semibold">{error}</p>
      ) : powerRankings.length > 0 && powerRankings[0].pointsFor > 0 ? (
        <>
          <div className="overflow-x-auto mb-8">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-blue-100">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Rank</th>
                  <th className="py-3 px-4 text-center text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Change</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Team</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">DPR</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Record (W-L)</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points For</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Points Against</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-blue-700 uppercase tracking-wider border-b border-gray-200">Luck Score</th>
                </tr>
              </thead>
              <tbody>
                {powerRankings.map((row, rowIndex) => {
                  const sleeperUserId = TEAM_NAME_TO_SLEEPER_ID_MAP[row.team] || '';
                  const sleeperTeamData = sleeperUsersMap[sleeperUserId] || {};
                  const displayTeamName = sleeperTeamData.metadata?.team_name || row.team;
                  const avatarUrl = getSleeperAvatarUrl(sleeperTeamData.avatar);

                  return (
                    <tr key={row.team} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{row.rank}</td>
                      <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200 text-center">{renderMovement(row.movement)}</td>
                      <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                        <div className="flex items-center space-x-2">
                          <img src={avatarUrl} alt={`${displayTeamName}'s avatar`} className="w-8 h-8 rounded-full object-cover" />
                          <span>{displayTeamName}</span>
                        </div>
                      </td>
                      <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatDPR(row.dpr)}</td>
                      <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{renderRecordNoTies(row.wins, row.losses)}</td>
                      <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatPoints(row.pointsFor)}</td>
                      <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatPoints(row.pointsAgainst)}</td>
                      <td className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">{formatLuckRating(row.luckRating)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {weeklyChartData.length > 0 && (
            <section className="mt-8">
              <h3 className="text-xl font-bold text-blue-700 mb-4 text-center">
                DPR Rank by Week - {powerRankings[0].year} Season
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={weeklyChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="week" label={{ value: "Week", position: "insideBottom", offset: 0 }} />
                  <YAxis
                    label={{ value: "Rank", angle: -90, position: "insideLeft" }}
                    domain={[1, maxTeamsInChart]}
                    ticks={Array.from({ length: maxTeamsInChart }, (_, i) => i + 1)}
                    allowDecimals={false}
                    reversed={true}
                    interval={0}
                  />
                  <Tooltip content={<CustomDPRRankTooltip />} />
                  <Legend />
                  {chartTeams.map((team, index) => (
                    <Line
                      key={team}
                      type="monotone"
                      dataKey={team}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      activeDot={{ r: 8 }}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-4 text-sm text-gray-500 text-center">
                This graph shows each team's rank based on their Dominance Power Ranking (DPR), calculated cumulatively based on all games played up to each specific week of the newest season. Rank 1 indicates the highest DPR.
              </p>
            </section>
          )}
        </>
      ) : (
        <p className="text-center text-gray-600">{error}</p>
      )}
      <p className="mt-4 text-sm text-gray-500 text-center">
        Power Rankings are calculated based on DPR (Dominance Power Ranking) for the newest season available.
      </p>
    </div>
  );
};

export default PowerRankings;