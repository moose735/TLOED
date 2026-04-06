import React, { useState, useEffect, useMemo } from 'react';
import logger from '../utils/logger';
import { getSleeperPlayerHeadshotUrl } from '../utils/sleeperApi';
import { useSleeperData } from '../contexts/SleeperDataContext';

const HallOfChampions = () => {
    const { historicalData, getTeamName, getTeamDetails, nflPlayers } = useSleeperData();
    const [championsByYear, setChampionsByYear] = useState([]);
    const [isDataReady, setIsDataReady] = useState(false);
    const [selectedYear, setSelectedYear] = useState(null);
    const [showBracket, setShowBracket] = useState(false);
    const [bracketData, setBracketData] = useState(null);
    const [championPlayersByYear, setChampionPlayersByYear] = useState({});
    const [rosterModalOpen, setRosterModalOpen] = useState(false);
    const [rosterModalYear, setRosterModalYear] = useState(null);

    // ── League MVP selections (untouched) ─────────────────────────────────────
    const leagueMVPs = {
        2025: { 
            playerId: '4034', name: 'Christian McCaffrey', position: 'RB', team: 'SF', 
            reasonTitle: 'Dominant Season',
            staticHeadshot: require('../assets/images/mvp-headshots/2025-christian-mccaffrey-sf.png')
        },
        2024: { 
            playerId: '4866', name: 'Saquon Barkley', position: 'RB', team: 'PHI', 
            reasonTitle: 'Joe Schmitt',
            staticHeadshot: require('../assets/images/mvp-headshots/2024-saquon-barkley-phi.png')
        },
        2023: { 
            playerId: '19', name: 'Joe Flacco', position: 'QB', team: 'CLE', 
            reasonTitle: 'Unlikely Hero',
            staticHeadshot: require('../assets/images/mvp-headshots/2023-joe-flacco-cle.png')
        },
        2022: { 
            playerId: '6786', name: 'CeeDee Lamb', position: 'WR', team: 'DAL', 
            reasonTitle: 'Disc Sheep',
            staticHeadshot: require('../assets/images/mvp-headshots/2022-ceedee-lamb-dal.png')
        },
        2021: { 
            playerId: '4984', name: 'Josh Allen', position: 'QB', team: 'BUF', 
            reasonTitle: 'Josh "Josh Allen" Allen',
            staticHeadshot: require('../assets/images/mvp-headshots/2021-josh-allen-buf.png')
        },
    };

    const getMVPForYear = (year) => leagueMVPs[year] || null;

    // ── Hardcoded 2021 roster (untouched) ─────────────────────────────────────
    const hardcoded2021Roster = [
        { playerId: '4984', name: 'Josh Allen', position: 'QB', team: 'BUF', isStarter: true },
        { playerId: '5000', name: 'Chase Edmonds', position: 'RB', team: 'ARI', isStarter: true },
        { playerId: '4962', name: 'Sony Michel', position: 'RB', team: 'LAR', isStarter: true },
        { playerId: '6786', name: 'CeeDee Lamb', position: 'WR', team: 'DAL', isStarter: true },
        { playerId: '2078', name: 'Odell Beckham Jr', position: 'WR', team: 'LAR', isStarter: true },
        { playerId: '1466', name: 'Travis Kelce', position: 'TE', team: 'KC', isStarter: true },
        { playerId: '4950', name: 'Christian Kirk', position: 'WR', team: 'JAX', isStarter: true },
        { playerId: '59', name: 'Mason Crosby', position: 'K', team: 'GB', isStarter: true },
        { playerId: 'PHI', name: 'Philadelphia Eagles', position: 'DEF', team: 'PHI', isStarter: true },
        { playerId: '6826', name: 'Cole Kmet', position: 'TE', team: 'CHI', isStarter: false },
        { playerId: '6945', name: 'Antonio Gibson', position: 'RB', team: 'WAS', isStarter: false },
        { playerId: '1689', name: 'Adam Thielen', position: 'WR', team: 'MIN', isStarter: false },
        { playerId: '5038', name: 'Michael Gallup', position: 'WR', team: 'DAL', isStarter: false },
        { playerId: '6989', name: 'Marquez Callaway', position: 'WR', team: 'NE', isStarter: false },
        { playerId: '6770', name: 'Joe Burrow', position: 'QB', team: 'CIN', isStarter: false },
        { playerId: '6824', name: 'Donovan Peoples-Jones', position: 'WR', team: 'CLE', isStarter: false },
        { playerId: '4149', name: 'Jamaal Williams', position: 'RB', team: 'DET', isStarter: false },
        { playerId: '2168', name: 'Devonta Freeman', position: 'RB', team: 'ATL', isStarter: false },
        { playerId: '4028', name: 'Kansas City Chiefs', position: 'DEF', team: 'KC', isStarter: false },
    ];

    const getStaticHeadshot = (imagePath) => {
        try { return imagePath || null; } catch (error) { return null; }
    };

    const championImages = {
        2024: require('../assets/images/hall-of-champions/2024-champion.JPG'),
        2023: require('../assets/images/hall-of-champions/2023-champion.jpg'),
        2022: require('../assets/images/hall-of-champions/2022-champion.jpg'),
        2021: require('../assets/images/hall-of-champions/2021-champion.jpg'),
    };

    const getChampionImage = (year) => {
        try { return championImages[year] || null; } catch (error) { return null; }
    };

    const getBracketForYear = (year) => {
        if (!historicalData?.winnersBracketBySeason?.[year]) return null;
        const winnersBracket = historicalData.winnersBracketBySeason[year];
        const losersBracket = historicalData.losersBracketBySeason?.[year] || [];
        const rosters = historicalData.rostersBySeason?.[year] || [];
        let teams = [];
        if (rosters && Array.isArray(rosters)) {
            teams = rosters.map(roster => ({
                rosterId: roster.roster_id, ownerId: roster.owner_id,
                name: getTeamName(roster.owner_id, year),
                avatar: getTeamDetails(roster.owner_id, year)?.avatar
            }));
        }
        return { year, winnersBracket, losersBracket, rosters, teams };
    };

    const handleChampionClick = (year) => {
        const bracket = getBracketForYear(year);
        if (bracket) { setSelectedYear(year); setBracketData(bracket); setShowBracket(true); }
    };

    const closeBracket = () => { setShowBracket(false); setSelectedYear(null); setBracketData(null); };

    const getUserDisplayName = (userId, year) => getTeamName(userId, year) || 'Unknown Champion';

    // ── Champions useEffect (untouched) ───────────────────────────────────────
    useEffect(() => {
        const allDataPresent = historicalData && historicalData.winnersBracketBySeason && historicalData.rostersBySeason;
        setIsDataReady(allDataPresent);
        if (allDataPresent) {
            const allChampions = [];
            const sortedYears = Object.keys(historicalData.winnersBracketBySeason).sort((a, b) => b - a);
            for (const year of sortedYears) {
                const yearNumber = Number(year);
                let championUserId = null;
                const winnersBracket = historicalData.winnersBracketBySeason[yearNumber];
                const championshipGame = winnersBracket?.find(matchup => matchup.p === 1 && matchup.w);
                if (championshipGame) {
                    const winningRosterId = String(championshipGame.w);
                    const rostersForYear = historicalData.rostersBySeason?.[yearNumber];
                    if (rostersForYear && Array.isArray(rostersForYear)) {
                        const winningRoster = rostersForYear.find(roster => String(roster.roster_id) === winningRosterId);
                        if (winningRoster && winningRoster.owner_id) championUserId = winningRoster.owner_id;
                    }
                }
                if (!championUserId) {
                    const seasonAwards = historicalData.seasonAwardsSummary?.[yearNumber];
                    if (seasonAwards?.champion && seasonAwards.champion !== 'N/A') {
                        championUserId = seasonAwards.champion;
                    } else {
                        const awardsSummary = historicalData.awardsSummary?.[yearNumber];
                        const champKey = awardsSummary?.champion || awardsSummary?.["Champion"];
                        if (champKey && champKey !== 'N/A') championUserId = champKey;
                    }
                }
                if (championUserId) {
                    const championName = getUserDisplayName(championUserId, yearNumber);
                    const teamDetails = getTeamDetails(championUserId, yearNumber);
                    allChampions.push({
                        year: yearNumber,
                        name: championName !== 'Unknown Champion' ? championName : championUserId,
                        championId: championUserId,
                        avatar: teamDetails?.avatar,
                        image: getChampionImage(yearNumber),
                        hasBracket: !!winnersBracket && winnersBracket.length > 0
                    });
                }
            }
            try {
                logger.debug && logger.debug('HallOfChampions: built allChampions', allChampions);
                if (typeof window !== 'undefined') {
                    window.__championsByYear = allChampions;
                    window.__historicalDataSummary = { hasHistoricalData: !!historicalData, winnersKeys: historicalData && historicalData.winnersBracketBySeason ? Object.keys(historicalData.winnersBracketBySeason) : [], rostersKeys: historicalData && historicalData.rostersBySeason ? Object.keys(historicalData.rostersBySeason) : [] };
                }
            } catch (e) {}
            setChampionsByYear(allChampions);
        }
    }, [historicalData, getTeamName, getTeamDetails]);

    // ── Champion players useEffect (untouched) ────────────────────────────────
    useEffect(() => {
        if (!historicalData || !championsByYear || championsByYear.length === 0) return;
        const db = {};
        const normalizePlayerArray = (arr) => {
            if (!arr && arr !== 0) return null;
            const mapEntryToId = (entry) => { if (!entry && entry !== 0) return null; if (typeof entry === 'string') return entry; if (typeof entry === 'number') return String(entry); if (typeof entry === 'object') { return String(entry.player_id || entry.playerId || entry.id || entry.player?.player_id || entry.player?.playerId || entry.pid || entry.sleeper_id || entry.sleeper_player_id || entry.roster_player_id || null); } return null; };
            if (Array.isArray(arr)) return arr.map(mapEntryToId).filter(Boolean);
            if (typeof arr === 'object') return Object.keys(arr).map(k => mapEntryToId(arr[k])).filter(Boolean);
            return null;
        };
        const findWinningRosterId = (yearNumber) => { const winnersBracket = historicalData.winnersBracketBySeason?.[yearNumber]; if (winnersBracket && Array.isArray(winnersBracket)) { const championshipGame = winnersBracket.find(g => g.p === 1 && g.w); if (championshipGame && championshipGame.w) return String(championshipGame.w); } return null; };
        const getPlayersFromRosterObj = (rosterObj) => {
            if (!rosterObj) return null;
            const mapEntryToId = (entry) => { if (!entry && entry !== 0) return null; if (typeof entry === 'string') return entry; if (typeof entry === 'number') return String(entry); if (typeof entry === 'object') { return String(entry.player_id || entry.playerId || entry.id || entry.player?.player_id || entry.player?.playerId || entry.pid || entry.sleeper_id || entry.sleeper_player_id || entry.roster_player_id || null); } return null; };
            const normalizeArray = (arr) => { if (!arr) return null; if (Array.isArray(arr)) return arr.map(mapEntryToId).filter(Boolean); if (typeof arr === 'object') { return Object.keys(arr).map(k => mapEntryToId(arr[k])).filter(Boolean); } return null; };
            if (Array.isArray(rosterObj.players) && rosterObj.players.length > 0) return normalizeArray(rosterObj.players);
            if (Array.isArray(rosterObj.starters) && rosterObj.starters.length > 0) return normalizeArray(rosterObj.starters);
            if (rosterObj.players_by_week && typeof rosterObj.players_by_week === 'object') { const weeks = Object.keys(rosterObj.players_by_week).sort((a,b) => parseInt(b)-parseInt(a)); if (weeks.length > 0) return normalizeArray(rosterObj.players_by_week[weeks[0]]); }
            return null;
        };
        const findPlayerTeamInMatchups = (yearNumber, playerId, championshipWeekHint = null) => {
            const matchups = historicalData.matchupsBySeason?.[yearNumber] || [];
            const weeksToScan = new Set();
            if (championshipWeekHint) weeksToScan.add(String(championshipWeekHint));
            const recentWeeks = matchups.slice(-6).map(m => String(m.week || m.weekNumber || ''));
            recentWeeks.forEach(w => { if (w) weeksToScan.add(w); });
            const inspectValueForPlayerTeam = (val, pid) => { if (!val) return null; if (typeof val === 'object') { if (val.hasOwnProperty(pid) && val[pid] && typeof val[pid] === 'object') { if (val[pid].team) return val[pid].team; if (val[pid].player_team) return val[pid].player_team; } if (Array.isArray(val)) { for (const item of val) { const found = inspectValueForPlayerTeam(item, pid); if (found) return found; } } else { for (const k of Object.keys(val)) { const v = val[k]; if (k === 'team' && typeof v === 'string') return v; if ((k === 'player_id' || k === 'player' || k === 'playerId') && String(val[k]) === String(pid)) { if (val.team) return val.team; } const found = inspectValueForPlayerTeam(v, pid); if (found) return found; } } } return null; };
            for (const m of matchups) { const wk = String(m.week || m.weekNumber || ''); if (weeksToScan.size > 0 && !weeksToScan.has(wk)) continue; const candidateFields = [m.team1_players, m.team2_players, m.team1_details, m.team2_details, m.team1_players_points, m.team2_players_points, m.players, m.players_points, m.players_points_map]; for (const field of candidateFields) { const found = inspectValueForPlayerTeam(field, String(playerId)); if (found) return found; } const foundAny = inspectValueForPlayerTeam(m, String(playerId)); if (foundAny) return foundAny; }
            return null;
        };
        championsByYear.forEach(champ => {
            const year = champ.year; const championId = champ.championId; const championName = champ.name;
            const rosterId = findWinningRosterId(year);
            let players = null;
            if (year === 2021) {
                players = hardcoded2021Roster.map(p => p.playerId);
            } else {
                const rostersForYear = historicalData.rostersBySeason?.[year] || historicalData.rostersBySeason?.[String(year)];
                if (rostersForYear && Array.isArray(rostersForYear)) { const rosterObj = rostersForYear.find(r => String(r.roster_id) === String(rosterId)); players = getPlayersFromRosterObj(rosterObj); }
            }
            if ((!players || players.length === 0) && historicalData.matchupsBySeason && historicalData.matchupsBySeason[year]) {
                const matchups = historicalData.matchupsBySeason[year];
                const winnersBracket = historicalData.winnersBracketBySeason?.[year] || [];
                const championshipGame = winnersBracket.find(g => g.p === 1 && g.w);
                const championshipWeek = championshipGame?.week || championshipGame?.weekNumber || null;
                const tryMatchups = (list) => { for (let i = list.length - 1; i >= 0; i--) { const m = list[i]; if (String(m.team1_roster_id) === String(rosterId)) { if (m.team1_players) return normalizePlayerArray(m.team1_players); if (m.team1_details && m.team1_details.starters) return normalizePlayerArray(m.team1_details.starters); } if (String(m.team2_roster_id) === String(rosterId)) { if (m.team2_players) return normalizePlayerArray(m.team2_players); if (m.team2_details && m.team2_details.starters) return normalizePlayerArray(m.team2_details.starters); } } return null; };
                if (championshipWeek) { const weekMatchups = matchups.filter(mm => String(mm.week) === String(championshipWeek) || mm.weekNumber === championshipWeek || mm.playoffs); players = tryMatchups(weekMatchups) || players; }
                if ((!players || players.length === 0)) players = tryMatchups(matchups) || players;
            }
            const normalized = [];
            if (year === 2021 && Array.isArray(players)) {
                hardcoded2021Roster.forEach(playerData => {
                    const meta = (nflPlayers && nflPlayers[playerData.playerId]) || null;
                    normalized.push({ playerId: playerData.playerId, name: playerData.name || (meta ? `${meta.first_name} ${meta.last_name}` : playerData.playerId), position: playerData.position || (meta ? meta.position : null), nflMeta: meta || null, teamAtChampionship: playerData.team || meta?.team || null, starterPoints: null, isStarter: playerData.isStarter || false });
                });
            } else if (Array.isArray(players)) {
                const winnersBracket = historicalData.winnersBracketBySeason?.[year] || [];
                const championshipGame = winnersBracket.find(g => g.p === 1 && g.w);
                const championshipWeek = championshipGame?.week || championshipGame?.weekNumber || null;
                let championshipMatch = null;
                const matchups = historicalData.matchupsBySeason?.[year] || [];
                if (championshipWeek) { const weekMatchups = matchups.filter(mm => String(mm.week) === String(championshipWeek) || mm.weekNumber === championshipWeek || mm.playoffs); championshipMatch = weekMatchups.find(m => String(m.team1_roster_id) === String(rosterId) || String(m.team2_roster_id) === String(rosterId)) || null; }
                if (!championshipMatch && Array.isArray(matchups) && matchups.length > 0) { for (let i = matchups.length - 1; i >= 0; i--) { const m = matchups[i]; if (String(m.team1_roster_id) === String(rosterId) || String(m.team2_roster_id) === String(rosterId)) { championshipMatch = m; break; } } }
                const extractPointsForRoster = (match, rosterIdStr) => { if (!match) return null; const isTeam1 = String(match.team1_roster_id) === String(rosterIdStr); const teamPlayers = isTeam1 ? (match.team1_players || match.team1_details || {}) : (match.team2_players || match.team2_details || {}); const playersPoints = teamPlayers.players_points || teamPlayers.players_points_map || teamPlayers.players_points_by_id || null; const starters = teamPlayers.starters || null; return { playersPoints, starters }; };
                const rosterPointsInfo = championshipMatch ? extractPointsForRoster(championshipMatch, rosterId) : null;
                const startersSet = rosterPointsInfo && Array.isArray(rosterPointsInfo.starters) ? new Set(rosterPointsInfo.starters.map(s => String(s))) : null;
                players.forEach(pid => {
                    const meta = (nflPlayers && nflPlayers[pid]) || null;
                    let pointsForChampGame = null;
                    const pidStr = String(pid);
                    const isStarter = startersSet ? startersSet.has(pidStr) : false;
                    if (rosterPointsInfo && rosterPointsInfo.playersPoints) { const ptsMap = rosterPointsInfo.playersPoints; if (Array.isArray(rosterPointsInfo.starters) && rosterPointsInfo.starters.length > 0) { const startersSet = new Set(rosterPointsInfo.starters.map(s => String(s))); const pidStr = String(pid); if (startersSet.has(pidStr) && typeof ptsMap[pidStr] === 'number') { pointsForChampGame = ptsMap[pidStr]; } else { pointsForChampGame = pointsForChampGame; } } else { const v = ptsMap[String(pid)]; if (typeof v === 'number') pointsForChampGame = v; } }
                    const teamFromMatchups = findPlayerTeamInMatchups(year, pid, championshipWeek);
                    const teamValue = teamFromMatchups || meta?.team || null;
                    normalized.push({ playerId: pid, name: meta ? `${meta.first_name} ${meta.last_name}` : pid, position: meta ? meta.position : null, nflMeta: meta || null, teamAtChampionship: teamValue, starterPoints: pointsForChampGame, isStarter });
                });
            }
            db[year] = { year, championId, championName, rosterId: rosterId || null, players: normalized };
        });
        logger.debug && logger.debug('HallOfChampions: built championPlayersByYear', db);
        setChampionPlayersByYear(db);
    }, [historicalData, championsByYear, nflPlayers]);

    // ── PlayerAvatar (untouched logic, dark-safe styling) ─────────────────────
    const PlayerAvatar = ({ p, size = 40, className = '', staticHeadshot = null }) => {
        const explicit = p?.nflMeta?.headshot || p?.nflMeta?.headshot_url || p?.nflMeta?.img || null;
        const built = p?.playerId ? getSleeperPlayerHeadshotUrl(p.playerId) : null;
        const imgUrl = staticHeadshot || explicit || built;
        const [imgError, setImgError] = useState(false);
        if (imgUrl && !imgError) {
            return (
                <div style={{ width: size, height: size }} className={`relative rounded-full flex-shrink-0 ${className}`}>
                    <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 0 3px rgba(250,204,21,0.9)' }} />
                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={imgUrl} alt={p.name || p.playerId} style={{ width: size - 6, height: size - 6, borderRadius: '50%' }} className="object-cover" onError={() => setImgError(true)} />
                    </div>
                </div>
            );
        }
        return (
            <div style={{ width: size, height: size }} className={`relative rounded-full overflow-hidden flex-shrink-0 ${className}`}>
                <div className="w-full h-full rounded-full bg-amber-900/40 border border-amber-500/40 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 text-amber-400" fill="currentColor" aria-hidden>
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                </div>
            </div>
        );
    };

    // ── MVP Display (dark themed) ─────────────────────────────────────────────
    const MVPDisplay = ({ year, mvp }) => {
        if (!mvp) {
            return (
                <div className="mt-4 bg-white/5 border border-dashed border-white/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500">🏆 No MVP selected yet</p>
                </div>
            );
        }
        const mvpPlayer = { playerId: mvp.playerId, name: mvp.name, nflMeta: { first_name: mvp.name?.split(' ')[0] || '', last_name: mvp.name?.split(' ').slice(1).join(' ') || '' } };
        return (
            <div className="mt-4 bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-3">
                <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                        <PlayerAvatar p={mvpPlayer} size={56} staticHeadshot={getStaticHeadshot(mvp.staticHeadshot)} />
                        <div className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-yellow-900 rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow">👑 MVP</div>
                    </div>
                    <div className="min-w-0">
                        <div className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider">League MVP {year}</div>
                        <div className="text-sm font-bold text-white truncate">{mvp.name}</div>
                        <div className="text-xs text-gray-400">{mvp.position} · {mvp.team}</div>
                        {mvp.reasonTitle && <div className="text-[10px] text-gray-500 italic mt-0.5">{mvp.reasonTitle}</div>}
                    </div>
                </div>
            </div>
        );
    };

    const openRosterModal = (year) => { setRosterModalYear(year); setRosterModalOpen(true); };
    const closeRosterModal = () => { setRosterModalOpen(false); setRosterModalYear(null); };

    // ── Bracket Modal (dark themed) ───────────────────────────────────────────
    const BracketModal = ({ bracket, onClose }) => {
        if (!bracket) return null;
        const { year, winnersBracket, losersBracket, teams } = bracket;
        if (!winnersBracket || !Array.isArray(winnersBracket)) {
            return (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
                        <h3 className="text-lg font-bold text-white mb-3">No Bracket Data</h3>
                        <p className="text-gray-400 text-sm mb-4">Bracket data is not available for {year}.</p>
                        <button onClick={onClose} className="px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg text-sm hover:bg-blue-500/30 transition-colors">Close</button>
                    </div>
                </div>
            );
        }
        const getTeamInfo = (rosterId) => { if (!teams || !Array.isArray(teams)) return { name: 'Unknown Team', avatar: null }; return teams.find(t => String(t.rosterId) === String(rosterId)) || { name: 'Unknown Team', avatar: null }; };
        const mainBracketGames = [];
        winnersBracket.forEach(game => { if (!game.p || game.p === 1) mainBracketGames.push(game); });
        const gamesByRound = {};
        mainBracketGames.forEach(game => { const round = game.r || 1; if (!gamesByRound[round]) gamesByRound[round] = []; gamesByRound[round].push(game); });
        const sortedRounds = Object.keys(gamesByRound).sort((a, b) => parseInt(a) - parseInt(b));
        const getRoundName = (round, games) => {
            const roundNum = parseInt(round);
            const maxRound = Math.max(...sortedRounds.map(r => parseInt(r)));
            if (roundNum === maxRound) return "Championship";
            if (roundNum === maxRound - 1) return "Semifinals";
            if (roundNum === maxRound - 2) return "Quarterfinals";
            if (roundNum === 1) return "First Round";
            return `Round ${roundNum}`;
        };
        const renderBracketMatchup = (game) => {
            const team1Info = getTeamInfo(game.t1);
            const team2Info = getTeamInfo(game.t2);
            return (
                <div className="bg-gray-700 border border-white/10 rounded-lg overflow-hidden w-48">
                    {[{ info: team1Info, score: game.t1_score, isWinner: String(game.w) === String(game.t1) },
                      { info: team2Info, score: game.t2_score, isWinner: String(game.w) === String(game.t2) }
                    ].map((side, i) => (
                        <div key={i} className={`flex items-center justify-between px-3 py-2 h-10 ${i === 0 ? 'border-b border-white/10' : ''} ${side.isWinner ? 'bg-emerald-900/30 border-l-2 border-l-emerald-400' : 'bg-gray-750'}`}>
                            <div className="flex items-center gap-2 min-w-0">
                                <img src={side.info.avatar || 'https://sleepercdn.com/avatars/default_avatar.png'} alt={side.info.name} className="w-5 h-5 rounded-full flex-shrink-0 border border-white/20" onError={e => { e.target.src = 'https://sleepercdn.com/avatars/default_avatar.png'; }} />
                                <span className={`text-xs truncate ${side.isWinner ? 'text-white font-semibold' : 'text-gray-400'}`}>{side.info.name}</span>
                            </div>
                            <span className={`text-xs font-bold ml-2 flex-shrink-0 tabular-nums ${side.isWinner ? 'text-emerald-400' : 'text-gray-500'}`}>{side.score ? parseFloat(side.score).toFixed(1) : '—'}</span>
                        </div>
                    ))}
                </div>
            );
        };
        return (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 border border-white/10 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-auto">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                        <h3 className="text-lg font-bold text-white">{year} Tournament Bracket</h3>
                        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors text-lg font-bold">×</button>
                    </div>
                    <div className="p-6">
                        <div className="flex justify-center">
                            <div className="flex items-center gap-12 overflow-x-auto pb-4">
                                {sortedRounds.map((round) => {
                                    const roundGames = gamesByRound[round];
                                    const roundName = getRoundName(round, roundGames);
                                    const isChampionship = roundName === "Championship";
                                    return (
                                        <div key={round} className="flex flex-col items-center min-w-max">
                                            <div className="mb-5 text-center">
                                                <span className={`text-xs font-semibold uppercase tracking-widest ${isChampionship ? 'text-yellow-400' : 'text-gray-500'}`}>{roundName}</span>
                                            </div>
                                            <div className="flex flex-col justify-center gap-10">
                                                {roundGames.map((game, gameIndex) => (
                                                    <div key={`${game.r}-${game.m}-${gameIndex}`} className="relative">
                                                        {renderBracketMatchup(game)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        {sortedRounds.length === 0 && (
                            <div className="text-center text-gray-500 py-8 text-sm">No playoff games found for {year}.</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ── Loading / empty states ────────────────────────────────────────────────
    if (!isDataReady) {
        return (
            <div className="text-center py-12 text-gray-500 text-sm animate-pulse">
                Loading historical champion data…
            </div>
        );
    }
    if (championsByYear.length === 0) {
        return (
            <div className="text-center py-12 text-red-400 text-sm">
                No champion data found in the provided data.
            </div>
        );
    }

    // ── Main render ───────────────────────────────────────────────────────────
    return (
        <div className="w-full space-y-8 p-2 sm:p-4">

            {/* Champion cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {championsByYear.map((champion, index) => (
                    <div key={index} className="relative bg-gray-800 border border-yellow-500/20 rounded-2xl p-5 flex flex-col items-center text-center shadow-xl hover:-translate-y-0.5 transition-transform">
                        {/* Year pill */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-400 text-gray-900 px-3 py-1 rounded-full text-xs font-bold shadow border border-amber-300/50">
                            {champion.year}
                        </div>

                        {/* Champion image */}
                        <div className="mb-4 mt-2 rounded-xl overflow-hidden border border-white/10 bg-black/20">
                            {champion.image ? (
                                <img src={champion.image} alt={`${champion.year} Champion`} className="max-w-full max-h-44 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                            ) : (
                                <div className="w-24 h-24 bg-gradient-to-br from-amber-700/40 to-yellow-600/30 flex items-center justify-center text-2xl font-bold text-amber-400 rounded-xl">
                                    {(champion.name || '').split(' ')[0]?.slice(0, 2)}
                                </div>
                            )}
                        </div>

                        {/* Champion name */}
                        <div className="text-white text-base font-semibold mb-1">{champion.name}</div>

                        {/* MVP */}
                        <MVPDisplay year={champion.year} mvp={getMVPForYear(champion.year)} />

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-4">
                            {champion.hasBracket && (
                                <button onClick={() => handleChampionClick(champion.year)} className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium rounded-lg hover:bg-amber-500/30 transition-colors">
                                    View Bracket
                                </button>
                            )}
                            <button onClick={() => openRosterModal(champion.year)} className="px-3 py-1.5 bg-white/8 text-gray-300 border border-white/10 text-xs font-medium rounded-lg hover:bg-white/12 transition-colors">
                                View Roster
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Multi-Time Champions */}
            <div className="bg-gray-800 border border-white/10 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                    <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Multi-Time Champions</span>
                </div>
                <div className="p-4">
                    {Object.keys(championPlayersByYear).length === 0 ? (
                        <p className="text-sm text-gray-500">Champion roster player data not available or still processing.</p>
                    ) : (() => {
                        try {
                            logger.debug && logger.debug('HallOfChampions: championPlayersByYear for multi-time calc', championPlayersByYear);
                            if (typeof window !== 'undefined') window.__championPlayersByYear = championPlayersByYear;
                        } catch (e) {}
                        const tally = {};
                        const normalizeNameText = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
                        Object.values(championPlayersByYear).forEach(entry => {
                            const seenThisYear = new Set();
                            const yearLabel = entry.year;
                            (entry.players || []).forEach(p => {
                                if (!p) return;
                                let pid = null, name = null;
                                if (typeof p === 'string' || typeof p === 'number') { pid = String(p); name = (nflPlayers && nflPlayers[pid]) ? `${nflPlayers[pid].first_name} ${nflPlayers[pid].last_name}` : pid; }
                                else if (typeof p === 'object') { pid = p.playerId || p.player_id || p.id || p.pid || p.sleeper_player_id || (p.nflMeta && (p.nflMeta.player_id || p.nflMeta.id)) || null; if (pid !== null && pid !== undefined) pid = String(pid); name = p.name || (p.nflMeta ? `${p.nflMeta.first_name || ''} ${p.nflMeta.last_name || ''}`.trim() : '') || null; }
                                const nameKey = normalizeNameText(name || '');
                                if (!pid && nameKey && nflPlayers) { const found = Object.keys(nflPlayers).find(k => { const meta = nflPlayers[k]; if (!meta) return false; const full = normalizeNameText(`${meta.first_name || ''} ${meta.last_name || ''}`); const last = normalizeNameText(`${meta.last_name || ''}`); return full === nameKey || full.includes(nameKey) || nameKey.includes(last) || last && nameKey.includes(last); }); if (found) pid = String(found); }
                                const key = pid || nameKey;
                                if (!key) return;
                                if (seenThisYear.has(key)) return;
                                seenThisYear.add(key);
                                if (!tally[key]) { tally[key] = { playerId: pid || null, name: name || (pid && ((nflPlayers && nflPlayers[pid]) ? `${nflPlayers[pid].first_name} ${nflPlayers[pid].last_name}` : pid)) || key, years: [] }; }
                                if (!tally[key].years.includes(yearLabel)) tally[key].years.push(yearLabel);
                            });
                        });
                        const computed = Object.values(tally).map(item => ({ ...item, count: item.years.length }));
                        const multi = computed.filter(x => x.count > 1).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
                        if (multi.length === 0) return <p className="text-sm text-gray-500">No multi-time champions found in the current dataset.</p>;
                        return (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {multi.map(p => (
                                    <div key={`multi-${p.playerId}`} className="flex flex-col items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-4">
                                        <PlayerAvatar p={p} size={56} />
                                        <div className="text-center">
                                            <div className="font-semibold text-sm text-gray-200 leading-tight" title={p.name} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                                            <div className="text-xs text-gray-500 mt-1">Championships: <span className="font-bold text-yellow-400">{p.count}</span></div>
                                            <div className="text-[10px] text-gray-600 mt-0.5">{p.years.join(', ')}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Celebration GIF */}
            <div className="flex justify-center">
                <div className="w-full max-w-2xl">
                    <img src="/hall-of-champions/tom-brady-rings.gif" alt="celebration" className="w-full h-auto object-contain max-h-56 sm:max-h-64 rounded-xl" onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
            </div>

            {/* Roster Modal */}
            {rosterModalOpen && rosterModalYear && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 border border-white/10 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                            <h3 className="text-base font-bold text-white">{rosterModalYear} Champion Roster</h3>
                            <button onClick={closeRosterModal} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors text-lg font-bold">×</button>
                        </div>
                        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {(() => {
                                const players = (championPlayersByYear[rosterModalYear]?.players || []);
                                const starterOrder = ['QB','RB','RB','FLEX','WR','WR','TE','K','DEF'];
                                const starters = players.filter(p => p.isStarter);
                                const bench = players.filter(p => !p.isStarter);
                                const normPos = (pos) => (pos || '').toUpperCase();
                                const byPos = {};
                                starters.forEach(s => { const pos = normPos(s.position) || 'FLEX'; if (!byPos[pos]) byPos[pos] = []; byPos[pos].push(s); });
                                const orderedStarters = [];
                                const usedIds = new Set();
                                for (const slot of starterOrder) {
                                    if (slot === 'FLEX') { const remaining = starters.filter(s => !usedIds.has(s.playerId)); const preferred = remaining.find(r => ['RB','WR','TE'].includes(normPos(r.position))); const pick = preferred || remaining[0]; if (pick) { orderedStarters.push(pick); usedIds.add(pick.playerId); } continue; }
                                    const bucket = byPos[slot];
                                    if (bucket && bucket.length > 0) { const pick = bucket.find(b => !usedIds.has(b.playerId)); if (pick) { orderedStarters.push(pick); usedIds.add(pick.playerId); } }
                                }
                                starters.forEach(s => { if (!usedIds.has(s.playerId)) { orderedStarters.push(s); usedIds.add(s.playerId); } });
                                const positionPriority = { 'QB': 1, 'RB': 2, 'WR': 3, 'TE': 4, 'K': 5, 'DEF': 6 };
                                const benchSorted = bench.slice().sort((a,b) => { const pa = positionPriority[normPos(a.position)] || 99; const pb = positionPriority[normPos(b.position)] || 99; if (pa !== pb) return pa - pb; return (a.name || '').localeCompare(b.name || ''); });
                                return (
                                    <>
                                        {orderedStarters.map(p => (
                                            <div key={`modal-starter-${p.playerId}`} className="flex items-center gap-2.5 p-2.5 bg-white/5 border border-white/10 rounded-xl">
                                                <PlayerAvatar p={p} size={40} />
                                                <div className="min-w-0">
                                                    <div className="text-xs font-medium text-gray-200 leading-tight" title={p.name} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                                                    <div className="text-[10px] text-gray-500">{p.position || 'N/A'}</div>
                                                    {typeof p.starterPoints === 'number' && <div className="text-[10px] text-yellow-400 font-semibold">{p.starterPoints} pts</div>}
                                                </div>
                                            </div>
                                        ))}
                                        {benchSorted.length > 0 && (
                                            <div className="col-span-full my-1">
                                                <div className="border-t border-dashed border-white/10 w-full" />
                                                <p className="text-[10px] text-gray-600 text-center mt-1">Bench</p>
                                            </div>
                                        )}
                                        {benchSorted.map(p => (
                                            <div key={`modal-bench-${p.playerId}`} className="flex items-center gap-2.5 p-2.5 bg-white/[0.03] border border-white/5 rounded-xl">
                                                <PlayerAvatar p={p} size={36} />
                                                <div className="min-w-0">
                                                    <div className="text-xs font-medium text-gray-300 leading-tight" title={p.name} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                                                    <div className="text-[10px] text-gray-600">{p.position || 'N/A'}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Bracket Modal */}
            {showBracket && <BracketModal bracket={bracketData} onClose={closeBracket} />}
        </div>
    );
};

export default HallOfChampions;