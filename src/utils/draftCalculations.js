// src/utils/draftCalculations.js

/**
 * Enriches a single draft pick with additional display and calculation properties.
 */
export const enrichPickForCalculations = (pick, usersData, historicalData, selectedSeason, getTeamName) => {
    let playerName = pick.player_name || 'Unknown Player';
    if (pick.metadata?.position === 'DEF') {
        playerName = `${pick.metadata.first_name || ''} ${pick.metadata.last_name || ''}`.trim();
        if (!playerName) playerName = 'Unknown Defense';
    }

    const user = usersData.find(u => u.user_id === pick.picked_by);
    const roster = historicalData.rostersBySeason?.[selectedSeason]?.find(
        r => String(r.owner_id) === String(pick.picked_by)
    );

    return {
        ...pick,
        player_name: playerName,
        player_position: pick.player_position || '',
        player_team: pick.metadata?.team || pick.player_team || '',
        picked_by_display_name: user ? (user.display_name || 'Unknown User') : 'Unknown User',
        picked_by_team_name: roster
            ? (roster.metadata?.team_name || getTeamName(pick.picked_by, selectedSeason))
            : getTeamName(pick.picked_by, selectedSeason),
    };
};

/**
 * Returns the fantasy points for a player pick.
 * Used as input to VORP calculations.
 */
export const calculatePlayerValue = (enrichedPick) => {
    return typeof enrichedPick.fantasy_points === 'number' ? enrichedPick.fantasy_points : 0;
};

/**
 * Calculates a hypothetical value for a specific draft pick slot.
 */
export const calculatePickSlotValue = (pickNo, totalRounds, totalTeams) => {
    if (pickNo <= 0) return 0;
    const totalPicks = totalRounds * totalTeams;
    return (totalPicks - pickNo + 1) * 5;
};

/**
 * Builds an empirical expected-fantasy-points map from this league's own
 * historical draft data — one median value per pick slot across all past seasons.
 *
 * WHY EMPIRICAL INSTEAD OF A THEORETICAL CURVE:
 * ──────────────────────────────────────────────
 * Any hand-tuned curve (logarithmic, exponential, etc.) encodes assumptions
 * about a generic fantasy league. Your league has its own scoring format,
 * roster settings, and draft tendencies. Using the median actual production
 * for each pick slot from your own history as the baseline means:
 *
 *   • Round 1 picks are compared to what round-1 picks historically produced
 *     in THIS league — not some theoretical max.
 *   • Round 15 picks are compared to what round-15 picks historically produced.
 *     If most round-15 players score ~40 pts and a player scores 80, that is a
 *     clean positive regardless of any curve asymptote.
 *   • Average draft value across all rounds naturally centers near zero because
 *     the baseline IS the historical average. No more systematic early-round
 *     inflation or late-round deflation.
 *
 * FALLBACK:
 * ─────────
 * If there are fewer than MIN_SAMPLES historical picks at a slot (e.g. first
 * season ever, or keepers that removed a slot), we fall back to a smoothed
 * exponential curve so the slot still gets a reasonable baseline.
 *
 * KEEPER SLOT NOTE (2026+):
 * ─────────────────────────
 * Starting 2026, keepers occupy real pick slots at their assigned value.
 * Those picks are treated as scoreable (is_valued_keeper = true) and compared
 * against the empirical baseline for that slot, just like regular picks.
 *
 *   Season < 2026  → 0 valued keepers (legacy, excluded from scoring)
 *   Season = 2026  → 1 valued keeper per team
 *   Season = 2027  → 2 valued keepers per team
 *   Season >= 2028 → 3 valued keepers per team
 *
 * @param {number}   totalDraftPicks  - Total picks in the current draft
 * @param {object[]} allHistoricalPicks - Flat array of all past non-keeper picks,
 *                                        each with { pick_no, fantasy_points }
 * @returns {Map<number, number>}  pick_no → expected fantasy points
 */
// ── Shared helpers ────────────────────────────────────────────────────────────

