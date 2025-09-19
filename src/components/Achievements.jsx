import React, { useState, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { formatScore } from '../utils/formatUtils';

const ACCENT_MAP = {
    blue: { bg: 'bg-blue-200', border: 'border-blue-400', icon: 'text-blue-700' },
    yellow: { bg: 'bg-yellow-200', border: 'border-yellow-400', icon: 'text-yellow-700' },
    gray: { bg: 'bg-gray-200', border: 'border-gray-400', icon: 'text-gray-700' },
    green: { bg: 'bg-green-200', border: 'border-green-400', icon: 'text-green-700' },
    red: { bg: 'bg-red-200', border: 'border-red-400', icon: 'text-red-700' },
    purple: { bg: 'bg-purple-200', border: 'border-purple-400', icon: 'text-purple-700' },
    orange: { bg: 'bg-orange-200', border: 'border-orange-400', icon: 'text-orange-700' },
    brown: { bg: 'bg-yellow-100', border: 'border-yellow-300', icon: 'text-yellow-800' }
};

const Badge = ({ title, subtitle, year, accent = 'blue' }) => {
    const a = ACCENT_MAP[accent] || ACCENT_MAP.blue;
    return (
        <div className={`flex flex-col items-center text-center p-4 bg-gray-50 rounded-lg border border-gray-200`}>
            <div className={`w-20 h-20 rounded-full ${a.bg} flex items-center justify-center mb-3 border-4 ${a.border}`}>
                {/* simple trophy/medal placeholder */}
                <svg className={`w-10 h-10 ${a.icon}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2l2 5h5l-4 3 1 5-5-3-5 3 1-5-4-3h5l2-5z" />
                </svg>
            </div>
            <div className="text-sm font-semibold text-gray-800">{title}</div>
            {subtitle && <div className="text-xs text-gray-500 italic">{subtitle}</div>}
            {year && <div className="text-xs text-gray-400 mt-1">{year}</div>}
        </div>
    );
};

// Simple tooltip (title attribute fallback) — can be replaced with richer tooltip library later
const Tooltip = ({ text, children }) => (
    <div title={text} className="relative inline-block">{children}</div>
);

const BadgeCard = ({ badge, count = 1, years = [] }) => {
    const title = badge.displayName || badge.name || badge.id;
    const subtitle = badge.metadata && badge.metadata.pick ? `Pick: ${badge.metadata.pick.overall_pick || badge.metadata.pick.pick_no || ''}` : null;
    return (
        <Tooltip text={badge.description || badge.metadata?.description || title}>
            <div className="p-3 bg-white rounded-md border flex items-start gap-3 relative">
                {count > 1 && (
                    <div className="absolute top-1 right-1 px-2 py-0.5 bg-gray-800 text-white text-xs rounded">x{count}</div>
                )}
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-700">{badge.icon || '🏆'}</div>
                <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-800 truncate">{title}</div>
                    {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
                    {years && years.length > 0 && <div className="text-xs text-gray-400 mt-1">{years.join(', ')}</div>}
                </div>
            </div>
        </Tooltip>
    );
};

const SectionHeader = ({ title }) => (
    <div className="bg-gray-800 text-white px-4 py-2 rounded-md mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
    </div>
);

const Achievements = () => {
    const { historicalData, usersData, getTeamName, getTeamDetails, processedSeasonalRecords, careerDPRData, badgesByTeam, recentBadges } = useSleeperData();
    const [selectedTeam, setSelectedTeam] = useState('overview');
    const [showCatalog, setShowCatalog] = useState(false);

    // Build team dropdown options: Overview + every team name available in current or historical data
    const teamOptions = useMemo(() => {
        // Only include Overview + the current league users to keep the dropdown to the active teams
        const opts = [{ key: 'overview', label: 'Overview' }];
        if (usersData && Array.isArray(usersData)) {
            usersData.forEach(u => {
                const label = u.metadata?.team_name || u.display_name || `User ${u.user_id}`;
                // Use user_id as the key to keep it simple and unique
                opts.push({ key: u.user_id, label });
            });
        }

        return opts;
    }, [historicalData, usersData]);

    const handleTeamChange = (e) => {
        setSelectedTeam(e.target.value);
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-1">Achievements</h2>
                    <p className="text-sm text-gray-500">Trophy Room, Champion badges, Season badges, Matchup badges, Draft & Transaction badges, Roster badges, League badges and Blunders.</p>
                </div>
                <div className="flex items-center gap-3">
                    <label htmlFor="team-select" className="text-sm text-gray-600">View:</label>
                    <select id="team-select" value={selectedTeam} onChange={handleTeamChange} className="px-3 py-2 border rounded-md bg-white">
                        {teamOptions.map(opt => (
                            <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setShowCatalog(s => !s)}
                        className="ml-3 px-3 py-2 bg-gray-100 border rounded-md text-sm"
                        aria-pressed={showCatalog}
                    >
                        {showCatalog ? 'Hide full catalog' : 'Show all badges'}
                    </button>
                </div>
            </div>

            {/* Team Summary (when a specific team is selected) */}
            {selectedTeam && selectedTeam !== 'overview' && (
                <div className="mb-6 p-4 bg-gray-50 rounded-md border border-gray-100 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        <img src={getTeamDetails ? getTeamDetails(selectedTeam)?.avatar : ''} alt="avatar" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <div className="text-lg font-semibold text-gray-800">{getTeamDetails ? getTeamDetails(selectedTeam)?.name : 'Team'}</div>
                        {(() => {
                            const badges = (badgesByTeam && badgesByTeam[selectedTeam]) || [];
                            const achievements = badges.filter(b => b.category !== 'blunder').length;
                            const blunders = badges.filter(b => b.category === 'blunder').length;
                            return <div className="text-sm text-gray-500">Badge Count: {achievements} • Blunders: {blunders}</div>;
                        })()}
                    </div>
                </div>
            )}

            {/* Team-specific aggregated sections are rendered below; remove raw 'Team Badges' block to avoid duplication */}

            {/* Overview Heatmap and Recent Badges */}
            {selectedTeam === 'overview' && (
                <>
                    <SectionHeader title="Overview: Team Achievements Heatmap" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                        {(() => {
                            // Build counts from careerDPRData (preferred) or fallback to processedSeasonalRecords
                            // Build counts from badgesByTeam and careerDPRData as fallback for names
                            const teamIds = Object.keys(badgesByTeam || {});
                            if (teamIds.length === 0) {
                                return <div className="text-sm text-gray-500">No team badge data available for overview.</div>;
                            }

                            const counts = teamIds.map(id => {
                                const badges = badgesByTeam[id] || [];
                                const achievements = badges.filter(b => b.category !== 'blunder').length;
                                const blunders = badges.filter(b => b.category === 'blunder').length;
                                const name = getTeamDetails ? getTeamDetails(id)?.name : id;
                                return { ownerId: id, name, achievements, blunders };
                            });

                            const maxA = counts.reduce((m, c) => Math.max(m, c.achievements), 0) || 1;
                            const maxB = counts.reduce((m, c) => Math.max(m, c.blunders), 0) || 1;

                            return counts.map(team => {
                                const aRatio = team.achievements / maxA;
                                const bRatio = team.blunders / maxB;
                                const aOpacity = Math.min(0.95, 0.15 + aRatio * 0.85);
                                const bOpacity = Math.min(0.95, 0.15 + bRatio * 0.85);
                                return (
                                    <div key={team.ownerId} className="p-3 rounded-md border border-gray-100 bg-white">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-sm font-medium truncate">{team.name}</div>
                                            <div className="text-xs text-gray-500">A: {team.achievements} • B: {team.blunders}</div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="w-full h-3 rounded-md bg-gray-200 overflow-hidden">
                                                <div style={{ width: `${Math.round(aRatio * 100)}%`, backgroundColor: `rgba(16,185,129, ${aOpacity})`, height: '100%' }} />
                                            </div>
                                            <div className="w-full h-3 rounded-md bg-gray-200 overflow-hidden">
                                                <div style={{ width: `${Math.round(bRatio * 100)}%`, backgroundColor: `rgba(239,68,68, ${bOpacity})`, height: '100%' }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    <SectionHeader title="Recently Earned Badges" />
                    <div className="mb-6">
                            {recentBadges && recentBadges.length > 0 ? (
                                <div className="space-y-2">
                                    {recentBadges.slice(0, 8).map((rb, idx) => (
                                        <BadgeCard key={idx} badge={rb} />
                                    ))}
                                </div>
                            ) : <div className="text-sm text-gray-500">No recent badges</div>}
                    </div>
                </>
            )}

            {/* Full badge catalog (display only badges the selected team has earned) */}
            {(selectedTeam !== 'overview' || showCatalog) && (
                (() => {
                    if (!selectedTeam || selectedTeam === 'overview') return null;
                    const teamBadges = (badgesByTeam && badgesByTeam[selectedTeam]) || [];
                    if (!teamBadges || teamBadges.length === 0) return <div className="text-sm text-gray-500">No badges found for this team.</div>;

                    // Helper to render a section if there are badges matching the given display names
                    const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
                    const renderSection = (title, displayNamesSet) => {
                        const normalizedSet = new Set(Array.from(displayNamesSet).map(n => normalize(n)));
                        const filtered = teamBadges.filter(b => normalizedSet.has(normalize(b.displayName)));
                        if (!filtered || filtered.length === 0) return null;

                        // Group by displayName
                        const grouped = {};
                        filtered.forEach(b => {
                            const key = b.displayName || b.name || b.id;
                            grouped[key] = grouped[key] || { badge: b, years: [], count: 0 };
                            grouped[key].count += 1;
                            if (b.year) grouped[key].years.push(String(b.year));
                        });

                        return (
                            <>
                                <SectionHeader title={title} />
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                                    {Object.keys(grouped).map(k => {
                                        const g = grouped[k];
                                        // Attach a description for tooltip if available
                                        if (!g.badge.description) g.badge.description = badgeDescriptions[g.badge.displayName] || g.badge.metadata?.description || g.badge.displayName;
                                        // Pass aggregated years and count into BadgeCard
                                        return <BadgeCard key={k} badge={g.badge} count={g.count} years={Array.from(new Set(g.years))} />;
                                    })}
                                </div>
                            </>
                        );
                    };

                    // human-readable descriptions for tooltip hover. This list is intentionally
                    // broad to cover many badges. Missing cases will fall back to badge metadata
                    // or the badge displayName.
                    const badgeDescriptions = {
                        // Season / Trophy
                        'Season Title': 'Awarded to the team with the best regular season record (most wins).',
                        'Season Points Title': 'Awarded to the team with the most total points scored in the regular season.',
                        'Season All-Play Title': 'Awarded to the team with the best all-play win percentage across the season.',
                        'Triple Crown': 'Won Season Title, Points Title, and All-Play Title in the same year.',
                        'Champion': 'Playoff champion for the season.',
                        'Runner Up': 'Playoff runner-up (2nd place).',
                        '3rd Place': 'Playoff third-place finisher.',

                        // Champion-special
                        'Heavyweight Champion': 'Champion who defeated a schedule at or above the 75th percentile of difficulty.',
                        'Comeback Kid': 'Champion who started 0-5 and still won the title.',
                        'Against All Odds': 'Champion who had a very low luck rating (<=25th percentile).',
                        'Silverback-To-Back': 'Runner-up in consecutive seasons.',

                        // Season tiers
                        'Bronze Season': 'Season performance ranked in the Bronze percentile tier for DPR.',
                        'Silver Season': 'Season performance ranked in the Silver percentile tier for DPR.',
                        'Gold Season': 'Season performance ranked in the Gold percentile tier for DPR.',
                        'Diamond Season': 'Season performance ranked in the Diamond percentile tier for DPR.',
                        'The Gauntlet': 'Award for sustained excellence across a difficult run of opponents.',

                        // Matchup
                        'Peak Performance': 'Highest single-game score recorded by any team that season.',
                        'The Shootout': 'The single matchup with the highest combined score in the season.',
                        'Massacre': 'A dominant win by a large margin in a single matchup.',
                        'Firing Squad': 'Multiple players on the roster had breakout performances in the same week.',
                        'A Small Victory': 'A narrow, hard-fought win.',
                        'A Micro Victory': 'A win by a very small margin.',
                        'A Nano Victory': 'An extremely narrow win (fractions of a point).',
                        'Double Up': 'Won twice in a single matchup window or achieved two identical outcomes in a season.',
                        'Perfectly Peaked': 'Team peaked perfectly for the playoffs with ideal matchups/performance.',
                        'Bully': 'Consistently large-margin wins vs weaker opponents.',
                        'Thread The Needle': 'A risky lineup move that paid off dramatically in a matchup.',

                        // Draft & transactions
                        'Draft King': 'Team with the highest combined draft pick value (best draft) for the season.',
                        'Worst Draft Pick': 'The single draft selection with the largest negative return relative to expectation.',
                        'The Mastermind': 'A particularly shrewd or valuable draft strategy executed by a team.',
                        'Top Draft Pick': 'The single highest-valued draft pick for that roster.',
                        'Action King': 'Team with the most transactions in the season year (adds/drops/trades).',

                        // Roster-level
                        'Top QB Roster': 'Roster with the highest combined QB value for the season.',
                        'Top RB Roster': 'Roster with the highest combined RB value for the season.',
                        'Top WR Roster': 'Roster with the highest combined WR value for the season.',
                        'Top TE Roster': 'Roster with the highest combined TE value for the season.',
                        'Top K Roster': 'Roster with the highest combined kicker value for the season.',
                        'Top DEF Roster': 'Roster with the highest combined defense/special teams value for the season.',

                        // League career milestones
                        'Veteran Presence': 'Team/user with long-term participation in the league.',
                        'Total Wins - 25': 'Reached 25 total wins across career.',
                        'Total Wins - 50': 'Reached 50 total wins across career.',
                        'Total Wins - 100': 'Reached 100 total wins across career.',
                        'All-Play Wins - 250': 'Reached 250 all-play wins across career.',
                        'All-Play Wins - 500': 'Reached 500 all-play wins across career.',
                        'All-Play Wins - 1000': 'Reached 1000 all-play wins across career.',
                        'Total Points - 10000': 'Accumulated 10,000 points across the team career.',

                        // Blunders
                        'The Worst': 'A catastrophic season or play that earns a special blunder badge.',
                        'Trash Trifecta': 'Series of poor outcomes across multiple categories in the same season.',
                        'Flawless Garbage': 'Consistently poor performance with particularly bad outcomes.',
                        'Champion Drought - 5': 'Has not won a championship in 5+ seasons.',
                        'Champion Drought - 10': 'Has not won a championship in 10+ seasons.',
                        'Champion Drought - 15': 'Has not won a championship in 15+ seasons.',
                        'The Cupcake': 'Lost many games to significantly weaker opponents.',
                        'Season Worst Scores -5': 'Recorded among the bottom single-game scores in a season.',
                        'Iron Season': 'Consistently low variance but poor results—an "iron" level season.',
                        'Wood Season': 'A lower-tier season classification for poor performance.',
                        'Clay Season': 'A bottom-tier season classification for very poor performance.',
                        'Bye Week': 'A season where an important week (bye) damaged season outcomes.',
                        'Heartbreaker': 'Lost multiple games by extremely small margins.',
                        'The Snoozer': 'Low scoring, unexciting season.',
                        'Doubled Up': 'Suffered repeated losses that compound into a blunder.',
                        'True Lowlight': 'A painfully bad highlight that stands out in league history.',
                        'Spoiled Goods': 'Drafted players who severely underperformed relative to expectations.',
                        'Bullied': 'Consistently got beaten by other teams in the league.',
                        'The Madman': 'Made an unorthodox series of moves that backfired spectacularly.',

                        // League-level blunders
                        'Total Losses - 25': 'Accumulated 25 career losses.',
                        'Total Losses - 50': 'Accumulated 50 career losses.',
                        'Total Losses - 100': 'Accumulated 100 career losses.',
                        'All-Play Losses - 250': 'Accumulated 250 all-play losses across career.',
                        'All-Play Losses - 500': 'Accumulated 500 all-play losses across career.',
                        'All-Play Losses - 1000': 'Accumulated 1000 all-play losses across career.',
                        'Total Opponent Points - 10000': 'Opponents have scored 10,000 points against this roster across career.'
                    };

                    // Define sets for each section using the labels you provided
                    const makeSet = arr => new Set((arr || []).map(s => normalize(s)));
                    const trophyRoom = makeSet(['Playoff 1st','Champion','Playoff 2nd','Runner Up','Playoff 3rd','3rd Place','Points 1st','Top Scoring','Points 2nd','2nd Scoring','Points 3rd','3rd Scoring']);
                    const championBadges = makeSet(['Season Title','Season Points Title','Season All-Play Title','Triple Crown','Champion','Heavyweight Champion','Comeback Kid','Against All Odds','Draft King','Action King','Silverback-To-Back']);
                    const seasonBadges = makeSet(['Bronze Season','Silver Season','Gold Season','Diamond Season','The Gauntlet','Season Top-Half Scoring - 75%']);
                    const matchupBadges = makeSet(['Peak Performance','The Shootout','Massacre','Firing Squad','A Small Victory','A Micro Victory','A Nano Victory','Double Up','Perfectly Peaked','Bully','Thread The Needle']);
                    const draftTxBadges = makeSet(['The Mastermind','Top Draft Pick','Top QB Draft','Top RB Draft','Top WR Draft','Top TE Draft','Top K Draft','Top DEF Draft','Draft King','Worst Draft Pick','Worst QB Draft','Worst RB Draft','Worst K Draft','Worst DL Draft','Worst DB Draft','Worst LB Draft','Worst WR Draft','Worst TE Draft']);
                    const rosterBadges = makeSet(['Top QB Roster','Top RB Roster','Top WR Roster','Top TE Roster','Top K Roster','Top DEF Roster']);
                    const leagueBadges = makeSet(['Veteran Presence','Total Wins - 25','Total Wins - 50','All-Play Wins - 250','All-Play Wins - 500','Total Points - 10000','All-Play Wins - 1000','Total Wins - 100']);
                    const blunderBadges = makeSet(['The Worst','Trash Trifecta','Flawless Garbage','Champion Drought - 5','Champion Drought - 10','Champion Drought - 15','The Cupcake','Season Worst Scores -5','Iron Season','Wood Season','Clay Season','Season Bottom-Half Scoring - 75%','Bye Week','Heartbreaker','The Snoozer','Doubled Up','True Lowlight','Spoiled Goods','Bullied','The Madman','Worst Draft Pick','Worst QB Draft','Worst RB Draft','Worst K Draft','Worst DL Draft','Worst DB Draft','Worst LB Draft','Worst WR Draft','Worst TE Draft','Worst QB Roster','Worst RB Roster','Worst WR Roster','Worst TE Roster','Worst K Roster','Worst DEF Roster','Worst DL Roster','Worst LB Roster','Worst DB Roster']);
                    const leagueBlunders = makeSet(['Total Losses - 25','Total Losses - 50','Total Losses - 100','All-Play Losses - 250','All-Play Losses - 500','All-Play Losses - 1000','Total Opponent Points - 10000']);

                    // Render sections with precedence: once a badge is placed into a section
                    // it will not appear in later sections. This avoids duplicating the same
                    // earned badge across multiple categories.
                    const sections = [
                        { title: 'Trophy Room', set: trophyRoom },
                        { title: 'Champion Badges', set: championBadges },
                        { title: 'Season Badges', set: seasonBadges },
                        { title: 'Matchup Badges', set: matchupBadges },
                        { title: 'Draft & Transaction Badges', set: draftTxBadges },
                        { title: 'Roster Badges', set: rosterBadges },
                        { title: 'League Badges', set: leagueBadges },
                        { title: 'Blunders', set: blunderBadges },
                        { title: 'League Blunders', set: leagueBlunders },
                    ];

                    let remaining = Array.from(teamBadges);

                    const renderedSections = [];

                    sections.forEach(sec => {
                        const normalizedSet = sec.set; // already a set of normalized strings
                        // find badges that match this section from the remaining pool
                        const filtered = remaining.filter(b => normalizedSet.has(normalize(b.displayName)));
                        if (!filtered || filtered.length === 0) return;

                        // group them by displayName
                        const grouped = {};
                        filtered.forEach(b => {
                            const key = b.displayName || b.name || b.id;
                            grouped[key] = grouped[key] || { badge: b, years: [], count: 0 };
                            grouped[key].count += 1;
                            if (b.year) grouped[key].years.push(String(b.year));
                        });

                        renderedSections.push(
                            <React.Fragment key={sec.title}>
                                <SectionHeader title={sec.title} />
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                                    {Object.keys(grouped).map(k => {
                                        const g = grouped[k];
                                        if (!g.badge.description) g.badge.description = badgeDescriptions[g.badge.displayName] || g.badge.metadata?.description || g.badge.displayName;
                                        return <BadgeCard key={k} badge={g.badge} count={g.count} years={Array.from(new Set(g.years))} />;
                                    })}
                                </div>
                            </React.Fragment>
                        );

                        // remove matched badges from remaining so they don't show again
                        const matchedIds = new Set(filtered.map(b => b.id || `${b.displayName}-${b.year || ''}-${Math.random()}`));
                        remaining = remaining.filter(b => !matchedIds.has(b.id));
                    });

                    // If the user wants to see the full catalog and there are leftovers, show them under "Other Badges"
                    if (showCatalog && remaining.length > 0) {
                        const grouped = {};
                        remaining.forEach(b => {
                            const key = b.displayName || b.name || b.id;
                            grouped[key] = grouped[key] || { badge: b, years: [], count: 0 };
                            grouped[key].count += 1;
                            if (b.year) grouped[key].years.push(String(b.year));
                        });
                        renderedSections.push(
                            <React.Fragment key="other">
                                <SectionHeader title="Other Badges" />
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                                    {Object.keys(grouped).map(k => {
                                        const g = grouped[k];
                                        if (!g.badge.description) g.badge.description = badgeDescriptions[g.badge.displayName] || g.badge.metadata?.description || g.badge.displayName;
                                        return <BadgeCard key={k} badge={g.badge} count={g.count} years={Array.from(new Set(g.years))} />;
                                    })}
                                </div>
                            </React.Fragment>
                        );
                    }

                    return <>{renderedSections}</>;
                })()
            )}
        </div>
    );
};

export default Achievements;
