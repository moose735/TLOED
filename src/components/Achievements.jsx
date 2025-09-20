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
// Accent used for league-level badges (outer ring requested: #50C878)
ACCENT_MAP.leagueAccent = { bg: '#f2fff7', border: '#50C878', icon: '#10784f' };

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
// For blunder-style matchup badges use the blunders matchup icon provided by the user
const MATCHUP_ICON = '/badges/achievement/matchup-icon.svg';
const BLUNDER_MATCHUP_ICON = '/badges/blunders/matchup-icon.svg';

[
    'peak-performance','peak-performance.svg','the-shootout','shootout','massacre','massacre.svg',
    'firing-squad','firing-squad.svg','a-small-victory','a-small-victory.svg','a-micro-victory','a-nano-victory',
    'micro-victory','small-victory','nano-victory','double-up','double-up.svg','bully','thread-the-needle','thread-the-needle.svg'
].forEach(k => { FORCED_BADGE_MAP[k] = MATCHUP_ICON; });

// Map blunder matchup names/aliases to the blunder matchup icon so they show the provided asset
[
 'the-snoozer','the-snoozer.svg','the_snoozer','snoozer','snoozer.svg',
 'the-undercard','the-undercard.svg','the_undercard','undercard','undercard.svg',
 'a-small-defeat','a-small-defeat.svg','a_small_defeat','a small defeat','small-defeat','small_defeat',
 'doubled-up','doubled-up.svg','doubled_up','doubled up','doubledup',
 'spoiled-goods','spoiled-goods.svg','spoiled_goods','spoiled goods','spoiledgoods',
 'bullied','bullied.svg','bye-week','bye-week.svg','bye_week','the-bye-week','the-bye-week.svg'
].forEach(k => { FORCED_BADGE_MAP[k] = BLUNDER_MATCHUP_ICON; });

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

// League badge assets
FORCED_BADGE_MAP['veteran-presence'] = '/badges/achievement/veteran-presence.svg';
FORCED_BADGE_MAP['veteran-presence.svg'] = '/badges/achievement/veteran-presence.svg';
FORCED_BADGE_MAP['veteran_presence'] = '/badges/achievement/veteran-presence.svg';

FORCED_BADGE_MAP['old-timer'] = '/badges/achievement/old-timer.svg';
FORCED_BADGE_MAP['old-timer.svg'] = '/badges/achievement/old-timer.svg';
FORCED_BADGE_MAP['old_timer'] = '/badges/achievement/old-timer.svg';

// Career win flag (used for Total Wins badges every 25 wins)
FORCED_BADGE_MAP['career-win-flag'] = '/badges/achievement/career-win-flag.svg';
FORCED_BADGE_MAP['career-win-flag.svg'] = '/badges/achievement/career-win-flag.svg';
FORCED_BADGE_MAP['career_win_flag'] = '/badges/achievement/career-win-flag.svg';
FORCED_BADGE_MAP['total-wins'] = '/badges/achievement/career-win-flag.svg';

// Best and Worst pick assets
FORCED_BADGE_MAP['best-draft-pick'] = '/badges/achievement/best-pick-smiley.svg';
FORCED_BADGE_MAP['best_draft_pick'] = '/badges/achievement/best-pick-smiley.svg';
FORCED_BADGE_MAP['best-draft-pick.svg'] = '/badges/achievement/best-pick-smiley.svg';

FORCED_BADGE_MAP['worst-draft-pick'] = '/badges/blunders/worst-pick-yuck.svg';
FORCED_BADGE_MAP['worst_draft_pick'] = '/badges/blunders/worst-pick-yuck.svg';
FORCED_BADGE_MAP['worst-draft-pick.svg'] = '/badges/blunders/worst-pick-yuck.svg';

// Broke Ass blunder asset (placeholder) — create or replace with preferred SVG in public/badges/blunders/
FORCED_BADGE_MAP['broke-ass'] = '/badges/blunders/broke-ass.svg';
FORCED_BADGE_MAP['broke-ass.svg'] = '/badges/blunders/broke-ass.svg';
FORCED_BADGE_MAP['broke_ass'] = '/badges/blunders/broke-ass.svg';

