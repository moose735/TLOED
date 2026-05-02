// Lightweight keeper pick-slot resolver
// Inputs:
// - historicalData: object containing draftPicksBySeason (as provided by SleeperDataContext.historicalData)
// - ownerId: roster_id or owner_id (we'll try matching against roster_id, picked_by, owner_id)
// - targetSeason: numeric season (e.g., 2026) in which picks are assigned
// - targetRound: numeric desired round (1..N)
// Returns: { resolved: boolean, round: number|null, pick_in_round: number|null, pick_no: number|null, label: string }
//
// Fallback rule (per league rules):
//   If the owner does not have a pick in the assigned round, cost is -1 round (one round earlier).
//   We check ONLY one round earlier — we do NOT walk all the way back to R1.
//   If they don't own that round either, we return an unresolved "Round Cost: RN" label.

export function resolveKeeperPick(historicalData, ownerId, targetSeason, targetRound) {
    // defensive checks
    if (!historicalData || !historicalData.draftPicksBySeason) {
        return { resolved: false, label: `Round Cost: R${targetRound}` };
    }

    const seasonPicks = historicalData.draftPicksBySeason[String(targetSeason)]
        || historicalData.draftPicksBySeason[targetSeason];
    if (!seasonPicks || !seasonPicks.length) {
        return { resolved: false, label: `Round Cost: R${targetRound}` };
    }

    // Try to resolve owner's roster_id for the target season if ownerId is a user_id
    let rosterIdForOwner = null;
    try {
        const rostersForSeason = historicalData.rostersBySeason
            && (historicalData.rostersBySeason[String(targetSeason)]
                || historicalData.rostersBySeason[targetSeason]);
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
        const checks = [
            p.roster_id, p.picked_by, p.owner_id,
            p.metadata?.owner_id, p.metadata?.owner,
            p.metadata?.original_owner_id, p.metadata?.original_owner,
        ];
        for (const c of checks) {
            if (c == null) continue;
            if (String(c) === String(ownerId)) return true;
            if (rosterIdForOwner && String(c) === String(rosterIdForOwner)) return true;
        }
        return false;
    };

    // Compute pick_in_round when it's missing by ordering picks in that round by pick_no
    const computePickInRound = (pickObj) => {
        if (pickObj.pick_in_round != null) return Number(pickObj.pick_in_round);
        if (pickObj.pick_no != null && seasonPicks.length) {
            const roundPicks = seasonPicks
                .filter(p => Number(p.round) === Number(pickObj.round))
                .slice()
                .sort((a, b) => Number(a.pick_no || 0) - Number(b.pick_no || 0));
            const idx = roundPicks.findIndex(p => String(p.pick_no) === String(pickObj.pick_no));
            if (idx >= 0) return idx + 1;
        }
        return null;
    };

    // Build traded picks lookup: Map<round, Map<original_roster_id, tradedPickInfo>>
    const tradedPicksForSeason = (
        historicalData.tradedPicksBySeason
        && (historicalData.tradedPicksBySeason[String(targetSeason)]
            || historicalData.tradedPicksBySeason[targetSeason])
    ) || [];
    const tradedPicksLookup = new Map();
    if (Array.isArray(tradedPicksForSeason)) {
        tradedPicksForSeason.forEach(tp => {
            const r = Number(tp.round || tp.round_number || tp.draft_round || 0);
            if (!r) return;
            if (!tradedPicksLookup.has(r)) tradedPicksLookup.set(r, new Map());
            const original = tp.roster_id != null
                ? String(tp.roster_id)
                : tp.original_roster_id != null
                    ? String(tp.original_roster_id)
                    : null;
            if (original) tradedPicksLookup.get(r).set(original, tp);
        });
    }

    const findPickInRound = (round) => {
        // Direct match: pick already assigned to this owner
        const direct = seasonPicks.find(
            p => Number(p.round) === Number(round) && matchesOwner(p)
        );
        if (direct) return direct;

        // Traded pick match: find a pick whose current owner is this roster
        if (rosterIdForOwner && tradedPicksLookup.has(Number(round))) {
            const mapForRound = tradedPicksLookup.get(Number(round));
            for (const [originalRosterId, tp] of mapForRound.entries()) {
                const currentOwner = tp.owner_id != null
                    ? String(tp.owner_id)
                    : tp.owner != null
                        ? String(tp.owner)
                        : null;
                if (!currentOwner) continue;
                if (String(currentOwner) !== String(rosterIdForOwner)) continue;

                // Find the actual pick object in seasonPicks for this original roster's slot
                const pickMatch = seasonPicks.find(p =>
                    Number(p.round) === Number(round) && (
                        String(p.roster_id) === String(originalRosterId)
                        || String(p.metadata?.original_roster_id) === String(originalRosterId)
                        || String(p.metadata?.original_owner_roster_id) === String(originalRosterId)
                        || String(p.metadata?.original_owner) === String(originalRosterId)
                    )
                );
                if (pickMatch) return pickMatch;

                // Fallback: match by pick_no if available
                if (tp.pick_no != null) {
                    const byPickNo = seasonPicks.find(
                        p => Number(p.round) === Number(round)
                            && Number(p.pick_no) === Number(tp.pick_no)
                    );
                    if (byPickNo) return byPickNo;
                }
            }
        }

        return null;
    };

    // Try the assigned round first
    const directPick = findPickInRound(targetRound);
    if (directPick) {
        const pickInRound = computePickInRound(directPick);
        const pickNo = directPick.pick_no != null ? Number(directPick.pick_no) : null;
        return {
            resolved: true,
            round: targetRound,
            pick_in_round: pickInRound,
            pick_no: pickNo,
            label: `R${targetRound} • Pick ${pickInRound || pickNo || '—'}`,
        };
    }

    // Per rules: if owner doesn't have the assigned round pick, cost is exactly -1 round.
    // Check ONE round earlier only — do not walk all the way back.
    if (targetRound > 1) {
        const fallbackRound = targetRound - 1;
        const fallbackPick = findPickInRound(fallbackRound);
        if (fallbackPick) {
            const pickInRound = computePickInRound(fallbackPick);
            const pickNo = fallbackPick.pick_no != null ? Number(fallbackPick.pick_no) : null;
            return {
                resolved: true,
                round: fallbackRound,
                pick_in_round: pickInRound,
                pick_no: pickNo,
                label: `R${fallbackRound} • Pick ${pickInRound || pickNo || '—'}`,
            };
        }
    }

    // Neither the assigned round nor one round earlier found — show round cost only
    return { resolved: false, label: `Round Cost: R${targetRound}` };
}

export default resolveKeeperPick;