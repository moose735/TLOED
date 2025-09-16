// Debug component to test financial data access
import React, { useEffect, useState } from 'react';
import { fetchFinancialDataForYear } from '../services/financialService';
import { useSleeperData } from '../contexts/SleeperDataContext';

const FinancialDebug = () => {
    const { historicalData } = useSleeperData();
    const [testResults, setTestResults] = useState({});
    const [loading, setLoading] = useState(false);

    const testYear = async (year) => {
        console.log(`Testing year: ${year}`);
        try {
            const data = await fetchFinancialDataForYear(year);
            setTestResults(prev => ({
                ...prev,
                [year]: {
                    success: true,
                    data: data,
                    transactionCount: data?.transactions?.length || 0,
                    hasData: !!(data?.transactions?.length)
                }
            }));
        } catch (error) {
            setTestResults(prev => ({
                ...prev,
                [year]: {
                    success: false,
                    error: error.message
                }
            }));
        }
    };

    useEffect(() => {
        if (!historicalData?.rostersBySeason) return;
        
        setLoading(true);
        
        // Get all seasons from historicalData (same as FinancialTracker)
        const allSeasons = Object.keys(historicalData.rostersBySeason).sort((a, b) => b - a);
        console.log('Available seasons from historicalData:', allSeasons);
        
        // Test each available season
        const testPromises = allSeasons.map(year => testYear(year));
        
        Promise.all(testPromises).then(() => {
            setLoading(false);
        });
    }, [historicalData]);

    if (!historicalData?.rostersBySeason) {
        return <div className="p-4 border border-gray-300 rounded bg-gray-50">
            <h3 className="text-lg font-bold mb-2">Financial Data Debug</h3>
            <p>Waiting for historical data...</p>
        </div>;
    }

    const allSeasons = Object.keys(historicalData.rostersBySeason).sort((a, b) => b - a);

    return (
        <div className="p-4 border border-gray-300 rounded bg-gray-50 mb-4">
            <h3 className="text-lg font-bold mb-4">Financial Data Debug</h3>
            <p className="mb-2"><strong>Available seasons from historicalData:</strong> {allSeasons.join(', ')}</p>
            {loading && <p className="text-blue-600">Testing financial data access...</p>}
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                {allSeasons.map(year => {
                    const result = testResults[year];
                    if (!result) return (
                        <div key={year} className="p-2 rounded bg-yellow-100">
                            <strong>Year {year}:</strong> Testing...
                        </div>
                    );
                    
                    return (
                        <div key={year} className={`p-2 rounded ${
                            result.success && result.hasData ? 'bg-green-100' : 
                            result.success ? 'bg-yellow-100' : 
                            'bg-red-100'
                        }`}>
                            <strong>Year {year}:</strong>
                            {result.success ? (
                                <div className="text-sm">
                                    {result.hasData ? (
                                        <span className="text-green-700">
                                            ✅ {result.transactionCount} transactions
                                        </span>
                                    ) : (
                                        <span className="text-yellow-700">
                                            📄 No transactions
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-red-700">
                                    ❌ Error: {result.error}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FinancialDebug;