import React from 'react';

const TradeTicker = ({ recentTrades, loadingTrades, errorTrades, getMappedTeamName, renderTradeAsset }) => {
  return (
    <section className="w-full">
      {loadingTrades ? (
        <></> // Display nothing while loading
      ) : errorTrades ? (
        <p className="text-red-500 px-4 md:px-0 text-center">Error: {errorTrades}</p>
      ) : recentTrades && recentTrades.length > 0 ? (
        <div id="trade-ticker-container" className="overflow-x-auto whitespace-nowrap">
          <div className="inline-flex gap-4 animate-ticker-scroll items-center">
            {[...recentTrades, ...recentTrades].map((trade, index) => (
              <div key={`<span class="math-inline">\{trade\.transaction\_id\}\-</span>{index}`} className="
                border border-[#bfbfbf] rounded-md shadow-sm p-2.5
                flex flex-col flex-shrink-0
                min-w-[280px] min-h-[220px]
                overflow-y-hidden
              ">
                <h3 className="
                  flex justify-center font-semibold text-[11px] text-gray-700 tracking-wide
                  pb-1 mb-1 border-b-2 border-[#0070c0] text-center
                ">
                  Trade Completed - Week {trade.week}
                </h3>
                <div className="flex flex-nowrap justify-center items-start w-full h-full gap-0">
                  {trade.participants.map((participant, pIndex) => (
                    <React.Fragment key={participant.rosterId}>
                      <div className="flex flex-col flex-shrink-0 items-center p-0.5 min-w-[120px]">
                        <div className="flex flex-col items-center gap-1 mb-1 pb-1.5 border-b border-[#ff0000] w-full">
                          <img src={participant.managerAvatar} alt={`${participant.teamName} avatar`} className="w-5 h-5 rounded-full object-cover border border-[#ff0000]" onError={(e) => e.target.src = 'https://placehold.co/32x32/cccccc/333333?text=M' } />
                          <span className="font-semibold text-[10px] text-[#0070c0] text-center break-words max-w-full">{getMappedTeamName(participant.teamName)}</span>
                        </div>
                        <div className="flex flex-col gap-1 flex-grow w-full">
                          {participant.receivedAssets.length > 0 && participant.receivedAssets.map((asset, assetIndex) => <div key={assetIndex}>{renderTradeAsset(asset, 'received')}</div>)}
                          {participant.receivedAssets.length > 0 && participant.sentAssets.length > 0 && (
                            <div className="pt-2"></div>
                          )}
                          {participant.sentAssets.length > 0 && participant.sentAssets.map((asset, assetIndex) => <div key={assetIndex}>{renderTradeAsset(asset, 'sent')}</div>)}
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-gray-600 px-4 md:px-0 text-center">No recent trades data available. Please ensure your Trade Ticker Apps Script URL is correct and data is being returned.</p>
      )}
    </section>
  );
};

export default TradeTicker;
