'use client';

import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart,
} from 'recharts';

interface Trade {
  id: string;
  pnl: number;
  result: 'win' | 'loss';
  timestamp: string;
  symbol: string;
}

interface EquityChartProps {
  trades: Trade[];
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
}

const TIMEFRAMES = ['1H', '24H', '7D', '30D', 'ALL'];

export const EquityChart = ({ trades, timeframe, onTimeframeChange }: EquityChartProps) => {
  const chartData = useMemo(() => {
    if (!trades.length) return [];

    const sorted = [...trades].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let cumulative = 0;
    return sorted.map((t, i) => {
      cumulative += Number(t.pnl);
      return {
        time: new Date(t.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        pnl: Number(t.pnl),
        equity: Math.round(cumulative * 100) / 100,
        result: t.result,
      };
    });
  }, [trades]);

  const winRate = useMemo(() => {
    if (!trades.length) return 0;
    return ((trades.filter((t) => t.result === 'win').length / trades.length) * 100).toFixed(1);
  }, [trades]);

  const totalPnl = useMemo(() => trades.reduce((s, t) => s + Number(t.pnl), 0), [trades]);

  if (!trades.length) {
    return (
      <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-6">
        <div className="text-center py-8 text-slate-500 font-mono text-xs">
          No trade data yet. Run a bot to populate the chart.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide text-slate-400 text-xs">// P&amp;L Equity Curve</h3>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-md transition-all uppercase tracking-wider ${
                timeframe === tf
                  ? 'bg-gold/10 text-gold border border-gold/20'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#1e293b' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                background: '#0A1929',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'JetBrains Mono',
              }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Equity']}
            />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#equityGradient)"
              dot={false}
              activeDot={{ r: 4, stroke: '#10B981', strokeWidth: 2, fill: '#0A1929' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-800/60">
        <div className="text-center">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Total P&amp;L</p>
          <p className={`text-sm font-bold font-mono mt-0.5 ${totalPnl >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Win Rate</p>
          <p className="text-sm font-bold font-mono mt-0.5 text-white">{winRate}%</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Total Trades</p>
          <p className="text-sm font-bold font-mono mt-0.5 text-white">{trades.length}</p>
        </div>
      </div>
    </div>
  );
};
