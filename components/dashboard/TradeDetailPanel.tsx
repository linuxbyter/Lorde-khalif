'use client';

import React from 'react';

interface Trade {
  id: string;
  contract_type: 'CALL' | 'PUT';
  symbol: string;
  entry_price: number;
  exit_price: number;
  stake: number;
  pnl: number;
  result: 'win' | 'loss';
  timestamp: string;
}

interface TradeDetailPanelProps {
  trade: Trade;
  onClose: () => void;
}

export const TradeDetailPanel = ({ trade, onClose }: TradeDetailPanelProps) => {
  const duration = trade.entry_price && trade.exit_price
    ? Math.abs(trade.exit_price - trade.entry_price)
    : 0;

  return (
    <div className="bg-[#000814]/80 border-t border-slate-800/60 px-4 py-4 animate-fadeIn">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">Contract Details</span>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-xs transition-colors">Close</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Contract ID</p>
          <p className="text-white font-bold mt-0.5 break-all">{trade.id.substring(0, 12)}...</p>
        </div>
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Stake</p>
          <p className="text-white font-bold mt-0.5">${Number(trade.stake).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Entry → Exit</p>
          <p className="text-white font-bold mt-0.5">{trade.entry_price.toFixed(2)} → {trade.exit_price.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Time</p>
          <p className="text-white font-bold mt-0.5">{new Date(trade.timestamp).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};
