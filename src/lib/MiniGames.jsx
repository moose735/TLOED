import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const buildRosterOwnerMap = (rostersBySeason, year) => {
    const map = new Map();
    const rosters = rostersBySeason?.[year] ?? rostersBySeason?.[String(year)] ?? [];
    rosters.forEach(r => {
        if (r.roster_id != null && r.owner_id != null)
            map.set(String(r.roster_id), String(r.owner_id));
    });
    return map;
};

// Handles both Sleeper shape (playoff_start_week at top level) and nested settings shape
const getPlayoffStartWeek = (historicalData, year) => {
    const meta = historicalData?.leaguesMetadataBySeason?.[year]
        ?? historicalData?.leaguesMetadataBySeason?.[String(year)];
    if (!meta) return 15; // safe default
    // Sleeper league objects have playoff_start_week directly on settings
    const fromSettings = meta?.settings?.playoff_start_week;
    // Sometimes it's nested one level deeper or at top level of meta
    const fromMeta = meta?.playoff_start_week;
    const val = Number(fromSettings ?? fromMeta ?? 15);
    return isNaN(val) ? 15 : val;
};

const normaliseMatchups = (rawMatchups, rosterOwnerMap) => {
    if (!Array.isArray(rawMatchups)) return [];
    return rawMatchups.map(m => {
        if (m.owner_id != null) return { ...m, week: Number(m.week) };
        const owner1 = rosterOwnerMap.get(String(m.team1_roster_id)) || String(m.team1_roster_id);
        const owner2 = rosterOwnerMap.get(String(m.team2_roster_id)) || String(m.team2_roster_id);
        return {
            week: Number(m.week),
            owner_id: owner1,
            points_for: m.team1_score ?? 0,
            team2_owner_id: owner2,
            points_against: m.team2_score ?? 0,
            regSeason: m.regSeason,
        };
    });
};

// Filter to regular season only — uses explicit regSeason flag when available,
// otherwise falls back to week < playoffStartWeek
const regularSeasonOnly = (matchups, playoffStartWeek) =>
    matchups.filter(m => {
        if (m.regSeason === true) return true;
        if (m.regSeason === false) return false;
        return m.week < playoffStartWeek;
    });

