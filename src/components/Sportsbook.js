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
    calculateWinProbability,
    applyMarketVig
} from '../utils/sportsbookCalculations';
import { SPORTSBOOK_VIG } from '../config';
import { generateCleanBettingMarkets } from '../utils/cleanOddsCalculator';
import { 
    calculateRecentForm, 
    probabilityToAmericanOdds, 
    formatOdds 
} from '../utils/matchupOdds';
import { 
    buildDynamicSeasonStats, 
    getSeasonData,
    normalizeSeasonKey
} from '../utils/dynamicSeasonStats';
import { 
    calculateWinProbabilityByRosterId 
} from '../utils/winProbabilityCalculator';
import { formatScore } from '../utils/formatUtils';

// ── Sportsbook design tokens ──────────────────────────────────────────────────
// Background layers: bg-[#0d1117] (deepest) → bg-[#161b22] (card) → bg-[#1c2333] (row)
// Accent: #00d4a0 (teal-green) for live odds buttons
// Highlight: #f59e0b (amber) for futures/selected tabs
// Locked: bg-[#2d1b1b] red tint
// Win: bg-[#0d2e1a] green tint  / border-[#00d4a0]
// Loss: bg-[#2d1b1b] red tint  / border-[#ef4444]
// Selected: bg-[#0e2040] blue tint / border-[#3b82f6]

const OddsBtn = ({ odds, selected, won, lost, locked, onClick, children, className = '' }) => {
    let bg = 'bg-[#1c2333] border-white/10 hover:bg-[#252f45] hover:border-white/20 cursor-pointer';
    if (locked)   bg = 'bg-[#1a1a2e] border-white/5 cursor-not-allowed opacity-50';
    else if (won) bg = 'bg-[#0d2e1a] border-[#00d4a0] cursor-default';
    else if (lost) bg = 'bg-[#2d1b1b] border-[#ef4444]/40 cursor-default';
    else if (selected) bg = 'bg-[#0e2040] border-[#3b82f6] cursor-pointer';

    return (
        <button
            className={`w-full h-16 flex flex-col items-center justify-center rounded-lg border transition-all duration-150 select-none ${bg} ${className}`}
            onClick={onClick}
            disabled={locked}
        >
            {children}
        </button>
    );
};

const OddsValue = ({ value, won, lost, selected }) => {
    let color = 'text-[#00d4a0]';
    if (won)    color = 'text-[#00d4a0]';
    if (lost)   color = 'text-[#ef4444]';
    if (selected) color = 'text-[#60a5fa]';
    return <span className={`text-base font-bold tabular-nums ${color}`}>{value}</span>;
};

