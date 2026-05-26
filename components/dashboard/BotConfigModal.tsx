'use client';

import React, { useState } from 'react';

interface BotConfig {
  stake: number;
  tickInterval: number;
  maxDrawdown: number;
  maxTradesPerDay: number;
}

interface BotConfigModalProps {
  botType: string;
  botLabel: string;
  config: BotConfig;
  onSave: (botType: string, config: BotConfig) => void;
  onClose: () => void;
}

export const BotConfigModal = ({ botType, botLabel, config, onSave, onClose }: BotConfigModalProps) => {
  const [stake, setStake] = useState(config.stake.toString());
  const [tickInterval, setTickInterval] = useState(config.tickInterval.toString());
  const [maxDrawdown, setMaxDrawdown] = useState(config.maxDrawdown.toString());
  const [maxTrades, setMaxTrades] = useState(config.maxTradesPerDay.toString());

  const handleSave = () => {
    onSave(botType, {
      stake: Math.max(1, Number(stake) || 100),
      tickInterval: Math.max(1, Number(tickInterval) || 5),
      maxDrawdown: Math.min(100, Math.max(1, Number(maxDrawdown) || 20)),
      maxTradesPerDay: Math.max(1, Number(maxTrades) || 50),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-[#0A1929] border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white tracking-wide">{botLabel} Configuration</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg">✕</button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-mono uppercase font-bold text-slate-400 mb-1.5">Stake Amount ($)</label>
            <input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              min={1}
              step={1}
              className="w-full bg-[#000814] border border-slate-800 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase font-bold text-slate-400 mb-1.5">Tick Interval</label>
            <input
              type="number"
              value={tickInterval}
              onChange={(e) => setTickInterval(e.target.value)}
              min={1}
              step={1}
              className="w-full bg-[#000814] border border-slate-800 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase font-bold text-slate-400 mb-1.5">Max Drawdown (%)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                value={maxDrawdown}
                onChange={(e) => setMaxDrawdown(e.target.value)}
                min={1}
                max={50}
                className="flex-1 accent-gold"
              />
              <span className="text-sm font-mono font-bold text-white w-12 text-right">{maxDrawdown}%</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase font-bold text-slate-400 mb-1.5">Max Trades / Day</label>
            <input
              type="number"
              value={maxTrades}
              onChange={(e) => setMaxTrades(e.target.value)}
              min={1}
              step={1}
              className="w-full bg-[#000814] border border-slate-800 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-gold transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-700 text-slate-300 font-bold py-2.5 rounded-lg text-sm hover:bg-slate-800/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-gold text-navy-dark font-bold py-2.5 rounded-lg text-sm hover:bg-gold-light transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
