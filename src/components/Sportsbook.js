// src/components/Sportsbook.js
import React, { useState, useEffect, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { 
    calculateEloRatings, 
    calculateTeamMomentum, 
    calculateBookmakerOdds, 
    calculateHybridPlayoffProbability,
    calculateChampionshipOdds,
    classifyKeeperLeagueTeam,
    calculateTeamConsistency,
    calculateTeamDPRValues,
    calculateWinProbability
} from '../utils/sportsbookCalculations';
import { generateCleanBettingMarkets } from '../utils/cleanOddsCalculator';
import { 
    calculateRecentForm, 
    probabilityToAmericanOdds, 
    formatOdds 
} from '../utils/matchupOdds';const Sportsbook = () => {
    const { 
        historicalData, 
        leagueData, 
        getTeamDetails, 
        processedSeasonalRecords, 
        nflState, 
        loading, 
        rostersWithDetails 
    } = useSleeperData();

    const [selectedBetType, setSelectedBetType] = useState('gameLines'); // 'gameLines', 'futures'
    const [selectedFuturesTab, setSelectedFuturesTab] = useState('playoffs'); // 'playoffs', 'championship'
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [matchupOdds, setMatchupOdds] = useState([]);
    const [playoffOdds, setPlayoffOdds] = useState([]);
    const [championshipOdds, setChampionshipOdds] = useState([]);
    const [eloRatings, setEloRatings] = useState({});

    // Bet Slip State
    const [betSlip, setBetSlip] = useState([]);
    const [betAmount, setBetAmount] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [isBetSlipExpanded, setIsBetSlipExpanded] = useState(false);

    // Current season
    const currentSeason = useMemo(() => {
        return leagueData && Array.isArray(leagueData) ? leagueData[0]?.season : leagueData?.season;
    }, [leagueData]);

    // Initialize current week and Elo ratings
    useEffect(() => {
        if (nflState?.week && !selectedWeek) {
            setSelectedWeek(parseInt(nflState.week));
        }
        
        if (currentSeason && historicalData) {
            const ratings = calculateEloRatings(historicalData, currentSeason);
            setEloRatings(ratings);
        }
    }, [nflState, selectedWeek, currentSeason, historicalData]);

    // Notification functions
    const addNotification = (message, type = 'info') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 3000);
    };

    // Bet slip functions
    const addBetToSlip = (bet) => {
        const betId = `${bet.matchupId}-${bet.type}-${bet.selection}`;
        
        // Check if bet already exists (toggle functionality)
        const existingBetIndex = betSlip.findIndex(b => b.id === betId);
        
        if (existingBetIndex >= 0) {
            // Remove bet if it exists
            setBetSlip(prev => prev.filter(b => b.id !== betId));
            addNotification('Bet removed from slip', 'info');
            return;
        }

        // Check for conflicts only when adding new bets
        const conflicts = betSlip.filter(existingBet => {
            // Same game restrictions
            if (existingBet.matchupId === bet.matchupId) {
                // Can't bet both sides of spread
                if (bet.type === 'spread' && existingBet.type === 'spread') {
                    return true;
                }
                // Can't bet both over/under
                if (bet.type === 'total' && existingBet.type === 'total') {
                    return true;
                }
                // Can't bet both moneylines
                if (bet.type === 'moneyline' && existingBet.type === 'moneyline') {
                    return true;
                }
                // Can't bet same team's spread and moneyline
                if ((bet.type === 'spread' && existingBet.type === 'moneyline') ||
                    (bet.type === 'moneyline' && existingBet.type === 'spread')) {
                    if (bet.team === existingBet.team) {
                        return true;
                    }
                }
            }
            return false;
        });

        if (conflicts.length > 0) {
            addNotification('Cannot add conflicting bets from the same game', 'error');
            return;
        }

        // Add new bet
        setBetSlip(prev => [...prev, { ...bet, id: betId }]);
        addNotification('Bet added to slip', 'success');
    };

    const removeBetFromSlip = (betId) => {
        setBetSlip(prev => prev.filter(b => b.id !== betId));
        addNotification('Bet removed from slip', 'info');
    };

    const clearBetSlip = () => {
        setBetSlip([]);
        setBetAmount('');
        addNotification('Bet slip cleared', 'info');
    };

    const calculateParlayOdds = (bets) => {
        if (bets.length === 0) return 0;
        let totalOdds = 1;
        
        bets.forEach(bet => {
            const decimalOdds = bet.odds > 0 ? (bet.odds / 100) + 1 : (100 / Math.abs(bet.odds)) + 1;
            totalOdds *= decimalOdds;
        });
        
        const americanOdds = totalOdds >= 2 ? (totalOdds - 1) * 100 : -100 / (totalOdds - 1);
        return Math.round(americanOdds);
    };

    const calculatePayout = () => {
        if (!betAmount || betSlip.length === 0) return 0;
        
        const amount = parseFloat(betAmount);
        if (isNaN(amount) || amount <= 0) return 0;
        
        if (betSlip.length === 1) {
            // Single bet
            const odds = betSlip[0].odds;
            const winAmount = odds > 0 ? (amount * odds / 100) : (amount * 100 / Math.abs(odds));
            return amount + winAmount;
        } else {
            // Parlay
            const parlayOdds = calculateParlayOdds(betSlip);
            const winAmount = parlayOdds > 0 ? (amount * parlayOdds / 100) : (amount * 100 / Math.abs(parlayOdds));
            return amount + winAmount;
        }
    };

    // Calculate team power score based on multiple factors
    const calculateTeamPowerScore = (teamStats, rosterId, season) => {
        // Base factors
        const winPct = teamStats.gamesPlayed > 0 ? teamStats.wins / teamStats.gamesPlayed : 0;
        const avgPoints = teamStats.averageScore || 0;
        const pointsFor = teamStats.pointsFor || 0;
        const pointsAgainst = teamStats.pointsAgainst || 0;
        
        // Advanced factors
        const luckRating = teamStats.luckRating || 0;
        const strengthOfSchedule = teamStats.strengthOfSchedule || 0;
        
        // Get recent form and momentum
        const recentForm = calculateRecentForm(rosterId, season, 4);
        const momentum = calculateTeamMomentum(rosterId, season, historicalData, 6);
        
        // Elo rating component
        const eloComponent = eloRatings[rosterId] ? (eloRatings[rosterId] - 1500) / 10 : 0;
        
        // Weighted power score calculation
        const powerScore = (
            (winPct * 100) * 0.25 +           // 25% win percentage
            (avgPoints / 10) * 0.20 +         // 20% average points (scaled)
            (recentForm * 10) * 0.15 +        // 15% recent form
            ((pointsFor - pointsAgainst) / 100) * 0.15 + // 15% point differential
            (momentum * 20) * 0.10 +          // 10% momentum
            eloComponent * 0.10 +             // 10% Elo rating
            (luckRating * 50) * 0.03 +        // 3% luck (can be negative)
            (strengthOfSchedule * 10) * 0.02   // 2% strength of schedule
        );

        return Math.max(0, powerScore); // Ensure non-negative
    };

    // Calculate recent form (win percentage over last N games)
    const calculateRecentForm = (rosterId, season, gameCount = 4) => {
        if (!historicalData?.matchupsBySeason?.[season]) return 0.5;

        const teamMatchups = historicalData.matchupsBySeason[season]
            .filter(m => String(m.team1_roster_id) === String(rosterId) || String(m.team2_roster_id) === String(rosterId))
            .sort((a, b) => parseInt(b.week) - parseInt(a.week)) // Most recent first
            .slice(0, gameCount);

        if (teamMatchups.length === 0) return 0.5;

        const wins = teamMatchups.filter(matchup => {
            const isTeam1 = String(matchup.team1_roster_id) === String(rosterId);
            const teamScore = isTeam1 ? matchup.team1_score : matchup.team2_score;
            const opponentScore = isTeam1 ? matchup.team2_score : matchup.team1_score;
            return teamScore > opponentScore;
        }).length;

        return wins / teamMatchups.length;
    };

    // Team power rankings (used for odds calculation)
    const teamPowerRankings = useMemo(() => {
        if (!processedSeasonalRecords || !currentSeason || !processedSeasonalRecords[currentSeason]) {
            return {};
        }

        const seasonData = processedSeasonalRecords[currentSeason];
        const teams = Object.keys(seasonData).map(rosterId => {
            const team = seasonData[rosterId];
            const powerScore = calculateTeamPowerScore(team, rosterId, currentSeason);
            
            // Add keeper league analysis
            const classification = classifyKeeperLeagueTeam(rosterId, seasonData, historicalData, currentSeason);
            const consistency = calculateTeamConsistency(rosterId, seasonData, historicalData, currentSeason);
            const momentum = calculateTeamMomentum(rosterId, currentSeason, historicalData, 6);
            
            return {
                rosterId,
                ...team,
                powerScore,
                classification,
                consistency,
                momentum
            };
        }).sort((a, b) => b.powerScore - a.powerScore);

        const rankings = {};
        teams.forEach((team, index) => {
            rankings[team.rosterId] = {
                ...team,
                rank: index + 1,
                powerScore: team.powerScore
            };
        });

        return rankings;
    }, [processedSeasonalRecords, currentSeason, eloRatings, historicalData]);

    // Generate matchup odds for a specific week
    const generateMatchupOdds = (week) => {
        if (!historicalData?.matchupsBySeason?.[currentSeason] || !teamPowerRankings || !currentSeason) {
            return [];
        }

        // Create getTeamName function for DPR calculation
        const getTeamName = (ownerId, season) => {
            const details = getTeamDetails(ownerId, season);
            return details?.name || `Team ${ownerId}`;
        };

        // Get both upcoming and completed matchups for the selected week
        const weekMatchups = historicalData.matchupsBySeason[currentSeason]
            .filter(m => parseInt(m.week) === week);

        return weekMatchups.map(matchup => {
            try {
                const team1RosterId = String(matchup.team1_roster_id);
                const team2RosterId = String(matchup.team2_roster_id);
                
                // Check if teams exist in power rankings
                if (!teamPowerRankings[team1RosterId] || !teamPowerRankings[team2RosterId]) {
                    return null;
                }
                
                // Check if game is completed - only consider completed if it's a past week OR has actual scores and is not current week
                const currentWeek = nflState?.week ? parseInt(nflState.week) : null;
                const isCompleted = (matchup.team1_score > 0 || matchup.team2_score > 0) && 
                                  (currentWeek ? week < currentWeek : true);
                
                // Get team details using the same pattern as Gamecenter
                const rosterForTeam1 = historicalData.rostersBySeason?.[currentSeason]?.find(r => String(r.roster_id) === team1RosterId);
                const team1OwnerId = rosterForTeam1?.owner_id;
                const team1Details = getTeamDetails(team1OwnerId, currentSeason);

                const rosterForTeam2 = historicalData.rostersBySeason?.[currentSeason]?.find(r => String(r.roster_id) === team2RosterId);
                const team2OwnerId = rosterForTeam2?.owner_id;
                const team2Details = getTeamDetails(team2OwnerId, currentSeason);
                
                const team1WinProb = calculateWinProbability(
                    team1RosterId, 
                    team2RosterId, 
                    teamPowerRankings, 
                    eloRatings, 
                    historicalData,
                    currentSeason
                );
                const team2WinProb = 1 - team1WinProb;
                
                // Use enhanced odds calculation with vig
                const team1OddsData = calculateBookmakerOdds(team1WinProb);
                const team2OddsData = calculateBookmakerOdds(team2WinProb);

                const matchupData = {
                    matchupId: matchup.matchup_id,
                    week: week,
                    isCompleted: isCompleted,
                    team1: {
                        rosterId: team1RosterId,
                        name: team1Details.name,
                        avatar: team1Details.avatar,
                        record: `${teamPowerRankings[team1RosterId]?.wins || 0}-${teamPowerRankings[team1RosterId]?.losses || 0}`,
                        avgPoints: teamPowerRankings[team1RosterId]?.averageScore || 0,
                        powerScore: teamPowerRankings[team1RosterId]?.powerScore || 0,
                        eloRating: eloRatings[team1RosterId] || 1500,
                        momentum: calculateTeamMomentum(team1RosterId, currentSeason, historicalData),
                        probability: team1WinProb,
                        odds: team1OddsData.americanOdds
                    },
                    team2: {
                        rosterId: team2RosterId,
                        name: team2Details.name,
                        avatar: team2Details.avatar,
                        record: `${teamPowerRankings[team2RosterId]?.wins || 0}-${teamPowerRankings[team2RosterId]?.losses || 0}`,
                        avgPoints: teamPowerRankings[team2RosterId]?.averageScore || 0,
                        powerScore: teamPowerRankings[team2RosterId]?.powerScore || 0,
                        eloRating: eloRatings[team2RosterId] || 1500,
                        momentum: calculateTeamMomentum(team2RosterId, currentSeason, historicalData),
                        probability: team2WinProb,
                        odds: team2OddsData.americanOdds
                    }
                };

                // Generate clean betting markets with proper spread-to-moneyline relationships
                const bettingMarkets = generateCleanBettingMarkets(
                    {
                        team1RosterId,
                        team2RosterId,
                        team1Name: team1Details.name,
                        team2Name: team2Details.name,
                        winProbability: team1WinProb
                    },
                    teamPowerRankings,
                    {
                        vig: 0.045,
                        includePropBets: true
                    }
                );

                // Now add actual scores and spread coverage AFTER markets are generated
                if (isCompleted) {
                    matchupData.actualScores = {
                        team1Score: matchup.team1_score,
                        team2Score: matchup.team2_score,
                        team1Won: matchup.team1_score > matchup.team2_score,
                        totalPoints: matchup.team1_score + matchup.team2_score,
                        // Calculate spread coverage using the clean betting markets
                        team1CoveredSpread: bettingMarkets?.spread ? (() => {
                            const team1SpreadLine = bettingMarkets.spread.team1.line;
                            // Handle pick'em games (PK)
                            const team1Spread = team1SpreadLine === "PK" ? 0 : parseFloat(team1SpreadLine);
                            const team1SpreadResult = matchup.team1_score - matchup.team2_score;
                            
                            // Check if team1 covered their spread
                            // For pick'em games, they need to win outright
                            return team1SpreadResult > -team1Spread;
                        })() : null,
                        
                        // Calculate over/under result
                        overHit: bettingMarkets?.total ? (() => {
                            const totalLine = bettingMarkets.total.over.line;
                            const actualTotal = matchup.team1_score + matchup.team2_score;
                            return actualTotal > totalLine;
                        })() : null
                    };
                }

                // Generate betting markets once and store them
                const markets = bettingMarkets;
                matchupData.markets = markets;

                return matchupData;
            } catch (error) {
                console.error('Error generating matchup odds:', error);
                return null;
            }
        }).filter(Boolean); // Remove any null entries
    };

    // Generate playoff odds
    const generatePlayoffOdds = () => {
        if (!teamPowerRankings) return [];

        return Object.keys(teamPowerRankings).map(rosterId => {
            const team = teamPowerRankings[rosterId];
            
            // Get team details using the same pattern as Gamecenter
            const rosterForTeam = historicalData.rostersBySeason?.[currentSeason]?.find(r => String(r.roster_id) === rosterId);
            const ownerId = rosterForTeam?.owner_id;
            const teamDetails = getTeamDetails(ownerId, currentSeason);
            
            // Calculate playoff probability based on current standing and remaining games
            const playoffProb = calculatePlayoffProbability(rosterId);
            const playoffOdds = probabilityToAmericanOdds(playoffProb);

            return {
                rosterId,
                name: teamDetails.name,
                avatar: teamDetails.avatar,
                record: `${team.wins || 0}-${team.losses || 0}`,
                powerScore: team.powerScore,
                rank: team.rank,
                probability: playoffProb,
                odds: playoffOdds
            };
        }).sort((a, b) => b.probability - a.probability);
    };

    // Calculate playoff probability using hybrid playoff format
    const calculatePlayoffProbability = (rosterId) => {
        const team = teamPowerRankings[rosterId];
        if (!team) return 0;

        const gamesPlayed = team.gamesPlayed || 0;
        const totalGames = 14; // Typical fantasy season length
        const gamesRemaining = Math.max(0, totalGames - gamesPlayed);
        
        // Use the new hybrid playoff probability calculation
        return calculateHybridPlayoffProbability(
            rosterId,
            teamPowerRankings,
            gamesRemaining,
            3000 // Reduced simulations for faster UI response
        );
    };

    // Generate championship odds using enhanced hybrid playoff system
    const generateChampionshipOdds = () => {
        if (!teamPowerRankings) return [];

        const currentGamesPlayed = Math.max(...Object.values(teamPowerRankings).map(t => t.gamesPlayed || 0));
        const remainingGames = Math.max(0, 14 - currentGamesPlayed); // Assume 14-game season

        return Object.keys(teamPowerRankings).map(rosterId => {
            const team = teamPowerRankings[rosterId];
            
            // Get team details using the same pattern as Gamecenter
            const rosterForTeam = historicalData.rostersBySeason?.[currentSeason]?.find(r => String(r.roster_id) === rosterId);
            const ownerId = rosterForTeam?.owner_id;
            const teamDetails = getTeamDetails(ownerId, currentSeason);
            
            
            // Create getTeamName function for DPR calculation
            const getTeamName = (ownerId, season) => {
                const details = getTeamDetails(ownerId, season);
                return details?.name || `Team ${ownerId}`;
            };
            
            // Use new DPR-enhanced championship odds calculation
            const championshipData = calculateChampionshipOdds(
                rosterId,
                teamPowerRankings,
                remainingGames,
                250, // Reduced from 1000 to 250 for much faster UI response
                historicalData, // Add historical data for SOS and momentum
                currentSeason, // Add current season for trend analysis
                getTeamName, // Add getTeamName function for DPR calculation
                nflState // Add NFL state for DPR calculation
            );

            return {
                rosterId,
                name: teamDetails.name,
                avatar: teamDetails.avatar,
                record: `${team.wins || 0}-${team.losses || 0}`,
                powerScore: team.powerScore,
                rank: team.rank,
                probability: championshipData.championshipProbability,
                odds: championshipData.odds.american, // Use the odds from the enhanced calculation
                playoffProb: championshipData.playoffProbability,
                expectedSeed: championshipData.expectedSeed,
                strengthOfSchedule: championshipData.strengthOfSchedule,
                momentum: championshipData.momentum,
                isWildcardContender: isWildcardContender(team, rosterId),
                gamesPlayed: team.gamesPlayed || 0
            };
        }).sort((a, b) => b.probability - a.probability);
    };

    // Helper function to identify teams that might make playoffs via wildcard (high points, bad record)
    const isWildcardContender = (team, rosterId) => {
        const gamesPlayed = team.gamesPlayed || 0;
        if (gamesPlayed < 3) return false; // Need some sample size
        
        const winPct = gamesPlayed > 0 ? (team.wins || 0) / gamesPlayed : 0;
        const avgScore = team.averageScore || 0;
        
        // Get league averages
        const allTeams = Object.values(teamPowerRankings);
        const avgLeagueScore = allTeams.reduce((sum, t) => sum + (t.averageScore || 0), 0) / allTeams.length;
        const avgWinPct = allTeams.reduce((sum, t) => {
            const gp = t.gamesPlayed || 0;
            return sum + (gp > 0 ? (t.wins || 0) / gp : 0);
        }, 0) / allTeams.length;
        
        // Wildcard contender: below average record but above average scoring
        return winPct < avgWinPct && avgScore > avgLeagueScore * 1.05; // Score 5% above average
    };

    // Update odds when dependencies change
    useEffect(() => {
        if (selectedBetType === 'gameLines' && selectedWeek && teamPowerRankings && Object.keys(teamPowerRankings).length > 0) {
            setMatchupOdds(generateMatchupOdds(selectedWeek));
        } else if (selectedBetType === 'futures' && selectedFuturesTab === 'playoffs' && teamPowerRankings && Object.keys(teamPowerRankings).length > 0) {
            setPlayoffOdds(generatePlayoffOdds());
        } else if (selectedBetType === 'futures' && selectedFuturesTab === 'championship' && teamPowerRankings && Object.keys(teamPowerRankings).length > 0) {
            setChampionshipOdds(generateChampionshipOdds());
        }
    }, [selectedBetType, selectedFuturesTab, selectedWeek, teamPowerRankings, currentSeason, eloRatings, historicalData]);

    if (loading) {
        return (
            <div className="p-4 bg-gray-50 min-h-screen flex justify-center items-center">
                <div className="text-xl font-semibold text-gray-500">Loading Sportsbook...</div>
            </div>
        );
    }

    return (
        <div className={`p-4 bg-gray-50 min-h-screen ${betSlip.length > 0 ? 'pb-24' : ''}`}>
            <div className="max-w-7xl mx-auto">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg mb-6">
                    <h1 className="text-3xl font-bold mb-2">Fantasy Sportsbook</h1>
                    <p className="text-blue-100">Odds based on team performance, power rankings, and statistical analysis</p>
                </div>

                {/* Bet Type Selector */}
                <div className="bg-white rounded-lg shadow-md mb-6">
                    <div className="flex border-b">
                        <button
                            className={`flex-1 py-4 px-6 text-center font-medium ${
                                selectedBetType === 'gameLines' 
                                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                            onClick={() => setSelectedBetType('gameLines')}
                        >
                            Game Lines
                        </button>
                        <button
                            className={`flex-1 py-4 px-6 text-center font-medium ${
                                selectedBetType === 'futures' 
                                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                            onClick={() => setSelectedBetType('futures')}
                        >
                            Futures
                        </button>
                    </div>

                    {/* Week selector for game lines */}
                    {selectedBetType === 'gameLines' && (
                        <div className="p-4 border-b flex flex-wrap gap-4">
                            <div>
                                <label htmlFor="week-select" className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Week
                                </label>
                                <select
                                    id="week-select"
                                    value={selectedWeek || ''}
                                    onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                                    className="block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                                >
                                    {Array.from({length: 18}, (_, i) => i + 1).map(week => (
                                        <option key={week} value={week}>
                                            Week {week} {week >= 15 ? '(Playoffs)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Content based on selected bet type */}
                {selectedBetType === 'gameLines' && (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            Week {selectedWeek} {selectedWeek >= 15 ? 'Playoffs' : 'Betting Odds'}
                        </h2>
                        {selectedWeek >= 15 ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                                <div className="text-blue-600 mb-2">
                                    <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-blue-800 mb-2">Playoff Week</h3>
                                <p className="text-blue-700 mb-4">
                                    {selectedWeek === 15 ? 'Wildcard Round' : selectedWeek === 16 ? 'Semifinals' : 'Championship Game'}
                                </p>
                                <p className="text-sm text-blue-600">
                                    Playoff matchups are determined by regular season standings. 
                                    Regular season betting is available for weeks 1-14.
                                </p>
                            </div>
                        ) : matchupOdds.length > 0 ? (
                            <div className="grid gap-6">
                                {matchupOdds.map(matchup => (
                                    <div key={matchup.matchupId} className="bg-white rounded-lg shadow-md overflow-hidden">
                                        {/* Betting Markets - Stacked Teams with Column Headers */}
                                        <div className="p-6">
                                            <div className="grid grid-cols-4 gap-4">
                                                {/* Teams Column */}
                                                <div>
                                                    <div className="h-10 flex items-center text-sm font-semibold text-gray-700 mb-4">
                                                        Teams
                                                    </div>
                                                    <div className="space-y-2">
                                                        {/* Team 1 */}
                                                        <div className="h-20 flex items-center justify-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <img className="w-8 h-8 rounded-full" src={matchup.team1.avatar} alt={matchup.team1.name} />
                                                                <div className="font-medium text-gray-800 text-lg text-center">{matchup.team1.name}</div>
                                                                <div className="text-sm text-gray-500">{matchup.team1.record}</div>
                                                            </div>
                                                        </div>
                                                        {/* Team 2 */}
                                                        <div className="h-20 flex items-center justify-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <img className="w-8 h-8 rounded-full" src={matchup.team2.avatar} alt={matchup.team2.name} />
                                                                <div className="font-medium text-gray-800 text-lg text-center">{matchup.team2.name}</div>
                                                                <div className="text-sm text-gray-500">{matchup.team2.record}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Spread Column */}
                                                <div>
                                                    <div className="h-10 flex items-center justify-center text-sm font-semibold text-gray-700 mb-4">
                                                        Spread
                                                    </div>
                                                    {matchup.markets?.spread ? (
                                                        <div className="space-y-2">
                                                            {/* Team 1 Spread */}
                                                            <div 
                                                                className={`p-3 rounded-lg text-center transition-colors cursor-pointer h-20 flex flex-col justify-center ${
                                                                    matchup.isCompleted && matchup.actualScores?.team1CoveredSpread !== null
                                                                        ? (matchup.actualScores.team1CoveredSpread 
                                                                            ? 'bg-green-100 border-2 border-green-500' 
                                                                            : 'bg-red-100 border-2 border-red-300')
                                                                        : betSlip.some(bet => bet.id === `${matchup.matchupId}-spread-team1`)
                                                                            ? 'bg-blue-100 border-2 border-blue-500'
                                                                            : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
                                                                }`}
                                                                onClick={() => !matchup.isCompleted && addBetToSlip({
                                                                    matchupId: matchup.matchupId,
                                                                    type: 'spread',
                                                                    selection: 'team1',
                                                                    team: matchup.team1.name,
                                                                    line: matchup.markets.spread.team1.line,
                                                                    odds: matchup.markets.spread.team1.odds,
                                                                    description: `${matchup.team1.name} ${matchup.markets.spread.team1.line}`
                                                                })}
                                                            >
                                                                <div className={`text-lg font-bold mb-1 ${
                                                                    matchup.isCompleted && matchup.actualScores?.team1CoveredSpread !== null
                                                                        ? (matchup.actualScores.team1CoveredSpread ? 'text-green-600' : 'text-red-600')
                                                                        : 'text-gray-500'
                                                                }`}>{matchup.markets.spread.team1.line}</div>
                                                                {/* Only show odds for non-pick'em games */}
                                                                {matchup.markets.spread.team1.line !== "PK" && (
                                                                    <div className="text-sm text-gray-500">{formatOdds(matchup.markets.spread.team1.odds)}</div>
                                                                )}
                                                            </div>
                                                            {/* Team 2 Spread */}
                                                            <div 
                                                                className={`p-3 rounded-lg text-center transition-colors cursor-pointer h-20 flex flex-col justify-center ${
                                                                    matchup.isCompleted && matchup.actualScores?.team1CoveredSpread !== null
                                                                        ? (!matchup.actualScores.team1CoveredSpread 
                                                                            ? 'bg-green-100 border-2 border-green-500' 
                                                                            : 'bg-red-100 border-2 border-red-300')
                                                                        : betSlip.some(bet => bet.id === `${matchup.matchupId}-spread-team2`)
                                                                            ? 'bg-blue-100 border-2 border-blue-500'
                                                                            : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
                                                                }`}
                                                                onClick={() => !matchup.isCompleted && addBetToSlip({
                                                                    matchupId: matchup.matchupId,
                                                                    type: 'spread',
                                                                    selection: 'team2',
                                                                    team: matchup.team2.name,
                                                                    line: matchup.markets.spread.team2.line,
                                                                    odds: matchup.markets.spread.team2.odds,
                                                                    description: `${matchup.team2.name} ${matchup.markets.spread.team2.line}`
                                                                })}
                                                            >
                                                                <div className={`text-lg font-bold mb-1 ${
                                                                    matchup.isCompleted && matchup.actualScores?.team1CoveredSpread !== null
                                                                        ? (!matchup.actualScores.team1CoveredSpread ? 'text-green-600' : 'text-red-600')
                                                                        : 'text-gray-500'
                                                                }`}>{matchup.markets.spread.team2.line}</div>
                                                                {/* Only show odds for non-pick'em games */}
                                                                {matchup.markets.spread.team2.line !== "PK" && (
                                                                    <div className="text-sm text-gray-500">{formatOdds(matchup.markets.spread.team2.odds)}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <div className="bg-gray-100 p-3 rounded-lg text-center text-gray-400 h-20 flex items-center justify-center">-</div>
                                                            <div className="bg-gray-100 p-3 rounded-lg text-center text-gray-400 h-20 flex items-center justify-center">-</div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Total Column */}
                                                <div>
                                                    <div className="h-10 flex items-center justify-center text-sm font-semibold text-gray-700 mb-4">
                                                        Total
                                                    </div>
                                                    {matchup.markets?.total ? (
                                                        <div className="space-y-2">
                                                            {/* Over */}
                                                            <div 
                                                                className={`p-3 rounded-lg text-center transition-colors cursor-pointer h-20 flex flex-col justify-center ${
                                                                    matchup.isCompleted && matchup.actualScores?.overHit !== null
                                                                        ? (matchup.actualScores.overHit
                                                                            ? 'bg-green-100 border-2 border-green-500' 
                                                                            : 'bg-red-100 border-2 border-red-300') 
                                                                        : betSlip.some(bet => bet.id === `${matchup.matchupId}-total-over`)
                                                                            ? 'bg-blue-100 border-2 border-blue-500'
                                                                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                                                                }`}
                                                                onClick={() => !matchup.isCompleted && addBetToSlip({
                                                                    matchupId: matchup.matchupId,
                                                                    type: 'total',
                                                                    selection: 'over',
                                                                    team: `${matchup.team1.name} vs ${matchup.team2.name}`,
                                                                    line: matchup.markets.total.over.line,
                                                                    odds: matchup.markets.total.over.odds,
                                                                    description: `Over ${matchup.markets.total.over.line}`
                                                                })}
                                                            >
                                                                <div className="text-xs text-gray-600 mb-1">OVER</div>
                                                                <div className={`text-lg font-bold mb-1 ${
                                                                    matchup.isCompleted && matchup.actualScores?.overHit !== null
                                                                        ? (matchup.actualScores.overHit ? 'text-green-600' : 'text-red-600')
                                                                        : 'text-purple-600'
                                                                }`}>
                                                                    {matchup.markets.total.over.line}
                                                                </div>
                                                                <div className="text-sm text-gray-600">{formatOdds(matchup.markets.total.over.odds)}</div>
                                                            </div>
                                                            {/* Under */}
                                                            <div 
                                                                className={`p-3 rounded-lg text-center transition-colors cursor-pointer h-20 flex flex-col justify-center ${
                                                                    matchup.isCompleted && matchup.actualScores?.overHit !== null
                                                                        ? (!matchup.actualScores.overHit
                                                                            ? 'bg-green-100 border-2 border-green-500' 
                                                                            : 'bg-red-100 border-2 border-red-300') 
                                                                        : betSlip.some(bet => bet.id === `${matchup.matchupId}-total-under`)
                                                                            ? 'bg-blue-100 border-2 border-blue-500'
                                                                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                                                                }`}
                                                                onClick={() => !matchup.isCompleted && addBetToSlip({
                                                                    matchupId: matchup.matchupId,
                                                                    type: 'total',
                                                                    selection: 'under',
                                                                    team: `${matchup.team1.name} vs ${matchup.team2.name}`,
                                                                    line: matchup.markets.total.under.line,
                                                                    odds: matchup.markets.total.under.odds,
                                                                    description: `Under ${matchup.markets.total.under.line}`
                                                                })}
                                                            >
                                                                <div className="text-xs text-gray-600 mb-1">UNDER</div>
                                                                <div className={`text-lg font-bold mb-1 ${
                                                                    matchup.isCompleted && matchup.actualScores?.overHit !== null
                                                                        ? (!matchup.actualScores.overHit ? 'text-green-600' : 'text-red-600')
                                                                        : 'text-purple-600'
                                                                }`}>
                                                                    {matchup.markets.total.under.line}
                                                                </div>
                                                                <div className="text-sm text-gray-600">{formatOdds(matchup.markets.total.under.odds)}</div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <div className="bg-gray-100 p-3 rounded-lg text-center text-gray-400 h-20 flex items-center justify-center">-</div>
                                                            <div className="bg-gray-100 p-3 rounded-lg text-center text-gray-400 h-20 flex items-center justify-center">-</div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Moneyline Column */}
                                                <div>
                                                    <div className="h-10 flex items-center justify-center text-sm font-semibold text-gray-700 mb-4">
                                                        Moneyline
                                                    </div>
                                                    <div className="space-y-2">
                                                        {/* Team 1 Moneyline */}
                                                        <div 
                                                            className={`p-3 rounded-lg text-center transition-colors cursor-pointer h-20 flex flex-col justify-center ${
                                                                matchup.isCompleted && matchup.actualScores?.team1Won !== null
                                                                    ? (matchup.actualScores.team1Won 
                                                                        ? 'bg-green-100 border-2 border-green-500' 
                                                                        : 'bg-red-100 border-2 border-red-300') 
                                                                    : betSlip.some(bet => bet.id === `${matchup.matchupId}-moneyline-team1`)
                                                                        ? 'bg-blue-100 border-2 border-blue-500'
                                                                        : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                                                            }`}
                                                            onClick={() => !matchup.isCompleted && addBetToSlip({
                                                                matchupId: matchup.matchupId,
                                                                type: 'moneyline',
                                                                selection: 'team1',
                                                                team: matchup.team1.name,
                                                                line: 'ML',
                                                                odds: matchup.markets?.moneyline?.team1?.odds || matchup.team1.odds,
                                                                description: `${matchup.team1.name} ML`
                                                            })}
                                                        >
                                                            <div className={`text-lg font-bold ${
                                                                matchup.isCompleted && matchup.actualScores?.team1Won !== null
                                                                    ? (matchup.actualScores.team1Won ? 'text-green-600' : 'text-red-600')
                                                                    : 'text-blue-600'
                                                            }`}>
                                                                {formatOdds(matchup.markets?.moneyline?.team1?.odds || matchup.team1.odds)}
                                                            </div>
                                                        </div>
                                                        {/* Team 2 Moneyline */}
                                                        <div 
                                                            className={`p-3 rounded-lg text-center transition-colors cursor-pointer h-20 flex flex-col justify-center ${
                                                                matchup.isCompleted && matchup.actualScores?.team1Won !== null
                                                                    ? (!matchup.actualScores.team1Won 
                                                                        ? 'bg-green-100 border-2 border-green-500' 
                                                                        : 'bg-red-100 border-2 border-red-300') 
                                                                    : betSlip.some(bet => bet.id === `${matchup.matchupId}-moneyline-team2`)
                                                                        ? 'bg-blue-100 border-2 border-blue-500'
                                                                        : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                                                            }`}
                                                            onClick={() => !matchup.isCompleted && addBetToSlip({
                                                                matchupId: matchup.matchupId,
                                                                type: 'moneyline',
                                                                selection: 'team2',
                                                                team: matchup.team2.name,
                                                                line: 'ML',
                                                                odds: matchup.markets?.moneyline?.team2?.odds || matchup.team2.odds,
                                                                description: `${matchup.team2.name} ML`
                                                            })}
                                                        >
                                                            <div className={`text-lg font-bold ${
                                                                matchup.isCompleted && matchup.actualScores?.team1Won !== null
                                                                    ? (!matchup.actualScores.team1Won ? 'text-green-600' : 'text-red-600')
                                                                    : 'text-blue-600'
                                                            }`}>
                                                                {formatOdds(matchup.markets?.moneyline?.team2?.odds || matchup.team2.odds)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Enhanced Team Analysis Section - Hidden but calculations still run */}
                                        {false && matchup.markets?.teamAnalysis && (
                                            <div className="p-4 bg-gray-50 border-t">
                                                <h4 className="text-sm font-semibold text-gray-700 mb-3">Keeper League Analysis</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    {/* Team 1 Analysis */}
                                                    <div className="bg-white p-3 rounded-lg">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <img className="w-5 h-5 rounded-full" src={matchup.team1.avatar} alt={matchup.team1.name} />
                                                            <span className="font-medium text-sm">{matchup.team1.name}</span>
                                                        </div>
                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex justify-between">
                                                                <span>Strategy:</span>
                                                                <span className={`font-medium capitalize ${
                                                                    matchup.markets.teamAnalysis.team1.classification.strategy === 'contender' ? 'text-green-600' :
                                                                    matchup.markets.teamAnalysis.team1.classification.strategy === 'rebuilding' ? 'text-red-600' :
                                                                    'text-yellow-600'
                                                                }`}>
                                                                    {matchup.markets.teamAnalysis.team1.classification.strategy}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Consistency:</span>
                                                                <span className="font-medium">
                                                                    {(matchup.markets.teamAnalysis.team1.consistency.consistency * 100).toFixed(0)}%
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Momentum:</span>
                                                                <span className={`font-medium ${
                                                                    matchup.markets.teamAnalysis.team1.momentum > 0.2 ? 'text-green-600' :
                                                                    matchup.markets.teamAnalysis.team1.momentum < -0.2 ? 'text-red-600' :
                                                                    'text-gray-600'
                                                                }`}>
                                                                    {matchup.markets.teamAnalysis.team1.momentum > 0 ? '↗' : matchup.markets.teamAnalysis.team1.momentum < 0 ? '↘' : '→'}
                                                                    {Math.abs(matchup.markets.teamAnalysis.team1.momentum * 100).toFixed(0)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Team 2 Analysis */}
                                                    <div className="bg-white p-3 rounded-lg">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <img className="w-5 h-5 rounded-full" src={matchup.team2.avatar} alt={matchup.team2.name} />
                                                            <span className="font-medium text-sm">{matchup.team2.name}</span>
                                                        </div>
                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex justify-between">
                                                                <span>Strategy:</span>
                                                                <span className={`font-medium capitalize ${
                                                                    matchup.markets.teamAnalysis.team2.classification.strategy === 'contender' ? 'text-green-600' :
                                                                    matchup.markets.teamAnalysis.team2.classification.strategy === 'rebuilding' ? 'text-red-600' :
                                                                    'text-yellow-600'
                                                                }`}>
                                                                    {matchup.markets.teamAnalysis.team2.classification.strategy}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Consistency:</span>
                                                                <span className="font-medium">
                                                                    {(matchup.markets.teamAnalysis.team2.consistency.consistency * 100).toFixed(0)}%
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Momentum:</span>
                                                                <span className={`font-medium ${
                                                                    matchup.markets.teamAnalysis.team2.momentum > 0.2 ? 'text-green-600' :
                                                                    matchup.markets.teamAnalysis.team2.momentum < -0.2 ? 'text-red-600' :
                                                                    'text-gray-600'
                                                                }`}>
                                                                    {matchup.markets.teamAnalysis.team2.momentum > 0 ? '↗' : matchup.markets.teamAnalysis.team2.momentum < 0 ? '↘' : '→'}
                                                                    {Math.abs(matchup.markets.teamAnalysis.team2.momentum * 100).toFixed(0)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Matchup Context */}
                                                {matchup.markets.teamAnalysis.matchupContext.description && (
                                                    <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                                                        <strong>Matchup Insight:</strong> {matchup.markets.teamAnalysis.matchupContext.description}
                                                    </div>
                                                )}
                                                
                                                {/* Sportsbook Edge Info */}
                                                {matchup.markets.pointSpread?.edgeInfo && (
                                                    <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-700">
                                                        <strong>House Edge:</strong> {(matchup.markets.pointSpread.edgeInfo.edge * 100).toFixed(1)}%
                                                        {matchup.markets.pointSpread.edgeInfo.adjusted && (
                                                            <span className="ml-2 text-orange-600">(Adjusted for minimum edge)</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-md p-8 text-center">
                                <div className="text-gray-500">
                                    <p className="text-lg mb-2">No upcoming matchups found for Week {selectedWeek}</p>
                                    <p className="text-sm">Games may have already been played or the schedule isn't available yet.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {selectedBetType === 'futures' && (
                    <div className="space-y-4">
                        {/* Futures sub-tabs */}
                        <div className="flex border-b mb-4">
                            <button
                                className={`flex-1 py-2 px-4 text-center font-medium ${
                                    selectedFuturesTab === 'playoffs'
                                        ? 'bg-gray-900 text-white border-b-2 border-yellow-400'
                                        : 'text-gray-600 hover:text-gray-800'
                                }`}
                                onClick={() => setSelectedFuturesTab('playoffs')}
                            >
                                Playoff Appearance
                            </button>
                            <button
                                className={`flex-1 py-2 px-4 text-center font-medium ${
                                    selectedFuturesTab === 'championship'
                                        ? 'bg-gray-900 text-white border-b-2 border-yellow-400'
                                        : 'text-gray-600 hover:text-gray-800'
                                }`}
                                onClick={() => setSelectedFuturesTab('championship')}
                            >
                                Championship
                            </button>
                        </div>

                        {/* Futures content */}
                        {selectedFuturesTab === 'playoffs' && (
                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gray-800 mb-4">Playoff Appearance Odds</h2>
                                <div className="grid gap-4">
                                    {playoffOdds.map((team, index) => (
                                        <div key={team.rosterId} className="bg-white rounded-lg shadow-md p-4">
                                            <div className="flex items-center justify-between">
                                                {/* Team Info */}
                                                <div className="flex items-center gap-3 flex-1">
                                                    <img className="h-10 w-10 rounded-full" src={team.avatar} alt={team.name} />
                                                    <div>
                                                        <div className="font-medium text-gray-800">{team.name}</div>
                                                        <div className="text-sm text-gray-600">#{team.rank} • {team.record}</div>
                                                    </div>
                                                </div>
                                                
                                                {/* Probability */}
                                                <div className="text-center mx-4">
                                                    <div className="text-lg font-bold text-gray-800">{(team.probability * 100).toFixed(1)}%</div>
                                                    <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                                                        <div 
                                                            className="bg-blue-500 h-2 rounded-full" 
                                                            style={{width: `${team.probability * 100}%`}}
                                                        ></div>
                                                    </div>
                                                </div>
                                                
                                                {/* Clickable Odds */}
                                                <div 
                                                    className={`p-3 rounded-lg text-center transition-colors cursor-pointer min-w-[80px] ${
                                                        betSlip.some(bet => bet.id === `playoff-${team.rosterId}`)
                                                            ? 'bg-blue-100 border-2 border-blue-500'
                                                            : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
                                                    }`}
                                                    onClick={() => addBetToSlip({
                                                        matchupId: `playoff-${team.rosterId}`,
                                                        type: 'futures',
                                                        selection: 'playoffs',
                                                        team: team.name,
                                                        line: 'Make Playoffs',
                                                        odds: team.odds,
                                                        description: `${team.name} Make Playoffs`
                                                    })}
                                                >
                                                    <div className="text-lg font-bold text-gray-500">
                                                        {formatOdds(team.odds)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedFuturesTab === 'championship' && (
                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-gray-800 mb-4">Championship Odds</h2>
                                <div className="grid gap-4">
                                    {championshipOdds.map((team, index) => (
                                        <div key={team.rosterId} className="bg-white rounded-lg shadow-md p-4">
                                            <div className="flex items-center justify-between">
                                                {/* Team Info */}
                                                <div className="flex items-center gap-3 flex-1">
                                                    <img className="h-10 w-10 rounded-full" src={team.avatar} alt={team.name} />
                                                    <div>
                                                        <div className="font-medium text-gray-800">{team.name}</div>
                                                        <div className="text-sm text-gray-600">#{team.rank} • {team.record}</div>
                                                        {team.isWildcardContender && (
                                                            <div className="text-xs text-blue-600">🎯 Wildcard Contender</div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Probability */}
                                                <div className="text-center mx-4">
                                                    <div className="text-lg font-bold text-gray-800">{(team.probability * 100).toFixed(1)}%</div>
                                                    <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                                                        <div 
                                                            className="bg-blue-500 h-2 rounded-full" 
                                                            style={{width: `${team.probability * 100}%`}}
                                                        ></div>
                                                    </div>
                                                    {team.playoffProb && (
                                                        <div className="text-xs text-gray-600 mt-1">
                                                            Playoff: {(team.playoffProb * 100).toFixed(1)}%
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Clickable Odds */}
                                                <div 
                                                    className={`p-3 rounded-lg text-center transition-colors cursor-pointer min-w-[80px] ${
                                                        betSlip.some(bet => bet.id === `championship-${team.rosterId}`)
                                                            ? 'bg-blue-100 border-2 border-blue-500'
                                                            : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
                                                    }`}
                                                    onClick={() => addBetToSlip({
                                                        matchupId: `championship-${team.rosterId}`,
                                                        type: 'futures',
                                                        selection: 'championship',
                                                        team: team.name,
                                                        line: 'Win Championship',
                                                        odds: team.odds,
                                                        description: `${team.name} Win Championship`
                                                    })}
                                                >
                                                    <div className="text-lg font-bold text-gray-500">
                                                        {formatOdds(team.odds)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}



                {/* Notifications */}
                {notifications.length > 0 && (
                    <div className="fixed top-4 right-4 space-y-2 z-50">
                        {notifications.map(notification => (
                            <div
                                key={notification.id}
                                className={`px-4 py-2 rounded-lg shadow-lg text-white ${
                                    notification.type === 'success' ? 'bg-green-500' :
                                    notification.type === 'error' ? 'bg-red-500' :
                                    'bg-blue-500'
                                }`}
                            >
                                {notification.message}
                            </div>
                        ))}
                    </div>
                )}

                {/* Mobile Bet Slip Overlay */}
                {betSlip.length > 0 && (
                    <div className={`fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg transform transition-transform duration-300 z-40 ${
                        isBetSlipExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-60px)]'
                    }`}>
                        {/* Bet Slip Header */}
                        <div 
                            className="px-4 py-3 border-b cursor-pointer flex justify-between items-center bg-gray-50"
                            onClick={() => setIsBetSlipExpanded(!isBetSlipExpanded)}
                        >
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-gray-800">Bet Slip ({betSlip.length})</span>
                                {betAmount && parseFloat(betAmount) > 0 && (
                                    <span className="text-green-600 font-semibold text-sm">
                                        ${calculatePayout().toFixed(2)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        clearBetSlip();
                                    }}
                                    className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1"
                                >
                                    Clear
                                </button>
                                <svg 
                                    className={`w-4 h-4 text-gray-500 transform transition-transform ${
                                        isBetSlipExpanded ? 'rotate-180' : ''
                                    }`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>

                        {/* Bet Content */}
                        <div className="max-h-[50vh] overflow-y-auto">
                            {/* Bets List */}
                            <div className="p-3 space-y-2">
                                {betSlip.map(bet => (
                                    <div key={bet.id} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                                        <div>
                                            <div className="text-sm font-medium text-gray-800">{bet.description}</div>
                                            <div className="text-xs text-gray-600">{formatOdds(bet.odds)}</div>
                                        </div>
                                        <button
                                            onClick={() => removeBetFromSlip(bet.id)}
                                            className="text-red-500 hover:text-red-700 text-lg leading-none"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Bet Controls */}
                            <div className="p-3 border-t bg-gray-50 space-y-3">
                                {/* Amount & Parlay Info */}
                                <div className="flex gap-3 items-center">
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={betAmount}
                                        onChange={(e) => setBetAmount(e.target.value)}
                                        className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                        placeholder="Bet $"
                                    />
                                    {betSlip.length > 1 && (
                                        <div className="text-xs text-blue-600 font-medium">
                                            {betSlip.length}-leg parlay
                                        </div>
                                    )}
                                </div>

                                {/* Payout & Button */}
                                {betAmount && parseFloat(betAmount) > 0 && (
                                    <div className="flex justify-between items-center">
                                        <div className="text-sm">
                                            <span className="text-gray-600">To Win: </span>
                                            <span className="font-semibold text-green-600">
                                                ${(calculatePayout() - parseFloat(betAmount)).toFixed(2)}
                                            </span>
                                        </div>
                                        <button
                                            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                                            onClick={() => {
                                                addNotification(`Bet placed: $${betAmount} to win $${(calculatePayout() - parseFloat(betAmount)).toFixed(2)}`, 'success');
                                                clearBetSlip();
                                                setIsBetSlipExpanded(false);
                                            }}
                                        >
                                            Place Bet
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Disclaimer */}
                <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex">
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">
                                For Entertainment Purposes Only
                            </h3>
                            <div className="mt-2 text-sm text-yellow-700">
                                <p>
                                    These odds are calculated using historical performance, team statistics, and power rankings. 
                                    They are for entertainment and analytical purposes only. Fantasy football involves elements 
                                    of skill and chance - actual results may vary significantly from projections.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sportsbook;