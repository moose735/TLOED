import React, { useState } from 'react';

const MobileRecordHeader = ({ title, value, holder, top5 = [], color = 'blue' }) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="sm:hidden p-3 border-b border-gray-100">
            <div className="flex items-start justify-between">
                <div>
                    <div className={`text-sm font-semibold text-gray-800`}>{title}</div>
                    <div className="mt-1 text-lg font-bold text-gray-900">{value ?? '—'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{holder ?? ''}</div>
                </div>

                <div className="flex items-start gap-2">
                    <button
                        onClick={() => setOpen(o => !o)}
                        className={`text-sm px-3 py-2 rounded-md bg-${color}-50 text-${color}-700`}
                        aria-expanded={open}
                    >
                        {open ? 'Hide' : 'Top 5'}
                    </button>
                </div>
            </div>

            {open && (
                <div className="mt-3 bg-white border border-gray-100 rounded-md shadow-sm p-2">
                    {top5 && top5.length > 0 ? (
                        <ol className="list-decimal list-inside text-sm space-y-1">
                            {top5.map((t, i) => (
                                <li key={i} className="flex justify-between">
                                    <div className="truncate pr-2">{t.label}</div>
                                    <div className="font-semibold ml-2">{t.value}</div>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <div className="text-sm text-gray-500">Top 5 not available.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MobileRecordHeader;
