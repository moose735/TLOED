// Lightweight keeper pick-slot resolver
// Inputs:
// - historicalData: object containing draftPicksBySeason (as provided by SleeperDataContext.historicalData)
// - ownerId: roster_id or owner_id (we'll try matching against roster_id, picked_by, owner_id)
// - targetSeason: numeric season (e.g., 2026) in which picks are assigned
// - targetRound: numeric desired round (1..N)
// Returns: { resolved: boolean, round: number|null, pick_in_round: number|null, pick_no: number|null, label: string }

export function resolveKeeperPick(historicalData, ownerId, targetSeason, targetRound) {
    // defensive checks
    if (!historicalData || !historicalData.draftPicksBySeason) {
        return { resolved: false, label: `Round Cost: R${targetRound}` };
    }

    const seasonPicks = historicalData.draftPicksBySeason[String(targetSeason)] || historicalData.draftPicksBySeason[targetSeason];
    if (!seasonPicks || !seasonPicks.length) {
        return { resolved: false, label: `Round Cost: R${targetRound}` };
    }

    // Try to resolve owner's roster_id for the target season if ownerId is a user_id
    let rosterIdForOwner = null;
    try {
        const rostersForSeason = historicalData.rostersBySeason && (historicalData.rostersBySeason[String(targetSeason)] || historicalData.rostersBySeason[targetSeason]);
        if (rostersForSeason && ownerId != null) {
            // ownerId might already be a roster_id
            const asRoster = rostersForSeason.find(r => String(r.roster_id) === String(ownerId));
            if (asRoster) rosterIdForOwner = String(asRoster.roster_id);
            // otherwise try matching by owner_id
            if (!rosterIdForOwner) {
                const asOwner = rostersForSeason.find(r => String(r.owner_id) === String(ownerId));
                if (asOwner) rosterIdForOwner = String(asOwner.roster_id);
            }
        }
    } catch (e) {
        // ignore mapping failures
    }

    const matchesOwner = (p) => {
        if (!p) return false;
        const checks = [p.roster_id, p.picked_by, p.owner_id, p.metadata?.owner_id, p.metadata?.owner, p.metadata?.original_owner_id, p.metadata?.original_owner];
        // compare both rosterId and ownerId forms
        for (const c of checks) {
            if (c == null) continue;
            if (String(c) === String(ownerId)) return true;
            if (rosterIdForOwner && String(c) === String(rosterIdForOwner)) return true;
        }
        return false;
    };

    // Helper to compute pick_in_round when it's missing by ordering picks in that round by pick_no
    const computePickInRound = (pickObj) => {
        if (pickObj.pick_in_round != null) return Number(pickObj.pick_in_round);
        if (pickObj.pick_no != null && seasonPicks && seasonPicks.length) {
            // find all picks in same round and sort by pick_no
            const roundPicks = seasonPicks.filter(p => Number(p.round) === Number(pickObj.round)).slice().sort((a,b) => (Number(a.pick_no || 0) - Number(b.pick_no || 0)));
            const idx = roundPicks.findIndex(p => String(p.pick_no) === String(pickObj.pick_no));
            if (idx >= 0) return idx + 1;
        }
        return null;
    };

    // Build traded picks lookup for the season if available: Map<round, Map<original_roster_id, tradedPickInfo>>
    const tradedPicksForSeason = historicalData.tradedPicksBySeason && (historicalData.tradedPicksBySeason[String(targetSeason)] || historicalData.tradedPicksBySeason[targetSeason]) || [];
    const tradedPicksLookup = new Map();
    if (Array.isArray(tradedPicksForSeason)) {
        tradedPicksForSeason.forEach(tp => {
            const r = Number(tp.round || tp.round_number || tp.draft_round || 0) || Number(tp.round);
            if (!tradedPicksLookup.has(r)) tradedPicksLookup.set(r, new Map());
            // original roster id is usually in tp.roster_id
            const original = tp.roster_id != null ? String(tp.roster_id) : (tp.original_roster_id != null ? String(tp.original_roster_id) : null);
            if (original) tradedPicksLookup.get(r).set(original, tp);
        });
    }

    const findPickInRound = (round) => {
        // direct match where the pick object indicates it's owned/used by owner
        const direct = seasonPicks.find(p => Number(p.round) === Number(round) && matchesOwner(p));
        if (direct) return direct;

        // If owner mapped to a rosterId, check traded picks for this round: find originalRosterIds whose traded pick owner is this owner
        if (rosterIdForOwner && tradedPicksLookup.has(Number(round))) {
            const mapForRound = tradedPicksLookup.get(Number(round));
            for (const [originalRosterId, tp] of mapForRound.entries()) {
                // traded pick's current owner may be stored in different fields; try owner_id then owner
                const currentOwner = tp.owner_id != null ? String(tp.owner_id) : (tp.owner != null ? String(tp.owner) : null);
                if (!currentOwner) continue;
                if (String(currentOwner) === String(rosterIdForOwner)) {
                    // try to find the pick object in seasonPicks that corresponds to the originalRosterId
                    const pickMatch = seasonPicks.find(p => Number(p.round) === Number(round) && (
                        String(p.roster_id) === String(originalRosterId) ||
                        String(p.metadata?.original_roster_id) === String(originalRosterId) ||
                        String(p.metadata?.original_owner_roster_id) === String(originalRosterId) ||
                        String(p.metadata?.original_owner) === String(originalRosterId)
                    ));
                    if (pickMatch) return pickMatch;
                    // If there's no explicit metadata linking the pick object to the original roster, as a fallback,
                    // try to match by pick_no and round: find any pick in this round whose pick_no equals tp.pick_no (if present)
                    if (tp.pick_no != null) {
                        const byPickNo = seasonPicks.find(p => Number(p.round) === Number(round) && Number(p.pick_no) === Number(tp.pick_no));
                        if (byPickNo) return byPickNo;
                    }
                }
            }
        }

        // nothing found for this round
        return null;
    };

    let resolvedPick = findPickInRound(targetRound);
    let resolvedRound = targetRound;

    // If not found, search earlier rounds (owner may have acquired an earlier pick)
    if (!resolvedPick) {
        for (let r = targetRound - 1; r >= 1; r--) {
            const p = findPickInRound(r);
            if (p) {
                resolvedPick = p;
                resolvedRound = r;
                break;
            }
        }
    }

    if (resolvedPick) {
        const pickInRound = computePickInRound(resolvedPick);
        const pickNo = resolvedPick.pick_no != null ? Number(resolvedPick.pick_no) : null;
        const label = `R${resolvedRound} • Pick ${pickInRound || pickNo || '—'}`;
        return { resolved: true, round: resolvedRound, pick_in_round: pickInRound, pick_no: pickNo, label };
    }

    return { resolved: false, label: `Round Cost: R${targetRound}` };
}

export default resolveKeeperPick;
