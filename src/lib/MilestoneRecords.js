import React, { useState, useEffect } from 'react';
import logger from '../utils/logger';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { calculateAllLeagueMetrics } from '../utils/calculations';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faTrophy } from '@fortawesome/free-solid-svg-icons';

const MilestoneRecords = () => {
    const {
        historicalData, getTeamName, getTeamDetails,
        currentSeason, nflState,
        loading: contextLoading, error: contextError
    } = useSleeperData();

    const [activeMilestone, setActiveMilestone] = useState('totalWins');
    const [milestoneData, setMilestoneData] = useState({});
    const [dynamicMilestones, setDynamicMilestones] = useState({});
    const [loading, setLoading] = useState(true);
    const [expandedThresholds, setExpandedThresholds] = useState({});

    // ── All logic untouched ───────────────────────────────────────────────────
    const baseMilestones = {
        totalWins: { title: 'Total Wins', description: 'Career victory milestones celebrating the most successful franchises in league history. Every win counts toward these legendary achievements.', icon: '🏆', thresholds: [25, 50, 75, 100, 150], color: 'green' },
        totalLosses: { title: 'Total Losses', description: 'Career loss milestones that track the journey through adversity. Sometimes the path to greatness includes learning from defeat.', icon: '💀', thresholds: [25, 50, 75, 100, 150], color: 'red' },
        allPlayWins: { title: 'All-Play Wins', description: 'All-Play wins show how often your score would beat every other team that week. This milestone celebrates consistent high-level performance.', icon: '⚡', thresholds: [50, 100, 200, 300, 500], color: 'blue' },
        allPlayLosses: { title: 'All-Play Losses', description: 'All-Play losses track how many teams would have beaten you each week. This milestone shows the journey through challenging performances.', icon: '💸', thresholds: [50, 100, 200, 300, 500], color: 'purple' },
        totalPoints: { title: 'Total Points', description: 'Career scoring milestones recognizing the highest cumulative point totals in league history. These achievements showcase offensive consistency and excellence.', icon: '📊', thresholds: [1000, 2500, 5000, 7500, 10000], color: 'yellow' },
        highScores: { title: 'High Scores', description: 'Milestones for achieving the most high-scoring weeks (top 3 performances each week).', icon: '🚀', thresholds: [5, 10, 25, 50, 75], color: 'orange' }
    };

    const generateDynamicMilestones = (teamStats) => {
        const updatedMilestones = JSON.parse(JSON.stringify(baseMilestones));
        const totalTeams = Object.keys(teamStats || {}).length;
        Object.keys(updatedMilestones).forEach(milestoneKey => {
            const milestone = updatedMilestones[milestoneKey];
            const currentThresholds = [...milestone.thresholds];
            let highestAchieved = 0;
            Object.values(teamStats).forEach(stats => {
                let currentValue = 0;
                switch (milestoneKey) {
                    case 'totalWins': currentValue = stats.totalWins || 0; break;
                    case 'totalLosses': currentValue = stats.totalLosses || 0; break;
                    case 'allPlayWins': currentValue = stats.allPlayWins || 0; break;
                    case 'allPlayLosses': currentValue = stats.allPlayLosses || 0; break;
                    case 'totalPoints': currentValue = stats.totalPoints || 0; break;
                    case 'highScores': currentValue = stats.highScores || 0; break;
                }
                highestAchieved = Math.max(highestAchieved, currentValue);
            });
            const maxThreshold = Math.max(...currentThresholds);
            if (highestAchieved >= maxThreshold) {
                const newThresholds = generateNewThresholds(milestoneKey, maxThreshold, highestAchieved);
                milestone.thresholds = [...new Set([...currentThresholds, ...newThresholds])].sort((a, b) => a - b);
            }
        });
        return updatedMilestones;
    };

    const generateNewThresholds = (milestoneKey, currentMax, highestAchieved) => {
        const newThresholds = [];
        let nextThreshold = currentMax;
        const incrementPatterns = {
            totalWins: [25, 50, 25, 25, 50], totalLosses: [25, 50, 25, 25, 50],
            allPlayWins: [100, 200, 200, 300, 500], allPlayLosses: [100, 200, 200, 300, 500],
            totalPoints: [2500, 2500, 5000, 5000, 10000], highScores: [25, 25, 50, 50, 100]
        };
        const pattern = incrementPatterns[milestoneKey] || [50, 100, 100, 200, 500];
        let patternIndex = 0;
        while (nextThreshold <= highestAchieved + pattern[patternIndex % pattern.length] * 2) {
            nextThreshold += pattern[patternIndex % pattern.length];
            newThresholds.push(nextThreshold);
            patternIndex++;
            if (newThresholds.length >= 10) break;
        }
        return newThresholds;
    };

    const milestones = Object.keys(dynamicMilestones).length > 0 ? dynamicMilestones : baseMilestones;

    useEffect(() => {
        if (contextLoading || !historicalData) { setLoading(true); return; }
        try { calculateMilestones(); }
        catch (err) { logger.error('Error calculating milestones:', err); }
        finally { setLoading(false); }
    }, [historicalData, contextLoading]);

    const calculateMilestones = () => {
        logger.debug('=== SIMPLE MILESTONE TRACKER START ===');
        const { careerDPRData } = calculateAllLeagueMetrics(historicalData, null, getTeamName, nflState);
        if (!careerDPRData || careerDPRData.length === 0) { logger.warn('No career data found'); return; }
        const teamStats = {}, allRosters = {}, achievementTimeline = {};
        careerDPRData.forEach(careerStats => {
            const ownerId = careerStats.ownerId;
            const teamDetails = getTeamDetails(ownerId, currentSeason);
            teamStats[ownerId] = { wins: 0, losses: 0, ties: 0, points: 0, allPlayWins: 0, allPlayLosses: 0, highScores: 0, finalWins: careerStats.wins || 0, finalLosses: careerStats.losses || 0, finalTies: careerStats.ties || 0, finalPoints: careerStats.pointsFor || 0, finalAllPlayWins: careerStats.allPlayWins || 0, finalAllPlayLosses: careerStats.allPlayLosses || 0, finalHighScores: careerStats.topScoreWeeksCount || 0 };
            allRosters[ownerId] = { name: careerStats.teamName || getTeamName(ownerId, currentSeason), avatar: teamDetails?.avatar };
        });
        let generatedMilestones = generateDynamicMilestones(teamStats);
        Object.keys(generatedMilestones).forEach(milestoneKey => {
            achievementTimeline[milestoneKey] = {};
            generatedMilestones[milestoneKey].thresholds.forEach(threshold => { achievementTimeline[milestoneKey][threshold] = []; });
        });
        const allSeasons = Object.keys(historicalData.matchupsBySeason || {}).sort((a, b) => parseInt(a) - parseInt(b));
        let globalWeek = 0;
        logger.debug(`Processing ${allSeasons.length} seasons chronologically`);
        allSeasons.forEach(season => {
            const matchups = historicalData.matchupsBySeason?.[season] || [];
            const rosters = historicalData.rostersBySeason?.[season] || [];
            const weeklyMatchups = {};
            matchups.forEach(matchup => { const week = matchup.week; if (!weeklyMatchups[week]) weeklyMatchups[week] = []; weeklyMatchups[week].push(matchup); });
            const weeks = Object.keys(weeklyMatchups).sort((a, b) => parseInt(a) - parseInt(b));
            weeks.forEach(week => {
                globalWeek++;
                const weekMatchups = weeklyMatchups[week];
                const weekScores = [];
                weekMatchups.forEach(matchup => {
                    const team1Roster = rosters.find(r => String(r.roster_id) === String(matchup.team1_roster_id));
                    const team2Roster = matchup.team2_roster_id !== null && matchup.team2_roster_id !== undefined ? rosters.find(r => String(r.roster_id) === String(matchup.team2_roster_id)) : null;
                    if (!team1Roster) return;
                    const team1Id = String(team1Roster.owner_id);
                    const team2Id = team2Roster ? String(team2Roster.owner_id) : null;
                    const team1Score = parseFloat(matchup.team1_score) || 0;
                    const team2Score = parseFloat(matchup.team2_score) || 0;
                    if (!teamStats[team1Id]) return;
                    teamStats[team1Id].points += team1Score;
                    if (team2Id && teamStats[team2Id]) teamStats[team2Id].points += team2Score;
                    if (team2Id && teamStats[team2Id]) {
                        if (team1Score > team2Score) { teamStats[team1Id].wins++; teamStats[team2Id].losses++; }
                        else if (team2Score > team1Score) { teamStats[team2Id].wins++; teamStats[team1Id].losses++; }
                        else { teamStats[team1Id].ties++; teamStats[team2Id].ties++; }
                    }
                    weekScores.push({ ownerId: team1Id, score: team1Score });
                    if (team2Id) weekScores.push({ ownerId: team2Id, score: team2Score });
                });
                weekScores.forEach(teamScore => { weekScores.forEach(opponentScore => { if (teamScore.ownerId !== opponentScore.ownerId) { if (teamScore.score > opponentScore.score) teamStats[teamScore.ownerId].allPlayWins++; else if (teamScore.score < opponentScore.score) teamStats[teamScore.ownerId].allPlayLosses++; } }); });
                const sortedScores = [...weekScores].sort((a, b) => b.score - a.score);
                for (let i = 0; i < Math.min(3, sortedScores.length); i++) teamStats[sortedScores[i].ownerId].highScores++;
                generatedMilestones = generateDynamicMilestones(teamStats);
                Object.keys(generatedMilestones).forEach(milestoneKey => {
                    if (!achievementTimeline[milestoneKey]) achievementTimeline[milestoneKey] = {};
                    generatedMilestones[milestoneKey].thresholds.forEach(threshold => { if (achievementTimeline[milestoneKey][threshold] === undefined) achievementTimeline[milestoneKey][threshold] = []; });
                });
                Object.keys(teamStats).forEach(ownerId => {
                    const stats = teamStats[ownerId];
                    const milestoneValues = { totalWins: stats.wins, totalLosses: stats.losses, allPlayWins: stats.allPlayWins, allPlayLosses: stats.allPlayLosses, totalPoints: stats.points, highScores: stats.highScores };
                    Object.keys(milestoneValues).forEach(milestoneKey => {
                        const currentValue = milestoneValues[milestoneKey];
                        const thresholdsToCheck = (generatedMilestones[milestoneKey] || baseMilestones[milestoneKey]).thresholds;
                        thresholdsToCheck.forEach(threshold => {
                            if (currentValue >= threshold) {
                                const alreadyAchieved = achievementTimeline[milestoneKey][threshold].some(a => a.ownerId === ownerId);
                                if (!alreadyAchieved) {
                                    achievementTimeline[milestoneKey][threshold].push({ ownerId, season: parseInt(season), week: parseInt(week), globalWeek, value: currentValue, teamName: allRosters[ownerId]?.name || `Team ${ownerId}` });
                                    logger.info(`🏆 ${milestoneKey} ${threshold}: ${allRosters[ownerId]?.name} achieved in S${season}W${week} (value: ${currentValue})`);
                                }
                            }
                        });
                    });
                });
            });
        });
        const achievements = {};
        Object.keys(teamStats).forEach(ownerId => {
            achievements[ownerId] = {};
            Object.keys(baseMilestones).forEach(milestoneKey => {
                achievements[ownerId][milestoneKey] = {};
                const finalValue = teamStats[ownerId][milestoneKey === 'totalWins' ? 'finalWins' : milestoneKey === 'totalLosses' ? 'finalLosses' : milestoneKey === 'allPlayWins' ? 'finalAllPlayWins' : milestoneKey === 'allPlayLosses' ? 'finalAllPlayLosses' : milestoneKey === 'totalPoints' ? 'finalPoints' : 'finalHighScores'];
                baseMilestones[milestoneKey].thresholds.forEach(threshold => { achievements[ownerId][milestoneKey][threshold] = { achieved: finalValue >= threshold, currentValue: finalValue, remaining: Math.max(0, threshold - finalValue), progress: Math.min(100, (finalValue / threshold) * 100) }; });
            });
        });
        Object.keys(teamStats).forEach(ownerId => { teamStats[ownerId].achievements = achievements[ownerId]; });
        setDynamicMilestones(generatedMilestones);
        setMilestoneData({ teamStats, allRosters, achievementHistory: achievementTimeline });
        logger.debug('=== MILESTONE TRACKING COMPLETE ===');
        logger.debug('Achievement timeline summary:', Object.keys(achievementTimeline).map(key => ({ milestone: key, achievements: Object.keys(achievementTimeline[key]).map(threshold => ({ threshold, count: achievementTimeline[key][threshold].length, firstAchiever: achievementTimeline[key][threshold][0]?.teamName || 'None' })) })));
    };

    const getMilestoneAchievers = (milestoneKey, threshold) => {
        if (!milestoneData.teamStats) return [];
        const achievers = [];
        Object.keys(milestoneData.teamStats).forEach(ownerId => {
            const achievement = milestoneData.teamStats[ownerId].achievements[milestoneKey]?.[threshold];
            if (achievement?.achieved) {
                const timingInfo = milestoneData.achievementHistory?.[milestoneKey]?.[threshold]?.find(h => h.ownerId === ownerId);
                achievers.push({ ownerId, ...milestoneData.allRosters[ownerId], currentValue: achievement.currentValue, timingInfo: timingInfo || null });
            }
        });
        return achievers.sort((a, b) => { if (a.timingInfo && b.timingInfo) return a.timingInfo.globalWeek - b.timingInfo.globalWeek; return b.currentValue - a.currentValue; });
    };

    const getMilestoneTimingStats = (milestoneKey, threshold) => {
        if (!milestoneData.achievementHistory?.[milestoneKey]?.[threshold]) return null;
        const achievements = milestoneData.achievementHistory[milestoneKey][threshold];
        if (achievements.length === 0) return null;
        // Filter to only include teams that currently have this achievement
        const currentAchievers = achievements.filter(a => {
            const achievement = milestoneData.teamStats?.[a.ownerId]?.achievements?.[milestoneKey]?.[threshold];
            return achievement?.achieved === true;
        });
        if (currentAchievers.length === 0) return null;
        const sortedAchievements = [...currentAchievers].sort((a, b) => a.globalWeek - b.globalWeek);
        const firstAchiever = sortedAchievements[0];
        return { firstAchiever: { ownerId: firstAchiever.ownerId, name: firstAchiever.teamName, globalWeek: firstAchiever.globalWeek, season: firstAchiever.season, week: firstAchiever.week }, allAchievements: sortedAchievements.map(a => ({ ownerId: a.ownerId, name: a.teamName, globalWeek: a.globalWeek, weeksAfterFirst: a.globalWeek - firstAchiever.globalWeek, season: a.season, week: a.week, achievedIn: a.globalWeek })) };
    };

    const getMilestoneWatchers = (milestoneKey, threshold) => {
        if (!milestoneData.teamStats) return [];
        const watchers = [];
        Object.keys(milestoneData.teamStats).forEach(ownerId => {
            const achievement = milestoneData.teamStats[ownerId].achievements[milestoneKey]?.[threshold];
            if (!achievement?.achieved && achievement?.remaining <= 10 && achievement?.remaining > 0) watchers.push({ ownerId, ...milestoneData.allRosters[ownerId], remaining: achievement.remaining, currentValue: achievement.currentValue });
        });
        return watchers.sort((a, b) => a.remaining - b.remaining);
    };

    const shouldCollapseMilestone = (milestoneKey, threshold) => {
        const achievers = getMilestoneAchievers(milestoneKey, threshold);
        const totalTeams = Object.keys(milestoneData.teamStats || {}).length;
        return achievers.length === totalTeams && totalTeams > 0;
    };

    const formatStatValue = (value, milestoneKey) => {
        if (milestoneKey === 'totalPoints') return value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        return value.toString();
    };

    const getDisplayedThresholds = (milestoneKey) => {
        const sourceMilestones = Object.keys(dynamicMilestones).length > 0 ? dynamicMilestones : baseMilestones;
        const thresholds = sourceMilestones[milestoneKey]?.thresholds || [];
        if (!milestoneData?.teamStats) return thresholds.slice().sort((a, b) => b - a);
        let highest = 0;
        Object.keys(milestoneData.teamStats).forEach(ownerId => {
            const stats = milestoneData.teamStats[ownerId];
            if (!stats) return;
            let val = 0;
            switch (milestoneKey) {
                case 'totalWins': val = stats.finalWins || 0; break;
                case 'totalLosses': val = stats.finalLosses || 0; break;
                case 'allPlayWins': val = stats.finalAllPlayWins || 0; break;
                case 'allPlayLosses': val = stats.finalAllPlayLosses || 0; break;
                case 'totalPoints': val = stats.finalPoints || 0; break;
                case 'highScores': val = stats.finalHighScores || 0; break;
                default: val = 0;
            }
            highest = Math.max(highest, val);
        });
        const sortedAsc = thresholds.slice().sort((a, b) => a - b);
        let cutoffIndex = sortedAsc.findIndex(t => t > highest);
        if (cutoffIndex === -1) return sortedAsc.slice().sort((a, b) => b - a);
        return sortedAsc.slice(0, cutoffIndex + 1).sort((a, b) => b - a);
    };

    const getMilestoneProgress = (milestoneKey, threshold) => {
        if (!milestoneData.teamStats) return [];
        const progress = [];
        Object.keys(milestoneData.teamStats).forEach(ownerId => {
            const achievement = milestoneData.teamStats[ownerId].achievements[milestoneKey]?.[threshold];
            if (achievement) progress.push({ ownerId, ...milestoneData.allRosters[ownerId], currentValue: achievement.currentValue, remaining: achievement.remaining, progress: achievement.progress || 0, achieved: achievement.achieved });
        });
        return progress.sort((a, b) => { if (a.achieved && !b.achieved) return -1; if (!a.achieved && b.achieved) return 1; return b.currentValue - a.currentValue; });
    };

    const toggleThresholdExpansion = (milestoneKey, threshold) => {
        const key = `${milestoneKey}-${threshold}`;
        setExpandedThresholds(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const isThresholdExpanded = (milestoneKey, threshold) => {
        const key = `${milestoneKey}-${threshold}`;
        const collapsed = shouldCollapseMilestone(milestoneKey, threshold);
        return expandedThresholds[key] !== undefined ? expandedThresholds[key] : !collapsed;
    };

    // ── Accent helpers ────────────────────────────────────────────────────────
    const accentClasses = {
        green:  { badge: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300', dot: 'bg-emerald-400', btn: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', bar: 'bg-emerald-500', watcher: 'bg-emerald-500/10 border-emerald-500/20', pill: 'bg-emerald-500/15 text-emerald-300' },
        red:    { badge: 'bg-red-500/15 border-red-500/25 text-red-300',             dot: 'bg-red-400',     btn: 'bg-red-500/20 text-red-300 border-red-500/40',             bar: 'bg-red-500',     watcher: 'bg-red-500/10 border-red-500/20',         pill: 'bg-red-500/15 text-red-300' },
        blue:   { badge: 'bg-blue-500/15 border-blue-500/25 text-blue-300',           dot: 'bg-blue-400',    btn: 'bg-blue-500/20 text-blue-300 border-blue-500/40',           bar: 'bg-blue-500',    watcher: 'bg-blue-500/10 border-blue-500/20',         pill: 'bg-blue-500/15 text-blue-300' },
        purple: { badge: 'bg-purple-500/15 border-purple-500/25 text-purple-300',     dot: 'bg-purple-400',  btn: 'bg-purple-500/20 text-purple-300 border-purple-500/40',     bar: 'bg-purple-500',  watcher: 'bg-purple-500/10 border-purple-500/20',     pill: 'bg-purple-500/15 text-purple-300' },
        yellow: { badge: 'bg-yellow-500/15 border-yellow-500/25 text-yellow-300',     dot: 'bg-yellow-400',  btn: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',     bar: 'bg-yellow-500',  watcher: 'bg-yellow-500/10 border-yellow-500/20',     pill: 'bg-yellow-500/15 text-yellow-300' },
        orange: { badge: 'bg-orange-500/15 border-orange-500/25 text-orange-300',     dot: 'bg-orange-400',  btn: 'bg-orange-500/20 text-orange-300 border-orange-500/40',     bar: 'bg-orange-500',  watcher: 'bg-orange-500/10 border-orange-500/20',     pill: 'bg-orange-500/15 text-orange-300' },
    };

    const acc = (color) => accentClasses[color] || accentClasses.blue;

    // ── Loading / error ───────────────────────────────────────────────────────
    if (contextError) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-sm text-red-400">Error loading data: {contextError}</p>
            </div>
        );
    }
    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-gray-400 animate-pulse">Loading milestones…</p>
                </div>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="p-3 sm:p-5 space-y-4">

            {/* Section header */}
            <div className="flex items-center gap-2 px-1 pb-3 border-b border-white/8">
                <svg className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Career Milestones</span>
            </div>

            {/* Milestone selector */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {Object.keys(milestones).map(key => {
                    const isActive = activeMilestone === key;
                    const a = acc(milestones[key].color);
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveMilestone(key)}
                            className={`p-3 rounded-xl text-center transition-all duration-150 border ${
                                isActive
                                    ? `${a.btn} shadow-sm`
                                    : 'bg-white/[0.03] border-white/8 text-gray-500 hover:bg-white/[0.06] hover:text-gray-300'
                            }`}
                        >
                            <div className="text-xl mb-1">{milestones[key].icon}</div>
                            <div className="text-[10px] font-semibold leading-tight">{milestones[key].title}</div>
                        </button>
                    );
                })}
            </div>

            {/* Active milestone */}
            {activeMilestone && milestones[activeMilestone] && (() => {
                const m = milestones[activeMilestone];
                const a = acc(m.color);
                return (
                    <div className="space-y-3">
                        {/* Milestone description card */}
                        <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 flex items-start gap-4">
                            <div className="text-3xl flex-shrink-0">{m.icon}</div>
                            <div className="min-w-0">
                                <h2 className="text-sm font-bold text-white mb-1">{m.title}</h2>
                                <p className="text-xs text-gray-500 leading-relaxed">{m.description}</p>
                            </div>
                        </div>

                        {/* Threshold cards */}
                        <div className="space-y-2">
                            {(getDisplayedThresholds(activeMilestone) || []).map(threshold => {
                                const achievers    = getMilestoneAchievers(activeMilestone, threshold);
                                const watchers     = getMilestoneWatchers(activeMilestone, threshold);
                                const progress     = getMilestoneProgress(activeMilestone, threshold);
                                const timingStats  = getMilestoneTimingStats(activeMilestone, threshold);
                                const collapsed    = shouldCollapseMilestone(activeMilestone, threshold);
                                const isExpanded   = isThresholdExpanded(activeMilestone, threshold);

                                return (
                                    <div key={threshold} className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
                                        {/* Threshold header — clickable */}
                                        <div
                                            className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                                            onClick={() => toggleThresholdExpansion(activeMilestone, threshold)}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${a.dot}`} />
                                                <span className="text-sm font-semibold text-gray-200 truncate">
                                                    {formatStatValue(threshold, activeMilestone)} {m.title}
                                                </span>
                                                {achievers.length > 0 && (
                                                    <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${a.badge}`}>
                                                        {achievers.length} achieved
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {collapsed && <span className="text-[10px] text-gray-600 hidden sm:inline">All teams achieved</span>}
                                                <FontAwesomeIcon
                                                    icon={isExpanded ? faChevronUp : faChevronDown}
                                                    className="w-3 h-3 text-gray-600"
                                                />
                                            </div>
                                        </div>

                                        {/* Expandable content */}
                                        {isExpanded && (
                                            <div className="border-t border-white/8 p-4 space-y-5">

                                                {/* Achievement timeline */}
                                                {achievers.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <FontAwesomeIcon icon={faTrophy} className="w-3.5 h-3.5 text-yellow-400" />
                                                            <span className="text-xs font-semibold text-gray-300">Achievement Timeline ({achievers.length})</span>
                                                        </div>
                                                        <div className="overflow-x-auto rounded-xl border border-white/8">
                                                            <table className="min-w-full text-xs">
                                                                <thead>
                                                                    <tr className="border-b border-white/8 bg-white/[0.03]">
                                                                        {['Team','Season','Week','Total Weeks','Difference'].map(h => (
                                                                            <th key={h} className="py-2 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-white/5">
                                                                    {timingStats?.allAchievements ? timingStats.allAchievements.map((achievement, index) => {
                                                                        const isFirst = index === 0;
                                                                        return (
                                                                            <tr key={achievement.ownerId}
                                                                                className={isFirst ? 'bg-yellow-500/8' : 'hover:bg-white/[0.02] transition-colors'}>
                                                                                <td className="py-2 px-3">
                                                                                    <div className="flex items-center gap-2">
                                                                                        {milestoneData.allRosters[achievement.ownerId]?.avatar && (
                                                                                            <img src={milestoneData.allRosters[achievement.ownerId].avatar} alt={achievement.name} className="w-5 h-5 rounded-full border border-white/10" />
                                                                                        )}
                                                                                        <span className={`font-medium truncate ${isFirst ? 'text-yellow-300' : 'text-gray-200'}`}>{achievement.name}</span>
                                                                                        {isFirst && <span className="flex-shrink-0 text-[9px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">1st</span>}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="py-2 px-3 text-gray-400 tabular-nums">{achievement.season}</td>
                                                                                <td className="py-2 px-3 text-gray-400 tabular-nums">{achievement.week}</td>
                                                                                <td className="py-2 px-3">
                                                                                    <span className={`font-semibold tabular-nums ${isFirst ? 'text-yellow-300' : 'text-gray-300'}`}>{achievement.achievedIn}</span>
                                                                                </td>
                                                                                <td className="py-2 px-3">
                                                                                    {isFirst
                                                                                        ? <span className="text-yellow-400 font-semibold">First</span>
                                                                                        : <span className="text-red-400">+{achievement.weeksAfterFirst} wks</span>}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    }) : (
                                                                        <tr>
                                                                            <td colSpan={5} className="py-4 text-center text-gray-600 text-[10px] italic">No timing data available</td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Close watchers */}
                                                {watchers.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <span className="text-orange-400">👀</span>
                                                            <span className="text-xs font-semibold text-gray-300">Close to Achievement ({watchers.length})</span>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                            {watchers.map(watcher => (
                                                                <div key={watcher.ownerId} className={`flex items-center gap-3 p-3 rounded-lg border ${a.watcher} bg-orange-500/8`}>
                                                                    {watcher.avatar && <img src={watcher.avatar} alt={watcher.name} className="w-7 h-7 rounded-full border border-white/10 flex-shrink-0" />}
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-semibold text-gray-200 truncate">{watcher.name}</p>
                                                                        <p className="text-[10px] text-orange-400">{watcher.remaining} away ({formatStatValue(watcher.currentValue, activeMilestone)})</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Progress tracker */}
                                                {progress.filter(p => !p.achieved && p.remaining > 10).length > 0 && (
                                                    <div>
                                                        <div className="text-xs font-semibold text-gray-400 mb-3">Progress Tracker</div>
                                                        <div className="space-y-2">
                                                            {progress.filter(p => !p.achieved && p.remaining > 10).slice(0, 5).map(team => (
                                                                <div key={team.ownerId} className="bg-white/[0.03] border border-white/8 rounded-lg p-3">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            {team.avatar && <img src={team.avatar} alt={team.name} className="w-5 h-5 rounded-full border border-white/10 flex-shrink-0" />}
                                                                            <span className="text-xs font-medium text-gray-200 truncate">{team.name}</span>
                                                                        </div>
                                                                        <span className="text-[10px] text-gray-500 tabular-nums flex-shrink-0 ml-2">
                                                                            {formatStatValue(team.currentValue, activeMilestone)} / {formatStatValue(threshold, activeMilestone)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full rounded-full transition-all duration-300 ${a.bar}`}
                                                                                style={{ width: `${Math.min(100, team.progress)}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-[10px] font-semibold text-gray-400 tabular-nums w-10 text-right">
                                                                            {Math.min(100, Math.round(team.progress))}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default MilestoneRecords;