// Initials from team name for avatar placeholders
const initials = name =>
    (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

// ─────────────────────────────────────────────────────────────────────────────
// Best Ball — fetch raw Sleeper matchup data with players_points
// ─────────────────────────────────────────────────────────────────────────────

// Fetch a single week of raw Sleeper matchups (includes players_points + starters)
const fetchRawWeekMatchups = async (leagueId, week) => {
    try {
        const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
};

// Given players_points and starters list, compute optimal score:
// Keep all starters' points, then swap any starter with a bench player if bench scores more,
// respecting position slots from the roster settings.
// Since we don't have position data per player easily, we use a simpler approach:
// optimal = sum of top N player scores where N = number of starters
const computeOptimalScore = (playersPoints, starters) => {
    if (!playersPoints || !starters || starters.length === 0) return null;
    const allScores = Object.values(playersPoints).filter(s => typeof s === 'number');
    if (allScores.length === 0) return null;
    const n = starters.length;
    // Sort all player scores descending, take top N
    const sorted = [...allScores].sort((a, b) => b - a);
    return sorted.slice(0, n).reduce((sum, s) => sum + s, 0);
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
const MiniGames = () => {
    const { historicalData, getTeamName, getTeamDetails, leagueData } = useSleeperData();
    const [expandedGame, setExpandedGame] = useState('hammer');
    const [selectedYear, setSelectedYear] = useState(null);
    const [bestBallData, setBestBallData] = useState(null);   // { standings } | null | 'loading' | 'unavailable'
    const [bestBallYear, setBestBallYear] = useState(null);   // which year we loaded for

    // Resolve the correct league ID for a given season — mirrors Gamecenter exactly:
    // current season → leagueData[0].league_id, historical → leaguesMetadataBySeason[season].league_id
    const getLeagueIdForSeason = useCallback((season) => {
        const currentSeason = Array.isArray(leagueData)
            ? leagueData[0]?.season
            : leagueData?.season;
        if (String(season) === String(currentSeason)) {
            return Array.isArray(leagueData)
                ? leagueData[0]?.league_id
                : leagueData?.league_id;
        }
        return historicalData?.leaguesMetadataBySeason?.[season]?.league_id
            ?? historicalData?.leaguesMetadataBySeason?.[String(season)]?.league_id
            ?? null;
    }, [leagueData, historicalData]);

    const availableYears = useMemo(() => {
        if (!historicalData?.matchupsBySeason) return [];
        return Object.keys(historicalData.matchupsBySeason)
            .map(y => Number(y))
            .filter(y => {
                if (isNaN(y)) return false;
                const m = historicalData.matchupsBySeason[y] ?? historicalData.matchupsBySeason[String(y)];
                return Array.isArray(m) && m.length > 0;
            })
            .sort((a, b) => b - a);
    }, [historicalData]);

    useEffect(() => {
        if (availableYears.length > 0 && (selectedYear === null || !availableYears.includes(selectedYear)))
            setSelectedYear(availableYears[0]);
    }, [availableYears]);

    const rosterOwnerMap = useMemo(() => {
        if (!selectedYear || !historicalData?.rostersBySeason) return new Map();
        return buildRosterOwnerMap(historicalData.rostersBySeason, selectedYear);
    }, [historicalData, selectedYear]);

    // Build roster_id → owner_id map as well (for raw matchup data which uses roster_id)
    const ownerByRosterId = useMemo(() => rosterOwnerMap, [rosterOwnerMap]);

    const sortedMatchups = useMemo(() => {
        if (!historicalData?.matchupsBySeason || !selectedYear) return [];
        const raw = historicalData.matchupsBySeason[selectedYear]
            ?? historicalData.matchupsBySeason[String(selectedYear)] ?? [];
        const playoffStartWeek = getPlayoffStartWeek(historicalData, selectedYear);
        const normalised = normaliseMatchups(raw, rosterOwnerMap);
        const regSeason = regularSeasonOnly(normalised, playoffStartWeek);
        return [...regSeason].sort((a, b) => a.week - b.week);
    }, [historicalData, selectedYear, rosterOwnerMap]);

    const games = useMemo(() => {
        if (!sortedMatchups.length) return null;
        return {
            hammerGame: computeHammerGame(sortedMatchups, getTeamName),
            turdHammerGame: computeTurdHammerGame(sortedMatchups, getTeamName),
            survivorGame: computeSurvivorGame(sortedMatchups, getTeamName),
            scheduleSimulator: computeScheduleSimulator(sortedMatchups, getTeamName),
        };
    }, [sortedMatchups, getTeamName]);

    // Fetch best ball when expanded to 'bestball' and year changes
    useEffect(() => {
        if (expandedGame !== 'bestball') return;
        if (!selectedYear || !sortedMatchups.length) return;
        if (bestBallYear === selectedYear && bestBallData !== null) return; // already loaded

        const leagueId = getLeagueIdForSeason(selectedYear);
        if (!leagueId) {
            setBestBallData('unavailable');
            setBestBallYear(selectedYear);
            return;
        }

        setBestBallData('loading');
        setBestBallYear(selectedYear);

        const weeks = [...new Set(sortedMatchups.map(m => m.week))].sort((a, b) => a - b);

        Promise.all(weeks.map(w => fetchRawWeekMatchups(leagueId, w).then(data => ({ week: w, data }))))
            .then(weekResults => {
                // Build: { ownerId: { week: { actual, optimal, oppActual, oppOptimal } } }
                // Raw Sleeper matchup item: { roster_id, points, players_points, starters, matchup_id }
                const ownerWeekData = {}; // ownerId → { week → { actual, optimal, matchupId } }

                weekResults.forEach(({ week, data }) => {
                    if (!Array.isArray(data)) return;
                    data.forEach(item => {
                        const ownerId = ownerByRosterId.get(String(item.roster_id));
                        if (!ownerId) return;
                        if (!ownerWeekData[ownerId]) ownerWeekData[ownerId] = {};
                        const optimal = computeOptimalScore(item.players_points, item.starters);
                        ownerWeekData[ownerId][week] = {
                            actual: item.points ?? 0,
                            optimal: optimal ?? item.points ?? 0,
                            matchupId: item.matchup_id,
                            rosterId: item.roster_id,
                        };
                    });
                });

                // Now pair up matchups by matchup_id per week and compute best ball records
                const standings = {};
                Object.entries(ownerWeekData).forEach(([ownerId]) => {
                    standings[ownerId] = { ownerId, actualWins: 0, actualLosses: 0, bestBallWins: 0, bestBallLosses: 0, totalBenchGain: 0, gamesWithData: 0 };
                });

                weeks.forEach(week => {
                    // Group by matchup_id
                    const byMatchupId = {};
                    Object.entries(ownerWeekData).forEach(([ownerId, weekMap]) => {
                        const wd = weekMap[week];
                        if (!wd) return;
                        if (!byMatchupId[wd.matchupId]) byMatchupId[wd.matchupId] = [];
                        byMatchupId[wd.matchupId].push({ ownerId, ...wd });
                    });

                    Object.values(byMatchupId).forEach(pair => {
                        if (pair.length !== 2) return;
                        const [a, b] = pair;
                        if (!standings[a.ownerId] || !standings[b.ownerId]) return;

                        // Actual
                        if (a.actual > b.actual) { standings[a.ownerId].actualWins++; standings[b.ownerId].actualLosses++; }
                        else { standings[b.ownerId].actualWins++; standings[a.ownerId].actualLosses++; }

                        // Best ball
                        if (a.optimal > b.optimal) { standings[a.ownerId].bestBallWins++; standings[b.ownerId].bestBallLosses++; }
                        else { standings[b.ownerId].bestBallWins++; standings[a.ownerId].bestBallLosses++; }

                        standings[a.ownerId].totalBenchGain += Math.max(0, a.optimal - a.actual);
                        standings[b.ownerId].totalBenchGain += Math.max(0, b.optimal - b.actual);
                        standings[a.ownerId].gamesWithData++;
                        standings[b.ownerId].gamesWithData++;
                    });
                });

                // Convert to array, add names, sort by best ball wins
                const standingsArr = Object.values(standings).map(s => ({
                    ...s,
                    name: getTeamName(s.ownerId),
                    rankDiff: 0,
                    benchPerGame: s.gamesWithData > 0 ? (s.totalBenchGain / s.gamesWithData).toFixed(1) : '0.0',
                }));

                standingsArr.sort((a, b) => b.bestBallWins - a.bestBallWins || a.bestBallLosses - b.bestBallLosses);
                standingsArr.forEach((s, i) => { s.bestBallRank = i + 1; });

                const actualSorted = [...standingsArr].sort((a, b) => b.actualWins - a.actualWins || a.actualLosses - b.actualLosses);
                actualSorted.forEach((s, i) => {
                    const orig = standingsArr.find(x => x.ownerId === s.ownerId);
                    if (orig) { orig.actualRank = i + 1; orig.rankDiff = orig.actualRank - orig.bestBallRank; }
                });
                standingsArr.sort((a, b) => a.bestBallRank - b.bestBallRank);

                setBestBallData({ standings: standingsArr });
            })
            .catch(() => {
                setBestBallData('unavailable');
            });
    }, [expandedGame, selectedYear, sortedMatchups, getLeagueIdForSeason, ownerByRosterId, getTeamName]);

    if (!historicalData) return <div className="text-center text-gray-400 py-8">Loading mini-games…</div>;
    if (!selectedYear || !games) return (
        <div className="text-center text-gray-400 py-8">
            {availableYears.length === 0 ? 'No season data found.' : 'No matchup data for this season.'}
        </div>
    );

    const toggle = key => setExpandedGame(prev => prev === key ? null : key);

    return (
        <div className="space-y-4 py-6">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Mini-Games</h2>
                <p className="text-gray-400">Alternate realities. Different formats. Same trash talk.</p>
            </div>

            <div className="flex justify-center mb-6">
                <div className="bg-gray-800 border border-white/10 rounded-lg px-4 py-3 inline-block">
                    <label className="text-sm text-gray-400 mr-3">Season:</label>
                    <select
                        value={selectedYear}
                        onChange={e => { setSelectedYear(Number(e.target.value)); setBestBallData(null); setBestBallYear(null); }}
                        className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-1 focus:outline-none focus:border-blue-500"
                    >
                        {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
            </div>

            <GameSection title="🔨 The Hammer Game" description="Week 1's top scorer claims the Hammer. Lose it only by losing to the holder head-to-head." expanded={expandedGame === 'hammer'} onToggle={() => toggle('hammer')}>
                <HammerGameContent game={games.hammerGame} getTeamDetails={getTeamDetails} year={selectedYear} />
            </GameSection>
            <GameSection title="💩 Turd Hammer Game" description="Week 1's lowest scorer gets the Turd. Win your matchup and it passes to your opponent." expanded={expandedGame === 'turd'} onToggle={() => toggle('turd')}>
                <TurdHammerGameContent game={games.turdHammerGame} getTeamDetails={getTeamDetails} year={selectedYear} />
            </GameSection>
            <GameSection title="🎯 Best Ball Standings" description="What if your optimal lineup played every week?" expanded={expandedGame === 'bestball'} onToggle={() => toggle('bestball')}>
                <BestBallContent data={bestBallData} getTeamDetails={getTeamDetails} year={selectedYear} />
            </GameSection>
            <GameSection title="⚰️ Survivor" description="Each week, the lowest scorer is eliminated. Last team standing wins." expanded={expandedGame === 'survivor'} onToggle={() => toggle('survivor')}>
                <SurvivorGameContent game={games.survivorGame} getTeamDetails={getTeamDetails} year={selectedYear} />
            </GameSection>
            <GameSection title="🔄 Schedule Simulator" description="See each team's record against every other team's schedule." expanded={expandedGame === 'schedule'} onToggle={() => toggle('schedule')}>
                <ScheduleSimulatorContent game={games.scheduleSimulator} getTeamDetails={getTeamDetails} year={selectedYear} />
            </GameSection>
        </div>
    );
};

const GameSection = ({ title, description, expanded, onToggle, children }) => (
    <div className="bg-gray-800/80 border border-white/10 rounded-xl overflow-hidden">
        <button onClick={onToggle} className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-700/40 transition-colors">
            <div className="text-left">
                <h3 className="text-base font-bold text-white">{title}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            </div>
            <div className={`text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▼</div>
        </button>
        {expanded && <div className="border-t border-white/10 px-6 py-5">{children}</div>}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Hammer Game logic
// ─────────────────────────────────────────────────────────────────────────────
const computeHammerGame = (matchups, getTeamName) => {
    const matchupsByWeek = {};
    matchups.forEach(m => {
        if (!matchupsByWeek[m.week]) matchupsByWeek[m.week] = [];
        matchupsByWeek[m.week].push(m);
    });
    const weeks = Object.keys(matchupsByWeek).sort((a, b) => Number(a) - Number(b));
    const history = [];
    let currentHolder = null;

    weeks.forEach((week, idx) => {
        const wm = matchupsByWeek[week];
        if (idx === 0) {
            let topScore = -Infinity, topOwner = null;
            wm.forEach(m => {
                if ((m.points_for ?? 0) > topScore) { topScore = m.points_for; topOwner = m.owner_id; }
                if ((m.points_against ?? 0) > topScore) { topScore = m.points_against; topOwner = m.team2_owner_id; }
            });
            if (topOwner) {
                currentHolder = topOwner;
                history.push({ week: Number(week), holder: topOwner, holderName: getTeamName(topOwner), score: topScore, type: 'init', opponentId: null, opponentName: null, opponentScore: null, previousHolderName: null });
            }
        } else if (currentHolder) {
            const m = wm.find(x => x.owner_id === currentHolder || x.team2_owner_id === currentHolder);
            if (m) {
                const isT1 = m.owner_id === currentHolder;
                const myScore = isT1 ? m.points_for : m.points_against;
                const oppScore = isT1 ? m.points_against : m.points_for;
                const oppId = isT1 ? m.team2_owner_id : m.owner_id;
                if (myScore > oppScore) {
                    history.push({ week: Number(week), holder: currentHolder, holderName: getTeamName(currentHolder), score: myScore, type: 'defend', opponentId: oppId, opponentName: getTeamName(oppId), opponentScore: oppScore, previousHolderName: null });
                } else {
                    history.push({ week: Number(week), holder: oppId, holderName: getTeamName(oppId), score: oppScore, type: 'steal', opponentId: currentHolder, opponentName: getTeamName(currentHolder), opponentScore: myScore, previousHolderName: getTeamName(currentHolder) });
                    currentHolder = oppId;
                }
            }
        }
    });

    const weeksHeld = {};
    history.forEach(e => { weeksHeld[e.holderName] = (weeksHeld[e.holderName] || 0) + 1; });
    return { history, currentHolder: currentHolder ? getTeamName(currentHolder) : null, weeksHeld };
};

// ── Shared matchup card used by both Hammer and Turd ─────────────────────────
// Left side = holder/loser of turd, Right side = opponent, badge on right edge
const MatchupCard = ({ week, leftId, leftName, leftScore, rightId, rightName, rightScore, badge, cardBg, cardBorder, isInit, initLabel, getTeamDetails, year }) => (
    <div className={`rounded-xl border ${cardBg} ${cardBorder} overflow-hidden`}>
        {/* Week bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Week {week}</span>
            {badge}
        </div>
        {isInit ? (
            /* Init row — no matchup, just who got it */
            <div className="flex items-center gap-3 px-4 py-3">
                <Avatar ownerId={leftId} name={leftName} getTeamDetails={getTeamDetails} year={year} size="lg" />
                <div>
                    <div className="font-bold text-white text-sm leading-tight">{leftName}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{initLabel}</div>
                </div>
                <div className="ml-auto font-mono text-sm text-gray-300">{leftScore?.toFixed(1)}</div>
            </div>
        ) : (
            /* Matchup row */
            <div className="flex items-stretch">
                {/* Left team */}
                <div className="flex-1 flex items-center gap-2 px-3 py-3 min-w-0">
                    <Avatar ownerId={leftId} name={leftName} getTeamDetails={getTeamDetails} year={year} />
                    <div className="min-w-0">
                        <div className="font-bold text-white text-xs sm:text-sm leading-tight truncate">{leftName}</div>
                        <div className="font-mono text-xs text-gray-300 mt-0.5">{leftScore?.toFixed(1)}</div>
                    </div>
                </div>
                {/* VS divider */}
                <div className="flex items-center px-2 shrink-0">
                    <span className="text-[10px] font-bold text-gray-600 uppercase">vs</span>
                </div>
                {/* Right team */}
                <div className="flex-1 flex items-center gap-2 px-3 py-3 justify-end min-w-0">
                    <div className="min-w-0 text-right">
                        <div className="font-bold text-white text-xs sm:text-sm leading-tight truncate">{rightName}</div>
                        <div className="font-mono text-xs text-gray-300 mt-0.5">{rightScore?.toFixed(1)}</div>
                    </div>
                    <Avatar ownerId={rightId} name={rightName} getTeamDetails={getTeamDetails} year={year} />
                </div>
            </div>
        )}
    </div>
);

// Badge pill components
const Badge = ({ label, color }) => {
    const styles = {
        purple: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
        blue:   'bg-blue-500/20 text-blue-300 border border-blue-500/30',
        red:    'bg-red-500/20 text-red-300 border border-red-500/30',
        amber:  'bg-amber-500/20 text-amber-300 border border-amber-500/30',
        green:  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
        orange: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
    };
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styles[color] || styles.blue}`}>{label}</span>;
};

const HammerGameContent = ({ game, getTeamDetails, year }) => {
    const [showAll, setShowAll] = useState(false);
    if (!game?.history?.length) return <p className="text-gray-400">No data available</p>;
    const visible = showAll ? game.history : game.history.slice(0, 6);
    const steals = game.history.filter(e => e.type === 'steal').length;
    const defends = game.history.filter(e => e.type === 'defend').length;

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-700/40 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-yellow-300">{Object.keys(game.weeksHeld).length}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Holders</div>
                </div>
                <div className="bg-gray-700/40 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-red-300">{steals}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Steals</div>
                </div>
                <div className="bg-gray-700/40 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-blue-300">{defends}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Defends</div>
                </div>
            </div>

            {/* Matchup cards */}
            <div className="space-y-2">
                {visible.map((entry, idx) => {
                    const cfgMap = {
                        init:   { cardBg: 'bg-purple-900/10', cardBorder: 'border-purple-700/30', badge: <Badge label="👑 Week 1 High Score" color="purple" /> },
                        defend: { cardBg: 'bg-blue-900/10',   cardBorder: 'border-blue-700/25',   badge: <Badge label="🛡 Defended" color="blue" /> },
                        steal:  { cardBg: 'bg-red-900/10',    cardBorder: 'border-red-700/25',    badge: <Badge label="⚡ Stolen" color="red" /> },
                    };
                    const cfg = cfgMap[entry.type];
                    return (
                        <MatchupCard
                            key={idx}
                            week={entry.week}
                            leftId={entry.holder}
                            leftName={entry.holderName}
                            leftScore={entry.score}
                            rightId={entry.opponentId}
                            rightName={entry.opponentName}
                            rightScore={entry.opponentScore}
                            badge={cfg.badge}
                            cardBg={cfg.cardBg}
                            cardBorder={cfg.cardBorder}
                            isInit={entry.type === 'init'}
                            initLabel="Claimed the 🔨 with Week 1's high score"
                            getTeamDetails={getTeamDetails}
                            year={year}
                        />
                    );
                })}
            </div>

            {game.history.length > 6 && (
                <button onClick={() => setShowAll(p => !p)} className="w-full text-center text-xs text-gray-400 hover:text-white transition-colors py-1">
                    {showAll ? '▲ Show less' : `▼ Show all ${game.history.length} weeks`}
                </button>
            )}

            {/* Season-end summary */}
            <div className="rounded-xl border border-yellow-500/25 bg-yellow-900/10 p-4">
                <div className="flex items-center gap-3 mb-3">
                    <Avatar ownerId={game.history[game.history.length - 1]?.holder} name={game.currentHolder} getTeamDetails={getTeamDetails} year={year} size="lg" />
                    <div>
                        <div className="text-[10px] text-yellow-400 font-semibold uppercase tracking-wide">🔨 Held at season's end</div>
                        <div className="text-base font-bold text-white">{game.currentHolder}</div>
                    </div>
                </div>
                <div className="border-t border-white/5 pt-3 space-y-1.5">
                    {Object.entries(game.weeksHeld).sort((a, b) => b[1] - a[1]).map(([team, w]) => {
                        const entry = game.history.find(e => e.holderName === team);
                        return (
                            <div key={team} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Avatar ownerId={entry?.holder} name={team} getTeamDetails={getTeamDetails} year={year} />
                                    <span className="text-xs text-gray-300 truncate max-w-[140px]">{team}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-1.5 bg-yellow-500/60 rounded-full" style={{ width: `${Math.round((w / game.history.length) * 80)}px` }} />
                                    <span className="text-xs text-yellow-400 font-mono font-bold w-6 text-right">{w}w</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Turd Hammer logic
// ─────────────────────────────────────────────────────────────────────────────
const computeTurdHammerGame = (matchups, getTeamName) => {
    const matchupsByWeek = {};
    matchups.forEach(m => {
        if (!matchupsByWeek[m.week]) matchupsByWeek[m.week] = [];
        matchupsByWeek[m.week].push(m);
    });
    const weeks = Object.keys(matchupsByWeek).sort((a, b) => Number(a) - Number(b));
    const history = [];
    let currentHolder = null;

    weeks.forEach((week, idx) => {
        const wm = matchupsByWeek[week];
        if (idx === 0) {
            let lowScore = Infinity, lowOwner = null;
            wm.forEach(m => {
                if ((m.points_for ?? Infinity) < lowScore) { lowScore = m.points_for; lowOwner = m.owner_id; }
                if ((m.points_against ?? Infinity) < lowScore) { lowScore = m.points_against; lowOwner = m.team2_owner_id; }
            });
            if (lowOwner) {
                currentHolder = lowOwner;
                history.push({ week: Number(week), holderId: lowOwner, holderName: getTeamName(lowOwner), score: lowScore, type: 'init', opponentId: null, opponentName: null, opponentScore: null, previousHolderName: null });
            }
        } else if (currentHolder) {
            const m = wm.find(x => x.owner_id === currentHolder || x.team2_owner_id === currentHolder);
            if (m) {
                const isT1 = m.owner_id === currentHolder;
                const myScore = isT1 ? m.points_for : m.points_against;
                const oppScore = isT1 ? m.points_against : m.points_for;
                const oppId = isT1 ? m.team2_owner_id : m.owner_id;
                if (myScore < oppScore) {
                    history.push({ week: Number(week), holderId: currentHolder, holderName: getTeamName(currentHolder), score: myScore, type: 'kept', opponentId: oppId, opponentName: getTeamName(oppId), opponentScore: oppScore, previousHolderName: null });
                } else {
                    history.push({ week: Number(week), holderId: oppId, holderName: getTeamName(oppId), score: oppScore, type: 'passed', opponentId: currentHolder, opponentName: getTeamName(currentHolder), opponentScore: myScore, previousHolderName: getTeamName(currentHolder) });
                    currentHolder = oppId;
                }
            }
        }
    });

    const weeksHeld = {};
    history.forEach(e => { weeksHeld[e.holderName] = (weeksHeld[e.holderName] || 0) + 1; });
    return { history, currentHolder: currentHolder ? getTeamName(currentHolder) : null, weeksHeld };
};

const TurdHammerGameContent = ({ game, getTeamDetails, year }) => {
    const [showAll, setShowAll] = useState(false);
    if (!game?.history?.length) return <p className="text-gray-400">No data available</p>;
    const visible = showAll ? game.history : game.history.slice(0, 6);
    const passed = game.history.filter(e => e.type === 'passed').length;
    const kept = game.history.filter(e => e.type === 'kept').length;

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-700/40 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-amber-400">{Object.keys(game.weeksHeld).length}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Holders</div>
                </div>
                <div className="bg-gray-700/40 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-emerald-400">{passed}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Passed</div>
                </div>
                <div className="bg-gray-700/40 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-red-400">{kept}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Kept</div>
                </div>
            </div>

            {/* Matchup cards */}
            <div className="space-y-2">
                {visible.map((entry, idx) => {
                    const cfgMap = {
                        init:   { cardBg: 'bg-amber-900/15',   cardBorder: 'border-amber-700/30',   badge: <Badge label="💩 Week 1 Low Score" color="amber" /> },
                        kept:   { cardBg: 'bg-red-900/10',     cardBorder: 'border-red-700/20',     badge: <Badge label="😬 Kept It" color="red" /> },
                        passed: { cardBg: 'bg-emerald-900/10', cardBorder: 'border-emerald-700/20', badge: <Badge label="✅ Passed" color="green" /> },
                    };
                    const cfg = cfgMap[entry.type];
                    // For 'passed': left = new holder (received it), right = previous holder (who won)
                    // For 'kept':   left = holder (lost), right = opponent (who beat them)
                    const leftId   = entry.holderId;
                    const leftName = entry.holderName;
                    const leftScore = entry.type === 'kept' ? entry.score : entry.score;
                    const rightId   = entry.opponentId;
                    const rightName = entry.opponentName;
                    const rightScore = entry.opponentScore;
                    return (
                        <MatchupCard
                            key={idx}
                            week={entry.week}
                            leftId={leftId}
                            leftName={leftName}
                            leftScore={leftScore}
                            rightId={rightId}
                            rightName={rightName}
                            rightScore={rightScore}
                            badge={cfg.badge}
                            cardBg={cfg.cardBg}
                            cardBorder={cfg.cardBorder}
                            isInit={entry.type === 'init'}
                            initLabel="Started with the 💩 — Week 1's lowest score"
                            getTeamDetails={getTeamDetails}
                            year={year}
                        />
                    );
                })}
            </div>

            {game.history.length > 6 && (
                <button onClick={() => setShowAll(p => !p)} className="w-full text-center text-xs text-gray-400 hover:text-white transition-colors py-1">
                    {showAll ? '▲ Show less' : `▼ Show all ${game.history.length} weeks`}
                </button>
            )}

            {/* Season-end summary */}
            <div className="rounded-xl border border-amber-700/30 bg-amber-900/10 p-4">
                <div className="flex items-center gap-3 mb-3">
                    <Avatar ownerId={game.history[game.history.length - 1]?.holderId} name={game.currentHolder} getTeamDetails={getTeamDetails} year={year} size="lg" />
                    <div>
                        <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide">💩 Turd Holder at season's end</div>
                        <div className="text-base font-bold text-white">{game.currentHolder}</div>
                    </div>
                </div>
                <div className="border-t border-white/5 pt-3 space-y-1.5">
                    {Object.entries(game.weeksHeld).sort((a, b) => b[1] - a[1]).map(([team, w]) => {
                        const entry = game.history.find(e => e.holderName === team);
                        return (
                            <div key={team} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Avatar ownerId={entry?.holderId} name={team} getTeamDetails={getTeamDetails} year={year} />
                                    <span className="text-xs text-gray-300 truncate max-w-[140px]">{team}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-1.5 bg-amber-500/50 rounded-full" style={{ width: `${Math.round((w / game.history.length) * 80)}px` }} />
                                    <span className="text-xs text-amber-400 font-mono font-bold w-6 text-right">{w}w</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const BestBallContent = ({ data, getTeamDetails, year }) => {
    // Handle loading / unavailable / null states
    if (data === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-blue-400" />
                <p className="text-sm text-gray-400">Fetching lineup data…</p>
            </div>
        );
    }
    if (data === 'unavailable' || data === null) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-400 text-sm">Best Ball data isn't available for this season.</p>
                <p className="text-gray-600 text-xs mt-1">Requires Sleeper lineup data (not available for Yahoo/historical seasons).</p>
            </div>
        );
    }
    if (!data?.standings?.length) return <p className="text-gray-400">No data available</p>;

    const game = data;
    const biggest = game.standings.reduce((acc, s) => Math.abs(s.rankDiff) > Math.abs(acc.diff) ? { diff: s.rankDiff, team: s.name, id: s.ownerId } : acc, { diff: 0, team: '', id: null });
    const biggestDown = game.standings.reduce((acc, s) => s.rankDiff < acc.diff ? { diff: s.rankDiff, team: s.name, id: s.ownerId } : acc, { diff: 0, team: '', id: null });
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-green-900/30 rounded-xl p-3 border border-green-700/40 flex items-center gap-3">
                    <Avatar ownerId={biggest.id} name={biggest.team} getTeamDetails={getTeamDetails} year={year} size="lg" />
                    <div>
                        <div className="text-[10px] text-green-400 font-semibold uppercase tracking-wide">Biggest Gainer</div>
                        <div className="text-sm font-bold text-green-300 mt-0.5">{biggest.team || '—'}</div>
                        <div className="text-xs text-green-400 mt-0.5">↑ {Math.abs(biggest.diff)} spots</div>
                    </div>
                </div>
                <div className="bg-red-900/30 rounded-xl p-3 border border-red-700/40 flex items-center gap-3">
                    <Avatar ownerId={biggestDown.id} name={biggestDown.team} getTeamDetails={getTeamDetails} year={year} size="lg" />
                    <div>
                        <div className="text-[10px] text-red-400 font-semibold uppercase tracking-wide">Biggest Faller</div>
                        <div className="text-sm font-bold text-red-300 mt-0.5">{biggestDown.team || '—'}</div>
                        <div className="text-xs text-red-400 mt-0.5">↓ {Math.abs(biggestDown.diff)} spots</div>
                    </div>
                </div>
            </div>

            {/* Mobile: stacked cards */}
            <div className="sm:hidden space-y-2">
                {game.standings.map((s, idx) => (
                    <div key={idx} className="bg-gray-700/30 rounded-xl border border-white/8 p-3 flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-500 w-5 text-right shrink-0">{s.bestBallRank}</span>
                        <Avatar ownerId={s.ownerId} name={s.name} getTeamDetails={getTeamDetails} year={year} />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{s.name}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">Best Ball: {s.bestBallWins}-{s.bestBallLosses} · Actual: {s.actualWins}-{s.actualLosses}</div>
                        </div>
                        <div className="text-right shrink-0">
                            <span className={`text-sm font-bold ${s.rankDiff > 0 ? 'text-green-400' : s.rankDiff < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                {s.rankDiff === 0 ? '—' : s.rankDiff > 0 ? `+${s.rankDiff}` : s.rankDiff}
                            </span>
                            <div className="text-[10px] text-gray-500">rank Δ</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-600/50 bg-gray-700/40">
                            <th className="text-left py-2.5 px-3 text-gray-400 font-medium text-xs">#</th>
                            <th className="text-left py-2.5 px-3 text-gray-400 font-medium text-xs">Team</th>
                            <th className="text-center py-2.5 px-3 text-gray-400 font-medium text-xs">Best Ball</th>
                            <th className="text-center py-2.5 px-3 text-gray-400 font-medium text-xs">Actual</th>
                            <th className="text-center py-2.5 px-3 text-gray-400 font-medium text-xs">Rank Δ</th>
                            <th className="text-center py-2.5 px-3 text-gray-400 font-medium text-xs">Bench/gm</th>
                        </tr>
                    </thead>
                    <tbody>
                        {game.standings.map((s, idx) => (
                            <tr key={idx} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                                <td className="py-2 px-3 font-bold text-gray-500 text-xs">{s.bestBallRank}</td>
                                <td className="py-2 px-3">
                                    <div className="flex items-center gap-2">
                                        <Avatar ownerId={s.ownerId} name={s.name} getTeamDetails={getTeamDetails} year={year} />
                                        <span className="font-medium text-white text-sm">{s.name}</span>
                                    </div>
                                </td>
                                <td className="py-2 px-3 text-center text-gray-300 text-xs">{s.bestBallWins}-{s.bestBallLosses}</td>
                                <td className="py-2 px-3 text-center text-gray-300 text-xs">{s.actualWins}-{s.actualLosses}</td>
                                <td className="py-2 px-3 text-center text-xs">
                                    <span className={s.rankDiff > 0 ? 'text-green-400 font-bold' : s.rankDiff < 0 ? 'text-red-400 font-bold' : 'text-gray-500'}>
                                        {s.rankDiff === 0 ? '—' : s.rankDiff > 0 ? `+${s.rankDiff}` : s.rankDiff}
                                    </span>
                                </td>
                                <td className="py-2 px-3 text-center text-gray-400 text-xs">{s.benchPerGame}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-gray-500">Best Ball assumes optimal lineups every week. Bench gain = points left on bench that would have started optimally.</p>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Survivor logic
// Fixed: filter null/undefined owner IDs, break BEFORE eliminating when 1 remains
// ─────────────────────────────────────────────────────────────────────────────
const computeSurvivorGame = (matchups, getTeamName) => {
    const matchupsByWeek = {};
    matchups.forEach(m => {
        if (!matchupsByWeek[m.week]) matchupsByWeek[m.week] = [];
        matchupsByWeek[m.week].push(m);
    });

    // Build team set — filter out null/undefined owner IDs which cause the null winner bug
    const allTeams = new Set();
    matchups.forEach(m => {
        if (m.owner_id != null) allTeams.add(m.owner_id);
        if (m.team2_owner_id != null) allTeams.add(m.team2_owner_id);
    });

    let aliveTeams = new Set(allTeams);
    const eliminatedByWeek = [];

    for (const week of Object.keys(matchupsByWeek).sort((a, b) => Number(a) - Number(b))) {
        // If only 1 team left, they're the winner — stop before any more processing
        if (aliveTeams.size <= 1) break;

        const weekMatchups = matchupsByWeek[week];
        let lowestScore = Infinity, eliminatedTeam = null;

        weekMatchups.forEach(m => {
            if (m.owner_id != null && aliveTeams.has(m.owner_id)) {
                const score = m.points_for ?? 0;
                if (score < lowestScore) { lowestScore = score; eliminatedTeam = m.owner_id; }
            }
            if (m.team2_owner_id != null && aliveTeams.has(m.team2_owner_id)) {
                const score = m.points_against ?? 0;
                if (score < lowestScore) { lowestScore = score; eliminatedTeam = m.team2_owner_id; }
            }
        });

        if (eliminatedTeam) {
            aliveTeams.delete(eliminatedTeam);
            eliminatedByWeek.push({
                week: Number(week),
                team: getTeamName(eliminatedTeam),
                score: lowestScore,
            });
        }

        // After this elimination, if 1 remains they win next iteration's break — but also
        // catch the exact moment we reach 1 so we don't run another week
        if (aliveTeams.size <= 1) break;
    }

    // The survivor is whoever is left — guaranteed non-null because we filtered nulls above
    const survivorId = aliveTeams.size >= 1 ? [...aliveTeams][0] : null;

    // Weekly score grid for the table UI (all teams, all weeks)
    const allWeeks = Object.keys(matchupsByWeek).map(Number).sort((a, b) => a - b);
    const teamScoresByWeek = {}; // ownerId -> { week -> score }
    const teamElimWeek = {}; // ownerId -> week they were eliminated (undefined = survived)
    eliminatedByWeek.forEach(e => {
        // find the owner id for this team name — re-derive from matchups
        matchups.forEach(m => {
            if (getTeamName(m.owner_id) === e.team) teamElimWeek[m.owner_id] = e.week;
            if (getTeamName(m.team2_owner_id) === e.team) teamElimWeek[m.team2_owner_id] = e.week;
        });
    });

    [...allTeams].forEach(ownerId => { teamScoresByWeek[ownerId] = {}; });
    matchups.forEach(m => {
        if (m.owner_id != null) teamScoresByWeek[m.owner_id][m.week] = m.points_for ?? 0;
        if (m.team2_owner_id != null) teamScoresByWeek[m.team2_owner_id][m.week] = m.points_against ?? 0;
    });

    // Build sorted team list: survivor first, then eliminated order (last elim → first elim)
    const eliminatedIds = eliminatedByWeek.map(e => {
        for (const id of allTeams) {
            if (getTeamName(id) === e.team) return id;
        }
        return null;
    }).filter(Boolean);

    const teamList = survivorId
        ? [survivorId, ...[...eliminatedIds].reverse()]
        : [...eliminatedIds].reverse();

    // Close calls: weeks where the eliminated team's score was within 10pts of the next lowest alive team
    const closeCalls = [];
    eliminatedByWeek.forEach(e => {
        const weekMatchupsArr = matchupsByWeek[e.week] || [];
        const aliveScores = [];
        weekMatchupsArr.forEach(m => {
            if (m.owner_id != null && getTeamName(m.owner_id) !== e.team) aliveScores.push(m.points_for ?? 0);
            if (m.team2_owner_id != null && getTeamName(m.team2_owner_id) !== e.team) aliveScores.push(m.points_against ?? 0);
        });
        const nextLowest = Math.min(...aliveScores.filter(s => s > e.score));
        if (isFinite(nextLowest) && (nextLowest - e.score) < 15) {
            closeCalls.push({ ...e, margin: (nextLowest - e.score).toFixed(1), nearMiss: getTeamName([...allTeams].find(id => teamScoresByWeek[id]?.[e.week] === nextLowest) || '') });
        }
    });

    return {
        survivor: survivorId ? getTeamName(survivorId) : null,
        survivorId,
        eliminated: eliminatedByWeek,
        totalTeams: allTeams.size,
        allWeeks,
        teamList,
        teamScoresByWeek,
        teamElimWeek,
        closeCalls,
        getTeamName,
    };
};

// Avatar — uses real Sleeper avatar via getTeamDetails, falls back to initials circle
const Avatar = ({ ownerId, name, getTeamDetails, year, size = 'sm' }) => {
    const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
    const colors = ['bg-blue-700', 'bg-purple-700', 'bg-green-700', 'bg-red-700', 'bg-yellow-700', 'bg-pink-700', 'bg-indigo-700', 'bg-teal-700'];
    const displayName = name || '';
    const color = colors[displayName.charCodeAt(0) % colors.length];
    const fallback = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

    // Try to get avatar URL from getTeamDetails
    const avatarUrl = ownerId && getTeamDetails ? getTeamDetails(ownerId, year)?.avatar : null;

    if (avatarUrl) {
        return (
            <img
                src={avatarUrl}
                alt={displayName}
                className={`${sz} rounded-full object-cover border border-white/20 shrink-0`}
                onError={e => {
                    // On error, hide img and show initials fallback via a trick: replace with a div
                    e.target.style.display = 'none';
                    const sib = e.target.nextSibling;
                    if (sib) sib.style.display = 'flex';
                }}
            />
        );
    }

    return (
        <div className={`${sz} ${color} rounded-full flex items-center justify-center font-bold text-white shrink-0`}>
            {fallback}
        </div>
    );
};

const SurvivorGameContent = ({ game, getTeamDetails, year }) => {
    if (!game) return <p className="text-gray-400">No data available</p>;

    const { survivor, survivorId, eliminated, totalTeams, allWeeks, teamList, teamScoresByWeek, closeCalls } = game;

    // Find elim week per team name
    const elimWeekByName = {};
    eliminated.forEach(e => { elimWeekByName[e.team] = e.week; });

    // The grid should only show weeks up to and including the final elimination week
    // (the week when 2 teams became 1 — no need to show the survivor's remaining weeks after that)
    const lastElimWeek = eliminated.length > 0 ? eliminated[eliminated.length - 1].week : Math.max(...allWeeks);
    const gridWeeks = allWeeks.filter(w => w <= lastElimWeek);

    return (
        <div className="space-y-5">
            {/* Header with survivor badge */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <p className="text-xs text-gray-400">Each week, the team with the lowest score is eliminated. Last team standing wins.</p>
                </div>
                {survivor && (
                    <div className="flex items-center gap-2 bg-green-900/30 border border-green-600/40 rounded-lg px-3 py-2">
                        <span className="text-green-400 text-sm">🏆</span>
                        <div>
                            <div className="text-xs text-green-400 font-semibold uppercase tracking-wide leading-none">Survivor</div>
                            <div className="text-sm font-bold text-white">{survivor}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Score grid table — columns stop at final elimination week */}
            <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-gray-700/50">
                            <th className="text-left py-2.5 px-4 text-gray-300 font-medium whitespace-nowrap">Team</th>
                            {gridWeeks.map(w => (
                                <th key={w} className="text-center py-2.5 px-3 text-gray-300 font-medium whitespace-nowrap">Week {w}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {teamList.map((ownerId, rowIdx) => {
                            const teamName = game.getTeamName(ownerId);
                            const elimWeek = elimWeekByName[teamName];
                            const isSurvivor = teamName === survivor;
                            return (
                                <tr key={ownerId} className={`border-t border-white/5 ${isSurvivor ? 'bg-green-900/10' : rowIdx % 2 === 0 ? 'bg-gray-800/20' : ''}`}>
                                    <td className="py-2.5 px-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Avatar ownerId={ownerId} name={teamName} getTeamDetails={getTeamDetails} year={year} />
                                            {isSurvivor && <span className="text-green-400">🏆</span>}
                                            {!isSurvivor && <span className="text-gray-600 text-xs">☠</span>}
                                            <span className={`font-semibold text-sm ${isSurvivor ? 'text-green-300' : 'text-white'}`}>{teamName}</span>
                                        </div>
                                    </td>
                                    {gridWeeks.map(w => {
                                        const score = teamScoresByWeek[ownerId]?.[w];
                                        const wasElimThisWeek = elimWeek === w;
                                        const alreadyElim = elimWeek != null && w > elimWeek;
                                        if (alreadyElim) {
                                            return <td key={w} className="py-2.5 px-3 text-center text-gray-700">—</td>;
                                        }
                                        return (
                                            <td key={w} className="py-2.5 px-3 text-center">
                                                {score != null ? (
                                                    <span className={`font-mono text-xs ${wasElimThisWeek ? 'text-red-400 font-bold' : isSurvivor ? 'text-green-300' : 'text-gray-300'}`}>
                                                        {score.toFixed(1)}
                                                        {wasElimThisWeek && ' ☠'}
                                                    </span>
                                                ) : <span className="text-gray-700">—</span>}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Two-column layout: Graveyard + Close Calls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Graveyard */}
                <div className="bg-gray-800/60 rounded-lg border border-white/10 p-4">
                    <div className="text-sm font-bold text-white mb-1">The Graveyard</div>
                    <div className="text-xs text-gray-400 mb-3">Eliminated teams</div>
                    <div className="space-y-1.5">
                        {[...eliminated].reverse().map((e, idx) => {
                            // find ownerId for this eliminated team to get real avatar
                            const ownerId = teamList.find(id => game.getTeamName(id) === e.team);
                            return (
                                <div key={idx} className="flex items-center justify-between bg-red-900/15 border border-red-900/20 rounded-lg px-3 py-1.5">
                                    <div className="flex items-center gap-2">
                                        <Avatar ownerId={ownerId} name={e.team} getTeamDetails={getTeamDetails} year={year} />
                                        <span className="text-sm text-white font-medium">{e.team}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-400">W{e.week}</span>
                                        <span className="text-red-400 font-mono font-bold">{e.score?.toFixed(1)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Close Calls */}
                <div className="bg-gray-800/60 rounded-lg border border-white/10 p-4">
                    <div className="text-sm font-bold text-white mb-1">Close Calls</div>
                    <div className="text-xs text-gray-400 mb-3">Teams that barely survived</div>
                    {closeCalls.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No close calls this season</p>
                    ) : (
                        <div className="space-y-1.5">
                            {closeCalls.slice(0, 6).map((e, idx) => {
                                const ownerId = teamList.find(id => game.getTeamName(id) === e.nearMiss);
                                return (
                                    <div key={idx} className="flex items-center justify-between bg-yellow-900/10 border border-yellow-800/20 rounded-lg px-3 py-1.5">
                                        <div className="flex items-center gap-2">
                                            <Avatar ownerId={ownerId} name={e.nearMiss} getTeamDetails={getTeamDetails} year={year} />
                                            <span className="text-sm text-white font-medium">{e.nearMiss}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-gray-400">W{e.week}</span>
                                            <span className="text-yellow-400 font-mono font-bold">{e.score?.toFixed(1)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Schedule Simulator — full cross-schedule matrix like reference image
// ─────────────────────────────────────────────────────────────────────────────
const computeScheduleSimulator = (matchups, getTeamName) => {
    // Build weekly scores per team: { ownerId: { week: score } }
    const teamWeeklyScores = {};
    const allTeams = new Set();

    matchups.forEach(m => {
        if (m.owner_id != null) {
            allTeams.add(m.owner_id);
            if (!teamWeeklyScores[m.owner_id]) teamWeeklyScores[m.owner_id] = {};
            teamWeeklyScores[m.owner_id][m.week] = m.points_for ?? 0;
        }
        if (m.team2_owner_id != null) {
            allTeams.add(m.team2_owner_id);
            if (!teamWeeklyScores[m.team2_owner_id]) teamWeeklyScores[m.team2_owner_id] = {};
            teamWeeklyScores[m.team2_owner_id][m.week] = m.points_against ?? 0;
        }
    });

    // Build actual schedule per team: { ownerId: { week: opponentId } }
    const teamSchedule = {};
    matchups.forEach(m => {
        if (m.owner_id != null && m.team2_owner_id != null) {
            if (!teamSchedule[m.owner_id]) teamSchedule[m.owner_id] = {};
            if (!teamSchedule[m.team2_owner_id]) teamSchedule[m.team2_owner_id] = {};
            teamSchedule[m.owner_id][m.week] = m.team2_owner_id;
            teamSchedule[m.team2_owner_id][m.week] = m.owner_id;
        }
    });

    const teams = [...allTeams].filter(id => id != null);

    // For each team (row), compute their record against each other team's schedule (column)
    // "Team A with Team B's schedule" = for each week, Team A's score vs whoever Team B faced that week
    const matrix = {}; // matrix[rowTeamId][colTeamId] = { wins, losses }
    const actualRecords = {}; // actualRecords[teamId] = { wins, losses }

    teams.forEach(rowId => {
        matrix[rowId] = {};
        let aWins = 0, aLosses = 0;

        teams.forEach(colId => {
            let wins = 0, losses = 0;
            const colSched = teamSchedule[colId] || {};

            Object.entries(colSched).forEach(([week, colOpponentId]) => {
                const myScore = teamWeeklyScores[rowId]?.[Number(week)];
                const opponentScore = teamWeeklyScores[colOpponentId]?.[Number(week)];
                if (myScore == null || opponentScore == null) return;
                if (myScore > opponentScore) wins++;
                else losses++;
            });

            matrix[rowId][colId] = { wins, losses };

            if (rowId === colId) {
                aWins = wins;
                aLosses = losses;
            }
        });

        actualRecords[rowId] = { wins: aWins, losses: aLosses };
    });

    // Find biggest beneficiary and biggest victim
    let biggestGain = { teamId: null, gains: 0, bestScheduleId: null };
    let biggestLoss = { teamId: null, losses: 0, worstScheduleId: null };

    teams.forEach(rowId => {
        const actualW = actualRecords[rowId].wins;
        let maxWins = actualW, minWins = actualW;
        let bestColId = rowId, worstColId = rowId;

        teams.forEach(colId => {
            if (colId === rowId) return;
            const w = matrix[rowId][colId].wins;
            if (w > maxWins) { maxWins = w; bestColId = colId; }
            if (w < minWins) { minWins = w; worstColId = colId; }
        });

        const gain = maxWins - actualW;
        const loss = actualW - minWins;
        if (gain > biggestGain.gains) { biggestGain = { teamId: rowId, gains: gain, bestScheduleId: bestColId }; }
        if (loss > biggestLoss.losses) { biggestLoss = { teamId: rowId, losses: loss, worstScheduleId: worstColId }; }
    });

    // Sort teams by actual wins desc for display
    const sortedTeams = [...teams].sort((a, b) => {
        const diff = actualRecords[b].wins - actualRecords[a].wins;
        return diff !== 0 ? diff : actualRecords[a].losses - actualRecords[b].losses;
    });

    return {
        teams: sortedTeams,
        matrix,
        actualRecords,
        biggestGain,
        biggestLoss,
        getTeamName,
    };
};

const ScheduleSimulatorContent = ({ game, getTeamDetails, year }) => {
    if (!game?.teams?.length) return <p className="text-gray-400">No data available</p>;

    const { teams, matrix, actualRecords, biggestGain, biggestLoss, getTeamName } = game;
    const shortLabel = id => initials(getTeamName(id));

    return (
        <div className="space-y-4">
            <p className="text-xs text-gray-400">
                The matrix shows each team's record if they had played every other team's schedule. Blue = actual, Green = best possible, Red = worst possible.
            </p>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-600/60" /> Actual</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-700/60" /> Best</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-800/60" /> Worst</div>
            </div>

            {/* Beneficiary / Victim cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {biggestGain.teamId && (
                    <div className="bg-green-900/20 border border-green-700/35 rounded-xl p-3 flex items-center gap-3">
                        <Avatar ownerId={biggestGain.teamId} name={getTeamName(biggestGain.teamId)} getTeamDetails={getTeamDetails} year={year} size="lg" />
                        <div>
                            <div className="text-[10px] text-green-400 font-semibold uppercase tracking-wide">↗ Biggest Beneficiary</div>
                            <div className="text-sm font-bold text-white mt-0.5">{getTeamName(biggestGain.teamId)}</div>
                            <div className="text-xs text-green-300 mt-0.5">+{biggestGain.gains}W with {getTeamName(biggestGain.bestScheduleId)}'s schedule</div>
                        </div>
                    </div>
                )}
                {biggestLoss.teamId && (
                    <div className="bg-red-900/20 border border-red-700/35 rounded-xl p-3 flex items-center gap-3">
                        <Avatar ownerId={biggestLoss.teamId} name={getTeamName(biggestLoss.teamId)} getTeamDetails={getTeamDetails} year={year} size="lg" />
                        <div>
                            <div className="text-[10px] text-red-400 font-semibold uppercase tracking-wide">↘ Biggest Victim</div>
                            <div className="text-sm font-bold text-white mt-0.5">{getTeamName(biggestLoss.teamId)}</div>
                            <div className="text-xs text-red-300 mt-0.5">-{biggestLoss.losses}W with {getTeamName(biggestLoss.worstScheduleId)}'s schedule</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Cross-schedule matrix — horizontally scrollable on mobile */}
            <div className="overflow-x-auto rounded-lg border border-white/10 -mx-6 px-0 sm:mx-0">
                <table className="text-xs border-collapse" style={{ minWidth: `${teams.length * 52 + 160}px` }}>
                    <thead>
                        <tr className="bg-gray-700/60">
                            <th className="text-left py-3 px-3 text-gray-400 font-medium whitespace-nowrap sticky left-0 bg-gray-700/60 z-10" style={{ minWidth: '140px' }}>Team</th>
                            {teams.map(colId => (
                                <th key={colId} className="text-center py-2 px-1 text-gray-400 font-medium" style={{ minWidth: '48px' }}>
                                    <div className="flex flex-col items-center gap-1">
                                        <Avatar ownerId={colId} name={getTeamName(colId)} getTeamDetails={getTeamDetails} year={year} />
                                        <span className="text-[9px]">{shortLabel(colId)}</span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {teams.map((rowId, rowIdx) => {
                            const actualW = actualRecords[rowId].wins;
                            const actualL = actualRecords[rowId].losses;
                            let maxWins = -Infinity, minWins = Infinity;
                            teams.forEach(colId => {
                                const w = matrix[rowId][colId].wins;
                                if (w > maxWins) maxWins = w;
                                if (w < minWins) minWins = w;
                            });
                            const rowBg = rowIdx % 2 === 0 ? 'bg-gray-800/40' : 'bg-gray-800/10';
                            const stickyBg = rowIdx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/80';
                            return (
                                <tr key={rowId} className={`border-t border-white/5 ${rowBg}`}>
                                    <td className={`py-2 px-3 sticky left-0 z-10 ${stickyBg}`}>
                                        <div className="flex items-center gap-2">
                                            <Avatar ownerId={rowId} name={getTeamName(rowId)} getTeamDetails={getTeamDetails} year={year} />
                                            <div>
                                                <div className="font-semibold text-white text-xs whitespace-nowrap leading-tight">{getTeamName(rowId)}</div>
                                                <div className="text-gray-500 text-[10px]">{actualW}-{actualL}</div>
                                            </div>
                                        </div>
                                    </td>
                                    {teams.map(colId => {
                                        const { wins, losses } = matrix[rowId][colId];
                                        const isActual = rowId === colId;
                                        const isBest = !isActual && wins === maxWins;
                                        const isWorst = !isActual && wins === minWins && wins < maxWins;
                                        let cellBg = '', textColor = 'text-gray-400';
                                        if (isActual) { cellBg = 'bg-blue-600/25'; textColor = 'text-blue-200'; }
                                        else if (isBest) { cellBg = 'bg-green-800/35'; textColor = 'text-green-300'; }
                                        else if (isWorst) { cellBg = 'bg-red-900/35'; textColor = 'text-red-300'; }
                                        return (
                                            <td key={colId} className={`py-2 px-1 text-center ${cellBg}`}>
                                                <span className={`font-mono font-semibold text-[11px] ${textColor}`}>{wins}-{losses}</span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MiniGames;