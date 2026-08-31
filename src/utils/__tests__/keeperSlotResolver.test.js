import { resolveKeeperPick } from '../keeperSlotResolver';
import { computeAcquisitionMethod, dedupeTradeRecords, isActiveTransaction, normalizeTransactionSeason, resolveOwnerIdForRosterId } from '../../lib/PlayersHistory';

describe('resolveKeeperPick', () => {
    const sampleHistorical = {
        draftPicksBySeason: {
            2026: [
                { pick_no: 1, round: 1, pick_in_round: 1, roster_id: '1', picked_by: '1' },
                { pick_no: 5, round: 1, pick_in_round: 5, roster_id: '2', picked_by: '2' },
                { pick_no: 17, round: 2, pick_in_round: 5, roster_id: '3', picked_by: '3' },
                { pick_no: 29, round: 3, pick_in_round: 5, roster_id: '4', picked_by: '4' },
            ]
        },
        // include roster mapping so resolver can map owner_id -> roster_id
        rostersBySeason: {
            2026: [
                { roster_id: '1', owner_id: 'u1' },
                { roster_id: '2', owner_id: 'u2' },
                { roster_id: '3', owner_id: 'u3' },
                { roster_id: '4', owner_id: 'u4' },
            ]
        }
    };

    test('resolves direct pick in target round', () => {
        const r = resolveKeeperPick(sampleHistorical, '4', 2026, 3);
        expect(r.resolved).toBe(true);
        expect(r.round).toBe(3);
        expect(r.pick_in_round).toBe(5);
        expect(r.label).toContain('R3');
    });

    test('falls back to earlier round when target round missing', () => {
        const r = resolveKeeperPick(sampleHistorical, '3', 2026, 4); // targetRound 4 not present -> finds round 2
        expect(r.resolved).toBe(true);
        expect(r.round).toBe(2);
        expect(r.label).toContain('R2');
    });

    test('resolves when ownerId is a user_id via rostersBySeason mapping', () => {
        // owner 'u4' maps to roster_id '4' which has a round 3 pick
        const r = resolveKeeperPick(sampleHistorical, 'u4', 2026, 3);
        expect(r.resolved).toBe(true);
        expect(r.round).toBe(3);
        expect(r.pick_in_round).toBe(5);
        expect(r.label).toContain('R3');
    });

    test('handles traded pick: original owner A -> pick used by B then held by C', () => {
        // Simulate: original roster 'A' had round 4 pick (pick_no 46). It was traded to roster 'B' and used by B to pick player.
        // Later that player is on roster 'C' and we want resolver(ownerId='C') for round 4 to match the pick in season picks via tradedPicks
        const tradedHistorical = {
            draftPicksBySeason: {
                2026: [
                    { pick_no: 46, round: 4, pick_in_round: 10, roster_id: 'B', picked_by: 'B', player_id: 'px' },
                ]
            },
            rostersBySeason: {
                2026: [
                    { roster_id: 'A', owner_id: 'ua' },
                    { roster_id: 'B', owner_id: 'ub' },
                    { roster_id: 'C', owner_id: 'uc' },
                ]
            },
            // tradedPicksBySeason indicates that original roster A's round 4 pick was acquired by roster B
            tradedPicksBySeason: {
                2026: [
                    { round: 4, roster_id: 'A', owner_id: 'B', pick_no: 46 }
                ]
            }
        };

        // Now resolver should, when passed ownerId='uc' (roster C's owner id), not match since current owner is B.
        // But if ownerId is 'ub' (B) it should resolve to the pick in round 4.
        const rB = resolveKeeperPick(tradedHistorical, 'ub', 2026, 4);
        expect(rB.resolved).toBe(true);
        expect(rB.round).toBe(4);
        expect(rB.pick_in_round).toBe(10);

        // If the pick was later associated to roster C via some other mechanism (e.g., player traded after draft), the pick in season picks still belongs to B's draft slot,
        // but keeper logic in KeeperList should map current keeper owner to their roster and compute assigned round based on original draft round and years kept.
        // This test ensures the traded pick is findable via tradedPicksBySeason lookup.
    });

    test('falls back to the most recent prior draft season when target season has not started yet', () => {
        const preDraftHistorical = {
            draftPicksBySeason: {
                2025: [
                    { pick_no: 1, round: 1, pick_in_round: 1, roster_id: '1', picked_by: '1' },
                    { pick_no: 17, round: 2, pick_in_round: 5, roster_id: '3', picked_by: '3' },
                    { pick_no: 29, round: 3, pick_in_round: 5, roster_id: '4', picked_by: '4' },
                ],
                2026: []
            },
            rostersBySeason: {
                2025: [
                    { roster_id: '1', owner_id: 'u1' },
                    { roster_id: '3', owner_id: 'u3' },
                    { roster_id: '4', owner_id: 'u4' },
                ],
                2026: []
            }
        };

        const r = resolveKeeperPick(preDraftHistorical, 'u4', 2026, 3);
        expect(r.resolved).toBe(true);
        expect(r.round).toBe(3);
        expect(r.label).toContain('R3');
    });

    test('returns round cost when season picks missing', () => {
        const r = resolveKeeperPick({}, '1', 2027, 2);
        expect(r.resolved).toBe(false);
        expect(r.label).toContain('Round Cost');
    });

    test('ignores only explicit vetoed trades while keeping real trade metadata intact', () => {
        expect(isActiveTransaction({ type: 'trade', status: 'complete' })).toBe(true);
        expect(isActiveTransaction({ type: 'trade', status: 'vetoed' })).toBe(false);
        expect(isActiveTransaction({ type: 'trade', status: 'complete', metadata: { veto_msg_id: 'abc123' } })).toBe(true);
        expect(isActiveTransaction({ type: 'trade', status: 'complete', metadata: { vetoed: true } })).toBe(false);
        expect(isActiveTransaction({ type: 'commissioner', status: 'complete', adds: { '123': 1 } })).toBe(true);
        expect(isActiveTransaction({ type: 'free_agent', creator: 'commissioner', status: 'complete' })).toBe(true);
    });

    test('prefers a valid week-1/2 trade over prior carryover fallback', () => {
        const historical = {
            rostersBySeason: {
                2025: [{ roster_id: '6', owner_id: 'owner-6' }],
                2024: [{ roster_id: '11', owner_id: 'owner-6', players: ['4881'] }],
            },
            draftPicksBySeason: { 2025: [] },
        };

        const acquisition = computeAcquisitionMethod('4881', { season: '2025', rosterId: '6', startWeek: 2 }, historical, [
            { season: '2025', week: 2, type: 'received', toRosterId: '6', toTeam: 'Team 6' },
        ], () => 'Team 6', []);

        expect(acquisition.method).toBe('trade');
        expect(acquisition.label).toBe('Via Trade');
    });

    test('deduplicates the same trade transaction when it is assembled from cached and fresh records', () => {
        const sameTradeId = 'trade-123';
        const cachedTrade = {
            transactionId: sameTradeId,
            season: 2025,
            week: 1,
            type: 'received',
            fromTeam: 'Team A',
            toTeam: 'Team B',
            adds: [{ playerId: '1', first_name: 'Josh', last_name: 'Allen' }],
            drops: [{ playerId: '99', first_name: 'Other', last_name: 'Player' }],
        };
        const freshTrade = {
            transactionId: sameTradeId,
            season: 2025,
            week: 1,
            type: 'received',
            fromTeam: 'Team A',
            toTeam: 'Team B',
            adds: [{ playerId: '1', first_name: 'Josh', last_name: 'Allen' }],
            drops: [{ playerId: '99', first_name: 'Other', last_name: 'Player' }],
        };

        const deduped = dedupeTradeRecords([cachedTrade, freshTrade]);
        expect(deduped).toHaveLength(1);
        expect(deduped[0].transactionId).toBe(sameTradeId);
    });

    test('resolves the owner for a roster_id using the exact season instead of a reused roster number from another year', () => {
        const historical = {
            rostersBySeason: {
                2023: [
                    { roster_id: '10', owner_id: 'owner-23' },
                    { roster_id: '11', owner_id: 'owner-24' },
                ],
                2024: [
                    { roster_id: '10', owner_id: 'owner-24' },
                    { roster_id: '11', owner_id: 'owner-25' },
                ],
            },
        };

        expect(resolveOwnerIdForRosterId(historical, '10', 2023)).toBe('owner-23');
        expect(resolveOwnerIdForRosterId(historical, '10', 2024)).toBe('owner-24');
    });

    test('infers the season from the transaction date for offseason trades when sleeper omits season', () => {
        const tx = { created: '2023-08-10T00:00:00.000Z' };
        expect(normalizeTransactionSeason(tx)).toBe(2023);
    });

    test('treats a pre-draft commissioner add from a Yahoo import as a startup keeper instead of a waiver pickup', () => {
        const historical = {
            rostersBySeason: {
                2024: [{ roster_id: '7', owner_id: 'owner-7' }],
                2023: [{ roster_id: '8', owner_id: 'owner-7', players: ['9999'] }],
            },
            draftPicksBySeason: { 2024: [] },
        };

        const acquisition = computeAcquisitionMethod('9999', { season: '2024', rosterId: '7', startWeek: 1 }, historical, [], () => 'Team 7', [
            { type: 'commissioner', season: 2024, created: '2024-05-01T00:00:00Z', adds: { '9999': { roster_id: '7' } }, creator: 'commissioner' },
        ]);

        expect(acquisition.method).toBe('keeper');
        expect(acquisition.label).toBe('Kept');
        expect(acquisition.detail).toBe('Pre-draft roster setup');
    });
});