const _median = (arr) => {
    if (!arr || !arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
};

// Position-specific fallback curves for when historical data is sparse.
// Each curve is an exponential decay calibrated to typical PPR season totals
// for that position. These are only used as a blend weight when N < MIN_SAMPLES.
const _fallbackByPos = {
    // QBs score 250-420 pts in PPR; drafted rounds 1-16, peak around 300
    QB:  (i) => Math.max(60,  380 * Math.exp(-0.020 * (i - 1))),
    // RBs: 80-300 pts, drafted throughout
    RB:  (i) => Math.max(30,  280 * Math.exp(-0.018 * (i - 1))),
    // WRs: similar to RBs
    WR:  (i) => Math.max(30,  260 * Math.exp(-0.018 * (i - 1))),
    // TEs: 60-250 pts, tight range
    TE:  (i) => Math.max(30,  230 * Math.exp(-0.020 * (i - 1))),
    // Kickers: 100-180 pts, much flatter curve
    K:   (i) => Math.max(80,  160 * Math.exp(-0.008 * (i - 1))),
    // DEF: 80-160 pts, flat
    DEF: (i) => Math.max(70,  150 * Math.exp(-0.007 * (i - 1))),
};
const _fallbackDefault = (i) => Math.max(35, 260 * Math.exp(-0.016 * (i - 1)));

/**
 * Builds an empirical expected-fantasy-points map keyed by POSITION and PICK SLOT.
 *
 * WHY POSITION-SPECIFIC:
 * ──────────────────────
 * QBs score 300-400 raw fantasy points per season; RBs/WRs score 100-250.
 * Mixing them in a single slot baseline means a late-round QB who scores 280pts
 * looks like +200 pts above a ~80pt mixed-position fallback — massively inflated.
 * By comparing each pick only to historical picks AT THAT POSITION AND SLOT,
 * a late-round QB is benchmarked against late-round QBs from past seasons.
 *
 * STRUCTURE:
 *   result = Map<position, Map<pick_no, expectedPts>>
 *   e.g.  result.get('QB').get(115)  → median QB points scored by the player
 *         taken at pick 115 across all historical seasons.
 *
 * FALLBACK:
 *   If fewer than MIN_SAMPLES historical picks exist for a (pos, slot) pair,
 *   we blend toward a position-specific exponential decay curve.
 *   If no historical picks at all for that position at any slot, use the
 *   position fallback curve directly.
 *
 * KEEPER NOTE (2026+): same as before — valued keepers use this baseline,
 * legacy keepers are excluded.
 *
 * @param {number}   totalDraftPicks
 * @param {object[]} allHistoricalPicks  – flat array of past non-keeper picks,
 *                                         each with { pick_no, fantasy_points, player_position }
 * @returns {Map<string, Map<number, number>>}
 */
export const generateExpectedByPositionAndSlot = (totalDraftPicks, allHistoricalPicks = []) => {
    const MIN_SAMPLES = 3;
    const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

    // Group historical fantasy_points by position → slot
    const pointsByPosSlot = {}; // pos → { slot: [fp, ...] }
    allHistoricalPicks.forEach(p => {
        if (!p || p.is_keeper || typeof p.fantasy_points !== 'number') return;
        const slot = Number(p.pick_no);
        if (slot <= 0 || slot > totalDraftPicks + 50) return; // allow slight overflow
        const pos = normalizePosition(p.player_position || p.metadata?.position || '');
        if (!pos || !POSITIONS.includes(pos)) return;
        if (!pointsByPosSlot[pos]) pointsByPosSlot[pos] = {};
        if (!pointsByPosSlot[pos][slot]) pointsByPosSlot[pos][slot] = [];
        pointsByPosSlot[pos][slot].push(p.fantasy_points);
    });

    const result = new Map(); // pos → Map<slot, expectedPts>

    POSITIONS.forEach(pos => {
        const slotMap = new Map();
        const fallback = _fallbackByPos[pos] || _fallbackDefault;
        const posData  = pointsByPosSlot[pos] || {};

        // We need expected values for every slot from 1..totalDraftPicks.
        // For slots where this position is rarely drafted (e.g. QB at pick 5),
        // the fallback handles it gracefully.
        for (let i = 1; i <= totalDraftPicks; i++) {
            const samples = posData[i] || [];
            if (samples.length >= MIN_SAMPLES) {
                slotMap.set(i, _median(samples));
            } else if (samples.length > 0) {
                const blend = samples.length / MIN_SAMPLES;
                slotMap.set(i, blend * _median(samples) + (1 - blend) * fallback(i));
            } else {
                slotMap.set(i, fallback(i));
            }
        }
        result.set(pos, slotMap);
    });

    return result;
};

/**
 * Backward-compat shim: returns a single flat Map<slot, expectedPts>
 * using the mixed-position empirical baseline (original behavior).
 * Still used by computeTeamScaledVorpByPosition and other callers
 * that haven't migrated to the position-specific version yet.
 */
export const generateExpectedVorpByPickSlot = (totalDraftPicks, allHistoricalPicks = []) => {
    const expectedVorpByPick = new Map();
    if (totalDraftPicks === 0) return expectedVorpByPick;
    const MIN_SAMPLES = 3;
    const pointsBySlot = {};
    (allHistoricalPicks || []).forEach(p => {
        if (!p || p.is_keeper || typeof p.fantasy_points !== 'number') return;
        const slot = Number(p.pick_no);
        if (slot > 0) {
            if (!pointsBySlot[slot]) pointsBySlot[slot] = [];
            pointsBySlot[slot].push(p.fantasy_points);
        }
    });
    for (let i = 1; i <= totalDraftPicks; i++) {
        const samples = pointsBySlot[i] || [];
        if (samples.length >= MIN_SAMPLES) {
            expectedVorpByPick.set(i, _median(samples));
        } else if (samples.length > 0) {
            const blend = samples.length / MIN_SAMPLES;
            expectedVorpByPick.set(i, blend * _median(samples) + (1 - blend) * _fallbackDefault(i));
        } else {
            expectedVorpByPick.set(i, _fallbackDefault(i));
        }
    }
    return expectedVorpByPick;
};

/**
 * Normalizes various position strings into canonical positions.
 */
export const normalizePosition = (raw) => {
    if (!raw && raw !== 0) return '';
    const s = String(raw || '').toUpperCase().trim();
    if (!s) return '';
    const map = {
        'DST': 'DEF', 'DEFENSE': 'DEF', 'D': 'DEF',
        'PK': 'K', 'P': 'K',
        'HB': 'RB', 'FB': 'RB',
        'WRR': 'WR'
    };
    if (map[s]) return map[s];
    if (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].indexOf(s) !== -1) return s;
    const prefix = s.replace(/[^A-Z]+/g, '').slice(0, 2);
    if (['QB', 'RB', 'WR', 'TE', 'DE', 'DT'].indexOf(prefix) !== -1) {
        if (['DE', 'DT'].includes(prefix)) return 'DEF';
        return prefix;
    }
    return s;
};

