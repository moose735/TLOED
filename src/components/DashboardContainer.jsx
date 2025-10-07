import React from 'react';

// Shared layout wrapper for dashboard pages/widgets
const DashboardContainer = ({ children, className = '' }) => {
    return (
        <div className={`w-full max-w-7xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 font-inter overflow-x-hidden ${className}`}>
            {children}
        </div>
    );
};

export default DashboardContainer;
