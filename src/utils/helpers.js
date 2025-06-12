import React from 'react'; // Needed for JSX in renderTradeAsset

// Example team name mapping (adjust as needed)
const teamNameMapping = {
  "Team A Old Name": "Team A New Name",
  "Team B Original": "Team B Redux",
  // Add all your mappings here
};

export const getMappedTeamName = (originalName) => {
  // Ensure originalName is a string before calling .toLowerCase()
  if (typeof originalName !== 'string') {
    return originalName; // Return as is if not a string
  }
  return teamNameMapping[originalName] || originalName;
};

export const renderTradeAsset = (asset, type) => {
  const isPlayer = asset.type === 'player';
  const isPick = asset.type === 'pick';
  const isFaab = asset.type === 'faab';

  const textColor = type === 'received' ? 'text-green-700' : 'text-red-700';
  const sign = type === 'received' ? '+' : '-';

  return (
    <div className={`text-[10px] ${textColor} font-medium flex items-center`}>
      {isPlayer && (
        <>
          {sign} {asset.name} ({asset.position})
        </>
      )}
      {isPick && (
        <>
          {sign} {asset.year} {asset.round} Pick ({asset.originalOwner})
        </>
      )}
      {isFaab && (
        <>
          {sign} ${asset.amount} FAAB
        </>
      )}
    </div>
  );
};