/**
 * VORP delta: how much the player outperformed (or underperformed) the expected
 * value for their draft slot.
 *
 * Positive = better than expected for that pick position.
 * Negative = worse than expected.
 */
export const calculateVORPDelta = (playerVORP, draftPickAssignedVORP) => {
    return playerVORP - draftPickAssignedVORP;
};

/**
 * Scales a raw value linearly into [minTarget, maxTarget].
 */
export const scaleVorpDelta = (rawValue, minRaw, maxRaw, minTarget, maxTarget) => {
    if (maxRaw === minRaw) return minTarget;
    return ((rawValue - minRaw) / (maxRaw - minRaw)) * (maxTarget - minTarget) + minTarget;
};

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT VALUE PIPELINE  (v3 — empirical pick-slot baseline)
//
// Score = (actual_fantasy_points − expected_fantasy_points_for_slot) / σ
//
// "expected" = median fantasy points scored by players at that pick slot
//              across all historical seasons in this league.
//
// σ = standard deviation of all residuals in the current draft, computed
//     from scoreable picks only (no keepers unless is_valued_keeper).
//
// Result interpretation:
//   +1.5 → this pick outperformed its slot by 1.5 standard deviations
//    0.0 → exactly what history says to expect from that slot
//   -1.5 → underperformed its slot by 1.5 standard deviations
//
// Because the baseline IS the historical average for each slot, round-level
// averages naturally hover near zero — early rounds are not systematically
// positive and late rounds are not systematically negative.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines how many keepers per team are "valued" (occupy a real draft slot)
 * for a given season.
 *
 *   season < 2026  → 0 (all keepers are legacy, excluded from scoring)
 *   season = 2026  → 1
 *   season = 2027  → 2
 *   season >= 2028 → 3
 *
 * @param {number} season
 * @returns {number}
 */
