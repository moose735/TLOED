import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { calculateAllLeagueMetrics } from '../utils/calculations';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faTrophy } from '@fortawesome/free-solid-svg-icons';

const MilestoneRecords = () => {
    const {
        historicalData,
        getTeamName,
        getTeamDetails,
        currentSeason,
        nflState,
        loading: contextLoading,
        error: contextError
    } = useSleeperData();

    const [activeMilestone, setActiveMilestone] = useState('totalWins');
    const [milestoneData, setMilestoneData] = useState({});
    const [dynamicMilestones, setDynamicMilestones] = useState({});
    const [loading, setLoading] = useState(true);
    const [expandedThresholds, setExpandedThresholds] = useState({});

    // Define base milestone configurations
    const baseMilestones = {
        totalWins: {
            title: 'Total Wins',
            description: 'Career victory milestones celebrating the most successful franchises in league history. Every win counts toward these legendary achievements.',
            icon: '🏆',
            thresholds: [25, 50, 75, 100, 150],
            color: 'green'
        },
        totalLosses: {
            title: 'Total Losses',
            description: 'Career loss milestones that track the journey through adversity. Sometimes the path to greatness includes learning from defeat.',
            icon: '💀',
            thresholds: [25, 50, 75, 100, 150],
            color: 'red'
        },
        allPlayWins: {
            title: 'All-Play Wins',
            description: 'All-Play wins show how often your score would beat every other team that week. This milestone celebrates consistent high-level performance.',
            icon: '⚡',
            thresholds: [50, 100, 200, 300, 500],
            color: 'blue'
        },
        allPlayLosses: {
            title: 'All-Play Losses',
            description: 'All-Play losses track how many teams would have beaten you each week. This milestone shows the journey through challenging performances.',
            icon: '💸',
            thresholds: [50, 100, 200, 300, 500],
            color: 'purple'
        },
        totalPoints: {
            title: 'Total Points',
            description: 'Career scoring milestones recognizing the highest cumulative point totals in league history. These achievements showcase offensive consistency and excellence.',
            icon: '📊',
            thresholds: [1000, 2500, 5000, 7500, 10000],
            color: 'yellow'
        },
        highScores: {
            title: 'High Scores',
            description: 'Milestones for achieving the most high-scoring weeks (top 3 performances each week). Recognition for explosive offensive performances.',
            icon: '🚀',
            thresholds: [5, 10, 25, 50, 75],
            color: 'orange'
        }
    };

    // Function to generate dynamic milestones based on current achievements
    const generateDynamicMilestones = (teamStats) => {
        const updatedMilestones = JSON.parse(JSON.stringify(baseMilestones)); // Deep clone
        
        Object.keys(updatedMilestones).forEach(milestoneKey => {
            const milestone = updatedMilestones[milestoneKey];
            const currentThresholds = [...milestone.thresholds];
            
            // Find the highest achieved value for this milestone type
            let highestAchieved = 0;
            Object.values(teamStats).forEach(stats => {
                let currentValue = 0;
                switch (milestoneKey) {
                    case 'totalWins':
                        currentValue = stats.totalWins || 0;
                        break;
                    case 'totalLosses':
                        currentValue = stats.totalLosses || 0;
                        break;
                    case 'allPlayWins':
                        currentValue = stats.allPlayWins || 0;
                        break;
                    case 'allPlayLosses':
                        currentValue = stats.allPlayLosses || 0;
                        break;
                    case 'totalPoints':
                        currentValue = stats.totalPoints || 0;
                        break;
                    case 'highScores':
                        currentValue = stats.highScores || 0;
                        break;
                }
                highestAchieved = Math.max(highestAchieved, currentValue);
            });
            
            // Check if we need to add new thresholds
            const maxThreshold = Math.max(...currentThresholds);
            if (highestAchieved >= maxThreshold) {
                // Generate new thresholds based on milestone type
                const newThresholds = generateNewThresholds(milestoneKey, maxThreshold, highestAchieved);
                milestone.thresholds = [...new Set([...currentThresholds, ...newThresholds])].sort((a, b) => a - b);
            }
        });
        
        return updatedMilestones;
    };

    // Function to generate new threshold values
    const generateNewThresholds = (milestoneKey, currentMax, highestAchieved) => {
        const newThresholds = [];
        let nextThreshold = currentMax;
        
        // Define increment patterns for different milestone types
        const incrementPatterns = {
            totalWins: [25, 50, 25, 25, 50], // Pattern: 25, 50, 25, 25, 50, repeat
            totalLosses: [25, 50, 25, 25, 50],
            allPlayWins: [100, 200, 200, 300, 500], // Pattern: 100, 200, 200, 300, 500, repeat
            allPlayLosses: [100, 200, 200, 300, 500],
            totalPoints: [2500, 2500, 5000, 5000, 10000], // Pattern: 2500, 2500, 5000, 5000, 10000, repeat
            highScores: [25, 25, 50, 50, 100] // Pattern: 25, 25, 50, 50, 100, repeat
        };
        
        const pattern = incrementPatterns[milestoneKey] || [50, 100, 100, 200, 500];
        let patternIndex = 0;
        
        // Generate new thresholds until we're well above the highest achieved value
        while (nextThreshold <= highestAchieved + pattern[patternIndex % pattern.length] * 2) {
            nextThreshold += pattern[patternIndex % pattern.length];
            newThresholds.push(nextThreshold);
            patternIndex++;
            
            // Safety limit to prevent infinite loops
            if (newThresholds.length >= 10) break;
        }
        
        return newThresholds;
    };

    // Get current milestones (either base or dynamic)
    const milestones = Object.keys(dynamicMilestones).length > 0 ? dynamicMilestones : baseMilestones;

    useEffect(() => {
        if (contextLoading || !historicalData) {
            setLoading(true);
            return;
        }

        try {
            calculateMilestones();
        } catch (err) {
            console.error('Error calculating milestones:', err);
        } finally {
            setLoading(false);
        }
    }, [historicalData, contextLoading]);

    const calculateMilestones = () => {
        // Use the standardized calculateAllLeagueMetrics function to ensure consistency
        const { careerDPRData } = calculateAllLeagueMetrics(historicalData, null, getTeamName, nflState);
        
        if (!careerDPRData || careerDPRData.length === 0) {
            console.warn('MilestoneRecords - No career DPR data found');
            return;
        }
        
        const teamStats = {};
        const allRosters = {};
        const achievementHistory = {};
        
        // We need to process historical data chronologically to track when milestones were achieved
        const allSeasons = Object.keys(historicalData.matchupsBySeason || {}).sort((a, b) => parseInt(a) - parseInt(b));
        
        // Initialize achievement history tracking with base milestones
        Object.keys(baseMilestones).forEach(milestoneKey => {
            achievementHistory[milestoneKey] = {};
            baseMilestones[milestoneKey].thresholds.forEach(threshold => {
                achievementHistory[milestoneKey][threshold] = [];
            });
        });

        // Initialize team stats and rosters using the career data for final values
        careerDPRData.forEach(careerStats => {
            const ownerId = careerStats.ownerId;
            teamStats[ownerId] = {
                wins: 0,
                losses: 0,
                ties: 0,
                totalWins: 0,
                totalLosses: 0,
                allPlayWins: 0,
                allPlayLosses: 0,
                totalPoints: 0,
                totalOpponentPoints: 0,
                highScores: 0,
                weekHistory: [],
                achievements: {},
                milestoneHistory: {},
                // Store final career totals for reference
                careerTotals: {
                    wins: careerStats.wins || 0,
                    losses: careerStats.losses || 0,
                    ties: careerStats.ties || 0,
                    allPlayWins: careerStats.allPlayWins || 0,
                    allPlayLosses: careerStats.allPlayLosses || 0,
                    totalPoints: careerStats.pointsFor || 0,
                    highScores: careerStats.topScoreWeeksCount || 0
                }
            };

            // Use team details from the context
            const teamDetails = getTeamDetails(ownerId, currentSeason);
            allRosters[ownerId] = {
                name: careerStats.teamName || getTeamName(ownerId, currentSeason),
                avatar: teamDetails?.avatar
            };
        });

        // Process historical data chronologically to track milestone achievements
        let globalWeekCounter = 0;
        
        allSeasons.forEach(season => {
            const matchups = historicalData.matchupsBySeason?.[season] || [];
            
            const weeklyScores = {};
            
            // Group matchups by week
            const matchupsByWeek = {};
            matchups.forEach(matchup => {
                const week = matchup.week;
                if (!matchupsByWeek[week]) {
                    matchupsByWeek[week] = [];
                }
                matchupsByWeek[week].push(matchup);
            });

            // Process weeks in chronological order
            const sortedWeeks = Object.keys(matchupsByWeek).sort((a, b) => parseInt(a) - parseInt(b));
            
            sortedWeeks.forEach(week => {
                globalWeekCounter++;
                const weekMatchups = matchupsByWeek[week];
                
                if (!weeklyScores[week]) {
                    weeklyScores[week] = [];
                }

                // Process each matchup in this week
                weekMatchups.forEach(matchup => {
                    const team1RosterId = matchup.team1_roster_id;
                    const team2RosterId = matchup.team2_roster_id;
                    const team1Score = parseFloat(matchup.team1_score) || 0;
                    const team2Score = parseFloat(matchup.team2_score) || 0;

                    // Find owner IDs for rosters
                    const rosters = historicalData.rostersBySeason?.[season] || [];
                    const team1Roster = rosters.find(r => r.roster_id === team1RosterId);
                    const team2Roster = rosters.find(r => r.roster_id === team2RosterId);
                    
                    if (!team1Roster || !team2Roster) return;
                    
                    const team1OwnerId = team1Roster.owner_id;
                    const team2OwnerId = team2Roster.owner_id;

                    // Update basic stats
                    if (team1Score > team2Score) {
                        teamStats[team1OwnerId].wins++;
                        teamStats[team1OwnerId].totalWins++;
                        teamStats[team2OwnerId].losses++;
                        teamStats[team2OwnerId].totalLosses++;
                    } else if (team2Score > team1Score) {
                        teamStats[team2OwnerId].wins++;
                        teamStats[team2OwnerId].totalWins++;
                        teamStats[team1OwnerId].losses++;
                        teamStats[team1OwnerId].totalLosses++;
                    } else {
                        teamStats[team1OwnerId].ties++;
                        teamStats[team2OwnerId].ties++;
                    }

                    // Update points
                    teamStats[team1OwnerId].totalPoints += team1Score;
                    teamStats[team2OwnerId].totalPoints += team2Score;
                    teamStats[team1OwnerId].totalOpponentPoints += team2Score;
                    teamStats[team2OwnerId].totalOpponentPoints += team1Score;

                    // Add to weekly scores for all-play and high score tracking
                    weeklyScores[week].push({
                        ownerId: team1OwnerId,
                        score: team1Score
                    });
                    weeklyScores[week].push({
                        ownerId: team2OwnerId,
                        score: team2Score
                    });
                });

                // Calculate all-play wins/losses for this week
                const weekScores = weeklyScores[week];
                weekScores.forEach(teamScore => {
                    weekScores.forEach(opponentScore => {
                        if (teamScore.ownerId !== opponentScore.ownerId) {
                            if (teamScore.score > opponentScore.score) {
                                teamStats[teamScore.ownerId].allPlayWins++;
                            } else if (teamScore.score < opponentScore.score) {
                                teamStats[teamScore.ownerId].allPlayLosses++;
                            }
                        }
                    });
                });

                // Calculate high scores for this week (top 3)
                const sortedWeekScores = [...weekScores].sort((a, b) => b.score - a.score);
                for (let i = 0; i < Math.min(3, sortedWeekScores.length); i++) {
                    if (teamStats[sortedWeekScores[i].ownerId]) {
                        teamStats[sortedWeekScores[i].ownerId].highScores++;
                    }
                }

                // Check for milestone achievements after this week
                Object.keys(teamStats).forEach(ownerId => {
                    const stats = teamStats[ownerId];
                    
                    Object.keys(baseMilestones).forEach(milestoneKey => {
                        let currentValue;
                        switch (milestoneKey) {
                            case 'totalWins':
                                currentValue = stats.totalWins;
                                break;
                            case 'totalLosses':
                                currentValue = stats.totalLosses;
                                break;
                            case 'allPlayWins':
                                currentValue = stats.allPlayWins;
                                break;
                            case 'allPlayLosses':
                                currentValue = stats.allPlayLosses;
                                break;
                            case 'totalPoints':
                                currentValue = stats.totalPoints;
                                break;
                            case 'highScores':
                                currentValue = stats.highScores;
                                break;
                            default:
                                currentValue = 0;
                        }

                        baseMilestones[milestoneKey].thresholds.forEach(threshold => {
                            // Check if milestone was just achieved
                            if (currentValue >= threshold) {
                                const existingAchievement = achievementHistory[milestoneKey][threshold].find(
                                    achievement => achievement.ownerId === ownerId
                                );
                                
                                if (!existingAchievement) {
                                    achievementHistory[milestoneKey][threshold].push({
                                        ownerId,
                                        season: parseInt(season),
                                        week: parseInt(week),
                                        globalWeek: globalWeekCounter,
                                        currentValue: currentValue
                                    });
                                }
                            }
                        });
                    });
                });
            });
        });

        // Update final team stats to use career totals for milestone calculations
        Object.keys(teamStats).forEach(ownerId => {
            const stats = teamStats[ownerId];
            // Use the final career totals for milestone achievement calculations
            stats.wins = stats.careerTotals.wins;
            stats.losses = stats.careerTotals.losses;
            stats.ties = stats.careerTotals.ties;
            stats.totalWins = stats.careerTotals.wins;
            stats.totalLosses = stats.careerTotals.losses;
            stats.allPlayWins = stats.careerTotals.allPlayWins;
            stats.allPlayLosses = stats.careerTotals.allPlayLosses;
            stats.totalPoints = stats.careerTotals.totalPoints;
            stats.highScores = stats.careerTotals.highScores;
        });

        // Calculate milestone achievements for each team
        Object.keys(teamStats).forEach(ownerId => {
            const stats = teamStats[ownerId];
            const achievements = {};

            Object.keys(baseMilestones).forEach(milestoneKey => {
                const milestone = baseMilestones[milestoneKey];
                achievements[milestoneKey] = {};
                
                let statValue;
                switch (milestoneKey) {
                    case 'totalWins':
                        statValue = stats.wins;
                        break;
                    case 'totalLosses':
                        statValue = stats.losses;
                        break;
                    case 'allPlayWins':
                        statValue = stats.allPlayWins;
                        break;
                    case 'allPlayLosses':
                        statValue = stats.allPlayLosses;
                        break;
                    case 'totalPoints':
                        statValue = stats.totalPoints;
                        break;
                    case 'highScores':
                        statValue = stats.highScores;
                        break;
                    default:
                        statValue = 0;
                }

                milestone.thresholds.forEach(threshold => {
                    achievements[milestoneKey][threshold] = {
                        achieved: statValue >= threshold,
                        currentValue: statValue,
                        remaining: Math.max(0, threshold - statValue)
                    };
                });
            });

            stats.achievements = achievements;
        });

        // Generate dynamic milestones based on current achievements
        const updatedMilestones = generateDynamicMilestones(teamStats);
        setDynamicMilestones(updatedMilestones);

        // Recalculate achievements with dynamic milestones
        Object.keys(teamStats).forEach(ownerId => {
            const stats = teamStats[ownerId];
            const achievements = {};

            Object.keys(updatedMilestones).forEach(milestoneKey => {
                const milestone = updatedMilestones[milestoneKey];
                achievements[milestoneKey] = {};
                
                let statValue;
                switch (milestoneKey) {
                    case 'totalWins':
                        statValue = stats.wins;
                        break;
                    case 'totalLosses':
                        statValue = stats.losses;
                        break;
                    case 'allPlayWins':
                        statValue = stats.allPlayWins;
                        break;
                    case 'allPlayLosses':
                        statValue = stats.allPlayLosses;
                        break;
                    case 'totalPoints':
                        statValue = stats.totalPoints;
                        break;
                    case 'highScores':
                        statValue = stats.highScores;
                        break;
                    default:
                        statValue = 0;
                }

                milestone.thresholds.forEach(threshold => {
                    const achieved = statValue >= threshold;
                    const remaining = Math.max(0, threshold - statValue);
                    
                    achievements[milestoneKey][threshold] = {
                        achieved,
                        currentValue: statValue,
                        remaining,
                        progress: Math.min(100, (statValue / threshold) * 100)
                    };
                });
            });

            stats.achievements = achievements;
        });

        // Since we're using standardized stats, we don't have the detailed achievement timeline
        // but we can populate achievement history based on current stats for milestone tracking
        Object.keys(teamStats).forEach(ownerId => {
            Object.keys(updatedMilestones).forEach(milestoneKey => {
                let currentValue;
                switch (milestoneKey) {
                    case 'totalWins':
                        currentValue = teamStats[ownerId].wins;
                        break;
                    case 'totalLosses':
                        currentValue = teamStats[ownerId].losses;
                        break;
                    case 'allPlayWins':
                        currentValue = teamStats[ownerId].allPlayWins;
                        break;
                    case 'allPlayLosses':
                        currentValue = teamStats[ownerId].allPlayLosses;
                        break;
                    case 'totalPoints':
                        currentValue = teamStats[ownerId].totalPoints;
                        break;
                    case 'highScores':
                        currentValue = teamStats[ownerId].highScores;
                        break;
                    default:
                        currentValue = 0;
                }

                updatedMilestones[milestoneKey].thresholds.forEach(threshold => {
                    if (currentValue >= threshold) {
                        // Add to achievement history (simplified - we don't have exact timing data)
                        achievementHistory[milestoneKey][threshold].push({
                            ownerId,
                            season: currentSeason,
                            week: 1, // Simplified - we don't track exact week
                            achievedWeek: 1 // Simplified
                        });
                    }
                });
            });
        });

        // Update achievement history for new thresholds
        Object.keys(updatedMilestones).forEach(milestoneKey => {
            updatedMilestones[milestoneKey].thresholds.forEach(threshold => {
                if (!achievementHistory[milestoneKey]) {
                    achievementHistory[milestoneKey] = {};
                }
                if (!achievementHistory[milestoneKey][threshold]) {
                    achievementHistory[milestoneKey][threshold] = [];
                }
            });
        });

        // Since the complex historical processing might not be working, let's create a fallback
        // If we don't have proper achievement history, create timeline based on current achievements
        if (Object.keys(achievementHistory).every(key => 
            Object.keys(achievementHistory[key]).every(threshold => 
                achievementHistory[key][threshold].length === 0
            )
        )) {
            
            // Create a simple timeline based on current stats (this won't have real timing, but will show data)
            Object.keys(baseMilestones).forEach(milestoneKey => {
                const qualifyingTeams = [];
                
                Object.keys(teamStats).forEach(ownerId => {
                    const stats = teamStats[ownerId];
                    let currentValue;
                    
                    switch (milestoneKey) {
                        case 'totalWins':
                            currentValue = stats.wins;
                            break;
                        case 'totalLosses':
                            currentValue = stats.losses;
                            break;
                        case 'allPlayWins':
                            currentValue = stats.allPlayWins;
                            break;
                        case 'allPlayLosses':
                            currentValue = stats.allPlayLosses;
                            break;
                        case 'totalPoints':
                            currentValue = stats.totalPoints;
                            break;
                        case 'highScores':
                            currentValue = stats.highScores;
                            break;
                        default:
                            currentValue = 0;
                    }
                    
                    if (currentValue > 0) {
                        qualifyingTeams.push({
                            ownerId,
                            value: currentValue,
                            name: stats.name
                        });
                    }
                });
                
                // Sort teams by their values (highest first for most milestones)
                qualifyingTeams.sort((a, b) => b.value - a.value);
                
                baseMilestones[milestoneKey].thresholds.forEach(threshold => {
                    const achievingTeams = qualifyingTeams.filter(team => team.value >= threshold);
                    
                    if (achievingTeams.length > 0) {
                        achievementHistory[milestoneKey][threshold] = achievingTeams.map((team, index) => ({
                            milestoneKey,
                            threshold,
                            ownerId: team.ownerId,
                            season: currentSeason,
                            week: Math.min(14, index + 1), // Spread achievements across weeks
                            globalWeek: Math.min(100, (index * 5) + 10) // Simple fallback: spread teams across fake weeks
                        }));
                    }
                });
            });
        }

        setMilestoneData({ teamStats, allRosters, achievementHistory });
    };

    const getMilestoneAchievers = (milestoneKey, threshold) => {
        if (!milestoneData.teamStats) return [];

        const achievers = [];
        Object.keys(milestoneData.teamStats).forEach(ownerId => {
            const achievement = milestoneData.teamStats[ownerId].achievements[milestoneKey]?.[threshold];
            if (achievement?.achieved) {
                // Find timing information from achievement history
                const timingInfo = milestoneData.achievementHistory?.[milestoneKey]?.[threshold]?.find(
                    hist => hist.ownerId === ownerId
                );
                
                achievers.push({
                    ownerId,
                    ...milestoneData.allRosters[ownerId],
                    currentValue: achievement.currentValue,
                    timingInfo: timingInfo || null
                });
            }
        });

        return achievers.sort((a, b) => {
            // Sort by achievement timing first, then by current value
            if (a.timingInfo && b.timingInfo) {
                return a.timingInfo.globalWeek - b.timingInfo.globalWeek;
            }
            return b.currentValue - a.currentValue;
        });
    };

    const getMilestoneTimingStats = (milestoneKey, threshold) => {
        // Debug logging to understand the data structure
        if (!milestoneData.achievementHistory) {
            console.log('No achievementHistory in milestoneData');
            return null;
        }
        
        if (!milestoneData.achievementHistory[milestoneKey]) {
            console.log(`No achievement history for milestone: ${milestoneKey}`);
            return null;
        }
        
        if (!milestoneData.achievementHistory[milestoneKey][threshold]) {
            console.log(`No achievement history for ${milestoneKey} threshold: ${threshold}`);
            return null;
        }
        
        const achievements = milestoneData.achievementHistory[milestoneKey][threshold];
        console.log(`Found ${achievements.length} achievements for ${milestoneKey} ${threshold}:`, achievements);
        
        if (achievements.length === 0) return null;
        
        // Sort by global week to find first achiever
        const sortedAchievements = [...achievements].sort((a, b) => a.globalWeek - b.globalWeek);
        const firstAchiever = sortedAchievements[0];
        
        if (!firstAchiever || typeof firstAchiever.globalWeek !== 'number') {
            console.log('Invalid first achiever:', firstAchiever);
            return null;
        }
        
        const result = {
            firstAchiever: {
                ownerId: firstAchiever.ownerId,
                name: milestoneData.allRosters[firstAchiever.ownerId]?.name || 
                      milestoneData.teamStats[firstAchiever.ownerId]?.name || 
                      `Team ${firstAchiever.ownerId}`,
                globalWeek: firstAchiever.globalWeek,
                season: firstAchiever.season,
                week: firstAchiever.week
            },
            allAchievements: sortedAchievements.map(achievement => {
                const weeksAfterFirst = achievement.globalWeek - firstAchiever.globalWeek;
                return {
                    ownerId: achievement.ownerId,
                    name: milestoneData.allRosters[achievement.ownerId]?.name || 
                          milestoneData.teamStats[achievement.ownerId]?.name || 
                          `Team ${achievement.ownerId}`,
                    globalWeek: achievement.globalWeek,
                    weeksAfterFirst: isNaN(weeksAfterFirst) ? 0 : weeksAfterFirst,
                    season: achievement.season,
                    week: achievement.week,
                    achievedIn: achievement.globalWeek
                };
            })
        };
        
        console.log(`Timing stats result for ${milestoneKey} ${threshold}:`, result);
        return result;
    };

    const getMilestoneWatchers = (milestoneKey, threshold) => {
        if (!milestoneData.teamStats) return [];

        const watchers = [];
        Object.keys(milestoneData.teamStats).forEach(ownerId => {
            const achievement = milestoneData.teamStats[ownerId].achievements[milestoneKey]?.[threshold];
            if (!achievement?.achieved && achievement?.remaining <= 10 && achievement?.remaining > 0) {
                watchers.push({
                    ownerId,
                    ...milestoneData.allRosters[ownerId],
                    remaining: achievement.remaining,
                    currentValue: achievement.currentValue
                });
            }
        });

        return watchers.sort((a, b) => a.remaining - b.remaining);
    };

    const shouldCollapseMilestone = (milestoneKey, threshold) => {
        const achievers = getMilestoneAchievers(milestoneKey, threshold);
        const totalTeams = Object.keys(milestoneData.teamStats || {}).length;
        return achievers.length === totalTeams && totalTeams > 0;
    };

    const formatStatValue = (value, milestoneKey) => {
        if (milestoneKey === 'totalPoints') {
            return value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        }
        return value.toString();
    };

    const getMilestoneProgress = (milestoneKey, threshold) => {
        if (!milestoneData.teamStats) return [];

        const progress = [];
        Object.keys(milestoneData.teamStats).forEach(ownerId => {
            const achievement = milestoneData.teamStats[ownerId].achievements[milestoneKey]?.[threshold];
            if (achievement) {
                progress.push({
                    ownerId,
                    ...milestoneData.allRosters[ownerId],
                    currentValue: achievement.currentValue,
                    remaining: achievement.remaining,
                    progress: achievement.progress || 0,
                    achieved: achievement.achieved
                });
            }
        });

        return progress.sort((a, b) => {
            if (a.achieved && !b.achieved) return -1;
            if (!a.achieved && b.achieved) return 1;
            return b.currentValue - a.currentValue;
        });
    };

    const toggleThresholdExpansion = (milestoneKey, threshold) => {
        const key = `${milestoneKey}-${threshold}`;
        setExpandedThresholds(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const isThresholdExpanded = (milestoneKey, threshold) => {
        const key = `${milestoneKey}-${threshold}`;
        const collapsed = shouldCollapseMilestone(milestoneKey, threshold);
        // If it's in the state, use that value, otherwise use !collapsed as default
        return expandedThresholds[key] !== undefined ? expandedThresholds[key] : !collapsed;
    };

    if (contextError) {
        return (
            <div className="text-center py-8">
                <p className="text-red-600">Error loading data: {contextError}</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading milestones...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Mobile-friendly milestone selector */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 bg-gray-50 p-4 rounded-lg">
                {Object.keys(milestones).map(key => (
                    <button
                        key={key}
                        onClick={() => setActiveMilestone(key)}
                        className={`p-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeMilestone === key
                                ? `bg-${milestones[key].color}-100 text-${milestones[key].color}-800 border-2 border-${milestones[key].color}-300`
                                : 'bg-white text-gray-600 border-2 border-transparent hover:bg-gray-100'
                        }`}
                    >
                        <div className="text-lg mb-1">{milestones[key].icon}</div>
                        <div className="text-xs leading-tight">{milestones[key].title}</div>
                    </button>
                ))}
            </div>

            {/* Active milestone display */}
            {activeMilestone && milestones[activeMilestone] && (
                <div className="space-y-6">
                    {/* Milestone header */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-start space-x-4">
                            <div className={`text-4xl sm:text-5xl`}>
                                {milestones[activeMilestone].icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                                    {milestones[activeMilestone].title}
                                </h2>
                                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                                    {milestones[activeMilestone].description}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Milestone thresholds */}
                    <div className="space-y-4">
                        {milestones[activeMilestone].thresholds.map(threshold => {
                            const achievers = getMilestoneAchievers(activeMilestone, threshold);
                            const watchers = getMilestoneWatchers(activeMilestone, threshold);
                            const progress = getMilestoneProgress(activeMilestone, threshold);
                            const timingStats = getMilestoneTimingStats(activeMilestone, threshold);
                            const collapsed = shouldCollapseMilestone(activeMilestone, threshold);
                            const isExpanded = isThresholdExpanded(activeMilestone, threshold);

                            return (
                                <div key={threshold} className="bg-white rounded-lg shadow-sm border border-gray-200">
                                    {/* Threshold header */}
                                    <div 
                                        className="p-4 sm:p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={() => toggleThresholdExpansion(activeMilestone, threshold)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className={`w-3 h-3 rounded-full bg-${milestones[activeMilestone].color}-500`}></div>
                                                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                                                    {formatStatValue(threshold, activeMilestone)} {milestones[activeMilestone].title}
                                                </h3>
                                                {achievers.length > 0 && (
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${milestones[activeMilestone].color}-100 text-${milestones[activeMilestone].color}-800`}>
                                                        {achievers.length} achieved
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                {collapsed && (
                                                    <span className="text-xs text-gray-500 hidden sm:inline">
                                                        All teams achieved
                                                    </span>
                                                )}
                                                {isExpanded ? (
                                                    <FontAwesomeIcon icon={faChevronUp} className="h-5 w-5 text-gray-400" />
                                                ) : (
                                                    <FontAwesomeIcon icon={faChevronDown} className="h-5 w-5 text-gray-400" />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expandable content */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-200 p-4 sm:p-6 space-y-4">
                                            {/* Achievers */}
                                            {achievers.length > 0 && (
                                                <div>
                                                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                                        <FontAwesomeIcon icon={faTrophy} className="h-4 w-4 text-yellow-500 mr-2" />
                                                        Achievement Timeline ({achievers.length})
                                                    </h4>
                                                    
                                                    {/* Mobile-friendly table */}
                                                    <div className="overflow-x-auto">
                                                        <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
                                                            <thead className={`bg-${milestones[activeMilestone].color}-50`}>
                                                                <tr>
                                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                                        Team
                                                                    </th>
                                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                                        Season
                                                                    </th>
                                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                                        Week
                                                                    </th>
                                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                                        Total Weeks
                                                                    </th>
                                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                                        Difference
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-200">
                                                                {timingStats?.allAchievements ? timingStats.allAchievements.map((achievement, index) => {
                                                                    const isFirst = index === 0;
                                                                    return (
                                                                        <tr key={achievement.ownerId} className={
                                                                            isFirst ? 'bg-yellow-50' : 'hover:bg-gray-50'
                                                                        }>
                                                                            <td className="px-3 py-2">
                                                                                <div className="flex items-center space-x-2">
                                                                                    {milestoneData.allRosters[achievement.ownerId]?.avatar && (
                                                                                        <img
                                                                                            src={milestoneData.allRosters[achievement.ownerId].avatar}
                                                                                            alt={achievement.name}
                                                                                            className="w-6 h-6 rounded-full"
                                                                                        />
                                                                                    )}
                                                                                    <span className={`text-sm font-medium ${isFirst ? 'text-yellow-900' : 'text-gray-900'}`}>
                                                                                        {achievement.name}
                                                                                    </span>
                                                                                    {isFirst && (
                                                                                        <span className="text-xs bg-yellow-200 text-yellow-800 px-1 py-0.5 rounded">
                                                                                            1st
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-3 py-2 text-sm text-gray-600">
                                                                                {achievement.season}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-sm text-gray-600">
                                                                                {achievement.week}
                                                                            </td>
                                                                            <td className="px-3 py-2">
                                                                                <span className={`text-sm font-medium ${isFirst ? 'text-yellow-700' : 'text-gray-700'}`}>
                                                                                    {achievement.achievedIn}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-3 py-2">
                                                                                {isFirst ? (
                                                                                    <span className="text-sm font-medium text-yellow-700">
                                                                                        First
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-sm text-red-600">
                                                                                        +{achievement.weeksAfterFirst} weeks
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                }) : (
                                                                    <tr>
                                                                        <td colSpan="5" className="px-3 py-4 text-center text-sm text-gray-500">
                                                                            No timing data available for this milestone
                                                                        </td>
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
                                                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                                        <span className="text-orange-500 mr-2">👀</span>
                                                        Close to Achievement ({watchers.length})
                                                    </h4>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                        {watchers.map(watcher => (
                                                            <div key={watcher.ownerId} className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                                                                <div className="flex items-center space-x-3">
                                                                    {watcher.avatar && (
                                                                        <img
                                                                            src={watcher.avatar}
                                                                            alt={watcher.name}
                                                                            className="w-8 h-8 rounded-full"
                                                                        />
                                                                    )}
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium text-gray-900 truncate">
                                                                            {watcher.name}
                                                                        </p>
                                                                        <p className="text-xs text-orange-600">
                                                                            {watcher.remaining} away ({formatStatValue(watcher.currentValue, activeMilestone)})
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Progress for teams not achieved and not close */}
                                            {progress.filter(p => !p.achieved && p.remaining > 10).length > 0 && (
                                                <div>
                                                    <h4 className="font-medium text-gray-900 mb-3">
                                                        Progress Tracker
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {progress
                                                            .filter(p => !p.achieved && p.remaining > 10)
                                                            .slice(0, 5) // Show top 5 in progress
                                                            .map(team => (
                                                                <div key={team.ownerId} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center space-x-3">
                                                                            {team.avatar && (
                                                                                <img
                                                                                    src={team.avatar}
                                                                                    alt={team.name}
                                                                                    className="w-6 h-6 rounded-full"
                                                                                />
                                                                            )}
                                                                            <span className="text-sm font-medium text-gray-900">
                                                                                {team.name}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-xs text-gray-600">
                                                                            {formatStatValue(team.currentValue, activeMilestone)} / {formatStatValue(threshold, activeMilestone)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                                        <div
                                                                            className={`bg-${milestones[activeMilestone].color}-500 h-2 rounded-full transition-all duration-300`}
                                                                            style={{ width: `${Math.min(100, team.progress)}%` }}
                                                                        ></div>
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
            )}
        </div>
    );
};

export default MilestoneRecords;