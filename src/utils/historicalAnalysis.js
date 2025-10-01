// Historical matchup analysis for fantasy football spread calculations
// Based on provided scoring data to calculate variance, consistency, and performance trends

export const historicalMatchups = [
  // Week 1
  { team1: "Crude Crushers", score1: 138.93, team2: "The Freakshow", score2: 100.85 },
  { team1: "The Wolf of Waller Street", score1: 153.71, team2: "Team of Constant Sorrow", score2: 126.76 },
  { team1: "Je_B", score1: 110.04, team2: "Burrowing for Brownies", score2: 162.27 },
  { team1: "The Nightriders", score1: 130.63, team2: "A Touch Of Downs", score2: 147.74 },
  { team1: "Mayfield of Dreams", score1: 169.28, team2: "Michael Vick's Vet Clinic", score2: 151.51 },
  { team1: "Fupa Fappers", score1: 91.62, team2: "Allen Merchants", score2: 139.70 },

  // Week 2
  { team1: "Crude Crushers", score1: 144.38, team2: "Mayfield of Dreams", score2: 122.86 },
  { team1: "The Wolf of Waller Street", score1: 106.52, team2: "Je_B", score2: 105.52 },
  { team1: "The Nightriders", score1: 86.77, team2: "Fupa Fappers", score2: 144.53 },
  { team1: "A Touch Of Downs", score1: 112.67, team2: "Allen Merchants", score2: 148.63 },
  { team1: "The Freakshow", score1: 114.60, team2: "Burrowing for Brownies", score2: 107.33 },
  { team1: "Michael Vick's Vet Clinic", score1: 109.34, team2: "Team of Constant Sorrow", score2: 146.17 },

  // Week 3
  { team1: "Crude Crushers", score1: 118.57, team2: "Fupa Fappers", score2: 141.01 },
  { team1: "The Wolf of Waller Street", score1: 165.03, team2: "Michael Vick's Vet Clinic", score2: 117.77 },
  { team1: "Je_B", score1: 138.39, team2: "The Freakshow", score2: 96.32 },
  { team1: "The Nightriders", score1: 154.31, team2: "Allen Merchants", score2: 91.91 },
  { team1: "Mayfield of Dreams", score1: 179.98, team2: "Team of Constant Sorrow", score2: 113.89 },
  { team1: "A Touch Of Downs", score1: 68.62, team2: "Burrowing for Brownies", score2: 111.81 },

  // Week 4
  { team1: "Crude Crushers", score1: 123.52, team2: "A Touch Of Downs", score2: 141.64 },
  { team1: "The Wolf of Waller Street", score1: 103.99, team2: "Allen Merchants", score2: 115.82 },
  { team1: "Je_B", score1: 95.87, team2: "Michael Vick's Vet Clinic", score2: 117.60 },
  { team1: "The Nightriders", score1: 106.58, team2: "The Freakshow", score2: 152.71 },
  { team1: "Mayfield of Dreams", score1: 138.86, team2: "Burrowing for Brownies", score2: 94.25 },
  { team1: "Fupa Fappers", score1: 89.24, team2: "Team of Constant Sorrow", score2: 88.37 },

  // Week 5 (some team name changes - Herbert's Tank is Cumming, etc.)
  { team1: "Crude Crushers", score1: 123.53, team2: "Herbert's Tank is Cumming", score2: 104.37 },
  { team1: "The Wolf of Waller Street", score1: 179.20, team2: "Michael Vick's Vet Clinic", score2: 122.80 },
  { team1: "Je_B", score1: 132.62, team2: "The Nightriders", score2: 131.74 },
  { team1: "Bohans Bitches", score1: 103.51, team2: "JizzAllenTakesItInTheAss", score2: 106.87 },
  { team1: "Fupa Fappers", score1: 170.83, team2: "7 Mile Spanking Machine", score2: 129.38 },
  { team1: "Rog, King of the Slams", score1: 182.11, team2: "Team of Constant Sorrow", score2: 136.83 },

  // Week 6 (duplicate entry in original data)
  { team1: "Crude Crushers", score1: 89.91, team2: "Michael Vick's Vet Clinic", score2: 148.32 },
  { team1: "The Wolf of Waller Street", score1: 126.52, team2: "Herbert's Tank is Cumming", score2: 91.86 },
  { team1: "Je_B", score1: 135.17, team2: "Bohans Bitches", score2: 145.60 },
  { team1: "The Nightriders", score1: 125.92, team2: "JizzAllenTakesItInTheAss", score2: 148.48 },
  { team1: "Fupa Fappers", score1: 159.61, team2: "Rog, King of the Slams", score2: 154.46 },
  { team1: "7 Mile Spanking Machine", score1: 85.51, team2: "Team of Constant Sorrow", score2: 118.81 }
];

