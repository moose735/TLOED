// scripts/runSpreadComparison.js
// Quick script to compare old probability->spread mapping vs new distribution-based spreads

const fs = require('fs');
const path = require('path');
const clean = require('../src/utils/cleanOddsCalculator.js');

const CONTEXT_FILE = path.join(__dirname, '..', 'src', 'contexts', 'SleeperDataContext.js');

function extract2021Matchups() {
    const src = fs.readFileSync(CONTEXT_FILE, 'utf8');
    const key = '"2021":';
    const idx = src.indexOf(key);
    if (idx === -1) throw new Error('Could not find 2021 block in SleeperDataContext.js');
    const after = src.slice(idx);
    // Find "matchupsBySeason": [
    const mmKey = '"matchupsBySeason": [';
    const mmIdx = after.indexOf(mmKey);
    if (mmIdx === -1) throw new Error('Could not find matchupsBySeason array in 2021 block');
    const arrStart = idx + mmIdx + mmKey.length - 1; // position at '['
    // Now find matching closing bracket for this array
    let i = arrStart;
    let depth = 0;
    for (; i < src.length; i++) {
        const ch = src[i];
        if (ch === '[') depth++;
        if (ch === ']') {
            depth--;
            if (depth === 0) break;
        }
    }
    if (depth !== 0) throw new Error('Unbalanced brackets when extracting matchups array');
    const arrText = src.slice(arrStart, i + 1);

    // The arrText should be valid JS array literal; ensure trailing commas are valid by using Function to eval safely
    // Wrap in parentheses and evaluate
    let arr;
    try {
        arr = Function(`return ${arrText}`)();
    } catch (e) {
        throw new Error('Failed to parse extracted matchups array: ' + e.message);
    }
    return arr;
}

function buildTeamStats(matchups) {
    const stats = {};
    matchups.forEach(m => {
        const t1 = String(m.team1_roster_id || m.t1 || m.team1);
        const t2 = String(m.team2_roster_id || m.t2 || m.team2);
        const s1 = typeof m.team1_score !== 'undefined' ? m.team1_score : (m.t1_score !== undefined ? m.t1_score : null);
        const s2 = typeof m.team2_score !== 'undefined' ? m.team2_score : (m.t2_score !== undefined ? m.t2_score : null);
        if (!stats[t1]) stats[t1] = { scores: [], averageScore: 0, gamesPlayed: 0, rosterId: t1 };
        if (!stats[t2]) stats[t2] = { scores: [], averageScore: 0, gamesPlayed: 0, rosterId: t2 };
        if (s1 != null && !Number.isNaN(Number(s1))) {
            stats[t1].scores.push(Number(s1));
            stats[t1].gamesPlayed = stats[t1].scores.length;
        }
        if (s2 != null && !Number.isNaN(Number(s2))) {
            stats[t2].scores.push(Number(s2));
            stats[t2].gamesPlayed = stats[t2].scores.length;
        }
    });
    Object.values(stats).forEach(t => {
        if (t.scores.length > 0) {
            t.averageScore = t.scores.reduce((s, v) => s + v, 0) / t.scores.length;
        } else {
            t.averageScore = 120; // default
        }
    });
    return stats;
}

function prettyOdds(o) {
    if (o === null || typeof o === 'undefined') return 'N/A';
    return (o > 0 ? `+${o}` : `${o}`);
}

async function run() {
    const weekArg = process.argv[2];
    const week = weekArg ? parseInt(weekArg, 10) : 3; // default week 3

    console.log('Extracting 2021 matchups from', CONTEXT_FILE);
    const allMatchups = extract2021Matchups();
    const matchupsThisWeek = allMatchups.filter(m => parseInt(m.week) === week);
    if (matchupsThisWeek.length === 0) {
        console.log(`No matchups found for week ${week}`);
        process.exit(0);
    }

    const teamStats = buildTeamStats(allMatchups);
    const historicalData = { matchupsBySeason: { '2021': allMatchups } };

    console.log(`Found ${matchupsThisWeek.length} matchups for week ${week}. Computing spreads...\n`);

    for (const m of matchupsThisWeek) {
        const t1 = String(m.team1_roster_id || m.t1 || m.team1);
        const t2 = String(m.team2_roster_id || m.t2 || m.team2);
        const t1Name = `Team ${t1}`;
        const t2Name = `Team ${t2}`;

        // Compute win prob using a normal approximation from team means/variances
        const computeVariance = (scores) => {
            if (!Array.isArray(scores) || scores.length < 2) return 400; // std ~20
            const n = scores.length;
            const mean = scores.reduce((s, v) => s + v, 0) / n;
            const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
            return Math.max(100, variance);
        };

        const t1Scores = teamStats[t1]?.scores || [];
        const t2Scores = teamStats[t2]?.scores || [];
        const mu = (teamStats[t1]?.averageScore || 120) - (teamStats[t2]?.averageScore || 120);
        const var1 = computeVariance(t1Scores);
        const var2 = computeVariance(t2Scores);
        const sigma = Math.sqrt(var1 + var2) || 20;

        // Normal CDF using erf approximation
        const erf = (x) => {
            // Abramowitz and Stegun formula 7.1.26
            const sign = x >= 0 ? 1 : -1;
            x = Math.abs(x);
            const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
            const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
            const t = 1.0 / (1.0 + p * x);
            const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
            return sign * y;
        };
        const normalCdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
        const team1WinProb = Math.max(0.01, Math.min(0.99, normalCdf(mu / sigma)));

        // Compute power differential for old mapping
        const powerDiffObj = clean.calculateTeamPowerDifferential(teamStats[t1] || {}, teamStats[t2] || {}, teamStats);
        const powerDiff = powerDiffObj.powerDiff || 0;

        // Old spread mapping
        const oldSpread = clean.calculateSpreadFromProbability(team1WinProb, powerDiff);

        // New markets using generateCleanBettingMarkets (this uses the new distribution method)
        const matchupInput = {
            team1RosterId: t1,
            team2RosterId: t2,
            team1Name: t1Name,
            team2Name: t2Name,
            winProbability: team1WinProb
        };
        const markets = clean.generateCleanBettingMarkets(matchupInput, teamStats, { vig: 0.045, includePropBets: false, weekNumber: week });

        const newSpreadTeam1Line = markets.spread?.team1?.line;
        const newSpreadTeam2Line = markets.spread?.team2?.line;

        console.log('Matchup:', t1Name, 'vs', t2Name);
        console.log('  team1WinProb:', team1WinProb.toFixed(3));
        console.log('  Old spread (prob->spread):', oldSpread);
        console.log('  New spread lines:', `${newSpreadTeam1Line} (team1), ${newSpreadTeam2Line} (team2)`);
        console.log('  Moneyline (team1/team2):', prettyOdds(markets.moneyline?.team1?.odds), '/', prettyOdds(markets.moneyline?.team2?.odds));
        console.log('  Total (O/U):', markets.total?.over?.line, 'odds', prettyOdds(markets.total?.over?.odds));
        console.log('  Power analysis diff:', powerDiffObj.powerDiff.toFixed(3), 'team1Power/team2Power:', powerDiffObj.team1Power.toFixed(1), '/', powerDiffObj.team2Power.toFixed(1));
        console.log('');
    }
}

run().catch(err => {
    console.error('Error running spread comparison:', err);
    process.exit(1);
});