export const getValuedKeeperCountForSeason = (season) => {
    const s = Number(season);
    if (s < 2026) return 0;
    if (s === 2026) return 1;
    if (s === 2027) return 2;
    return 3; // 2028+
};

/**
 * Computes scaled_vorp_delta for every pick in processedPicks.
 *
 * KEEPER HANDLING:
 * ─────────────────
 * A pick is "scoreable" if:
 *   (a) it is NOT a keeper  (always scoreable), OR
 *   (b) it IS a keeper AND pick.is_valued_keeper === true
 *       (set by DraftAnalysis when the keeper occupies a real draft slot)
 *
 * Scoreable keepers are evaluated exactly like regular picks — they receive a
 * real vorp_delta against the expected curve for their pick slot and contribute
 * to the z-score mean/stddev baseline.
 *
 * Legacy keepers (is_keeper=true, is_valued_keeper falsy) are excluded from
 * scoring and receive scaled_vorp_delta = 0, same as before 2026.
 *
 * @param {object[]} processedPicks  - Enriched picks with .player_actual_vorp, .pick_no,
 *                                     .is_keeper, .is_valued_keeper (optional), .season
 * @param {Map}      expectedVORPMap - From generateExpectedVorpByPickSlot
 * @param {object}   positionWeights - Optional per-position multiplier overrides
 * @returns {object[]} picks with scaled_vorp_delta, vorp_delta, weighted_vorp_delta added
 */
/**
 * computeScaledVorpDeltas
 *
 * Accepts either:
 *   (a) expectedVORPMap as Map<string, Map<number, number>>  ← position-specific (new)
 *   (b) expectedVORPMap as Map<number, number>               ← flat/legacy (backward compat)
 *
 * When passed the position-specific map from generateExpectedByPositionAndSlot,
 * each pick's expected value is looked up by (position, slot) — so a QB at
 * pick 115 is compared to other QBs historically drafted at pick 115, not to
 * a mixed-position average. This eliminates the QB inflation problem.
 *
 * Scoring pipeline:
 *   1. residual = actual_fantasy_points − expected_for_(pos, slot)
 *   2. z-score residuals within each position group independently
 *      → a +1.5 QB and a +1.5 RB both mean "1.5 stddevs above average for
 *        that position at that slot", making them directly comparable
 *   3. No position weight multiplier needed — the position-specific baseline
 *      already accounts for scoring scale differences between positions.
 *      (weights kept as opt-in override for special cases)
 */