// Calculate team statistics from historical data
export function calculateTeamStats() {
  const teamStats = {};
  
  historicalMatchups.forEach(matchup => {
    // Initialize team stats if not exists
    if (!teamStats[matchup.team1]) {
      teamStats[matchup.team1] = { scores: [], games: 0 };
    }
    if (!teamStats[matchup.team2]) {
      teamStats[matchup.team2] = { scores: [], games: 0 };
    }
    
    // Add scores
    teamStats[matchup.team1].scores.push(matchup.score1);
    teamStats[matchup.team2].scores.push(matchup.score2);
    teamStats[matchup.team1].games++;
    teamStats[matchup.team2].games++;
  });
  
  // Calculate mean, variance, and standard deviation for each team
  Object.keys(teamStats).forEach(team => {
    const scores = teamStats[team].scores;
    const n = scores.length;
    
    // Mean
    const mean = scores.reduce((sum, score) => sum + score, 0) / n;
    
    // Variance (sigma squared)
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / (n - 1);
    
    // Standard deviation (sigma)
    const standardDeviation = Math.sqrt(variance);
    
    // Recent performance (last 3 games weighted more heavily)
    const recentScores = scores.slice(-3);
    const recentMean = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    
    // Hot/Cold streak detection
    const isHot = recentMean > mean + (standardDeviation * 0.5);
    const isCold = recentMean < mean - (standardDeviation * 0.5);
    
    // Consistency rating (lower variance = more consistent)
    const consistencyRating = Math.max(0, 1 - (variance / (mean * mean))) * 100;
    
    teamStats[team] = {
      ...teamStats[team],
      mean,
      variance,
      standardDeviation,
      recentMean,
      isHot,
      isCold,
      consistencyRating,
      coefficient_of_variation: standardDeviation / mean
    };
  });
  
  return teamStats;
}

// Calculate expected spread between two teams using variance-based approach
export function calculateVarianceBasedSpread(team1Name, team2Name, teamStats) {
  const team1 = teamStats[team1Name];
  const team2 = teamStats[team2Name];
  
  if (!team1 || !team2) {
    console.warn(`Missing team stats for ${team1Name} or ${team2Name}`);
    return { spread: 0, confidence: 0 };
  }
  
  // Expected point difference (team2.mean - team1.mean for proper spread convention)
  // Positive spread = team2 favorite, negative spread = team1 favorite
  const expectedDiff = team2.mean - team1.mean;
  
  // Combined variance (assumes independence)
  const combinedVariance = team1.variance + team2.variance;
  const combinedStdDev = Math.sqrt(combinedVariance);
  
  // Adjust for recent form (hot/cold streaks)
  // Positive adjustment = team2 gets more favor, negative = team1 gets more favor
  let formAdjustment = 0;
  if (team1.isHot && !team2.isHot) formAdjustment -= 3; // team1 hot = team1 more favored (negative)
  if (team2.isHot && !team1.isHot) formAdjustment += 3; // team2 hot = team2 more favored (positive)
  if (team1.isCold && !team2.isCold) formAdjustment += 3; // team1 cold = team2 more favored (positive)
  if (team2.isCold && !team1.isCold) formAdjustment -= 3; // team2 cold = team1 more favored (negative)
  
  // Final spread with form adjustment
  const adjustedSpread = expectedDiff + formAdjustment;
  
  // Confidence level based on combined standard deviation
  const confidence = Math.max(0, Math.min(1, 1 - (combinedStdDev / Math.abs(adjustedSpread + 0.1))));
  
  return {
    spread: Math.round(adjustedSpread * 10) / 10, // Round to 1 decimal
    confidence,
    combinedStdDev,
    team1Stats: {
      mean: team1.mean,
      stdDev: team1.standardDeviation,
      isHot: team1.isHot,
      isCold: team1.isCold,
      consistency: team1.consistencyRating
    },
    team2Stats: {
      mean: team2.mean,
      stdDev: team2.standardDeviation,
      isHot: team2.isHot,
      isCold: team2.isCold,
      consistency: team2.consistencyRating
    }
  };
}

// Get head-to-head record between two teams
export function getHeadToHeadRecord(team1Name, team2Name) {
  const h2h = { team1Wins: 0, team2Wins: 0, games: [] };
  
  historicalMatchups.forEach(matchup => {
    if ((matchup.team1 === team1Name && matchup.team2 === team2Name) ||
        (matchup.team1 === team2Name && matchup.team2 === team1Name)) {
      
      const isTeam1Home = matchup.team1 === team1Name;
      const team1Score = isTeam1Home ? matchup.score1 : matchup.score2;
      const team2Score = isTeam1Home ? matchup.score2 : matchup.score1;
      
      if (team1Score > team2Score) {
        h2h.team1Wins++;
      } else {
        h2h.team2Wins++;
      }
      
      h2h.games.push({
        team1Score,
        team2Score,
        winner: team1Score > team2Score ? team1Name : team2Name
      });
    }
  });
  
  return h2h;
}