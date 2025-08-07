// src/utils/dataUtils.js
// This file contains utility functions for formatting and processing data.

/**
 * Formats a timestamp into a human-readable date and time string.
 * @param {number} timestamp The Unix timestamp in milliseconds.
 * @returns {string} The formatted date string.
 */
export const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

/**
 * Gets a human-readable label for a transaction type.
 * @param {string} type The transaction type (e.g., 'trade', 'free_agent').
 * @returns {string} The formatted label.
 */
export const getTransactionTypeLabel = (type) => {
  switch (type) {
    case 'trade':
      return 'Trade';
    case 'waiver':
      return 'Waiver Claim';
    case 'free_agent':
      return 'Free Agent';
    default:
      return 'Transaction';
  }
};

/**
 * This is a placeholder function. In a real app, you would have a player
 * data object to map player IDs to names. For now, it just returns the ID.
 * @param {string} playerId The ID of the player.
 * @param {Object} transactions An object mapping player IDs to roster IDs.
 * @returns {string} The formatted player name or ID.
 */
export const formatPlayerTransaction = (playerId, transactions) => {
  // In a full application, you would pass a players object to this component
  // and do a lookup like:
  // const player = players[playerId];
  // return player ? player.full_name : `Player ID: ${playerId}`;

  // For this example, we'll just return the player ID.
  return `Player ID: ${playerId}`;
};
