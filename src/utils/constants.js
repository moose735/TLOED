export const TABS = {
  TRADES: 'trades',
  ODDS: 'odds',
  BRACKET: 'bracket',
  HISTORY: 'history',
  CHAMPIONS: 'champions',
  // Add other tabs as needed
};

export const NAV_CATEGORIES = {
  HOME: { label: 'Home', tab: TABS.TRADES }, // Assuming trades is the default home tab
  LEAGUE: {
    label: 'League',
    subTabs: [
      { label: 'Trades', tab: TABS.TRADES },
      { label: 'Odds', tab: TABS.ODDS },
      { label: 'Bracket', tab: TABS.BRACKET },
    ],
  },
  HISTORY: {
    label: 'History',
    subTabs: [
      { label: 'Power Rankings', tab: TABS.HISTORY },
      { label: 'Champions', tab: TABS.CHAMPIONS },
    ],
  },
  // Add other categories as needed
};