// Champion drought blunder assets (single SVG reused for progressive 5-year badges)
FORCED_BADGE_MAP['champ-drought'] = '/badges/blunders/champ-drought.svg';
FORCED_BADGE_MAP['champ-drought.svg'] = '/badges/blunders/champ-drought.svg';
FORCED_BADGE_MAP['champion-drought'] = '/badges/blunders/champ-drought.svg';
FORCED_BADGE_MAP['champion-drought.svg'] = '/badges/blunders/champ-drought.svg';
// progressive 5-year variants (map all to the same asset for now)
['5','10','15','20','25','30','35','40','45','50'].forEach(n => {
    FORCED_BADGE_MAP[`champion-drought-${n}`] = '/badges/blunders/champ-drought.svg';
    FORCED_BADGE_MAP[`champion-drought-${n}.svg`] = '/badges/blunders/champ-drought.svg';
    FORCED_BADGE_MAP[`champ-drought-${n}`] = '/badges/blunders/champ-drought.svg';
    FORCED_BADGE_MAP[`champ-drought_${n}`] = '/badges/blunders/champ-drought.svg';
});

    // Season blunder assets: iron, wood, clay, cursed (user-added SVGs)
    FORCED_BADGE_MAP['iron-season'] = '/badges/blunders/iron-season.svg';
    FORCED_BADGE_MAP['iron-season.svg'] = '/badges/blunders/iron-season.svg';
    FORCED_BADGE_MAP['iron_season'] = '/badges/blunders/iron-season.svg';
    FORCED_BADGE_MAP['iron'] = '/badges/blunders/iron-season.svg';
    FORCED_BADGE_MAP['iron.svg'] = '/badges/blunders/iron-season.svg';
    FORCED_BADGE_MAP['iron_season.svg'] = '/badges/blunders/iron-season.svg';

    FORCED_BADGE_MAP['wood-season'] = '/badges/blunders/wood-season.svg';
    FORCED_BADGE_MAP['wood-season.svg'] = '/badges/blunders/wood-season.svg';
    FORCED_BADGE_MAP['wood_season'] = '/badges/blunders/wood-season.svg';
    FORCED_BADGE_MAP['wood'] = '/badges/blunders/wood-season.svg';
    FORCED_BADGE_MAP['wood.svg'] = '/badges/blunders/wood-season.svg';
    FORCED_BADGE_MAP['wood_season.svg'] = '/badges/blunders/wood-season.svg';

    FORCED_BADGE_MAP['clay-season'] = '/badges/blunders/clay-season.svg';
    FORCED_BADGE_MAP['clay-season.svg'] = '/badges/blunders/clay-season.svg';
    FORCED_BADGE_MAP['clay_season'] = '/badges/blunders/clay-season.svg';
    FORCED_BADGE_MAP['clay'] = '/badges/blunders/clay-season.svg';
    FORCED_BADGE_MAP['clay.svg'] = '/badges/blunders/clay-season.svg';
    FORCED_BADGE_MAP['clay_season.svg'] = '/badges/blunders/clay-season.svg';

    FORCED_BADGE_MAP['cursed-season'] = '/badges/blunders/cursed-season.svg';
    FORCED_BADGE_MAP['cursed-season.svg'] = '/badges/blunders/cursed-season.svg';
    FORCED_BADGE_MAP['cursed_season'] = '/badges/blunders/cursed-season.svg';
    FORCED_BADGE_MAP['cursed'] = '/badges/blunders/cursed-season.svg';
    FORCED_BADGE_MAP['cursed.svg'] = '/badges/blunders/cursed-season.svg';
    FORCED_BADGE_MAP['least-luck'] = '/badges/blunders/cursed-season.svg';
    FORCED_BADGE_MAP['least-luck.svg'] = '/badges/blunders/cursed-season.svg';
    FORCED_BADGE_MAP['least_luck'] = '/badges/blunders/cursed-season.svg';

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
    'The Undercard': 'Lowest points share in a matchup for the season (undercard performance).',
    'Doubled Up': 'Suffered repeated losses that compound into a blunder.',
    'True Lowlight': 'A painfully bad highlight that stands out in league history.',
    'Spoiled Goods': 'Drafted players who severely underperformed relative to expectations.',
    'Bullied': 'Consistently got beaten by other teams in the league.',
    'The Madman': 'Made an unorthodox series of moves that backfired spectacularly.',
    // New losing-side blunders
    'A Small Defeat': 'Lost a matchup by 1.00 - 2.00 points.',
    'A Nano Defeat': 'Lost a matchup by 0.50 - 0.99 points.',
    'A Micro Defeat': 'Lost a matchup by 0.01 - 0.49 points.'
};

    // Forced assets for new blunder names (map to the matchup blunder icon for now)
    FORCED_BADGE_MAP['a-small-defeat'] = BLUNDER_MATCHUP_ICON;
    FORCED_BADGE_MAP['a-small-defeat.svg'] = BLUNDER_MATCHUP_ICON;
    FORCED_BADGE_MAP['a_small_defeat'] = BLUNDER_MATCHUP_ICON;

    FORCED_BADGE_MAP['a-nano-defeat'] = BLUNDER_MATCHUP_ICON;
    FORCED_BADGE_MAP['a-nano-defeat.svg'] = BLUNDER_MATCHUP_ICON;
    FORCED_BADGE_MAP['a_nano_defeat'] = BLUNDER_MATCHUP_ICON;

    FORCED_BADGE_MAP['a-micro-defeat'] = BLUNDER_MATCHUP_ICON;
    FORCED_BADGE_MAP['a-micro-defeat.svg'] = BLUNDER_MATCHUP_ICON;
    FORCED_BADGE_MAP['a_micro_defeat'] = BLUNDER_MATCHUP_ICON;

// Transaction blunder: Broke Ass
BADGE_DESCRIPTIONS['Broke Ass'] = 'Team that paid the most in transaction fees in a season.';

// Add descriptions for new league badges
BADGE_DESCRIPTIONS['Veteran Presence'] = 'Recognition for reaching five seasons of tenure with the league.';
BADGE_DESCRIPTIONS['Old Timer'] = 'Recognition for reaching ten seasons of tenure with the league.';
BADGE_DESCRIPTIONS['Total Wins - 25'] = 'Career milestone for accumulating 25 total wins.';
BADGE_DESCRIPTIONS['Total Wins - 50'] = 'Career milestone for accumulating 50 total wins.';

// Champion drought blunders (progressive every 5 years)
BADGE_DESCRIPTIONS['Champion Drought - 5'] = 'Recognizes a team that has not won the championship for five consecutive seasons.';
BADGE_DESCRIPTIONS['Champion Drought - 10'] = 'Recognizes a team that has not won the championship for ten consecutive seasons.';
BADGE_DESCRIPTIONS['Champion Drought - 15'] = 'Recognizes a team that has not won the championship for fifteen consecutive seasons.';
BADGE_DESCRIPTIONS['Champion Drought - 20'] = 'Recognizes a team that has not won the championship for twenty consecutive seasons.';
BADGE_DESCRIPTIONS['Champion Drought - 25'] = 'Recognizes a team that has not won the championship for twenty-five consecutive seasons.';