export const computeScaledVorpDeltas = (processedPicks, expectedVORPMap, positionWeights = {}) => {
    const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

    // Detect whether we received a position-specific map or a flat map
    // Position-specific: Map whose values are Maps (Map<pos, Map<slot, pts>>)
    const firstVal = expectedVORPMap instanceof Map ? expectedVORPMap.values().next().value : null;
    const isPosSpecific = firstVal instanceof Map;

    const isScoreable = (pick) => !pick.is_keeper || pick.is_valued_keeper === true;

    const getExpected = (pick) => {
        const slot = pick.pick_no;
        const pos  = normalizePosition(pick.player_position || pick.metadata?.position || '');
        if (isPosSpecific) {
            const posMap = expectedVORPMap.get(pos);
            if (posMap) return posMap.get(slot) ?? posMap.get(1) ?? 0;
            // Unknown position — fall back to flat average across positions
            let sum = 0, n = 0;
            expectedVORPMap.forEach(pm => { const v = pm.get(slot); if (v != null) { sum += v; n++; } });
            return n > 0 ? sum / n : 0;
        }
        // Flat map (backward compat)
        return expectedVORPMap.get(slot) ?? 0;
    };

    // Step 1: compute raw residual per scoreable pick
    const picksWithResidual = processedPicks.map(pick => {
        if (!isScoreable(pick)) {
            return { ...pick, vorp_delta: null, weighted_vorp_delta: null, scaled_vorp_delta: 0 };
        }
        const actualPts   = typeof pick.fantasy_points === 'number' ? pick.fantasy_points : 0;
        const expectedPts = getExpected(pick);
        const rawResidual = actualPts - expectedPts;
        const pos         = normalizePosition(pick.player_position || pick.metadata?.position || '');
        const weight      = positionWeights[pos] ?? 1.0; // default 1.0 — position baseline handles scale
        return {
            ...pick,
            draft_pick_assigned_vorp: expectedPts,
            player_actual_vorp:       actualPts,
            vorp_delta:               rawResidual,
            weighted_vorp_delta:      rawResidual * weight,
            _pos:                     pos, // internal, used for per-position z-score
        };
    });

    // Step 2: z-score WITHIN each position group independently
    // This means +1.5 for a QB = 1.5 stddevs above the QB average residual,
    // and +1.5 for an RB = 1.5 stddevs above the RB average residual.
    // The scores are now on the same scale and directly comparable.
    const statsByPos = {};
    POSITIONS.forEach(pos => {
        const vals = picksWithResidual
            .filter(p => isScoreable(p) && p._pos === pos && p.weighted_vorp_delta !== null)
            .map(p => p.weighted_vorp_delta);
        if (!vals.length) { statsByPos[pos] = { mean: 0, stddev: 1 }; return; }
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
        statsByPos[pos] = { mean, stddev: Math.sqrt(variance) || 1 };
    });

    // Step 3: apply per-position z-score; non-scoreable stay 0
    return picksWithResidual.map(pick => {
        if (!isScoreable(pick) || pick.weighted_vorp_delta === null) {
            const { _pos, ...rest } = pick;
            return { ...rest, scaled_vorp_delta: 0 };
        }
        const { _pos, ...rest } = pick;
        const { mean, stddev } = statsByPos[_pos] || { mean: 0, stddev: 1 };
        return { ...rest, scaled_vorp_delta: (pick.weighted_vorp_delta - mean) / stddev };
    });
};

/**
 * Compute per-team, per-position scaled VORP sums for a draft.
 * (Unchanged — used by team badges and other callers.)
 */
