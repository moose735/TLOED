import React, { useState, useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { formatScore } from '../utils/formatUtils';

// Palette uses explicit hex colors so the UI can precisely match brand/screenshot
const ACCENT_MAP = {
    blue: { bg: '#eaf2ff', border: '#2563eb', icon: '#1e40af' },      // season-ish blue
    diamond: { bg: '#eef6ff', border: '#2b6cf6', icon: '#1e40af' },   // diamond/light-blue
    // special champion accent requested by user: border #EFBF04
    championAccent: { bg: '#fff8e6', border: '#EFBF04', icon: '#b36b00' },
    yellow: { bg: '#07122b', border: '#d4a017', icon: '#d4a017' },     // champion: dark inner, gold border
    gray: { bg: '#f3f4f6', border: '#9ca3af', icon: '#374151' },       // neutral
    green: { bg: '#ecfdf5', border: '#10b981', icon: '#059669' },      // success/green
    red: { bg: '#fff5f5', border: '#ef4444', icon: '#b91c1c' },        // matchup red
    purple: { bg: '#f5f3ff', border: '#7c3aed', icon: '#6d28d9' },     // purple
    orange: { bg: '#fff7ed', border: '#f97316', icon: '#c2410c' },     // orange
    brown: { bg: '#fffbeb', border: '#c08400', icon: '#92400e' }       // brown/gold alternative
};

// Accent used for matchup badges (requested border color #B069DB)
ACCENT_MAP.matchupAccent = { bg: '#f7f3ff', border: '#B069DB', icon: '#6b21a8' };

// Forced mapping for specific badges where we know the exact asset path.
// This is used by BadgeCard and the Overview catalog to prefer known SVG assets.
const FORCED_BADGE_MAP = {
    // season tier badges
    'bronze-season': '/badges/achievement/season-score-bronze.svg',
    'season-bronze': '/badges/achievement/season-score-bronze.svg',
    'season-score-bronze': '/badges/achievement/season-score-bronze.svg',
    'season-score-bronze.svg': '/badges/achievement/season-score-bronze.svg',

    'silver-season': '/badges/achievement/season-score-silver.svg',
    'season-silver': '/badges/achievement/season-score-silver.svg',
    'season-score-silver': '/badges/achievement/season-score-silver.svg',
    'season-score-silver.svg': '/badges/achievement/season-score-silver.svg',

    'gold-season': '/badges/achievement/season-score-gold.svg',
    'season-gold': '/badges/achievement/season-score-gold.svg',
    'season-score-gold': '/badges/achievement/season-score-gold.svg',
    'season-score-gold.svg': '/badges/achievement/season-score-gold.svg',

    'diamond-season': '/badges/achievement/season-score-diamond.svg',
    'season-diamond': '/badges/achievement/season-score-diamond.svg',
    'season-score-diamond': '/badges/achievement/season-score-diamond.svg',
    'season-score-diamond.svg': '/badges/achievement/season-score-diamond.svg',

    // Champion badge assets (user-provided)
    'season-all-play-title': '/badges/achievement/season-all-play-champion.svg',
    'season-all-play-champion': '/badges/achievement/season-all-play-champion.svg',
    'all-play-title': '/badges/achievement/season-all-play-champion.svg',
    'allplay-title': '/badges/achievement/season-all-play-champion.svg',

    'regular-season-champion': '/badges/achievement/regular-season-champion.svg',
    'season-title': '/badges/achievement/regular-season-champion.svg',
    'season-title.svg': '/badges/achievement/regular-season-champion.svg',

    'league-champion': '/badges/achievement/league-champion.svg',
    'champion': '/badges/achievement/league-champion.svg'
};

// Additional forced assets
FORCED_BADGE_MAP['points-title'] = '/badges/achievement/points-champion.svg';
FORCED_BADGE_MAP['points-title.svg'] = '/badges/achievement/points-champion.svg';
FORCED_BADGE_MAP['points-champion'] = '/badges/achievement/points-champion.svg';
FORCED_BADGE_MAP['triple-crown'] = '/badges/achievement/triple-crown.svg';
FORCED_BADGE_MAP['triple-crown.svg'] = '/badges/achievement/triple-crown.svg';
FORCED_BADGE_MAP['heavyweight-champion'] = '/badges/achievement/heavyweight-champion.svg';
FORCED_BADGE_MAP['heavyweight-champion.svg'] = '/badges/achievement/heavyweight-champion.svg';

// Matchup badges: prefer the shared matchup icon (or specific assets if added later)
const MATCHUP_ICON = '/badges/achievement/matchup-icon.svg';
[
    'peak-performance','peak-performance.svg','the-shootout','shootout','massacre','massacre.svg',
    'firing-squad','firing-squad.svg','a-small-victory','a-small-victory.svg','a-micro-victory','a-nano-victory',
    'micro-victory','small-victory','nano-victory','double-up','double-up.svg','bully','thread-the-needle','thread-the-needle.svg'
].forEach(k => { FORCED_BADGE_MAP[k] = MATCHUP_ICON; });

// Lucky Duck asset
FORCED_BADGE_MAP['lucky-duck'] = '/badges/achievement/season-lucky-duck.svg';
FORCED_BADGE_MAP['lucky-duck.svg'] = '/badges/achievement/season-lucky-duck.svg';
FORCED_BADGE_MAP['lucky_duck'] = '/badges/achievement/season-lucky-duck.svg';
FORCED_BADGE_MAP['season-lucky-duck'] = '/badges/achievement/season-lucky-duck.svg';

// Action King asset (team with the most transactions in a season)
FORCED_BADGE_MAP['action-king'] = '/badges/achievement/season-action-king.svg';
FORCED_BADGE_MAP['action-king.svg'] = '/badges/achievement/season-action-king.svg';
FORCED_BADGE_MAP['action_king'] = '/badges/achievement/season-action-king.svg';
FORCED_BADGE_MAP['season-action-king'] = '/badges/achievement/season-action-king.svg';
FORCED_BADGE_MAP['season-action-king.svg'] = '/badges/achievement/season-action-king.svg';

// Human-readable descriptions for tooltip hover. Keep at module scope so overview
// rendering can reference these without ordering/hoisting problems.
const BADGE_DESCRIPTIONS = {
    // Season / Trophy
    'Season Title': 'Awarded to the team with the best regular season record (most wins).',
    'Points Title': 'Awarded to the team with the most total points scored in the regular season (full season weeks).',
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
    'Firing Squad': 'Awarded for achieving the highest points share in a matchup in a season.',
    'A Small Victory': 'A narrow, hard-fought win.',
    'A Micro Victory': 'A win by a very small margin.',
    'A Nano Victory': 'An extremely narrow win (fractions of a point).',
    'Double Up': 'Won twice in a single matchup window or achieved two identical outcomes in a season.',
    'Perfectly Peaked': 'Team peaked perfectly for the playoffs with ideal matchups/performance.',
    'Bully': 'Consistently large-margin wins vs weaker opponents.',
    'Thread The Needle': 'A risky lineup move that paid off dramatically in a matchup.',
    'Lucky Duck': 'Recognizes the team who had the most amount of luck in a season (highest luck rating).',

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
    'The Madman': 'Made an unorthodox series of moves that backfired spectacularly.'
};

const Badge = ({ title, subtitle, year, accent = 'blue', icon = null }) => {
    const a = ACCENT_MAP[accent] || ACCENT_MAP.blue;
    const circleStyle = { backgroundColor: a.bg, border: `4px solid ${a.border}`, color: a.icon };
    return (
        <div className="flex flex-col items-center text-center p-4">
            <div style={circleStyle} className={`w-20 h-20 rounded-full flex items-center justify-center mb-3`}>
                {icon ? (
                    <div style={{ color: a.icon }} className="text-2xl">{icon}</div>
                ) : (
                    <svg style={{ color: a.icon }} className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 2l2 5h5l-4 3 1 5-5-3-5 3 1-5-4-3h5l2-5z" />
                    </svg>
                )}
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
    const accent = badge.accent || 'blue';
    const a = ACCENT_MAP[accent] || ACCENT_MAP.blue;

    // helper to create a slug for an svg asset (public/badges/{slug}.svg)
    const makeSlug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const slugFromDisplay = makeSlug(badge.displayName || title);
    const slugFromId = makeSlug(badge.id || '');
    // generate tolerant variants: hyphen, underscore, and concatenated
    const variants = new Set();
    [slugFromDisplay, slugFromId].forEach(s => {
        if (!s) return;
        variants.add(s);
        variants.add(s.replace(/-/g, '_'));
        variants.add(s.replace(/-/g, ''));
        variants.add(s.replace(/_/g, '-'));
    });

    // try displayName-based variants first, then id-based variants
    const displayVariants = Array.from(variants).filter(v => v && v.indexOf(slugFromDisplay) !== -1);
    const idVariants = Array.from(variants).filter(v => v && v.indexOf(slugFromId) !== -1 && v !== slugFromDisplay);

    // If the badge.icon token indicates the shared matchup SVG, prefer that asset first
    const candidateSources = [];
    if (badge.icon === 'matchup-icon') {
        candidateSources.push('/badges/achievement/matchup-icon.svg');
    }
    candidateSources.push(...displayVariants.flatMap(v => [`/badges/${v}.svg`, `/badges/${v}.png`, `/badges/achievement/${v}.svg`, `/badges/achievement/${v}.png`]));
    candidateSources.push(...idVariants.flatMap(v => [`/badges/${v}.svg`, `/badges/${v}.png`, `/badges/achievement/${v}.svg`, `/badges/achievement/${v}.png`]));

    const forcedSlug = makeSlug(badge.displayName || title);
    const forcedSrc = FORCED_BADGE_MAP[forcedSlug] || null;
    // busted version to avoid stale/invalid cached responses; compute once per badge
    const forcedSrcBusted = React.useMemo(() => (forcedSrc ? `${forcedSrc}${forcedSrc.indexOf('?') === -1 ? '?' : '&'}cb=${Date.now()}` : null), [forcedSrc, badge.id, badge.displayName]);

    // Debug flag (url param ?badgeDebug=1) — we both log to console and optionally render a visual overlay
    let debugOn = false;
    try {
        const search = typeof window !== 'undefined' && window.location && window.location.search;
        debugOn = !!(search && search.indexOf('badgeDebug=1') !== -1);
        if (debugOn) console.debug('Badge candidateSources for', badge.displayName || badge.id, candidateSources);
    } catch (err) { }

    const circleStyle = { backgroundColor: a.bg, border: `4px solid ${a.border}`, color: a.icon, width: 80, height: 80 };
    // imageContainerStyle used when rendering an image so the image fills the circle
    // We use an absolutely-positioned overlay for the border so it sits _on top_
    // of the image (prevents anti-aliased transparent gap between svg and border).
    const imageContainerStyle = { backgroundColor: 'transparent', width: 80, height: 80, position: 'relative' };

    // Track sources that have failed to load so we don't keep retrying them (esp. forcedSrc)
    const [failedSources, setFailedSources] = React.useState([]);

    React.useEffect(() => {
        // reset failures when badge changes
        setFailedSources([]);
    }, [badge.id, badge.displayName]);

    const pickNextSrc = () => {
        // prefer busted forcedSrc if present and not failed (helps bypass bad cache)
        if (forcedSrcBusted && !failedSources.includes(forcedSrcBusted)) return forcedSrcBusted;
        // then plain forcedSrc if busted isn't available or failed
        if (forcedSrc && !failedSources.includes(forcedSrc)) return forcedSrc;
        for (let i = 0; i < candidateSources.length; i++) {
            const s = candidateSources[i];
            if (!failedSources.includes(s)) return s;
        }
        return null;
    };

    const currentSrc = pickNextSrc();

    const handleImgError = (failedSrc) => {
        try { console.debug('Badge image failed to load:', failedSrc); } catch (err) {}
        setFailedSources(prev => prev.concat([failedSrc]));
    };

    // Temporary debug-only embedded test image (data URL). We couldn't base64-encode the
    // on-disk PNG because it appears empty in the workspace; use an inline SVG data URL
    // for a visible test image when debugging.
    const bronzeTestDataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="28" r="20" fill="#e6b800" stroke="#2563eb" stroke-width="4" />
            <text x="32" y="36" font-size="12" text-anchor="middle" fill="#fff" font-family="Arial">BR</text>
        </svg>`
    );

    const slugForTest = makeSlug(badge.displayName || title);
    const displayedSrc = (debugOn && slugForTest === 'bronze-season') ? bronzeTestDataUrl : currentSrc;

    return (
        <Tooltip text={badge.description || badge.metadata?.description || title}>
            <div className="relative flex flex-col items-center text-center p-2">
                {count > 1 && (
                    <div className="absolute -top-1 -right-1 px-2 py-0.5 bg-gray-800 text-white text-xs rounded">x{count}</div>
                )}
                {/* If an image asset is available, render it directly (no circle/bg). Otherwise render circular badge */}
                {currentSrc ? (
                    // When an image asset exists, render it full-bleed and place the
                    // accent border as an overlay on top of the image to avoid
                    // any visible transparent/antialiased ring.
                    <div style={imageContainerStyle} className={`rounded-full overflow-hidden`}>
                        <img src={currentSrc} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onLoad={(e) => { try { console.debug('Badge image loaded:', currentSrc); } catch (err) {} }} onError={(e) => { e.target.onerror = null; handleImgError(currentSrc); }} />
                        <div style={{ position: 'absolute', inset: 0, borderRadius: '9999px', border: `4px solid ${a.border}`, boxSizing: 'border-box', pointerEvents: 'none' }} />
                    </div>
                ) : (
                    <div style={circleStyle} className={`rounded-full flex items-center justify-center`}>
                        {/* try candidateSources in order; if none load, we fall back to badge.icon */}
                        <div style={{ color: a.icon, fontSize: 28 }}>{(badge.icon && !badge.icon.startsWith('/')) ? badge.icon : '🏆'}</div>
                    </div>
                )}
                {debugOn && (
                    <div className="mt-2 text-xs text-left text-red-600 bg-white bg-opacity-80 px-2 py-1 rounded max-w-xs break-words">
                        <div className="font-semibold">Attempting:</div>
                        <div className="text-xs text-gray-700">{currentSrc || 'none'}</div>
                        <div className="mt-1 font-semibold">Candidates:</div>
                        <div className="text-xs text-gray-600">{candidateSources.join(', ')}</div>
                    </div>
                )}
                <div className="mt-2 text-sm font-semibold text-gray-800">{title}</div>
                {years && years.length > 0 && <div className="text-xs text-gray-400 mt-1">{years.join(', ')}</div>}
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
    // Pull whole context here so child render logic can reference it safely
    const ctx = useSleeperData();
    const { historicalData, usersData, getTeamName, getTeamDetails, processedSeasonalRecords, careerDPRData, badgesByTeam, recentBadges, currentSeason } = ctx || {};
    const [selectedTeam, setSelectedTeam] = useState('overview');
    const [showCatalog, setShowCatalog] = useState(false);

    // Determine whether the current season has recorded a champion yet.
    // Compute once per relevant inputs to avoid calling hooks conditionally.
    const currentSeasonHasChampion = React.useMemo(() => {
        try {
            const cs = currentSeason;
            if (!cs || !processedSeasonalRecords) return false;
            const metrics = processedSeasonalRecords[cs] || {};
            return Object.values(metrics).some(m => !!m.isChampion);
        } catch (e) {
            return false;
        }
    }, [currentSeason, processedSeasonalRecords]);

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
                    {/* currentSeasonHasChampion is computed at component scope */}
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
                                    {recentBadges.slice(0, 8).map((rb, idx) => {
                                        // hide current-season champions/season tiers until winners are recorded
                                        const isCurrentSeason = (rb.year === Number(currentSeason) || rb.year === currentSeason);
                                        const isChampionLike = (rb.category === 'champion' || rb.category === 'season' || rb.category === 'season-tier');
                                        const hideCurrentSeasonChampions = isCurrentSeason && isChampionLike && !currentSeasonHasChampion;
                                        if (hideCurrentSeasonChampions) return null;
                                        return <BadgeCard key={idx} badge={rb} />
                                    })}
                                </div>
                            ) : <div className="text-sm text-gray-500">No recent badges</div>}
                    </div>

                    {/* Badge Catalog: list all known badges with description and icon for review */}
                    <SectionHeader title="Badge Catalog (icons & descriptions)" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                        {(() => {
                            const known = [
                                'Season Title','Points Title','Season All-Play Title','Triple Crown','Champion','Runner Up','3rd Place',
                                'Bronze Season','Silver Season','Gold Season','Diamond Season',
                                'Peak Performance','The Shootout','Massacre','Firing Squad','A Small Victory','A Micro Victory','A Nano Victory','Double Up',
                                'Draft King','Worst Draft Pick','Action King','Season Transactions','Lucky Duck'
                            ];
                            return known.map(name => {
                                const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                                const forced = FORCED_BADGE_MAP[slug] || FORCED_BADGE_MAP[slug + '.svg'] || null;
                                // prefer forced asset if available and append cache-bust to ensure updates show
                                const cb = Date.now();
                                const candidate = forced ? `${forced}${forced.indexOf('?') === -1 ? '?' : '&'}cb=${cb}` : `/badges/achievement/${slug}.svg?cb=${cb}`;
                                const desc = BADGE_DESCRIPTIONS && BADGE_DESCRIPTIONS[name] ? BADGE_DESCRIPTIONS[name] : '';
                                return (
                                    <div key={slug} className="p-3 rounded-md border border-gray-100 bg-white text-center">
                                        <div className="flex items-center justify-center mb-3">
                                            <div className="w-16 h-16 rounded-full overflow-hidden relative mx-auto">
                                                <img src={candidate} alt={name} className="w-full h-full object-cover" onError={(e)=>{e.currentTarget.onerror=null; e.currentTarget.src='/badges/default.svg'}} />
                                            </div>
                                        </div>
                                        <div className="text-sm font-semibold text-gray-800">{name}</div>
                                        <div className="text-xs text-gray-500 mt-1">{desc}</div>
                                    </div>
                                );
                            });
                        })()}
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
                        // Helper to format year and optional week
                        const yearLabel = (b) => {
                            if (!b) return '';
                            const y = b.year ? String(b.year) : '';
                            const wk = b.metadata && (b.metadata.week || b.metadata.week === 0) ? b.metadata.week : (b.week || null);
                            return wk ? `${y} W${wk}` : y;
                        };

                        filtered.forEach(b => {
                            const key = b.displayName || b.name || b.id;
                            grouped[key] = grouped[key] || { badge: b, years: [], count: 0 };
                            grouped[key].count += 1;
                            const label = yearLabel(b);
                            if (label) grouped[key].years.push(label);
                        });

                        return (
                            <>
                                <SectionHeader title={title} />
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                                    {Object.keys(grouped).map(k => {
                                        const g = grouped[k];
                                        // Attach a description for tooltip if available
                                        if (!g.badge.description) g.badge.description = BADGE_DESCRIPTIONS[g.badge.displayName] || g.badge.metadata?.description || g.badge.displayName;
                                        // Pass aggregated years (with week if present) and count into BadgeCard
                                        return <BadgeCard key={k} badge={g.badge} count={g.count} years={Array.from(new Set(g.years))} />;
                                    })}
                                </div>
                            </>
                        );
                    };

                    // Descriptions moved to module-level BADGE_DESCRIPTIONS

                    // Define sets for each section using the labels you provided
                    const makeSet = arr => new Set((arr || []).map(s => normalize(s)));
                    const trophyRoom = makeSet(['Playoff 1st','Champion','Playoff 2nd','Runner Up','Playoff 3rd','3rd Place','Points 1st','Top Scoring','Points 2nd','2nd Scoring','Points 3rd','3rd Scoring']);
                    const championBadges = makeSet(['Season Title','Points Title','Season All-Play Title','Triple Crown','Champion','Heavyweight Champion','Comeback Kid','Against All Odds','Draft King','Silverback-To-Back','Lucky Duck']);
                    // Place Action King in the Season Badges group so it shows under season achievements with champion outline
                    const seasonBadges = makeSet(['Bronze Season','Silver Season','Gold Season','Diamond Season','The Gauntlet','Season Top-Half Scoring - 75%','Lucky Duck','Action King']);
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
                        // Helper to format year and optional week (reuse existing helper if defined)
                        const yearLabel = (b) => {
                            if (!b) return '';
                            const y = b.year ? String(b.year) : '';
                            const wk = b.metadata && (b.metadata.week || b.metadata.week === 0) ? b.metadata.week : (b.week || null);
                            return wk ? `${y} W${wk}` : y;
                        };

                        filtered.forEach(b => {
                            const key = b.displayName || b.name || b.id;
                            grouped[key] = grouped[key] || { badge: b, years: [], count: 0 };
                            grouped[key].count += 1;
                            const label = yearLabel(b);
                            if (label) grouped[key].years.push(label);
                        });

                        renderedSections.push(
                            <React.Fragment key={sec.title}>
                                <SectionHeader title={sec.title} />
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                                    {Object.keys(grouped).map(k => {
                                        const g = grouped[k];
                                        if (!g.badge.description) g.badge.description = BADGE_DESCRIPTIONS[g.badge.displayName] || g.badge.metadata?.description || g.badge.displayName;
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
                        // Helper to format year and optional week (reuse existing helper)
                        const yearLabel = (b) => {
                            if (!b) return '';
                            const y = b.year ? String(b.year) : '';
                            const wk = b.metadata && (b.metadata.week || b.metadata.week === 0) ? b.metadata.week : (b.week || null);
                            return wk ? `${y} W${wk}` : y;
                        };

                        remaining.forEach(b => {
                            const key = b.displayName || b.name || b.id;
                            grouped[key] = grouped[key] || { badge: b, years: [], count: 0 };
                            grouped[key].count += 1;
                            const label = yearLabel(b);
                            if (label) grouped[key].years.push(label);
                        });
                        renderedSections.push(
                            <React.Fragment key="other">
                                <SectionHeader title="Other Badges" />
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                                    {Object.keys(grouped).map(k => {
                                        const g = grouped[k];
                                        if (!g.badge.description) g.badge.description = BADGE_DESCRIPTIONS[g.badge.displayName] || g.badge.metadata?.description || g.badge.displayName;
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