// Season badge DPR buckets
BADGE_DESCRIPTIONS['Iron Season'] = 'Season DPR between 0.925 and 0.999 (very low variance / iron season).';
BADGE_DESCRIPTIONS['Wood Season'] = 'Season DPR between 0.850 and 0.924 (low performance tier).';
BADGE_DESCRIPTIONS['Clay Season'] = 'Season DPR below 0.849 (bottom-tier performance).';
BADGE_DESCRIPTIONS['Cursed'] = 'Awarded to the team with the least luck in a season (lowest luck rating).';

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
    let forcedSrc = FORCED_BADGE_MAP[forcedSlug] || null;
    // Prefer the career win flag asset for any Total Wins milestone badges
    try {
        const dn = String(badge.displayName || badge.name || badge.id || '').toLowerCase();
        if (!forcedSrc && (dn.indexOf('total wins') !== -1 || /^total_wins_/.test(String(badge.id || '')))) {
            forcedSrc = FORCED_BADGE_MAP['career-win-flag'] || FORCED_BADGE_MAP['total-wins'] || null;
        }
    } catch (err) { /* ignore */ }
    // busted version to avoid stale/invalid cached responses; compute once per badge
    const forcedSrcBusted = React.useMemo(() => (forcedSrc ? `${forcedSrc}${forcedSrc.indexOf('?') === -1 ? '?' : '&'}cb=${Date.now()}` : null), [forcedSrc, badge.id, badge.displayName]);

    // Debug flag (url param ?badgeDebug=1) — we both log to console and optionally render a visual overlay
    let debugOn = false;
    try {
        const search = typeof window !== 'undefined' && window.location && window.location.search;
        debugOn = !!(search && search.indexOf('badgeDebug=1') !== -1);
        if (debugOn) console.debug('Badge candidateSources for', badge.displayName || badge.id, candidateSources);
    } catch (err) { }

    // Responsive badge size: larger on mobile, scale up on larger screens
    const badgeSize = typeof window !== 'undefined' && window.innerWidth < 500 ? 96 : 80;
    const circleStyle = { backgroundColor: a.bg, border: `4px solid ${a.border}`, color: a.icon, width: badgeSize, height: badgeSize };
    // imageContainerStyle used when rendering an image so the image fills the circle
    // We use an absolutely-positioned overlay for the border so it sits _on top_
    // of the image (prevents anti-aliased transparent gap between svg and border).
    const imageContainerStyle = { backgroundColor: 'transparent', width: badgeSize, height: badgeSize, position: 'relative' };

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
            <div
                className="relative flex flex-col items-center text-center p-2"
                style={{ minWidth: badgeSize + 16, maxWidth: 160 }}
            >
                {count > 1 && (
                    <div className="absolute -top-1 -right-1 px-2 py-0.5 bg-gray-800 text-white text-xs rounded">x{count}</div>
                )}
                {/* If an image asset is available, render it directly (no circle/bg). Otherwise render circular badge */}
                {currentSrc ? (
                    <div style={imageContainerStyle} className={`rounded-full overflow-hidden`}>
                        <img
                            src={currentSrc}
                            alt={title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onLoad={(e) => { try { console.debug('Badge image loaded:', currentSrc); } catch (err) {} }}
                            onError={(e) => { e.target.onerror = null; handleImgError(currentSrc); }}
                        />
                        <div style={{ position: 'absolute', inset: 0, borderRadius: '9999px', border: `4px solid ${a.border}`, boxSizing: 'border-box', pointerEvents: 'none' }} />
                    </div>
                ) : (
                    <div style={circleStyle} className={`rounded-full flex items-center justify-center`}>
                        <div style={{ color: a.icon, fontSize: badgeSize * 0.35 }}>{(badge.icon && !badge.icon.startsWith('/')) ? badge.icon : '🏆'}</div>
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
                <div className="mt-2 text-base font-semibold text-gray-800" style={{ fontSize: badgeSize < 90 ? 14 : 16 }}>{title}</div>
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
    const [teamTab, setTeamTab] = useState('achievements'); // 'achievements' | 'blunders'
    // Sorting state for the member totals table (hooks must be at top level)
    const [sortBy, setSortBy] = useState({ key: 'totalBadges', dir: 'desc' });
    const toggleSort = (key) => {
        setSortBy(s => {
            if (s.key === key) return { key, dir: s.dir === 'asc' ? 'desc' : 'asc' };
            // default direction: blunder columns sort ascending by default (less is better)
            const defaultDir = String(key).startsWith('blunders') ? 'asc' : 'desc';
            return { key, dir: defaultDir };
        });
    };

    // simple hex lerp helper (linear interpolation)
    const lerpHex = (a, b, t) => {
        const pa = parseInt(a.replace('#',''),16);
        const pb = parseInt(b.replace('#',''),16);
        const ra = (pa >> 16) & 0xff; const ga = (pa >> 8) & 0xff; const ba = pa & 0xff;
        const rb = (pb >> 16) & 0xff; const gb = (pb >> 8) & 0xff; const bb = pb & 0xff;
        const rc = Math.round(ra + (rb - ra) * t);
        const gc = Math.round(ga + (gb - ga) * t);
        const bc = Math.round(ba + (bb - ba) * t);
        const hex = (rc << 16) + (gc << 8) + bc;
        return `#${hex.toString(16).padStart(6,'0')}`;
    };

    const GREEN_MIN = '#dff6e9'; const GREEN_MAX = '#059669';
    const RED_MIN = '#ffecec'; const RED_MAX = '#b91c1c';
    const BLUE_MIN = '#eaf2ff'; const BLUE_MAX = '#2563eb';

    const sortedRowsForRender = (rows) => {
        const copy = Array.from(rows);
        copy.sort((x,y) => {
            const a = x[sortBy.key] || 0;
            const b = y[sortBy.key] || 0;
            if (a === b) return 0;
            return (sortBy.dir === 'asc') ? (a - b) : (b - a);
        });
        return copy;
    };

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
        const seen = new Set();
        // prefer usersData ordering for active teams
        if (usersData && Array.isArray(usersData)) {
            usersData.forEach(u => {
                const key = String(u.user_id);
                seen.add(key);
                const label = u.metadata?.team_name || u.display_name || `User ${u.user_id}`;
                opts.push({ key, label });
            });
        }

        // include any owners present in badgesByTeam that aren't in usersData
        try {
            const badgeOwners = Object.keys(badgesByTeam || {});
            badgeOwners.forEach(ownerId => {
                const key = String(ownerId);
                if (seen.has(key)) return;
                // try to resolve a friendly name from badge metadata or team details
                let label = (getTeamDetails && getTeamDetails(key) && getTeamDetails(key).name) || null;
                if (!label && usersData && Array.isArray(usersData)) {
                    const u = usersData.find(x => String(x.user_id) === key);
                    if (u) label = u.metadata?.team_name || u.display_name;
                }
                if (!label) {
                    const badges = (badgesByTeam && badgesByTeam[key]) || [];
                    for (let i = 0; i < badges.length && !label; i++) {
                        const b = badges[i];
                        if (b && b.metadata) {
                            label = b.metadata.picked_by_team_name || b.metadata.picked_by_team || b.metadata.teamName || null;
                        }
                    }
                }
                if (!label) label = `Team ${key}`;
                seen.add(key);
                opts.push({ key, label });
            });
        } catch (e) { /* ignore */ }

        return opts;
    }, [historicalData, usersData]);

    const handleTeamChange = (e) => {
        setSelectedTeam(e.target.value);
    };

    // Debug: show raw badge metadata for selected team
    const [showRawBadges, setShowRawBadges] = useState(false);

    // Resolve an ownerId to a friendly team name using getTeamDetails, usersData, badge metadata, or fallback
    const resolveOwnerName = (ownerId) => {
        const id = String(ownerId || '');
        try {
            if (getTeamDetails) {
                const d = getTeamDetails(id);
                if (d && d.name) return d.name;
            }
        } catch (e) {}
        try {
            if (usersData && Array.isArray(usersData)) {
                const u = usersData.find(x => String(x.user_id) === id);
                if (u) return u.metadata?.team_name || u.display_name || `User ${id}`;
            }
        } catch (e) {}
        try {
            const badges = (badgesByTeam && badgesByTeam[id]) || [];
            for (let i = 0; i < badges.length; i++) {
                const b = badges[i];
                if (b && b.metadata) {
                    if (b.metadata.picked_by_team_name) return b.metadata.picked_by_team_name;
                    if (b.metadata.picked_by_team) return b.metadata.picked_by_team;
                    if (b.metadata.teamName) return b.metadata.teamName;
                }
            }
        } catch (e) {}
        return `Team ${id}`;
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
                        <div className="text-lg font-semibold text-gray-800">{resolveOwnerName(selectedTeam)}</div>
                        {(() => {
                            const badges = (badgesByTeam && badgesByTeam[selectedTeam]) || [];
                            const achievements = badges.filter(b => b.category !== 'blunder').length;
                            const blunders = badges.filter(b => b.category === 'blunder').length;
                            return <div className="text-sm text-gray-500">Badge Count: {achievements} • Blunders: {blunders}</div>;
                        })()}
                    </div>
                    <div className="ml-auto text-sm">
                        <label className="inline-flex items-center gap-2 text-gray-600">
                            <input type="checkbox" className="form-checkbox" checked={showRawBadges} onChange={(e) => setShowRawBadges(e.target.checked)} />
                            <span>Show raw badges</span>
                        </label>
                    </div>
                </div>
            )}

            {showRawBadges && selectedTeam && selectedTeam !== 'overview' && (
                <div className="mb-4 p-3 bg-white border rounded text-xs text-gray-700 max-h-64 overflow-auto">
                    <div className="font-semibold mb-2">Raw badges for {resolveOwnerName(selectedTeam)}</div>
                    <pre className="whitespace-pre-wrap">{JSON.stringify((badgesByTeam && badgesByTeam[selectedTeam]) || [], null, 2)}</pre>
                </div>
            )}

            {/* Team-specific aggregated sections are rendered below; remove raw 'Team Badges' block to avoid duplication */}

            {/* Overview Heatmap and Recent Badges */}
            {selectedTeam === 'overview' && (
                <>
                    {/* currentSeasonHasChampion is computed at component scope */}
                    <SectionHeader title="MEMBER BADGE TOTALS" />
                    <div className="mb-6 overflow-x-auto">
                        {(() => {
                            const teamIds = Object.keys(badgesByTeam || {});
                            if (teamIds.length === 0) return <div className="text-sm text-gray-500">No team badge data available for overview.</div>;

                            // Compute unique (distinct displayName) and total counts per category
                            const rows = teamIds.map(id => {
                                const badges = badgesByTeam[id] || [];
                                const achievementsBadges = badges.filter(b => b.category !== 'blunder');
                                const blunderBadges = badges.filter(b => b.category === 'blunder');

                                const uniqueAchievements = new Set(achievementsBadges.map(b => (b.displayName || b.name || b.id)));
                                const uniqueBlunders = new Set(blunderBadges.map(b => (b.displayName || b.name || b.id)));

                                const name = resolveOwnerName(id);
                                return {
                                    ownerId: id,
                                    name,
                                    achievementsUnique: uniqueAchievements.size,
                                    achievementsTotal: achievementsBadges.length,
                                    blundersUnique: uniqueBlunders.size,
                                    blundersTotal: blunderBadges.length,
                                    totalUnique: uniqueAchievements.size + uniqueBlunders.size,
                                    totalBadges: badges.length
                                };
                            });

                            // Find maxima for proportional bars
                            const maxAchievementsUnique = Math.max(...rows.map(r => r.achievementsUnique), 1);
                            const maxAchievementsTotal = Math.max(...rows.map(r => r.achievementsTotal), 1);
                            const maxBlundersUnique = Math.max(...rows.map(r => r.blundersUnique), 1);
                            const maxBlundersTotal = Math.max(...rows.map(r => r.blundersTotal), 1);
                            const maxTotalBadges = Math.max(...rows.map(r => r.totalBadges), 1);

                            // Table header + rows
                            return (
                                <table className="w-full table-auto border-collapse bg-white rounded-md overflow-hidden">
                                    <thead>
                                        <tr className="bg-gray-800 text-white text-sm">
                                            <th className="text-left px-4 py-3">MEMBER</th>
                                            <th className="text-center px-4 py-3 cursor-pointer" onClick={() => toggleSort('achievementsUnique')}>
                                                ACHIEVEMENTS {sortBy.key === 'achievementsUnique' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                                            </th>
                                            <th className="text-center px-4 py-3 cursor-pointer" onClick={() => toggleSort('achievementsTotal')}># {sortBy.key === 'achievementsTotal' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th className="text-center px-4 py-3 cursor-pointer" onClick={() => toggleSort('blundersUnique')}>BLUNDERS {sortBy.key === 'blundersUnique' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th className="text-center px-4 py-3 cursor-pointer" onClick={() => toggleSort('blundersTotal')}># {sortBy.key === 'blundersTotal' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th className="text-center px-4 py-3 cursor-pointer" onClick={() => toggleSort('totalUnique')}>TOTAL BADGES {sortBy.key === 'totalUnique' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th className="text-center px-4 py-3 cursor-pointer" onClick={() => toggleSort('totalBadges')}># {sortBy.key === 'totalBadges' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedRowsForRender(rows).map(r => {
                                            const achUniquePct = (r.achievementsUnique / maxAchievementsUnique) || 0;
                                            const blUniquePct = (r.blundersUnique / maxBlundersUnique) || 0;
                                            const totalUniquePct = (r.totalUnique / Math.max(...rows.map(x=>x.totalUnique),1)) || 0;

                                            const achColor = lerpHex(GREEN_MIN, GREEN_MAX, achUniquePct);
                                            const blColor = lerpHex(RED_MIN, RED_MAX, blUniquePct);
                                            const totalColor = lerpHex(BLUE_MIN, BLUE_MAX, totalUniquePct);

                                            const achBarPct = Math.round(achUniquePct * 100);
                                            const blBarPct = Math.round(blUniquePct * 100);
                                            const totalBarPct = Math.round(totalUniquePct * 100);

                                            return (
                                                <tr key={r.ownerId} className="border-t">
                                                    <td className="px-4 py-3 flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                                                            <img src={getTeamDetails ? getTeamDetails(r.ownerId)?.avatar : ''} alt="avatar" className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="text-sm font-medium truncate">{r.name}</div>
                                                    </td>
                                                    <td className="px-2 py-3 align-middle">
                                                        <div className="relative w-full h-8 bg-green-50 rounded-md overflow-hidden flex items-center">
                                                                <div
                                                                    className={`h-full ${achBarPct === 100 ? 'rounded-md' : 'rounded-l-md'} bg-gradient-to-r from-green-400 to-green-600 flex items-center`}
                                                                    style={{ width: `${achBarPct}%` }}
                                                                >
                                                                    {achBarPct >= 12 ? (
                                                                        <div className="ml-3 text-sm font-semibold text-white">{r.achievementsUnique}</div>
                                                                    ) : null}
                                                                </div>
                                                                {achBarPct < 12 && (
                                                                    <div className="absolute left-2 text-sm font-semibold text-gray-800">{r.achievementsUnique}</div>
                                                                )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-sm font-semibold">{r.achievementsTotal}</td>
                                                    <td className="px-2 py-3 align-middle">
                                                        <div className="relative w-full h-8 bg-red-50 rounded-md overflow-hidden flex items-center">
                                                            <div
                                                                className={`h-full ${blBarPct === 100 ? 'rounded-md' : 'rounded-l-md'} bg-gradient-to-r from-red-400 to-red-600 flex items-center`}
                                                                style={{ width: `${blBarPct}%` }}
                                                            >
                                                                {blBarPct >= 12 ? (
                                                                    <div className="ml-3 text-sm font-semibold text-white">{r.blundersUnique}</div>
                                                                ) : null}
                                                            </div>
                                                            {blBarPct < 12 && (
                                                                <div className="absolute left-2 text-sm font-semibold text-gray-800">{r.blundersUnique}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-sm font-semibold">{r.blundersTotal}</td>
                                                    <td className="px-2 py-3 align-middle">
                                                        <div className="relative w-full h-8 bg-blue-50 rounded-md overflow-hidden flex items-center">
                                                            <div
                                                                className={`h-full ${totalBarPct === 100 ? 'rounded-md' : 'rounded-l-md'} bg-gradient-to-r from-blue-500 to-blue-600 flex items-center`}
                                                                style={{ width: `${totalBarPct}%` }}
                                                            >
                                                                {totalBarPct >= 12 ? (
                                                                    <div className="ml-3 text-sm font-semibold text-white">{r.totalUnique}</div>
                                                                ) : null}
                                                            </div>
                                                            {totalBarPct < 12 && (
                                                                <div className="absolute left-2 text-sm font-semibold text-gray-800">{r.totalUnique}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-sm font-semibold">{r.totalBadges}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            );
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

                    {/* Badge Catalog: grouped view with category headings */}
                    <SectionHeader title="Badge Catalog (icons & descriptions)" />
                    {(() => {
                        // Shared subcategories for both catalogs
                        const subcategories = [
                            { title: 'Champion Badges', key: 'champion', items: ['Season Title','Points Title','Season All-Play Title','Triple Crown','Champion','Runner Up','3rd Place','Heavyweight Champion','Comeback Kid','Against All Odds'] },
                            { title: 'Season Badges', key: 'season', items: ['Bronze Season','Silver Season','Gold Season','Diamond Season','The Gauntlet','Lucky Duck','Iron Season','Wood Season','Clay Season','Cursed'] },
                            { title: 'Matchup Badges', key: 'matchup', items: ['Peak Performance','The Shootout','Massacre','Firing Squad','A Small Victory','A Micro Victory','A Nano Victory','Double Up','Perfectly Peaked','Bully','Thread The Needle','The Snoozer','A Small Defeat','Bye Week','Bullied','Spoiled Goods'] },
                            { title: 'Draft Badges', key: 'draft', items: ['Draft King','Top Draft Pick','Top QB Draft','Top RB Draft','Top WR Draft','Top TE Draft','Top K Draft','Top DEF Draft'] },
                            { title: 'Transaction Badges', key: 'tx', items: ['Action King','Season Transactions'] },
                            { title: 'Roster Badges', key: 'roster', items: ['Top QB Roster','Top RB Roster','Top WR Roster','Top TE Roster','Top K Roster','Top DEF Roster'] },
                            { title: 'League Badges', key: 'league', items: ['Veteran Presence','Old Timer','Total Wins - 25','Total Wins - 50','All-Play Wins - 250','All-Play Wins - 500','Total Points - 10000'] }
                        ];

                        // Define blunder-only set once so Achievements catalog can exclude them
                        const blunderOnly = new Set(['Iron Season','Wood Season','Clay Season','Cursed','The Snoozer','A Small Defeat','Bye Week','Bullied','Spoiled Goods','Doubled Up','Champion Drought - 5','Champion Drought - 10','Champion Drought - 15','Champion Drought - 20','Champion Drought - 25','The Worst','Trash Trifecta','Flawless Garbage','The Cupcake','Season Worst Scores -5','True Lowlight','The Madman','Worst Draft Pick']);

                        // Helper to render a group grid given an items array
                        const renderGroupGrid = (groupTitle, items) => (
                            <React.Fragment key={groupTitle}>
                                <SectionHeader title={groupTitle} />
                                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
                                    {items.map(name => {
                                        const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                                        const isTotalWins = /^total-wins(-|\s)?/.test(slug) || String(name).toLowerCase().indexOf('total wins') !== -1;
                                        const forced = (isTotalWins ? FORCED_BADGE_MAP['career-win-flag'] : null) || FORCED_BADGE_MAP[slug] || FORCED_BADGE_MAP[slug + '.svg'] || null;
                                        const cb = Date.now();
                                        const candidate = forced ? `${forced}${forced.indexOf('?') === -1 ? '?' : '&'}cb=${cb}` : `/badges/achievement/${slug}.svg?cb=${cb}`;
                                        const desc = BADGE_DESCRIPTIONS && BADGE_DESCRIPTIONS[name] ? BADGE_DESCRIPTIONS[name] : '';
                                        // Find winners from badgesByTeam (team name + year). Limit to 5 for compactness.
                                        const normalizeForMatch = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
                                        const targetNorm = normalizeForMatch(name);
                                        const winners = [];
                                        try {
                                            Object.keys(badgesByTeam || {}).forEach(ownerId => {
                                                const bs = (badgesByTeam && badgesByTeam[ownerId]) || [];
                                                bs.forEach(b => {
                                                    const bn = normalizeForMatch(b.displayName || b.name || b.id);
                                                    if (bn === targetNorm) {
                                                        const label = resolveOwnerName(ownerId) || `Team ${ownerId}`;
                                                        const year = b.year ? ` ${b.year}` : '';
                                                        winners.push(`${label}${year}`);
                                                    }
                                                });
                                            });
                                        } catch (err) { /* ignore winner lookup errors */ }
                                        const uniqueWinners = Array.from(new Set(winners));
                                        const winnersPreview = uniqueWinners.length === 0 ? 'None' : (uniqueWinners.slice(0,5).join(', ') + (uniqueWinners.length > 5 ? ` (+${uniqueWinners.length - 5} more)` : ''));
                                        return (
                                            <div key={`${groupTitle}-${slug}`} className="p-3 rounded-md border border-gray-100 bg-white text-center">
                                                <div className="flex items-center justify-center mb-3">
                                                    <div className="w-16 h-16 rounded-full overflow-hidden relative mx-auto">
                                                        <img src={candidate} alt={name} className="w-full h-full object-cover" onError={(e)=>{e.currentTarget.onerror=null; e.currentTarget.src='/badges/default.svg'}} />
                                                    </div>
                                                </div>
                                                <div className="text-sm font-semibold text-gray-800">{name}</div>
                                                <div className="text-xs text-gray-500 mt-1">{desc}</div>
                                                <div className="text-xs text-gray-600 mt-2">Winners: {winnersPreview}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </React.Fragment>
                        );

                        // Render two catalogs side-by-side on wide screens, stacked on small screens
                        return (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                {/* Achievements catalog */}
                                <div>
                                    <SectionHeader title="Achievements Catalog" />
                                    {subcategories.map(sc => {
                                        const items = sc.items.filter(i => !blunderOnly.has(i));
                                        if (!items || items.length === 0) return null;
                                        return renderGroupGrid(sc.title, items);
                                    })}
                                </div>

                                {/* Blunders catalog uses same subcategories but often different subset of items (we include relevant blunder items) */}
                                <div>
                                    <SectionHeader title="Blunders Catalog" />
                                    {(() => {
                                            const blunderOnly = new Set(['Iron Season','Wood Season','Clay Season','Cursed','The Snoozer','A Small Defeat','Bye Week','Bullied','Spoiled Goods','Doubled Up','Champion Drought - 5','Champion Drought - 10','Champion Drought - 15','Champion Drought - 20','Champion Drought - 25','The Worst','Trash Trifecta','Flawless Garbage','The Cupcake','Season Worst Scores -5','True Lowlight','The Madman','Worst Draft Pick','Worst QB Draft','Worst RB Draft','Worst WR Draft','Worst TE Draft','Worst K Draft','Worst DEF Draft','Broke Ass']);

                                                            // For Blunders catalog, some subcategories (like Draft and Transactions)
                                                            // should show the 'Worst' variants or specific blunders which are
                                                            // not present in the achievements list.
                                                            const blunderAdditions = {
                                                                draft: ['Worst Draft Pick','Worst QB Draft','Worst RB Draft','Worst WR Draft','Worst TE Draft','Worst K Draft','Worst DEF Draft'],
                                                                tx: ['Broke Ass']
                                                            };

                                                            return subcategories.map(sc => {
                                                                // Include only those items in this subcategory which are known blunders
                                                                // plus any explicit additions for that subcategory
                                                                const base = sc.items.filter(i => blunderOnly.has(i));
                                                                const additions = blunderAdditions[sc.key] || [];
                                                                const items = Array.from(new Set([...base, ...additions]));
                                                                if (!items || items.length === 0) return null;
                                                                return renderGroupGrid(sc.title, items);
                                                            });
                                        })()}
                                </div>
                            </div>
                        );
                    })()}
                </>
            )}

            {/* Full badge catalog (display only badges the selected team has earned) */}
            {(selectedTeam !== 'overview' || showCatalog) && (
                (() => {
                    if (!selectedTeam || selectedTeam === 'overview') return null;
                    const allTeamBadges = (badgesByTeam && badgesByTeam[selectedTeam]) || [];

                    // We'll filter badges by tab after we build the blunder/achievement sets below.
                    // Use `let` so we can reassign `teamBadges` once the sets are available.
                    let teamBadges = allTeamBadges;

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
                                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
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
                    const leagueBadges = makeSet(['Veteran Presence','Old Timer','Total Wins - 25','Total Wins - 50','Total Wins - 75','Total Wins - 100','All-Play Wins - 250','All-Play Wins - 500','Total Points - 10000','All-Play Wins - 1000','Total Wins - 100']);
                    const blunderBadges = makeSet([
                        'The Worst','Trash Trifecta','Flawless Garbage',
                        'Champion Drought - 5','Champion Drought - 10','Champion Drought - 15','Champion Drought - 20','Champion Drought - 25','Champion Drought - 30','Champion Drought - 35','Champion Drought - 40','Champion Drought - 45','Champion Drought - 50',
                        'The Cupcake','Season Worst Scores -5','Iron Season','Wood Season','Clay Season','Cursed','Season Bottom-Half Scoring - 75%','Bye Week','Heartbreaker','The Snoozer','Doubled Up','True Lowlight','Spoiled Goods','Bullied','The Madman',
                        'Worst Draft Pick','Worst QB Draft','Worst RB Draft','Worst K Draft','Worst DL Draft','Worst DB Draft','Worst LB Draft','Worst WR Draft','Worst TE Draft',
                        'Worst QB Roster','Worst RB Roster','Worst WR Roster','Worst TE Roster','Worst K Roster','Worst DEF Roster','Worst DL Roster','Worst LB Roster','Worst DB Roster'
                    ]);
                    const leagueBlunders = makeSet([
                        'Total Losses - 25','Total Losses - 50','Total Losses - 100','All-Play Losses - 250','All-Play Losses - 500','All-Play Losses - 1000','Total Opponent Points - 10000',
                        'Champion Drought - 5','Champion Drought - 10','Champion Drought - 15','Champion Drought - 20','Champion Drought - 25'
                    ]);

                    // Tab controls
                    const TabControls = () => (
                        <div className="mb-4 flex items-center gap-2">
                            <button onClick={() => setTeamTab('achievements')} className={`${teamTab === 'achievements' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'} px-3 py-2 rounded-md text-sm`}>Achievements</button>
                            <button onClick={() => setTeamTab('blunders')} className={`${teamTab === 'blunders' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'} px-3 py-2 rounded-md text-sm`}>Blunders</button>
                        </div>
                    );
                    // Render tab controls (used above when there are no badges and below when rendering sections)
                    const tabControlsElement = <div className="mb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                            <button onClick={() => setTeamTab('achievements')} className={`${teamTab === 'achievements' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'} w-full sm:w-auto px-3 py-2 rounded-md text-sm mb-2 sm:mb-0`}>Achievements</button>
                            <button onClick={() => setTeamTab('blunders')} className={`${teamTab === 'blunders' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'} w-full sm:w-auto px-3 py-2 rounded-md text-sm`}>Blunders</button>
                        </div>
                    </div>;

                    // Render sections with precedence. For achievements we show the usual
                    // Trophy/Champion/Season/Matchup/Draft/Roster/League groups. For blunders
                    // we want the same high-level groupings but only include badge names
                    // that appear in the blunder set. We'll compute intersection sets and
                    // build the appropriate sections list depending on the active tab.
                    const intersectSets = (a, b) => new Set(Array.from(a).filter(x => b.has(x)));

                    const sectionsForAchievements = [
                        { title: 'Trophy Room', set: trophyRoom },
                        { title: 'Champion Badges', set: championBadges },
                        { title: 'Season Badges', set: seasonBadges },
                        { title: 'Matchup Badges', set: matchupBadges },
                        { title: 'Draft & Transaction Badges', set: draftTxBadges },
                        { title: 'Roster Badges', set: rosterBadges },
                        { title: 'League Badges', set: leagueBadges },
                    ];

                    // Build blunder-group sets by intersecting achievement groups with the blunder list
                    // Also explicitly include a few blunder names that should map to these groups
                    // even if they weren't listed in the original achievement group arrays.
                    const seasonExtras = ['Iron Season','Wood Season','Clay Season','Cursed'];
                    const seasonExtraNorm = new Set(seasonExtras.map(n => normalize(n)));
                    const seasonBlunderSet = new Set([
                        ...Array.from(intersectSets(seasonBadges, blunderBadges)),
                        ...Array.from(blunderBadges).filter(x => seasonExtraNorm.has(x))
                    ]);

                    const matchupBlunderSet = intersectSets(matchupBadges, blunderBadges);
                    const draftTxBlunderSet = intersectSets(draftTxBadges, blunderBadges);
                    const rosterBlunderSet = intersectSets(rosterBadges, blunderBadges);
                    const leagueBlunderSet = intersectSets(leagueBadges, blunderBadges);

                    // Champion droughts should be grouped with Champion Badges
                    const championDroughtNorm = Array.from(blunderBadges).filter(x => x.startsWith('champion drought'));
                    const championBlunderSet = new Set([
                        ...Array.from(intersectSets(championBadges, blunderBadges)),
                        ...championDroughtNorm
                    ]);

                    // Any remaining blunders that didn't match the above groups go into 'Other Blunders'
                    const groupedUnion = new Set([
                        ...seasonBlunderSet, ...matchupBlunderSet, ...draftTxBlunderSet, ...rosterBlunderSet, ...leagueBlunderSet, ...championBlunderSet
                    ]);
                    const otherBlunders = new Set(Array.from(blunderBadges).filter(x => !groupedUnion.has(x)));

                    const sectionsForBlunders = [
                        { title: 'Season Blunders', set: seasonBlunderSet },
                        { title: 'Champion Badges', set: championBlunderSet },
                        { title: 'Matchup Blunders', set: matchupBlunderSet },
                        { title: 'Draft & Transaction Blunders', set: draftTxBlunderSet },
                        { title: 'Roster Blunders', set: rosterBlunderSet },
                        { title: 'League Blunders', set: leagueBlunderSet },
                        { title: 'Other Blunders', set: otherBlunders },
                    ];

                    const sections = (teamTab === 'blunders') ? sectionsForBlunders : sectionsForAchievements;

                    let remaining = Array.from(teamBadges);

                    // Recompute `teamBadges` using the set-based definitions so badges that
                    // should be blunders (by name) are included even if their `category`
                    // in the source data isn't set to 'blunder'. This handles cases where
                    // incoming badge data mis-categorizes season blunders.
                    if (teamTab === 'achievements') {
                        teamBadges = allTeamBadges.filter(b => {
                            const isBlunderByCategory = String(b.category || '').toLowerCase() === 'blunder';
                            const isBlunderByName = blunderBadges.has(normalize(b.displayName));
                            return !isBlunderByCategory && !isBlunderByName;
                        });
                    } else if (teamTab === 'blunders') {
                        teamBadges = allTeamBadges.filter(b => {
                            const isBlunderByCategory = String(b.category || '').toLowerCase() === 'blunder';
                            const isBlunderByName = blunderBadges.has(normalize(b.displayName));
                            return isBlunderByCategory || isBlunderByName;
                        });
                    } else {
                        teamBadges = allTeamBadges;
                    }

                    // Update remaining pool after tab-filtering
                    remaining = Array.from(teamBadges);

                    // If there are no badges for the selected tab, render tabs and a message
                    if ((!allTeamBadges || allTeamBadges.length === 0) || (!teamBadges || teamBadges.length === 0)) {
                        return <>
                            {tabControlsElement}
                            <div className="text-sm text-gray-500">No badges found for this team in the selected tab.</div>
                        </>;
                    }

                    

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
                                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
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
                                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
                                    {Object.keys(grouped).map(k => {
                                        const g = grouped[k];
                                        if (!g.badge.description) g.badge.description = BADGE_DESCRIPTIONS[g.badge.displayName] || g.badge.metadata?.description || g.badge.displayName;
                                        return <BadgeCard key={k} badge={g.badge} count={g.count} years={Array.from(new Set(g.years))} />;
                                    })}
                                </div>
                            </React.Fragment>
                        );
                    }

                    return <>{tabControlsElement}{renderedSections}</>;
                })()
            )}
        </div>
    );
};

export default Achievements;