export const computeTeamScaledVorpByPosition = (draftPicks = [], options = {}) => {
    const {
        historicalData = {},
        usersData = [],
        season = null,
        positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
        minTarget = -5,
        maxTarget = 5,
        scaleMethod = 'perPickThenSum',
        getTeamName = () => '',
    } = options || {};

    const totalDraftPicks = Array.isArray(draftPicks) ? draftPicks.length : 0;
    const expectedMap = generateExpectedVorpByPickSlot(totalDraftPicks);
    const entries = [];

    draftPicks.forEach(rawPick => {
        if (!rawPick) return;
        const pickNo = Number(rawPick.pick_no || rawPick.pick_number || rawPick.overall_pick || 0) || 0;
        if (pickNo <= 0) return;
        const owner = String(rawPick.picked_by || rawPick.owner_id || rawPick.picked_by_team || rawPick.roster_id || 'unknown');
        const enriched = enrichPickForCalculations(rawPick, usersData, historicalData, Number(season), getTeamName);
        const playerValue = calculatePlayerValue(enriched) || 0;
        const expected = expectedMap.get(pickNo) || 0;
        const delta = calculateVORPDelta(playerValue, expected);
        const posRaw = (enriched.player_position || enriched.player_pos || (rawPick.metadata && rawPick.metadata.position) || '').toString();
        const position = normalizePosition(posRaw) || 'NA';
        entries.push({ owner, position, delta, pickNo, playerValue, expected, enriched });
    });

    const allDeltas = entries.map(e => e.delta).filter(v => typeof v === 'number' && !isNaN(v));
    const minRaw = allDeltas.length ? Math.min(...allDeltas) : 0;
    const maxRaw = allDeltas.length ? Math.max(...allDeltas) : 0;
    const perOwner = {};

    if (scaleMethod === 'perPickThenSum') {
        entries.forEach(e => {
            const scaled = scaleVorpDelta(e.delta, minRaw, maxRaw, minTarget, maxTarget);
            if (!perOwner[e.owner]) perOwner[e.owner] = { positions: {}, totals: { rawSum: 0, scaledSum: 0, count: 0 } };
            if (!perOwner[e.owner].positions[e.position]) perOwner[e.owner].positions[e.position] = { rawSum: 0, scaledSum: 0, count: 0 };
            perOwner[e.owner].positions[e.position].rawSum    += e.delta;
            perOwner[e.owner].positions[e.position].scaledSum += scaled;
            perOwner[e.owner].positions[e.position].count     += 1;
            perOwner[e.owner].totals.rawSum    += e.delta;
            perOwner[e.owner].totals.scaledSum += scaled;
            perOwner[e.owner].totals.count     += 1;
        });
    } else {
        entries.forEach(e => {
            if (!perOwner[e.owner]) perOwner[e.owner] = { positions: {}, totals: { rawSum: 0, scaledSum: 0, count: 0 } };
            if (!perOwner[e.owner].positions[e.position]) perOwner[e.owner].positions[e.position] = { rawSum: 0, scaledSum: 0, count: 0 };
            perOwner[e.owner].positions[e.position].rawSum += e.delta;
            perOwner[e.owner].positions[e.position].count  += 1;
            perOwner[e.owner].totals.rawSum += e.delta;
            perOwner[e.owner].totals.count  += 1;
        });
        const ownerPosRawSums = [];
        Object.keys(perOwner).forEach(owner => {
            Object.keys(perOwner[owner].positions).forEach(pos => {
                ownerPosRawSums.push(perOwner[owner].positions[pos].rawSum || 0);
            });
        });
        const minOP = ownerPosRawSums.length ? Math.min(...ownerPosRawSums) : 0;
        const maxOP = ownerPosRawSums.length ? Math.max(...ownerPosRawSums) : 0;
        Object.keys(perOwner).forEach(owner => {
            Object.keys(perOwner[owner].positions).forEach(pos => {
                const raw = perOwner[owner].positions[pos].rawSum || 0;
                const scaled = scaleVorpDelta(raw, minOP, maxOP, minTarget, maxTarget);
                perOwner[owner].positions[pos].scaledSum = scaled;
                perOwner[owner].totals.scaledSum = (perOwner[owner].totals.scaledSum || 0) + scaled;
            });
        });
    }

    const positionTotals = {};
    Object.keys(perOwner).forEach(owner => {
        Object.keys(perOwner[owner].positions).forEach(pos => {
            if (!positionTotals[pos]) positionTotals[pos] = { rawSum: 0, scaledSum: 0, count: 0 };
            positionTotals[pos].rawSum    += perOwner[owner].positions[pos].rawSum    || 0;
            positionTotals[pos].scaledSum += perOwner[owner].positions[pos].scaledSum || 0;
            positionTotals[pos].count     += perOwner[owner].positions[pos].count     || 0;
        });
    });

    return {
        meta: { totalDraftPicks, minRaw, maxRaw, minTarget, maxTarget, scaleMethod, processedPicks: entries.length },
        perOwner,
        positionTotals,
        entries,
    };
};

/**
 * Pretty-print / console summary helper. Unchanged.
 */
export const printScaledVorpSummary = (teamVorp = {}, season = null, getTeamName = () => '') => {
    try {
        if (!teamVorp || !teamVorp.perOwner) return;
        const summary = Object.keys(teamVorp.perOwner || {}).map(ownerId => {
            const teamName = (typeof getTeamName === 'function') ? getTeamName(ownerId, Number(season)) : ownerId;
            const positionsObj = teamVorp.perOwner[ownerId].positions || {};
            const posSummary = {};
            Object.keys(positionsObj).forEach(p => {
                posSummary[p] = {
                    scaled: Number((positionsObj[p].scaledSum || 0).toFixed(3)),
                    raw:    Number((positionsObj[p].rawSum    || 0).toFixed(3)),
                    count:  positionsObj[p].count || 0,
                };
            });
            return {
                ownerId, teamName,
                totals: {
                    scaled: Number((teamVorp.perOwner[ownerId].totals.scaledSum || 0).toFixed(3)),
                    raw:    Number((teamVorp.perOwner[ownerId].totals.rawSum    || 0).toFixed(3)),
                    count:  teamVorp.perOwner[ownerId].totals.count || 0,
                },
                positions: posSummary,
            };
        });
        try {
            const logger = require('./logger').default;
            if (logger && typeof logger.info === 'function')
                logger.info(`Season ${season} - Scaled VORP by Position by Team:`, summary);
        } catch (e) { /* silent */ }
    } catch (e) { /* no-op */ }
};