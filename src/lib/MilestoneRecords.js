import React, { useState, useEffect } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { calculateAllLeagueMetrics } from '../utils/calculations';

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
    const [loading, setLoading] = useState(true);

    // Define milestone configurations
    const milestones = {
        totalWins: {
            title: 'Total Wins',
            description: 'This record recognizes a team that reaches a significant benchmark in all-time league victories. This achievement highlights long-term success, consistency, and dominance over multiple seasons.',
            icon: '🏆',
            thresholds: [10, 25, 50, 75, 100],
            color: 'green'
        },
        totalLosses: {
            title: 'Total Losses',
            description: 'Recognition for teams that have endured the most defeats. These milestones represent perseverance and continued participation despite setbacks.',
            icon: '💔',
            thresholds: [10, 25, 50, 75, 100],
            color: 'red'
        },
        allPlayWins: {
            title: 'All-Play Wins',
            description: 'All-Play wins count how many teams you would have beaten each week if you played everyone. This milestone recognizes consistent high-scoring performances.',
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
        const allSeasons = Object.keys(historicalData.matchupsBySeason || {}).sort();
        const teamStats = {};
        const weeklyScores = {};
        const achievementHistory = {}; // Track when milestones were achieved

        // Initialize team stats
        const allRosters = {};
        allSeasons.forEach(season => {
            const rosters = historicalData.rostersBySeason?.[season] || [];
            rosters.forEach(roster => {
                const ownerId = roster.owner_id;
                if (!teamStats[ownerId]) {
                    teamStats[ownerId] = {
                        wins: 0,
                        losses: 0,
                        ties: 0,
                        allPlayWins: 0,
                        allPlayLosses: 0,
                        totalPoints: 0,
                        totalOpponentPoints: 0,
                        highScores: 0,
                        weekHistory: [],
                        achievements: {},
                        milestoneHistory: {} // Track when each milestone was achieved
                    };
                }
                // Use the most recent season for team details (current season preferably)
                const teamDetails = getTeamDetails(ownerId, currentSeason) || getTeamDetails(ownerId, season);
                allRosters[ownerId] = {
                    name: getTeamName(ownerId, currentSeason) || getTeamName(ownerId, season),
                    avatar: teamDetails?.avatar
                };
            });
        });

        // Initialize achievement history tracking
        Object.keys(milestones).forEach(milestoneKey => {
            achievementHistory[milestoneKey] = {};
            milestones[milestoneKey].thresholds.forEach(threshold => {
                achievementHistory[milestoneKey][threshold] = [];
            });
        });

        let weekCounter = 0; // Global week counter for tracking achievement timing

        // Process matchups chronologically to track when milestones were achieved
        allSeasons.forEach(season => {
            const matchups = historicalData.matchupsBySeason?.[season] || [];
            
            // Group matchups by week
            const matchupsByWeek = {};
            matchups.forEach(matchup => {
                const week = parseInt(matchup.week);
                if (!matchupsByWeek[week]) matchupsByWeek[week] = [];
                matchupsByWeek[week].push(matchup);
            });

            // Process weeks in order
            const sortedWeeks = Object.keys(matchupsByWeek).sort((a, b) => parseInt(a) - parseInt(b));
            
            sortedWeeks.forEach(week => {
                weekCounter++;
                const weekMatchups = matchupsByWeek[week];
                const weekScores = [];

                // Collect all scores for the week
                weekMatchups.forEach(matchup => {
                    const team1Score = parseFloat(matchup.team1_score || 0);
                    const team2Score = parseFloat(matchup.team2_score || 0);
                    
                    weekScores.push({
                        ownerId: matchup.team1_details?.owner_id,
                        score: team1Score
                    });
                    weekScores.push({
                        ownerId: matchup.team2_details?.owner_id,
                        score: team2Score
                    });

                    // Regular wins/losses
                    const team1Owner = matchup.team1_details?.owner_id;
                    const team2Owner = matchup.team2_details?.owner_id;

                    if (team1Owner && teamStats[team1Owner]) {
                        teamStats[team1Owner].totalPoints += team1Score;
                        teamStats[team1Owner].totalOpponentPoints += team2Score;
                        
                        if (team1Score > team2Score) {
                            teamStats[team1Owner].wins++;
                        } else if (team1Score < team2Score) {
                            teamStats[team1Owner].losses++;
                        } else {
                            teamStats[team1Owner].ties++;
                        }
                    }

                    if (team2Owner && teamStats[team2Owner]) {
                        teamStats[team2Owner].totalPoints += team2Score;
                        teamStats[team2Owner].totalOpponentPoints += team1Score;
                        
                        if (team2Score > team1Score) {
                            teamStats[team2Owner].wins++;
                        } else if (team2Score < team1Score) {
                            teamStats[team2Owner].losses++;
                        } else {
                            teamStats[team2Owner].ties++;
                        }
                    }
                });

                // Calculate all-play wins/losses
                weekScores.forEach(team => {
                    if (!team.ownerId || !teamStats[team.ownerId]) return;
                    
                    let allPlayWins = 0;
                    let allPlayLosses = 0;

                    weekScores.forEach(opponent => {
                        if (opponent.ownerId !== team.ownerId) {
                            if (team.score > opponent.score) {
                                allPlayWins++;
                            } else if (team.score < opponent.score) {
                                allPlayLosses++;
                            }
                        }
                    });

                    teamStats[team.ownerId].allPlayWins += allPlayWins;
                    teamStats[team.ownerId].allPlayLosses += allPlayLosses;
                });

                // Calculate high scores (top 3 each week)
                weekScores.sort((a, b) => b.score - a.score);
                weekScores.slice(0, 3).forEach(team => {
                    if (team.ownerId && teamStats[team.ownerId]) {
                        teamStats[team.ownerId].highScores++;
                    }
                });

                // Check for milestone achievements after this week
                Object.keys(teamStats).forEach(ownerId => {
                    const stats = teamStats[ownerId];
                    
                    Object.keys(milestones).forEach(milestoneKey => {
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

                        milestones[milestoneKey].thresholds.forEach(threshold => {
                            // Check if milestone was just achieved
                            if (currentValue >= threshold) {
                                const existingAchievement = achievementHistory[milestoneKey][threshold].find(
                                    achievement => achievement.ownerId === ownerId
                                );
                                
                                if (!existingAchievement) {
                                    achievementHistory[milestoneKey][threshold].push({
                                        ownerId,
                                        achievedWeek: weekCounter,
                                        season: season,
                                        week: week,
                                        currentValue
                                    });
                                }
                            }
                        });
                    });
                });
            });
        });

        // Calculate milestone achievements for each team
        Object.keys(teamStats).forEach(ownerId => {
            const stats = teamStats[ownerId];
            const achievements = {};

            Object.keys(milestones).forEach(milestoneKey => {
                const milestone = milestones[milestoneKey];
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

        setMilestoneData({ teamStats, allRosters, achievementHistory });
    };

    const getMilestoneAchievers = (milestoneKey, threshold) => {
        if (!milestoneData.teamStats) return [];

        const achievers = [];
        Object.keys(milestoneData.teamStats).forEach(ownerId => {
            const achievement = milestoneData.teamStats[ownerId].achievements[milestoneKey]?.[threshold];
            if (achievement?.achieved) {
                achievers.push({
                    ownerId,
                    ...milestoneData.allRosters[ownerId],
                    currentValue: achievement.currentValue
                });
            }
        });

        return achievers.sort((a, b) => b.currentValue - a.currentValue);
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

    const getColorClasses = (color) => {
        const colors = {
            green: 'bg-green-100 text-green-800 border-green-200',
            red: 'bg-red-100 text-red-800 border-red-200',
            blue: 'bg-blue-100 text-blue-800 border-blue-200',
            purple: 'bg-purple-100 text-purple-800 border-purple-200',
            yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            orange: 'bg-orange-100 text-orange-800 border-orange-200'
        };
        return colors[color] || colors.blue;
    };

    if (loading || contextLoading) {
        return (
            <div className="flex justify-center items-center py-16">
                <div className="text-center">
                    <div className="text-4xl mb-4">⏳</div>
                    <p className="text-gray-600">Calculating milestones...</p>
                </div>
            </div>
        );
    }

    if (contextError) {
        return (
            <div className="text-center py-16">
                <div className="text-4xl mb-4">❌</div>
                <p className="text-red-600">Error loading milestone data</p>
            </div>
        );
    }

    const currentMilestone = milestones[activeMilestone];

    return (
        <div className="p-6">
            {/* Header */}
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">League Milestones</h2>
                <p className="text-gray-600">Track significant achievements and career accomplishments</p>
            </div>

            {/* Milestone Tabs */}
            <div className="mb-8">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                    {Object.keys(milestones).map((key) => {
                        const milestone = milestones[key];
                        const isActive = activeMilestone === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveMilestone(key)}
                                className={`p-3 rounded-lg text-center transition-all ${
                                    isActive
                                        ? `${getColorClasses(milestone.color)} border-2 transform scale-105`
                                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                                }`}
                            >
                                <div className="text-2xl mb-1">{milestone.icon}</div>
                                <div className="text-sm font-medium">{milestone.title}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Current Milestone Detail */}
            <div className="bg-white rounded-lg border shadow-sm">
                {/* Milestone Header */}
                <div className={`p-6 border-b ${getColorClasses(currentMilestone.color)} bg-opacity-50`}>
                    <div className="flex items-center gap-4">
                        <div className="text-4xl">{currentMilestone.icon}</div>
                        <div>
                            <h3 className="text-2xl font-bold">{currentMilestone.title} Milestone</h3>
                            <p className="text-sm opacity-80 mt-2">{currentMilestone.description}</p>
                        </div>
                    </div>
                </div>

                {/* Milestone Content */}
                <div className="p-6">
                    {[...currentMilestone.thresholds].sort((a, b) => b - a).map((threshold) => {
                        // Get achievement history for this threshold
                        const achievements = milestoneData.achievementHistory?.[activeMilestone]?.[threshold] || [];
                        
                        // Sort by achievement week (earliest first)
                        const sortedAchievements = [...achievements].sort((a, b) => a.achievedWeek - b.achievedWeek);
                        
                        // Count how many members achieved this milestone
                        const achievedCount = sortedAchievements.length;
                        const totalMembers = Object.keys(milestoneData.teamStats || {}).length;
                        const achievedPercentage = totalMembers > 0 ? Math.round((achievedCount / totalMembers) * 100) : 0;

                        return (
                            <div key={threshold} className="mb-8 last:mb-0 bg-gray-50 rounded-lg p-6 border">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-xl font-bold">
                                        {threshold.toLocaleString()} {currentMilestone.title}
                                    </h4>
                                    <div className="text-right">
                                        <div className="text-sm text-gray-600">
                                            {achievedCount}/{totalMembers} Members
                                        </div>
                                        <div className="text-lg font-semibold">
                                            {achievedPercentage}% Achieved
                                        </div>
                                    </div>
                                </div>

                                {sortedAchievements.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="text-gray-500 text-lg mb-4">
                                            🎯 Milestone Not Yet Achieved
                                        </div>
                                        <div className="text-gray-400">
                                            This milestone is waiting to be conquered!
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-4 gap-4 text-sm font-semibold text-gray-600 pb-2 border-b border-gray-300">
                                            <div>Member</div>
                                            <div>Achieved</div>
                                            <div>Achieved In (-Lead)</div>
                                            <div>Quickest</div>
                                        </div>
                                        
                                        {sortedAchievements.map((achievement, index) => {
                                            const teamName = milestoneData.allRosters[achievement.ownerId]?.name || 'Unknown';
                                            const firstAchiever = sortedAchievements[0];
                                            const leadWeeks = achievement.achievedWeek - firstAchiever.achievedWeek;
                                            
                                            return (
                                                <div key={achievement.ownerId} className="grid grid-cols-4 gap-4 py-3 border-b border-gray-200 last:border-b-0">
                                                    <div className="flex items-center space-x-2">
                                                        {milestoneData.allRosters[achievement.ownerId]?.avatar && (
                                                            <img 
                                                                src={milestoneData.allRosters[achievement.ownerId].avatar}
                                                                alt={teamName}
                                                                className="w-8 h-8 rounded-full"
                                                                onError={(e) => { 
                                                                    e.target.src = 'https://sleepercdn.com/avatars/default_avatar.png'; 
                                                                }}
                                                            />
                                                        )}
                                                        <span className="font-medium">{teamName}</span>
                                                    </div>
                                                    
                                                    <div className="text-gray-700">
                                                        {achievement.season} · Week {achievement.week}
                                                    </div>
                                                    
                                                    <div className="text-gray-700">
                                                        {achievement.achievedWeek} Weeks
                                                        {leadWeeks > 0 && (
                                                            <span className="text-orange-600"> (-{leadWeeks})</span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="text-gray-700">
                                                        {index === 0 ? (
                                                            <span className="text-green-600 font-semibold">1st</span>
                                                        ) : (
                                                            <span className="text-gray-500">{index + 1}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Show current progress for members who haven't achieved this milestone */}
                                {achievedCount < totalMembers && (
                                    <div className="mt-6 pt-4 border-t border-gray-300">
                                        <h5 className="text-lg font-semibold mb-3">Current Progress</h5>
                                        <div className="space-y-2">
                                            {Object.keys(milestoneData.teamStats || {})
                                                .filter(ownerId => !sortedAchievements.find(a => a.ownerId === ownerId))
                                                .sort((a, b) => {
                                                    const aProgress = milestoneData.teamStats[a].achievements[activeMilestone]?.[threshold]?.currentValue || 0;
                                                    const bProgress = milestoneData.teamStats[b].achievements[activeMilestone]?.[threshold]?.currentValue || 0;
                                                    return bProgress - aProgress;
                                                })
                                                .map(ownerId => {
                                                    const teamName = milestoneData.allRosters[ownerId]?.name || 'Unknown';
                                                    const progress = milestoneData.teamStats[ownerId].achievements[activeMilestone]?.[threshold];
                                                    const progressPercentage = Math.round((progress?.currentValue / threshold) * 100);
                                                    
                                                    return (
                                                        <div key={ownerId} className="flex items-center justify-between py-2 px-3 bg-white rounded border">
                                                            <div className="flex items-center space-x-2">
                                                                {milestoneData.allRosters[ownerId]?.avatar && (
                                                                    <img 
                                                                        src={milestoneData.allRosters[ownerId].avatar}
                                                                        alt={teamName}
                                                                        className="w-6 h-6 rounded-full"
                                                                        onError={(e) => { 
                                                                            e.target.src = 'https://sleepercdn.com/avatars/default_avatar.png'; 
                                                                        }}
                                                                    />
                                                                )}
                                                                <span className="font-medium">{teamName}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="font-medium">
                                                                    {activeMilestone === 'totalPoints' 
                                                                        ? (progress?.currentValue || 0).toFixed(0)
                                                                        : (progress?.currentValue || 0).toLocaleString()
                                                                    } / {threshold.toLocaleString()}
                                                                </div>
                                                                <div className="text-sm text-gray-500">
                                                                    {progressPercentage}% ({(progress?.remaining || threshold).toLocaleString()} needed)
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MilestoneRecords;