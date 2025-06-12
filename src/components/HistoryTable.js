import React from 'react';

const HistoryTable = ({ googleSheetHistory, loadingGoogleSheet, errorGoogleSheet, getMappedTeamName }) => {
  return (
    <section className="w-full">
      <h2 className="text-2xl font-bold text-[#0070c0] mb-4 border-b-2 border-[#bfbfbf] pb-2 text-center">
        League History (Power Rankings / General Data)
      </h2>
      {loadingGoogleSheet ? (
        <p className="text-gray-600">Loading league history from Google Sheet...</p>
      ) : errorGoogleSheet ? (
        <p className="text-red-500">Error: {errorGoogleSheet}</p>
      ) : googleSheetHistory ? (
        <div>
          {googleSheetHistory.data && googleSheetHistory.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow">
                <thead className="bg-[#bfbfbf]">
                  <tr>
                    {Object.keys(googleSheetHistory.data[0]).map((header) => (
                      <th key={header} className="py-3 px-4 text-left text-sm font-semibold text-[#0070c0] uppercase tracking-wider">
                        {header.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {googleSheetHistory.data.map((row, index) => {
                    const processedRow = Object.values(row).map(value =>
                      getMappedTeamName(value)
                    );
                    return (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        {processedRow.map((value, idx) => (
                          <td key={idx} className="py-2 px-4 text-sm text-gray-700 border-b border-gray-200">
                            {value}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600">No general historical data found in Google Sheet.</p>
          )}
        </div>
      ) : (
        <p className="text-gray-600">No Google Sheet history data available.</p>
      )}
      <p className="mt-4 text-sm text-gray-500">
        <a href="https://developers.google.com/apps-script/guides/web" target="_blank" rel="noopener noreferrer" className="text-[#0070c0] hover:underline">
          Learn how to expose your Google Sheet as an API using Google Apps Script.
        </a>
      </p>
    </section>
  );
};

export default HistoryTable;
