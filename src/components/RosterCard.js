// src/components/RosterCard.js
import React from 'react';

const RosterCard = ({ roster }) => {
    // Ensure roster and its properties exist before trying to access them
    if (!roster) {
        return null; // Or render a placeholder if a roster object is missing
    }

    const { ownerDisplayName, ownerTeamName, ownerAvatar, roster_id } = roster;

    return (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 flex flex-col items-center text-center w-full max-w-xs mx-auto md:max-w-sm">
            {/* Use the ownerAvatar directly from the roster object */}
            <img
                src={ownerAvatar}
                alt={`${ownerDisplayName}'s Avatar`}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover mb-3 sm:mb-4 border-4 border-blue-500 shadow-lg"
                onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/LeagueLogo.PNG';
                    logger.warn(`Failed to load avatar for ${ownerDisplayName}. Using default.`);
                }}
            />
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1 truncate w-full">{ownerTeamName}</h2>
            <p className="text-sm sm:text-md text-gray-600 mb-1 sm:mb-2 truncate w-full">Manager: {ownerDisplayName}</p>
            <p className="text-xs sm:text-sm text-gray-500">Roster ID: {roster_id}</p>
            {/* You can add more roster details here, e.g., points, record etc. */}
        </div>
    );
};

export default RosterCard;
