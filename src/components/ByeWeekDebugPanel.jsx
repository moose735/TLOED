import React, { useMemo } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';

// Dev-only panel to surface bye_week badge assignments
const ByeWeekDebugPanel = () => {
    const { badgesByTeam, recentBadges, getTeamName } = useSleeperData();

    // Collect bye_week badges from recentBadges and badgesByTeam
    const byeWeekEntries = useMemo(() => {
        const list = [];

        // recentBadges is an array of recent badge events
        if (Array.isArray(recentBadges)) {
            recentBadges.forEach(b => {
                const id = b && (b.id || b.badgeId || b.slug || b.name);
                const matches = (id && String(id).toLowerCase().includes('bye')) || (b && b.name && String(b.name).toLowerCase().includes('bye'));
                if (matches) {
                    list.push({
                        source: 'recent',
                        season: b.season || b.year || 'unknown',
                        ownerId: b.ownerId || b.owner || b.team || b.rosterId || b.roster_id || b.user_id,
                        badge: b
                    });
                }
            });
        }

        // badgesByTeam is an object of ownerId -> [badges]
        if (badgesByTeam && typeof badgesByTeam === 'object') {
            Object.entries(badgesByTeam).forEach(([ownerId, badges]) => {
                if (!Array.isArray(badges)) return;
                badges.forEach(b => {
                    const id = b && (b.id || b.badgeId || b.slug || b.name);
                    const matches = (id && String(id).toLowerCase().includes('bye')) || (b && b.name && String(b.name).toLowerCase().includes('bye'));
                    if (matches) {
                        list.push({
                            source: 'byTeam',
                            season: b.season || b.year || 'unknown',
                            ownerId: ownerId,
                            badge: b
                        });
                    }
                });
            });
        }

        // Deduplicate by ownerId+season+badge id
        const seen = new Set();
        const dedup = [];
        list.forEach(item => {
            const key = `${item.ownerId || 'unknown'}::${item.season || 'unknown'}::${(item.badge && (item.badge.id || item.badge.badgeId || item.badge.slug || item.badge.name)) || 'unknown'}`;
            if (!seen.has(key)) {
                seen.add(key);
                dedup.push(item);
            }
        });

        // Sort by season desc then ownerId
        dedup.sort((a, b) => (String(b.season).localeCompare(String(a.season)) || String(a.ownerId).localeCompare(String(b.ownerId))));
        return dedup;
    }, [badgesByTeam, recentBadges]);

    // Don't render in production by guard (double-check even if parent hides it)
    if (process.env.NODE_ENV === 'production') return null;

    return (
        <div className="fixed right-4 bottom-4 w-80 max-w-full z-50 pointer-events-auto">
            <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-sm text-gray-800">
                <div className="flex items-center justify-between mb-2">
                    <strong className="text-xs">Bye Week Debug</strong>
                    <span className="text-xs text-gray-500">dev</span>
                </div>
                <div className="max-h-64 overflow-auto">
                    {byeWeekEntries.length === 0 ? (
                        <div className="text-xs text-gray-500">No bye_week badges detected</div>
                    ) : (
                        <ul className="space-y-2">
                            {byeWeekEntries.map((e, idx) => {
                                const ownerId = e.ownerId;
                                const teamName = getTeamName ? getTeamName(ownerId, e.season) : String(ownerId || 'Unknown');
                                const badgeName = (e.badge && (e.badge.name || e.badge.title || e.badge.id || e.badge.badgeId)) || 'bye_week';
                                return (
                                    <li key={`${ownerId}-${e.season}-${idx}`} className="flex items-start gap-2">
                                        <div className="flex-1">
                                            <div className="font-medium text-xs truncate">{teamName}</div>
                                            <div className="text-xxs text-gray-500">{badgeName} • {e.season}</div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ByeWeekDebugPanel;
