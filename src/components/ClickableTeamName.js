// src/components/ClickableTeamName.js
import React from 'react';

const ClickableTeamName = ({ 
    teamName, 
    onTeamNameClick, 
    className = "text-gray-800 hover:text-gray-600 cursor-pointer", 
    children 
}) => {
    if (!onTeamNameClick) {
        // If no click handler provided, render as plain text
        return <span className={className.replace('cursor-pointer', '').replace('hover:text-gray-600', '')}>{children || teamName}</span>;
    }

    return (
        <button
            onClick={() => onTeamNameClick(teamName)}
            className={`bg-transparent border-none p-0 text-left ${className}`}
            title={`View ${teamName} details`}
        >
            {children || teamName}
        </button>
    );
};

export default ClickableTeamName;