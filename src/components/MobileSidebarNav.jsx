import React, { useState } from 'react';

const navGroups = [
  { label: 'Dashboard', link: '/dashboard' },
  {
    label: 'Games',
    children: [
      { label: 'Gamecenter', link: '/gamecenter' },
      { label: 'Sportsbook', link: '/sportsbook' },
    ],
  },
  {
    label: 'League',
    children: [
      { label: 'Hall of Champions', link: '/hall-of-champions' },
      { label: 'League History', link: '/league-history' },
      { label: 'Record Book', link: '/record-book' },
      { label: 'Season Breakdown', link: '/season-breakdown' },
      { label: 'Finances', link: '/finances' },
    ],
  },
  { label: 'Teams', link: '/teams' },
  {
    label: 'Analysis',
    children: [
      { label: 'Draft', link: '/draft' },
      { label: 'DPR Analysis', link: '/dpr-analysis' },
      { label: 'Luck Rating', link: '/luck-rating' },
    ],
  },
];

export default function MobileSidebarNav() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState({});

  const toggleGroup = (label) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 bg-blue-600 text-white p-2 rounded-md"
        onClick={() => setOpen(true)}
      >
        ☰
      </button>
      <div
        className={`fixed inset-0 z-40 bg-black bg-opacity-40 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setOpen(false)}
      />
      <nav
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-4 border-b font-bold text-lg">Menu</div>
        <ul className="p-2">
          {navGroups.map((group) =>
            group.children ? (
              <li key={group.label} className="mb-2">
                <button
                  className="w-full flex justify-between items-center px-2 py-2 font-semibold text-left"
                  onClick={() => toggleGroup(group.label)}
                >
                  {group.label}
                  <span>{expanded[group.label] ? '▲' : '▼'}</span>
                </button>
                {expanded[group.label] && (
                  <ul className="ml-4 mt-1">
                    {group.children.map((item) => (
                      <li key={item.label}>
                        <a href={item.link} className="block px-2 py-1 rounded hover:bg-blue-100">
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ) : (
              <li key={group.label} className="mb-2">
                <a href={group.link} className="block px-2 py-2 font-semibold rounded hover:bg-blue-100">
                  {group.label}
                </a>
              </li>
            )
          )}
        </ul>
      </nav>
    </>
  );
}
