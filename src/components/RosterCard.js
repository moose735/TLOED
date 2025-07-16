// src/components/RosterCard.js
import React from 'react';

const RosterCard = ({ roster }) => {
    // Ensure roster and its properties exist before trying to access them
    if (!roster) {
        return null; // Or render a placeholder if a roster object is missing
    }

    const { ownerDisplayName, ownerTeamName, ownerAvatar, roster_id } = roster;

    return (
        <div className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center text-center">
            {/* Use the ownerAvatar directly from the roster object */}
            <img
                src={ownerAvatar}
                alt={`${ownerDisplayName}'s Avatar`}
                className="w-24 h-24 rounded-full object-cover mb-4 border-4 border-blue-500 shadow-lg"
                // Add an onerror fallback to a default image if the avatar URL fails
                onError={(e) => {
                    e.target.onerror = null; // Prevents infinite loop if fallback also fails
                    e.target.src = '/LeagueLogo.PNG'; // Path to your default placeholder image
                    console.warn(`Failed to load avatar for ${ownerDisplayName}. Using default.`);
                }}
            />
            <h2 className="text-xl font-semibold text-gray-900 mb-1">{ownerTeamName}</h2>
            <p className="text-md text-gray-600 mb-2">Manager: {ownerDisplayName}</p>
            <p className="text-sm text-gray-500">Roster ID: {roster_id}</p>
            {/* You can add more roster details here, e.g., points, record etc. */}
        </div>
    );
};

export default RosterCard;