const Sportsbook = () => {
    const { 
        historicalData, 
        leagueData, 
        getTeamDetails, 
        processedSeasonalRecords, 
        nflState, 
        loading, 
        rostersWithDetails 
    } = useSleeperData();

    const [selectedBetType, setSelectedBetType] = useState('gameLines');
    const [selectedFuturesTab, setSelectedFuturesTab] = useState('playoffs');
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [matchupOdds, setMatchupOdds] = useState([]);
    const [playoffOdds, setPlayoffOdds] = useState([]);
    const [championshipOdds, setChampionshipOdds] = useState([]);
    const [eloRatings, setEloRatings] = useState({});

    const [betSlip, setBetSlip] = useState([]);
    const [betAmount, setBetAmount] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [isBetSlipExpanded, setIsBetSlipExpanded] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationData, setConfirmationData] = useState(null);

    const currentSeason = useMemo(() => {
        return leagueData && Array.isArray(leagueData) ? leagueData[0]?.season : leagueData?.season;
    }, [leagueData]);

    const dynamicStats = useMemo(() => {
        if (!processedSeasonalRecords || !currentSeason || !historicalData) return {};
        try {
            return buildDynamicSeasonStats({ processedSeasonalRecords, season: currentSeason, historicalData, getTeamDetails, rostersWithDetails });
        } catch (error) {
            console.warn('[Sportsbook] Error building dynamic stats:', error);
            return {};
        }
    }, [processedSeasonalRecords, currentSeason, historicalData, getTeamDetails, rostersWithDetails]);

    const playoffsAreSet = useMemo(() => {
        const currentWeek = nflState?.week ? parseInt(nflState.week) : 0;
        return currentWeek > 14;
    }, [nflState]);

    useEffect(() => {
        if (nflState?.week && !selectedWeek) setSelectedWeek(parseInt(nflState.week));
        if (currentSeason && historicalData) {
            const ratings = calculateEloRatings(historicalData, currentSeason);
            setEloRatings(ratings);
        }
    }, [nflState, selectedWeek, currentSeason, historicalData]);

    useEffect(() => {
        if (selectedBetType === 'futures' && playoffsAreSet && selectedFuturesTab === 'playoffs') {
            setSelectedFuturesTab('championship');
        }
    }, [playoffsAreSet, selectedBetType, selectedFuturesTab]);

    const getAbbreviatedTeamName = (teamName) => {
        if (!teamName) return '';
        const abbreviations = { 'The ': '', 'Team ': '', ' FC': '', ' United': '', ' City': '', 'Dynasty': 'Dyn', 'Champions': 'Champs', 'Destroyers': 'Dest', 'Crushers': 'Crush', 'Warriors': 'War', 'Titans': 'Tit', 'Thunder': 'Thnd', 'Lightning': 'Light', 'Hurricanes': 'Hurr', 'Tornadoes': 'Torn', 'Blizzard': 'Bliz', 'Avalanche': 'Aval', 'Storm': 'Storm', 'Fire': 'Fire', 'Ice': 'Ice', 'Steel': 'Steel', 'Iron': 'Iron', 'Gold': 'Gold', 'Silver': 'Silv', 'Diamond': 'Diam', 'Platinum': 'Plat', 'Elite': 'Elite', 'Power': 'Pow', 'Force': 'Force', 'Impact': 'Imp', 'Explosion': 'Exp', 'Revolution': 'Rev', 'Evolution': 'Evo', 'Domination': 'Dom', 'Destruction': 'Dest', 'Annihilation': 'Ann', 'Obliteration': 'Obl', 'Decimation': 'Dec', 'Devastation': 'Dev' };
        let abbreviated = teamName;
        Object.entries(abbreviations).forEach(([full, abbr]) => { abbreviated = abbreviated.replace(new RegExp(full, 'gi'), abbr); });
        if (abbreviated.length > 12) { const words = abbreviated.split(' '); if (words.length > 1) { abbreviated = words[0] + words.slice(1).map(w => w.charAt(0)).join(''); } }
        if (abbreviated.length > 12) abbreviated = abbreviated.substring(0, 10) + '…';
        return abbreviated;
    };

    const addNotification = (message, type = 'info') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 3000);
    };

    const addBetToSlip = (bet) => {
        const betId = `${bet.matchupId}-${bet.type}-${bet.selection}`;
        const existingBetIndex = betSlip.findIndex(b => b.id === betId);
        if (existingBetIndex >= 0) { setBetSlip(prev => prev.filter(b => b.id !== betId)); addNotification('Bet removed from slip', 'info'); return; }
        const conflicts = betSlip.filter(existingBet => {
            if (existingBet.matchupId !== bet.matchupId) return false;
            if (existingBet.type === bet.type) return true;
            if ((existingBet.type === 'spread' && bet.type === 'moneyline') || (existingBet.type === 'moneyline' && bet.type === 'spread')) return true;
            if (existingBet.type === 'total' || bet.type === 'total') return false;
            return true;
        });
        if (conflicts.length > 0) { addNotification('Cannot add conflicting bets for the same game (spread + moneyline not allowed).', 'error'); return; }
        const timestamp = new Date().toLocaleString();
        setBetSlip(prev => [...prev, { ...bet, id: betId, timestamp }]);
        addNotification('Bet added to slip', 'success');
    };

    const removeBetFromSlip = (betId) => { setBetSlip(prev => prev.filter(b => b.id !== betId)); addNotification('Bet removed from slip', 'info'); };
    const clearBetSlip = () => { setBetSlip([]); setBetAmount(''); addNotification('Bet slip cleared', 'info'); };

    const calculateParlayOdds = (bets) => {
        if (!bets.length) return 0;
        let total = 1;
        bets.forEach(bet => { const d = bet.odds > 0 ? (bet.odds / 100) + 1 : (100 / Math.abs(bet.odds)) + 1; total *= d; });
        const american = total >= 2 ? (total - 1) * 100 : -100 / (total - 1);
        return Math.round(american);
    };

    const calculatePayout = () => {
        if (!betAmount || !betSlip.length) return 0;
        const amount = parseFloat(betAmount);
        if (isNaN(amount) || amount <= 0) return 0;
        if (betSlip.length === 1) {
            const odds = betSlip[0].odds;
            const win = odds > 0 ? (amount * odds / 100) : (amount * 100 / Math.abs(odds));
            return amount + win;
        } else {
            const pOdds = calculateParlayOdds(betSlip);
            const win = pOdds > 0 ? (amount * pOdds / 100) : (amount * 100 / Math.abs(pOdds));
            return amount + win;
        }
    };

    const canPlace = betSlip.length > 0 && betAmount && !isNaN(parseFloat(betAmount)) && parseFloat(betAmount) > 0;

    const calculateTeamPowerScore = (teamStats, rosterId, season) => {
        const winPct = teamStats.gamesPlayed > 0 ? teamStats.wins / teamStats.gamesPlayed : 0;
        const avgPoints = teamStats.averageScore || 0;
        const pointsFor = teamStats.pointsFor || 0;
        const pointsAgainst = teamStats.pointsAgainst || 0;
        const luckRating = teamStats.luckRating || 0;
        const strengthOfSchedule = teamStats.strengthOfSchedule || 0;
        const recentForm = calculateRecentFormLocal(rosterId, season, 4);
        const momentum = calculateTeamMomentum(rosterId, season, historicalData, 6);
        const eloComponent = eloRatings[rosterId] ? (eloRatings[rosterId] - 1500) / 10 : 0;
        const powerScore = (winPct * 100) * 0.25 + (avgPoints / 10) * 0.20 + (recentForm * 10) * 0.15 + ((pointsFor - pointsAgainst) / 100) * 0.15 + (momentum * 20) * 0.10 + eloComponent * 0.10 + (luckRating * 50) * 0.03 + (strengthOfSchedule * 10) * 0.02;
        return Math.max(0, powerScore);
    };

    const calculateRecentFormLocal = (rosterId, season, gameCount = 4) => {
        if (!historicalData?.matchupsBySeason?.[season]) return 0.5;
        const teamMatchups = historicalData.matchupsBySeason[season].filter(m => String(m.team1_roster_id) === String(rosterId) || String(m.team2_roster_id) === String(rosterId)).sort((a, b) => parseInt(b.week) - parseInt(a.week)).slice(0, gameCount);
        if (!teamMatchups.length) return 0.5;
        const wins = teamMatchups.filter(matchup => { const isTeam1 = String(matchup.team1_roster_id) === String(rosterId); const ts = isTeam1 ? matchup.team1_score : matchup.team2_score; const os = isTeam1 ? matchup.team2_score : matchup.team1_score; return ts > os; }).length;
        return wins / teamMatchups.length;
    };

    const teamPowerRankings = useMemo(() => {
        const seasonData = getSeasonData(processedSeasonalRecords, currentSeason);
        if (!seasonData) return {};
        const teams = Object.keys(seasonData).map(rosterId => {
            const team = seasonData[rosterId];
            const powerScore = calculateTeamPowerScore(team, rosterId, currentSeason);
            const classification = classifyKeeperLeagueTeam(rosterId, seasonData, historicalData, currentSeason);
            const consistency = calculateTeamConsistency(rosterId, seasonData, historicalData, currentSeason);
            const momentum = calculateTeamMomentum(rosterId, currentSeason, historicalData, 6);
            return { rosterId, ...team, powerScore, classification, consistency, momentum };
        }).sort((a, b) => b.powerScore - a.powerScore);
        const rankings = {};
        teams.forEach((team, index) => { rankings[team.rosterId] = { ...team, rank: index + 1, powerScore: team.powerScore }; });
        return rankings;
    }, [processedSeasonalRecords, currentSeason, eloRatings, historicalData]);

    const getEliminatedTeams = useMemo(() => {
        if (!playoffsAreSet || !historicalData?.winnersBracketBySeason) return new Set();
        const seasonBracket = historicalData.winnersBracketBySeason[currentSeason];
        if (!seasonBracket) return new Set();
        const playoffTeamIds = new Set();
        const addTeamsFromBracket = (bracket) => { if (!bracket) return; if (Array.isArray(bracket)) { bracket.forEach(team => { if (team?.roster_id) playoffTeamIds.add(String(team.roster_id)); }); } else if (typeof bracket === 'object') { Object.values(bracket).forEach(team => { if (team?.roster_id) playoffTeamIds.add(String(team.roster_id)); }); } };
        addTeamsFromBracket(seasonBracket);
        const eliminated = new Set();
        if (teamPowerRankings) Object.keys(teamPowerRankings).forEach(rosterId => { if (!playoffTeamIds.has(rosterId)) eliminated.add(rosterId); });
        return eliminated;
    }, [playoffsAreSet, currentSeason, historicalData, teamPowerRankings]);

    const getPlayoffTeams = useMemo(() => {
        if (!historicalData?.winnersBracketBySeason) return new Set();
        const seasonBracket = historicalData.winnersBracketBySeason[currentSeason];
        if (!Array.isArray(seasonBracket)) return new Set();
        const allBracketTeams = new Set(), eliminatedTeams = new Set();
        seasonBracket.forEach(match => {
            const t1 = match.t1 ? String(match.t1) : null, t2 = match.t2 ? String(match.t2) : null;
            const winner = match.w ? String(match.w) : null, loser = match.l ? String(match.l) : null;
            if (t1) allBracketTeams.add(t1); if (t2) allBracketTeams.add(t2);
            if (loser) eliminatedTeams.add(loser);
        });
        const activeTeams = new Set();
        allBracketTeams.forEach(team => { if (!eliminatedTeams.has(team)) activeTeams.add(team); });
        return activeTeams;
    }, [currentSeason, historicalData]);

    const getRecentAverage = (rosterId, season, N = 2) => {
        if (!historicalData?.matchupsBySeason?.[season]) return 0;
        const matchups = historicalData.matchupsBySeason[season].filter(m => m.t1 === rosterId || m.t2 === rosterId);
        const recent = matchups.slice(-N);
        if (!recent.length) return 0;
        const total = recent.reduce((sum, m) => { const score = m.t1 === rosterId ? m.t1_score : m.t2_score; return sum + (typeof score === 'number' ? score : 0); }, 0);
        return total / recent.length;
    };

    const getMeanAndVariance = (rosterId, season, N = null) => {
        if (!historicalData?.matchupsBySeason?.[season]) return { mean: 0, variance: 0, count: 0 };
        let matchups = historicalData.matchupsBySeason[season].filter(m => m.t1 === rosterId || m.t2 === rosterId);
        if (N) matchups = matchups.slice(-N);
        const scores = matchups.map(m => m.t1 === rosterId ? m.t1_score : m.t2_score).filter(s => typeof s === 'number');
        if (!scores.length) return { mean: 0, variance: 0, count: 0 };
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
        return { mean, variance, count: scores.length };
    };

    function erf(x) {
        const sign = x >= 0 ? 1 : -1; x = Math.abs(x);
        const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return sign * y;
    }

    const generateMatchupOdds = (week) => {
        if (!processedSeasonalRecords || !historicalData) return [];
        const getTeamName = (ownerId, season) => { const details = getTeamDetails(ownerId, season); return details?.name || `Team ${ownerId}`; };
        const seasonMatchups = getSeasonData(historicalData.matchupsBySeason, currentSeason);
        if (!seasonMatchups) return [];
        const weekMatchups = seasonMatchups.filter(m => parseInt(m.week) === week);

        return weekMatchups.map(matchup => {
            const t1 = matchup.t1, t2 = matchup.t2;
            const t1Stats = getMeanAndVariance(t1, currentSeason, 4), t2Stats = getMeanAndVariance(t2, currentSeason, 4);
            const t1Season = getMeanAndVariance(t1, currentSeason), t2Season = getMeanAndVariance(t2, currentSeason);
            const t1Mean = t1Stats.count >= 2 ? t1Stats.mean : t1Season.mean, t2Mean = t2Stats.count >= 2 ? t2Stats.mean : t2Season.mean;
            const t1Var = t1Stats.count >= 2 ? t1Stats.variance : t1Season.variance, t2Var = t2Stats.count >= 2 ? t2Stats.variance : t2Season.variance;
            const t1N = t1Stats.count >= 2 ? t1Stats.count : t1Season.count, t2N = t2Stats.count >= 2 ? t2Stats.count : t2Season.count;
            const diff = t1Mean - t2Mean, stdErr = Math.sqrt((t1Var / t1N) + (t2Var / t2N));
            let winProb = 0.5;
            if (stdErr > 0) winProb = 0.5 + 0.5 * erf(diff / (Math.sqrt(2) * stdErr));
            const spread = diff;
            let t1ML = winProb > 0.5 ? -Math.round(100 * winProb / (1 - winProb)) : Math.round(100 * (1 - winProb) / winProb);
            let t2ML = winProb < 0.5 ? -Math.round(100 * (1 - winProb) / winProb) : Math.round(100 * winProb / (1 - winProb));
            const juice = 15;
            t1ML = t1ML > 0 ? t1ML + juice : t1ML - juice;
            t2ML = t2ML > 0 ? t2ML + juice : t2ML - juice;

            try {
                const team1RosterId = String(matchup.team1_roster_id), team2RosterId = String(matchup.team2_roster_id);
                if (!teamPowerRankings[team1RosterId] || !teamPowerRankings[team2RosterId]) return null;
                const currentWeek = nflState?.week ? parseInt(nflState.week) : null;
                const isCompleted = (matchup.team1_score > 0 || matchup.team2_score > 0) && (currentWeek ? week < currentWeek : true);
                const seasonRosters = getSeasonData(historicalData.rostersBySeason, currentSeason);
                const rosterForTeam1 = seasonRosters?.find(r => String(r.roster_id) === team1RosterId);
                const team1OwnerId = rosterForTeam1?.owner_id;
                const team1Details = getTeamDetails(team1OwnerId, currentSeason);
                const rosterForTeam2 = seasonRosters?.find(r => String(r.roster_id) === team2RosterId);
                const team2OwnerId = rosterForTeam2?.owner_id;
                const team2Details = getTeamDetails(team2OwnerId, currentSeason);

                let team1WinProb = calculateWinProbabilityByRosterId(team1RosterId, team2RosterId, dynamicStats);
                if (team1WinProb === 0.5 && (!dynamicStats[team1RosterId] || !dynamicStats[team2RosterId])) {
                    team1WinProb = calculateWinProbability(team1RosterId, team2RosterId, teamPowerRankings, eloRatings, historicalData, currentSeason);
                }

                const team1Stats = dynamicStats[team1RosterId] || teamPowerRankings[team1RosterId];
                const team2Stats = dynamicStats[team2RosterId] || teamPowerRankings[team2RosterId];
                if (team1Stats && team2Stats) {
                    const t1DPR = team1Stats.dpr || team1Stats.adjustedDPR || 1.0, t2DPR = team2Stats.dpr || team2Stats.adjustedDPR || 1.0;
                    if (t1DPR > t2DPR + 0.1 && team1WinProb < 0.5) team1WinProb = 1 - team1WinProb;
                    else if (t2DPR > t1DPR + 0.1 && team1WinProb > 0.5) team1WinProb = 1 - team1WinProb;
                }

                const team2WinProb = 1 - team1WinProb;
                const { probA: team1AdjProb, probB: team2AdjProb } = applyMarketVig(team1WinProb, team2WinProb, SPORTSBOOK_VIG);
                const team1OddsData = calculateBookmakerOdds(team1AdjProb, false);
                const team2OddsData = calculateBookmakerOdds(team2AdjProb, false);

                const didStarterScore = (m, side) => {
                    try {
                        const candidate = side === 'team1' ? (m.team1_players || m.team1_details || m.team1_players_points || m.team1_players_points_map || m.team1_players_points_by_id || null) : (m.team2_players || m.team2_details || m.team2_players_points || m.team2_players_points_map || m.team2_players_points_by_id || null);
                        if (!candidate || typeof candidate !== 'object') return false;
                        const starters = candidate.starters || candidate.starting_lineup || candidate.starting_lineup_ids || null;
                        const ptsMap = candidate.players_points || candidate.players_points_map || candidate.players_points_by_id || candidate;
                        if (!ptsMap || typeof ptsMap !== 'object') return false;
                        if (!Array.isArray(starters) || !starters.length) return Object.values(ptsMap).some(v => { const n = (typeof v === 'string') ? Number(v) : v; return typeof n === 'number' && !isNaN(n) && n > 0; });
                        return starters.some(sid => { if (sid === null || sid === undefined) return false; const key = String(sid); const val = ptsMap[key] !== undefined ? ptsMap[key] : ptsMap[Number(key)]; const n = (typeof val === 'string') ? Number(val) : val; return typeof n === 'number' && !isNaN(n) && n > 0; });
                    } catch (e) { return false; }
                };

                const playersScored = didStarterScore(matchup, 'team1') || didStarterScore(matchup, 'team2');
                const matchupData = {
                    matchupId: matchup.matchup_id, week, isCompleted,
                    bettingLocked: !!(playersScored && nflState?.week && parseInt(nflState.week) === week),
                    team1: { rosterId: team1RosterId, name: team1Details.name, avatar: team1Details.avatar, record: team1Stats?.record || `${teamPowerRankings[team1RosterId]?.wins || 0}-${teamPowerRankings[team1RosterId]?.losses || 0}`, avgPoints: team1Stats?.avgPerGame || teamPowerRankings[team1RosterId]?.averageScore || 0, powerScore: team1Stats?.dpr || teamPowerRankings[team1RosterId]?.powerScore || 0, eloRating: eloRatings[team1RosterId] || 1500, momentum: calculateTeamMomentum(team1RosterId, currentSeason, historicalData), probability: team1WinProb, odds: team1OddsData.americanOdds, isHot: team1Stats?.isHot || false, isCold: team1Stats?.isCold || false, tier: team1Stats?.tier || null },
                    team2: { rosterId: team2RosterId, name: team2Details.name, avatar: team2Details.avatar, record: team2Stats?.record || `${teamPowerRankings[team2RosterId]?.wins || 0}-${teamPowerRankings[team2RosterId]?.losses || 0}`, avgPoints: team2Stats?.avgPerGame || teamPowerRankings[team2RosterId]?.averageScore || 0, powerScore: team2Stats?.dpr || teamPowerRankings[team2RosterId]?.powerScore || 0, eloRating: eloRatings[team2RosterId] || 1500, momentum: calculateTeamMomentum(team2RosterId, currentSeason, historicalData), probability: team2WinProb, odds: team2OddsData.americanOdds, isHot: team2Stats?.isHot || false, isCold: team2Stats?.isCold || false, tier: team2Stats?.tier || null },
                    spread, moneyline: { [t1]: t1ML, [t2]: t2ML }, winProb,
                };

                const useDynamicStats = Object.keys(dynamicStats).length > 0;
                const statsToUse = useDynamicStats ? dynamicStats : teamPowerRankings;

                const bettingMarkets = generateCleanBettingMarkets({ team1RosterId, team2RosterId, team1Name: team1Details.name, team2Name: team2Details.name, winProbability: team1WinProb }, statsToUse, { vig: SPORTSBOOK_VIG, includePropBets: true, weekNumber: week });

                if (bettingMarkets?.total) {
                    if (isNaN(bettingMarkets.total.over.line) || !bettingMarkets.total.over.line) { const fallbackTotal = ((team1Stats?.avgPerGame || 120) + (team2Stats?.avgPerGame || 120)) * 1.05; bettingMarkets.total.over.line = Math.round(fallbackTotal * 2) / 2; bettingMarkets.total.under.line = bettingMarkets.total.over.line; }
                    if (isNaN(bettingMarkets.total.over.odds)) bettingMarkets.total.over.odds = -110;
                    if (isNaN(bettingMarkets.total.under.odds)) bettingMarkets.total.under.odds = -110;
                }

                if (isCompleted) {
                    matchupData.actualScores = {
                        team1Score: matchup.team1_score, team2Score: matchup.team2_score,
                        team1Won: matchup.team1_score > matchup.team2_score,
                        totalPoints: matchup.team1_score + matchup.team2_score,
                        team1CoveredSpread: bettingMarkets?.spread ? (() => { const line = bettingMarkets.spread.team1.line; const sp = line === "PK" ? 0 : parseFloat(line); return (matchup.team1_score - matchup.team2_score) > -sp; })() : null,
                        overHit: bettingMarkets?.total ? (() => (matchup.team1_score + matchup.team2_score) > bettingMarkets.total.over.line)() : null
                    };
                }

                matchupData.markets = bettingMarkets;
                return matchupData;
            } catch (error) { return null; }
        }).filter(Boolean);
    };

    const generatePlayoffOdds = () => {
        if (!teamPowerRankings) return [];
        return Object.keys(teamPowerRankings).map(rosterId => {
            const team = teamPowerRankings[rosterId];
            const seasonRosters = getSeasonData(historicalData.rostersBySeason, currentSeason);
            const rosterForTeam = seasonRosters?.find(r => String(r.roster_id) === rosterId);
            const ownerId = rosterForTeam?.owner_id;
            const teamDetails = getTeamDetails(ownerId, currentSeason);
            const playoffProb = calculatePlayoffProbability(rosterId);
            return { rosterId, name: teamDetails.name, avatar: teamDetails.avatar, record: `${team.wins || 0}-${team.losses || 0}`, powerScore: team.powerScore, rank: team.rank, probability: playoffProb, odds: probabilityToAmericanOdds(playoffProb) };
        }).sort((a, b) => b.probability - a.probability);
    };

    const calculatePlayoffProbability = (rosterId) => {
        const team = teamPowerRankings[rosterId];
        if (!team) return 0;
        const gamesPlayed = team.gamesPlayed || 0;
        const gamesRemaining = Math.max(0, 14 - gamesPlayed);
        return calculateHybridPlayoffProbability(rosterId, teamPowerRankings, gamesRemaining, 3000);
    };

    const generateChampionshipOdds = () => {
        if (!teamPowerRankings || !Object.keys(teamPowerRankings).length) return [];
        const currentGamesPlayed = Math.max(...Object.values(teamPowerRankings).map(t => t.gamesPlayed || 0));
        const remainingGames = Math.max(0, 14 - currentGamesPlayed);
        const getTeamName = (ownerId, season) => { const details = getTeamDetails(ownerId, season); return details?.name || `Team ${ownerId}`; };

        const odds = Object.keys(teamPowerRankings).map(rosterId => {
            try {
                const team = teamPowerRankings[rosterId];
                const seasonRosters = getSeasonData(historicalData.rostersBySeason, currentSeason);
                const rosterForTeam = seasonRosters?.find(r => String(r.roster_id) === rosterId);
                const ownerId = rosterForTeam?.owner_id;
                const teamDetails = getTeamDetails(ownerId, currentSeason);
                if (!teamDetails) return null;
                const championshipData = calculateChampionshipOdds(rosterId, teamPowerRankings, remainingGames, 1000, historicalData, currentSeason, getTeamName, nflState);
                return { rosterId, name: teamDetails.name, avatar: teamDetails.avatar, record: `${team.wins || 0}-${team.losses || 0}`, powerScore: team.powerScore, rank: team.rank, probability: championshipData.championshipProbability, odds: championshipData.odds.american, playoffProb: championshipData.playoffProbability, expectedSeed: championshipData.expectedSeed, strengthOfSchedule: championshipData.strengthOfSchedule, momentum: championshipData.momentum, isWildcardContender: isWildcardContender(team, rosterId), gamesPlayed: team.gamesPlayed || 0 };
            } catch (error) { return null; }
        }).filter(Boolean).sort((a, b) => b.probability - a.probability);

        let normalizedOdds = odds;
        if (playoffsAreSet && getPlayoffTeams?.size > 0) {
            const activeProbabilitySum = odds.filter(team => getPlayoffTeams.has(team.rosterId)).reduce((sum, team) => sum + team.probability, 0);
            if (activeProbabilitySum > 0) {
                normalizedOdds = odds.map(team => {
                    if (getPlayoffTeams.has(team.rosterId)) {
                        const normalizedProb = team.probability / activeProbabilitySum;
                        const americanOdds = normalizedProb > 0.5 ? Math.round(-100 * normalizedProb / (1 - normalizedProb)) : Math.round(100 * (1 - normalizedProb) / normalizedProb);
                        return { ...team, probability: normalizedProb, odds: americanOdds };
                    }
                    return team;
                });
            }
        }
        return normalizedOdds;
    };

    const isWildcardContender = (team, rosterId) => {
        const gamesPlayed = team.gamesPlayed || 0;
        if (gamesPlayed < 3) return false;
        const winPct = gamesPlayed > 0 ? (team.wins || 0) / gamesPlayed : 0;
        const avgScore = team.averageScore || 0;
        const allTeams = Object.values(teamPowerRankings);
        const avgLeagueScore = allTeams.reduce((sum, t) => sum + (t.averageScore || 0), 0) / allTeams.length;
        const avgWinPct = allTeams.reduce((sum, t) => { const gp = t.gamesPlayed || 0; return sum + (gp > 0 ? (t.wins || 0) / gp : 0); }, 0) / allTeams.length;
        return winPct < avgWinPct && avgScore > avgLeagueScore * 1.05;
    };

    useEffect(() => {
        if (selectedBetType === 'gameLines' && selectedWeek && teamPowerRankings && Object.keys(teamPowerRankings).length > 0) {
            setMatchupOdds(generateMatchupOdds(selectedWeek));
        } else if (selectedBetType === 'futures' && teamPowerRankings && Object.keys(teamPowerRankings).length > 0) {
            if (!playoffOdds || playoffOdds.length === 0) setPlayoffOdds(generatePlayoffOdds());
            if (!championshipOdds || championshipOdds.length === 0) setChampionshipOdds(generateChampionshipOdds());
        }
    }, [selectedBetType, selectedWeek, teamPowerRankings, currentSeason, eloRatings, historicalData]);

    // ── Render ──────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <div className="text-center p-8">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/20 border-t-[#00d4a0] mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Loading Sportsbook…</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`max-w-5xl mx-auto space-y-4 pb-${betSlip.length > 0 ? '28' : '10'}`}>

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="pt-2 flex items-end justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Fantasy Sportsbook</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Odds based on team performance · power rankings · statistical analysis</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#00d4a0] animate-pulse" />
                    <span className="text-[10px] font-bold text-[#00d4a0] uppercase tracking-widest">Live</span>
                </div>
            </div>

            {/* ── Bet Type Tabs ────────────────────────────────────────── */}
            <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
                <div className="flex">
                    {[{ key: 'gameLines', label: 'Game Lines' }, { key: 'futures', label: 'Futures' }].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setSelectedBetType(tab.key)}
                            className={`flex-1 py-3.5 text-sm font-bold tracking-wide transition-colors ${
                                selectedBetType === tab.key
                                    ? 'bg-[#00d4a0]/10 text-[#00d4a0] border-b-2 border-[#00d4a0]'
                                    : 'text-gray-400 hover:text-gray-200 border-b-2 border-transparent'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Week selector */}
                {selectedBetType === 'gameLines' && (
                    <div className="px-4 py-3 border-t border-white/10 flex items-center gap-3">
                        <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold whitespace-nowrap">Week</span>
                        <div className="flex gap-1.5 flex-wrap">
                            {Array.from({ length: 18 }, (_, i) => i + 1)
                                .filter(w => { const cw = nflState?.week ? parseInt(nflState.week) : 1; return w >= cw; })
                                .map(w => (
                                    <button
                                        key={w}
                                        onClick={() => setSelectedWeek(w)}
                                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                                            selectedWeek === w
                                                ? 'bg-[#00d4a0] text-gray-900'
                                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                    >
                                        {w >= 15 ? `W${w} 🏆` : `W${w}`}
                                    </button>
                                ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Game Lines ───────────────────────────────────────────── */}
            {selectedBetType === 'gameLines' && (
                <div className="space-y-3">
                    {selectedWeek >= 15 ? (
                        <div className="bg-[#161b22] border border-[#f59e0b]/30 rounded-xl p-6 text-center">
                            <div className="text-3xl mb-3">🏆</div>
                            <h3 className="text-lg font-bold text-[#f59e0b] mb-1">
                                {selectedWeek === 15 ? 'Wildcard Round' : selectedWeek === 16 ? 'Semifinals' : 'Championship Game'}
                            </h3>
                            <p className="text-sm text-gray-400">Playoff matchups are determined by regular season standings. Regular season betting is available for weeks 1–14.</p>
                        </div>
                    ) : matchupOdds.length > 0 ? (
                        matchupOdds.map(matchup => {
                            const isSelected = (type, sel) => betSlip.some(b => b.id === `${matchup.matchupId}-${type}-${sel}`);
                            return (
                                <div key={matchup.matchupId} className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
                                    {/* Match header */}
                                    <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/8 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                            {currentSeason} · Week {matchup.week}
                                            {matchup.bettingLocked && <span className="ml-2 text-[#f59e0b]">🔒 LOCKED</span>}
                                            {matchup.isCompleted && !matchup.bettingLocked && <span className="ml-2 text-gray-600">FINAL</span>}
                                        </span>
                                        <span className="text-[10px] text-[#00d4a0] font-semibold">
                                            {matchup.isCompleted
                                                ? `${formatScore(matchup.actualScores?.team1Score, 2)} – ${formatScore(matchup.actualScores?.team2Score, 2)}`
                                                : 'PRE-GAME'}
                                        </span>
                                    </div>

                                    {/* Column headers */}
                                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 pt-3 pb-1 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                                        <div>Team</div>
                                        <div className="w-24 text-center">Spread</div>
                                        <div className="w-24 text-center">Total</div>
                                        <div className="w-20 text-center">ML</div>
                                    </div>

                                    {/* Team rows */}
                                    {[1, 2].map(teamNum => {
                                        const team = teamNum === 1 ? matchup.team1 : matchup.team2;
                                        const isT1 = teamNum === 1;
                                        const spreadLine = isT1 ? matchup.markets?.spread?.team1 : matchup.markets?.spread?.team2;
                                        const spreadSel = isT1 ? 'team1' : 'team2';
                                        const wonMatch = matchup.isCompleted && (isT1 ? matchup.actualScores?.team1Won : !matchup.actualScores?.team1Won);
                                        const lostMatch = matchup.isCompleted && (isT1 ? !matchup.actualScores?.team1Won : matchup.actualScores?.team1Won);
                                        const t1CoveredSpread = matchup.actualScores?.team1CoveredSpread;
                                        const coveredSpread = isT1 ? t1CoveredSpread : (t1CoveredSpread === null ? null : !t1CoveredSpread);
                                        const overHit = matchup.actualScores?.overHit;

                                        return (
                                            <div key={teamNum} className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2 items-center ${teamNum === 2 ? 'border-t border-white/5' : ''}`}>
                                                {/* Team info */}
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <img className="w-8 h-8 rounded-full border border-white/20 flex-shrink-0" src={team.avatar} alt={team.name} />
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-gray-200 truncate">
                                                            <span className="hidden sm:block">{team.name}</span>
                                                            <span className="sm:hidden">{getAbbreviatedTeamName(team.name)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] text-gray-500">{team.record}</span>
                                                            {team.isHot && <span className="text-[9px] text-[#f59e0b]">🔥 HOT</span>}
                                                            {team.isCold && <span className="text-[9px] text-blue-400">❄️ COLD</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Spread */}
                                                <div className="w-24">
                                                    {spreadLine ? (
                                                        <OddsBtn
                                                            selected={isSelected('spread', spreadSel)}
                                                            won={matchup.isCompleted && coveredSpread === true}
                                                            lost={matchup.isCompleted && coveredSpread === false}
                                                            locked={matchup.bettingLocked}
                                                            onClick={() => {
                                                                if (matchup.bettingLocked) return addNotification('Betting locked: game in progress', 'error');
                                                                if (!matchup.isCompleted && spreadLine.line !== "PK") {
                                                                    addBetToSlip({ matchupId: matchup.matchupId, type: 'spread', selection: spreadSel, team: team.name, line: spreadLine.line, odds: spreadLine.odds, description: `${team.name} ${spreadLine.line}`, season: currentSeason, week: selectedWeek, matchup: `${matchup.team1.name} vs ${matchup.team2.name}` });
                                                                }
                                                            }}
                                                        >
                                                            <OddsValue value={spreadLine.line} won={matchup.isCompleted && coveredSpread === true} lost={matchup.isCompleted && coveredSpread === false} selected={isSelected('spread', spreadSel)} />
                                                            {spreadLine.line !== "PK" && <span className="text-[10px] text-gray-500 mt-0.5">{formatOdds(spreadLine.odds)}</span>}
                                                        </OddsBtn>
                                                    ) : (
                                                        <div className="w-full h-16 bg-[#1c2333] rounded-lg border border-white/5 flex items-center justify-center text-gray-700 text-sm">—</div>
                                                    )}
                                                </div>

                                                {/* Total */}
                                                <div className="w-24">
                                                    {matchup.markets?.total ? (
                                                        <OddsBtn
                                                            selected={isT1 ? isSelected('total', 'over') : isSelected('total', 'under')}
                                                            won={matchup.isCompleted && (isT1 ? overHit === true : overHit === false)}
                                                            lost={matchup.isCompleted && (isT1 ? overHit === false : overHit === true)}
                                                            locked={matchup.bettingLocked}
                                                            onClick={() => {
                                                                if (matchup.bettingLocked) return addNotification('Betting locked: game in progress', 'error');
                                                                if (!matchup.isCompleted) {
                                                                    const side = isT1 ? 'over' : 'under';
                                                                    const mkt = matchup.markets.total[side];
                                                                    addBetToSlip({ matchupId: matchup.matchupId, type: 'total', selection: side, team: `${matchup.team1.name} vs ${matchup.team2.name}`, line: mkt.line, odds: mkt.odds, description: `${side === 'over' ? 'Over' : 'Under'} ${mkt.line}`, season: currentSeason, week: selectedWeek, matchup: `${matchup.team1.name} vs ${matchup.team2.name}` });
                                                                }
                                                            }}
                                                        >
                                                            <span className="text-[9px] text-gray-500 uppercase tracking-widest">{isT1 ? 'Over' : 'Under'}</span>
                                                            <OddsValue value={isNaN(matchup.markets.total[isT1 ? 'over' : 'under'].line) ? 'N/A' : matchup.markets.total[isT1 ? 'over' : 'under'].line} won={matchup.isCompleted && (isT1 ? overHit === true : overHit === false)} lost={matchup.isCompleted && (isT1 ? overHit === false : overHit === true)} selected={isT1 ? isSelected('total', 'over') : isSelected('total', 'under')} />
                                                            <span className="text-[10px] text-gray-500 mt-0.5">{formatOdds(matchup.markets.total[isT1 ? 'over' : 'under'].odds)}</span>
                                                        </OddsBtn>
                                                    ) : (
                                                        <div className="w-full h-16 bg-[#1c2333] rounded-lg border border-white/5 flex items-center justify-center text-gray-700 text-sm">—</div>
                                                    )}
                                                </div>

                                                {/* Moneyline */}
                                                <div className="w-20">
                                                    <OddsBtn
                                                        selected={isSelected('moneyline', isT1 ? 'team1' : 'team2')}
                                                        won={matchup.isCompleted && wonMatch}
                                                        lost={matchup.isCompleted && lostMatch}
                                                        locked={matchup.bettingLocked}
                                                        onClick={() => {
                                                            if (matchup.bettingLocked) return addNotification('Betting locked: game in progress', 'error');
                                                            if (!matchup.isCompleted) {
                                                                const sel = isT1 ? 'team1' : 'team2';
                                                                const mlOdds = isT1 ? (matchup.markets?.moneyline?.team1?.odds || matchup.team1.odds) : (matchup.markets?.moneyline?.team2?.odds || matchup.team2.odds);
                                                                addBetToSlip({ matchupId: matchup.matchupId, type: 'moneyline', selection: sel, team: team.name, line: 'ML', odds: mlOdds, description: `${team.name} ML`, season: currentSeason, week: selectedWeek, matchup: `${matchup.team1.name} vs ${matchup.team2.name}` });
                                                            }
                                                        }}
                                                    >
                                                        <OddsValue
                                                            value={formatOdds(isT1 ? (matchup.markets?.moneyline?.team1?.odds || matchup.team1.odds) : (matchup.markets?.moneyline?.team2?.odds || matchup.team2.odds))}
                                                            won={matchup.isCompleted && wonMatch}
                                                            lost={matchup.isCompleted && lostMatch}
                                                            selected={isSelected('moneyline', isT1 ? 'team1' : 'team2')}
                                                        />
                                                    </OddsBtn>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })
                    ) : (
                        <div className="bg-[#161b22] border border-white/10 rounded-xl p-8 text-center">
                            <p className="text-gray-400">No matchups found for Week {selectedWeek}</p>
                            <p className="text-xs text-gray-600 mt-1">Games may have already been played or the schedule isn't available yet.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Futures ──────────────────────────────────────────────── */}
            {selectedBetType === 'futures' && (
                <div className="space-y-4">
                    {/* Futures sub-tabs */}
                    <div className="flex bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
                        {!playoffsAreSet && (
                            <button
                                onClick={() => setSelectedFuturesTab('playoffs')}
                                className={`flex-1 py-3 text-sm font-bold transition-colors ${selectedFuturesTab === 'playoffs' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-b-2 border-[#f59e0b]' : 'text-gray-400 hover:text-gray-200 border-b-2 border-transparent'}`}
                            >
                                Playoff Appearance
                            </button>
                        )}
                        <button
                            onClick={() => setSelectedFuturesTab('championship')}
                            className={`flex-1 py-3 text-sm font-bold transition-colors ${selectedFuturesTab === 'championship' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-b-2 border-[#f59e0b]' : 'text-gray-400 hover:text-gray-200 border-b-2 border-transparent'}`}
                        >
                            🏆 Championship
                        </button>
                    </div>

                    {/* Playoff odds */}
                    {selectedFuturesTab === 'playoffs' && !playoffsAreSet && (
                        <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/10">
                                <h3 className="text-sm font-bold text-white">Playoff Appearance Odds</h3>
                            </div>
                            <div className="divide-y divide-white/5">
                                {playoffOdds.map((team, index) => (
                                    <div key={team.rosterId} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-gray-600 w-5">{index + 1}</span>
                                            <img className="w-8 h-8 rounded-full border border-white/20" src={team.avatar} alt={team.name} />
                                            <div>
                                                <div className="text-sm font-semibold text-gray-200">
                                                    <span className="hidden sm:block">{team.name}</span>
                                                    <span className="sm:hidden">{getAbbreviatedTeamName(team.name)}</span>
                                                </div>
                                                <div className="text-[10px] text-gray-500">{team.record}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => addBetToSlip({ matchupId: `playoff-${team.rosterId}`, type: 'futures', selection: 'playoffs', team: team.name, line: 'Make Playoffs', odds: team.odds, description: `${team.name} Make Playoffs`, season: currentSeason, week: 'Futures', matchup: 'Season-Long Bet' })}
                                            className={`min-w-[72px] h-10 rounded-lg border text-sm font-bold transition-all ${
                                                betSlip.some(b => b.id === `playoff-${team.rosterId}-futures-playoffs`)
                                                    ? 'bg-[#0e2040] border-[#3b82f6] text-[#60a5fa]'
                                                    : 'bg-[#1c2333] border-white/10 text-[#00d4a0] hover:bg-[#252f45]'
                                            }`}
                                        >
                                            {formatOdds(team.odds)}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Championship odds */}
                    {selectedFuturesTab === 'championship' && (
                        <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-white">Championship Odds</h3>
                                {getPlayoffTeams?.size > 0 && <span className="text-[10px] text-[#f59e0b] font-semibold uppercase tracking-widest">{getPlayoffTeams.size} teams remaining</span>}
                            </div>
                            {getPlayoffTeams?.size === 1 ? (
                                <div className="p-6 text-center">
                                    <div className="text-2xl mb-2">🏆</div>
                                    <p className="text-[#f59e0b] font-semibold">Championship Complete</p>
                                    <p className="text-sm text-gray-500 mt-1">The championship game has concluded.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {championshipOdds?.length > 0
                                        ? championshipOdds.filter(team => !playoffsAreSet || getPlayoffTeams.has(team.rosterId)).map((team, index) => (
                                            <div key={team.rosterId} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold text-gray-600 w-5">{index + 1}</span>
                                                    <img className="w-8 h-8 rounded-full border border-white/20" src={team.avatar} alt={team.name} />
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-sm font-semibold text-gray-200">
                                                                <span className="hidden sm:block">{team.name}</span>
                                                                <span className="sm:hidden">{getAbbreviatedTeamName(team.name)}</span>
                                                            </span>
                                                            {team.isWildcardContender && <span className="text-[9px] text-[#3b82f6]">🎯 WC</span>}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500">{team.record}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => addBetToSlip({ matchupId: `championship-${team.rosterId}`, type: 'futures', selection: 'championship', team: team.name, line: 'Win Championship', odds: team.odds, description: `${team.name} Win Championship`, season: currentSeason, week: 'Futures', matchup: 'Season-Long Bet' })}
                                                    className={`min-w-[72px] h-10 rounded-lg border text-sm font-bold transition-all ${
                                                        betSlip.some(b => b.id === `championship-${team.rosterId}-futures-championship`)
                                                            ? 'bg-[#0e2040] border-[#3b82f6] text-[#60a5fa]'
                                                            : 'bg-[#1c2333] border-white/10 text-[#f59e0b] hover:bg-[#252f45]'
                                                    }`}
                                                >
                                                    {formatOdds(team.odds)}
                                                </button>
                                            </div>
                                        ))
                                        : (
                                            <div className="p-8 text-center text-gray-500 text-sm">
                                                Championship odds not yet available.
                                            </div>
                                        )
                                    }
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Disclaimer ───────────────────────────────────────────── */}
            <div className="bg-[#1a1500] border border-[#f59e0b]/20 rounded-xl p-4">
                <p className="text-[10px] text-[#f59e0b]/70 leading-relaxed">
                    <span className="font-bold text-[#f59e0b]/90">For entertainment purposes only.</span> Odds are calculated using historical performance, team statistics, and power rankings. Fantasy football involves elements of skill and chance — actual results may vary significantly from projections.
                </p>
            </div>

            {/* ── Toast Notifications ───────────────────────────────────── */}
            {notifications.length > 0 && (
                <div className="fixed top-4 right-4 space-y-2 z-50">
                    {notifications.map(n => (
                        <div key={n.id} className={`px-4 py-2.5 rounded-xl shadow-2xl text-sm font-semibold border backdrop-blur-md ${
                            n.type === 'success' ? 'bg-[#0d2e1a] border-[#00d4a0]/40 text-[#00d4a0]' :
                            n.type === 'error'   ? 'bg-[#2d1b1b] border-[#ef4444]/40 text-[#ef4444]' :
                            'bg-[#161b22] border-white/10 text-gray-300'
                        }`}>
                            {n.message}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Bet Slip ─────────────────────────────────────────────── */}
            {betSlip.length > 0 && (
                <div className={`fixed bottom-0 left-0 right-0 bg-[#0d1117] border-t border-white/10 shadow-2xl transition-transform duration-300 z-40 ${isBetSlipExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-56px)]'}`}>
                    {/* Slip header */}
                    <div
                        className="px-4 py-3.5 cursor-pointer flex justify-between items-center bg-[#161b22] border-b border-white/10"
                        onClick={() => setIsBetSlipExpanded(!isBetSlipExpanded)}
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-[#00d4a0] flex items-center justify-center text-[10px] font-black text-gray-900">{betSlip.length}</div>
                                <span className="font-bold text-white text-sm">Bet Slip</span>
                            </div>
                            <span className="text-gray-600 text-sm">·</span>
                            <span className="text-[#00d4a0] font-bold text-sm">
                                {betSlip.length === 1 ? formatOdds(betSlip[0].odds) : `${formatOdds(calculateParlayOdds(betSlip))} Parlay`}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={(e) => { e.stopPropagation(); clearBetSlip(); }} className="text-[10px] font-bold text-gray-500 hover:text-[#ef4444] transition-colors uppercase tracking-widest">Clear</button>
                            <svg className={`w-4 h-4 text-gray-500 transition-transform ${isBetSlipExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto">
                        {/* Bets */}
                        <div className="p-3 space-y-2">
                            {betSlip.map(bet => (
                                <div key={bet.id} className="flex justify-between items-start bg-white/5 border border-white/8 rounded-xl px-3 py-2.5">
                                    <div>
                                        <div className="text-sm font-semibold text-white">{bet.description}</div>
                                        <div className="text-[#00d4a0] text-xs font-bold mt-0.5">{formatOdds(bet.odds)}</div>
                                        {bet.season && <div className="text-[10px] text-gray-600 mt-1">{bet.season} · Wk {bet.week} · {bet.matchup}</div>}
                                    </div>
                                    <button onClick={() => removeBetFromSlip(bet.id)} className="text-gray-600 hover:text-[#ef4444] text-lg leading-none ml-3 transition-colors">×</button>
                                </div>
                            ))}
                        </div>

                        {/* Controls */}
                        <div className="p-3 border-t border-white/10 bg-[#0d1117] space-y-3">
                            <div className="flex gap-3 items-center">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold">$</span>
                                    <input
                                        type="number" min="1" step="1" value={betAmount}
                                        onChange={(e) => setBetAmount(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-white focus:ring-2 focus:ring-[#00d4a0] focus:border-[#00d4a0] outline-none placeholder-gray-600"
                                        placeholder="Wager amount"
                                    />
                                </div>
                                {betSlip.length > 1 && <span className="text-xs text-[#f59e0b] font-bold whitespace-nowrap">{betSlip.length}-leg parlay</span>}
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="text-sm">
                                    <span className="text-gray-500">To Win: </span>
                                    <span className="font-bold text-[#00d4a0]">
                                        ${formatScore(Number(canPlace ? (calculatePayout() - parseFloat(betAmount)) : 0), 2)}
                                    </span>
                                </div>
                                <button
                                    disabled={!canPlace}
                                    onClick={() => {
                                        if (!canPlace) return;
                                        const submissionTime = new Date();
                                        const parlayOdds = betSlip.length > 1 ? calculateParlayOdds(betSlip) : null;
                                        const singleOdds = betSlip.length === 1 ? betSlip[0].odds : null;
                                        setConfirmationData({ bets: [...betSlip], amount: betAmount, potentialPayout: calculatePayout(), potentialWin: calculatePayout() - parseFloat(betAmount), singleOdds, parlayOdds, submittedAt: submissionTime, ticketNumber: `TLO-${Date.now()}` });
                                        setShowConfirmation(true);
                                        clearBetSlip();
                                        setIsBetSlipExpanded(true);
                                    }}
                                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors ${canPlace ? 'bg-[#00d4a0] text-gray-900 hover:bg-[#00b894]' : 'bg-white/10 text-gray-600 cursor-not-allowed'}`}
                                >
                                    Place Bet
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirmation Modal ───────────────────────────────────── */}
            {showConfirmation && confirmationData && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#161b22] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="bg-[#0d2e1a] border-b border-[#00d4a0]/30 px-5 py-4 rounded-t-2xl flex items-center justify-between">
                            <div>
                                <div className="text-[#00d4a0] font-black text-lg">✅ BET PLACED</div>
                                <div className="text-xs text-gray-400 mt-0.5">Ticket #{confirmationData.ticketNumber}</div>
                            </div>
                            <button onClick={() => { setShowConfirmation(false); setIsBetSlipExpanded(false); }} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Bet details */}
                            <div className="space-y-2">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Selections</div>
                                {confirmationData.bets.map(bet => (
                                    <div key={bet.id} className="bg-white/5 border border-white/8 rounded-xl px-3 py-2.5">
                                        <div className="text-sm font-semibold text-white">{bet.description}</div>
                                        <div className="text-[#00d4a0] text-xs font-bold mt-0.5">{formatOdds(bet.odds)}</div>
                                        {bet.season && <div className="text-[10px] text-gray-600 mt-1">{bet.season} · Wk {bet.week}</div>}
                                    </div>
                                ))}
                            </div>

                            {/* Financials */}
                            <div className="bg-white/5 border border-white/8 rounded-xl p-4 space-y-2.5">
                                {[
                                    { label: 'Wager', val: `$${confirmationData.amount}`, color: 'text-white' },
                                    { label: 'Potential Payout', val: `$${formatScore(Number(confirmationData.potentialPayout), 2)}`, color: 'text-[#00d4a0]' },
                                    { label: 'Potential Win', val: `$${formatScore(Number(confirmationData.potentialWin), 2)}`, color: 'text-[#00d4a0]' },
                                    confirmationData.parlayOdds ? { label: 'Parlay Odds', val: formatOdds(confirmationData.parlayOdds), color: 'text-[#f59e0b]' } : null,
                                    confirmationData.singleOdds ? { label: 'Odds', val: formatOdds(confirmationData.singleOdds), color: 'text-[#f59e0b]' } : null,
                                ].filter(Boolean).map(({ label, val, color }) => (
                                    <div key={label} className="flex justify-between text-sm">
                                        <span className="text-gray-400">{label}</span>
                                        <span className={`font-bold ${color}`}>{val}</span>
                                    </div>
                                ))}
                                {confirmationData.bets.length > 1 && (
                                    <div className="text-[10px] text-[#f59e0b]/70 border-t border-white/8 pt-2 mt-1">
                                        {confirmationData.bets.length}-leg parlay · All selections must win
                                    </div>
                                )}
                            </div>

                            {/* Screenshot note */}
                            <div className="bg-[#1a1500] border border-[#f59e0b]/20 rounded-xl p-3 text-center">
                                <div className="text-[#f59e0b] text-xs font-semibold">📱 Screenshot to save your ticket</div>
                            </div>

                            {/* Timestamp + close */}
                            <div className="text-center border-t border-white/10 pt-4 space-y-3">
                                <div className="text-[10px] text-gray-600">{confirmationData.submittedAt.toLocaleDateString()} · {confirmationData.submittedAt.toLocaleTimeString()}</div>
                                <button onClick={() => setShowConfirmation(false)} className="bg-[#00d4a0] text-gray-900 font-bold px-6 py-2 rounded-lg text-sm hover:bg-[#00b894] transition-colors">
                                    Close Receipt
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sportsbook;