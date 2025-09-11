
import React, { useCallback } from 'react';
import { useSleeperData } from '../contexts/SleeperDataContext';
import { getSleeperPlayerHeadshotUrl } from '../utils/sleeperApi';

const Dashboard = () => {
    return (
        <div className="w-full flex items-center justify-center min-h-[200px] bg-gradient-to-r from-blue-50 to-gray-100 py-8">
            <h1 className="text-3xl font-bold text-blue-700">Coming soon</h1>
        </div>
    );
};

export default Dashboard;
