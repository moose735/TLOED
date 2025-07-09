import React, { useState } from 'react';
import LeagueRecords from './LeagueRecords';
import SeasonRecords from '../lib/SeasonRecords'; // Correct path to SeasonRecords

/**
 * Main component for displaying various league records.
 * Acts as a container for LeagueRecords and potentially other record types.
 */
const RecordBook = () => {
    const [activeTab, setActiveTab] = useState('league'); // State to control which tab is active

    const handleTabChange = (tab) => {
        setActiveTab(tab);
    };

    return (
        <div className="record-book-container bg-white shadow-lg rounded-lg p-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">League Record Book</h2>

            {/* Tab Navigation */}
            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => handleTabChange('league')}
                        className={`
                            ${activeTab === 'league'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }
                            whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
                        `}
                    >
                        All-Time Records
                    </button>
                    <button
                        onClick={() => handleTabChange('season')} // New tab for Seasonal Records
                        className={`
                            ${activeTab === 'season'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }
                            whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
                        `}
                    >
                        Seasonal Records
                    </button>
                </nav>
            </div>

            {/* Content based on active tab */}
            <div>
                {activeTab === 'league' && <LeagueRecords />}
                {activeTab === 'season' && <SeasonRecords />} {/* Render SeasonRecords when 'season' tab is active */}
            </div>
        </div>
    );
};

export default RecordBook;
