import React, { useState } from 'react';

const navGroups = [
  { label: 'Dashboard', link: '/dashboard' },
  { label: 'Achievements', link: '/achievements' },
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

export default navGroups;
