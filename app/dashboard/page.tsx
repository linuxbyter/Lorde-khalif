'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { createClient } from '../../lib/supabase/client';
import { Sidebar, ViewTab } from '../../components/dashboard/Sidebar';
import { EquityChart } from '../../components/dashboard/EquityChart';
import { BotConfigModal } from '../../components/dashboard/BotConfigModal';
import { TradeDetailPanel } from '../../components/dashboard/TradeDetailPanel';
import { ToastContainer, notify } from '../../components/dashboard/Toast';

interface DerivAccount {
  account_id: string;
  balance: string;
  currency: string;
  account_type: 'demo' | 'real';
}

interface UserNode {
  id: string;
  clerk_user_id: string;
  deriv_token: string;
  selected_account_id: string;
  account_type: 'demo' | 'real';
  status: 'pending_approval' | 'approved' | 'rejected';
  created_at: string;
}

interface Bot {
  id: string;
  user_id: string;
  bot_type: 'v75_mean_reversion' | 'crash500_hunter' | 'boom1000_reversal';
  status: 'running' | 'stopped' | 'error';
  config: any;
}

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

interface BotConfig {
  stake: number;
  tickInterval: number;
  maxDrawdown: number;
  maxTradesPerDay: number;
}

const DEFAULT_BOT_CONFIGS: Record<string, BotConfig> = {
  v75_mean_reversion: { stake: 100, tickInterval: 5, maxDrawdown: 20, maxTradesPerDay: 50 },
  crash500_hunter: { stake: 100, tickInterval: 5, maxDrawdown: 20, maxTradesPerDay: 50 },
  boom1000_reversal: { stake: 100, tickInterval: 5, maxDrawdown: 20, maxTradesPerDay: 50 },
};

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const supabase = createClient();

  const [userNode, setUserNode] = useState<UserNode | null>(null);
  const [derivAccounts, setDerivAccounts] = useState<DerivAccount[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [sessionPnL, setSessionPnL] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [derivToken, setDerivToken] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [timeframe, setTimeframe] = useState('ALL');
  const [configuringBot, setConfiguringBot] = useState<string | null>(null);
  const [botConfigs, setBotConfigs] = useState<Record<string, BotConfig>>(DEFAULT_BOT_CONFIGS);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [tradeFilter, setTradeFilter] = useState<'all' | 'win' | 'loss'>('all');

  useEffect(() => {
    if (isLoaded && user) {
      fetchUserNode();
      const unsubscribe = subscribeToTrades();
      return () => { unsubscribe(); };
    }
  }, [isLoaded, user]);

  const filteredTrades = useMemo(() => {
    let filtered = [...trades];
    if (timeframe !== 'ALL') {
      const now = Date.now();
      const msMap: Record<string, number> = { '1H': 3600000, '24H': 86400000, '7D': 604800000, '30D': 2592000000 };
      const cutoff = now - (msMap[timeframe] || Infinity);
      filtered = filtered.filter((t) => new Date(t.timestamp).getTime() > cutoff);
    }
    if (tradeFilter !== 'all') {
      filtered = filtered.filter((t) => t.result === tradeFilter);
    }
    return filtered;
  }, [trades, timeframe, tradeFilter]);

  const sessionPnLFiltered = useMemo(
    () => filteredTrades.reduce((s, t) => s + Number(t.pnl), 0),
    [filteredTrades]
  );

  const botsRunning = useMemo(() => bots.filter((b) => b.status === 'running').length, [bots]);

  const fetchUserNode = async () => {
    try {
      const { data, error } = await supabase
        .from('user_nodes')
        .select('*')
        .eq('clerk_user_id', user?.id)
        .single();
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user node:', error);
        setIsLoading(false);
        return;
      }
      if (data) {
        setUserNode(data);
        if (data.status === 'approved') {
          fetchBots();
          fetchTrades();
        }
      }
      setIsLoading(false);
    } catch (err) {
      console.error('Exception fetching user node:', err);
      setIsLoading(false);
    }
  };

  const handleConnectDeriv = async () => {
    if (!derivToken.trim()) {
      setConnectionError('Please enter your Deriv token');
      return;
    }
    setIsConnecting(true);
    setConnectionError('');
    try {
      const response = await fetch('/api/user/connect-deriv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: derivToken.trim() }),
      });
      const result = await response.json();
      if (!response.ok) {
        setConnectionError(result.error || 'Failed to connect to Deriv');
        setIsConnecting(false);
        return;
      }
      setDerivAccounts(result.accounts || []);
      setIsConnecting(false);
    } catch (err) {
      setConnectionError('Network error. Please try again.');
      setIsConnecting(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!selectedAccount) {
      setConnectionError('Please select an account');
      return;
    }
    setIsConnecting(true);
    try {
      const accountData = derivAccounts.find((acc) => acc.account_id === selectedAccount);
      const { data, error } = await supabase
        .from('user_nodes')
        .upsert({
          clerk_user_id: user?.id,
          deriv_token: derivToken.trim(),
          selected_account_id: selectedAccount,
          account_type: accountData?.account_type || 'demo',
          status: 'pending_approval',
        }, { onConflict: 'clerk_user_id' })
        .select()
        .single();
      if (error) throw error;
      setUserNode(data);
      setShowConnectionModal(false);
      setIsConnecting(false);
    } catch (err) {
      setConnectionError('Failed to save account. Please try again.');
      setIsConnecting(false);
    }
  };

  const fetchBots = async () => {
    try {
      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .eq('user_id', user?.id);
      if (error) throw error;
      setBots(data || []);
    } catch (err) {
      console.error('Error fetching bots:', err);
    }
  };

  const fetchTrades = async () => {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user?.id)
        .order('timestamp', { ascending: false })
        .limit(100);
      if (error) throw error;
      setTrades(data || []);
      const totalPnL = data?.reduce((sum, trade) => sum + parseFloat(trade.pnl.toString()), 0) || 0;
      setSessionPnL(totalPnL);
    } catch (err) {
      console.error('Error fetching trades:', err);
    }
  };

  const subscribeToTrades = () => {
    const channel = supabase
      .channel('trades_realtime_stream')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trades',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          const newTrade = payload.new as Trade;
          setTrades((prev) => [newTrade, ...prev.slice(0, 99)]);
          setSessionPnL((prev) => prev + parseFloat(newTrade.pnl.toString()));
          notify({
            type: 'trade',
            message: `New ${newTrade.contract_type} on ${newTrade.symbol}`,
            pnl: Number(newTrade.pnl),
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const handleStartBot = async (botType: string) => {
    try {
      const response = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_type: botType, action: 'start' }),
      });
      if (response.ok) {
        notify({ type: 'info', message: `${getBotLabel(botType)} dispatched` });
        fetchBots();
      } else {
        const err = await response.json();
        notify({ type: 'error', message: err.error || 'Failed to start bot' });
      }
    } catch (err) {
      notify({ type: 'error', message: 'Network error starting bot' });
    }
  };

  const handleStopBot = async (botType: string) => {
    try {
      const response = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_type: botType, action: 'stop' }),
      });
      if (response.ok) {
        notify({ type: 'info', message: `${getBotLabel(botType)} terminated` });
        fetchBots();
      } else {
        const err = await response.json();
        notify({ type: 'error', message: err.error || 'Failed to stop bot' });
      }
    } catch (err) {
      notify({ type: 'error', message: 'Network error stopping bot' });
    }
  };

  const handleSaveBotConfig = (botType: string, config: BotConfig) => {
    setBotConfigs((prev) => ({ ...prev, [botType]: config }));
    notify({ type: 'info', message: `${getBotLabel(botType)} config saved` });
  };

  const getBotLabel = (type: string) => {
    switch (type) {
      case 'v75_mean_reversion': return 'V75 Mean Reversion';
      case 'crash500_hunter': return 'Crash 500 Hunter';
      case 'boom1000_reversal': return 'Boom 1000 Reversal';
      default: return type;
    }
  };

  const getBotTrades = (botType: string) => {
    const symbolMap: Record<string, string> = {
      v75_mean_reversion: 'R_75',
      crash500_hunter: 'CRASH500',
      boom1000_reversal: 'BOOM1000',
    };
    const sym = symbolMap[botType];
    return sym ? filteredTrades.filter((t) => t.symbol === sym) : [];
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-[#000814] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFD700]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000814] text-white flex">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        botsRunning={botsRunning}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col min-h-screen">
        <nav className="border-b border-slate-800 bg-[#0A1929]/50 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-slate-400 hover:text-white transition-colors lg:hidden"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-xl font-bold tracking-widest text-[#FFD700]">LORDE AI</h1>
            <span className="text-slate-500 font-mono text-xs hidden sm:inline">/ {activeTab.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-6">
            {userNode?.status === 'approved' && userNode.selected_account_id && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
                <span className={`w-1.5 h-1.5 rounded-full ${userNode.account_type === 'demo' ? 'bg-status-success' : 'bg-status-warning'}`} />
                <span className="text-[10px] font-mono text-slate-400 font-bold">{userNode.selected_account_id.substring(0, 8)}</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600">{userNode.account_type}</span>
              </div>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white font-mono">{user?.primaryEmailAddress?.emailAddress}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">NODE ID: {user?.id.substring(0, 8)}</p>
            </div>
            <UserButton />
          </div>
        </nav>

        {!userNode && (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-12 text-center shadow-2xl max-w-3xl mx-auto my-12">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-[#FFD700]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#FFD700]/20">
                  <svg className="w-10 h-10 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3 tracking-wide">Connect Your Deriv Account</h2>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                  Link your Deriv synthetic indices credentials via our secure hybrid gateway node to unleash automated strategy routing pipelines.
                </p>
                <button
                  onClick={() => setShowConnectionModal(true)}
                  className="bg-[#FFD700] text-[#0A1929] font-bold px-8 py-3 rounded-lg hover:bg-[#FFC700] transition-all transform hover:scale-[1.02] shadow-lg shadow-[#FFD700]/10"
                >
                  Connect Deriv API
                </button>
              </div>
            </div>
          </main>
        )}

        {userNode && userNode.status === 'pending_approval' && (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/30 rounded-xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start gap-4 justify-between">
                <div className="flex gap-4">
                  <div className="mt-1 text-xl">⏳</div>
                  <div>
                    <h3 className="text-lg font-bold text-[#F59E0B] tracking-wide">Deployment Authorization Processing</h3>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                      Your pipeline data model is staged. Direct payment confirmation maps outside the dashboard are managed manually by Lord Khalif. Once your premium membership transaction status is authorized, your automated execution layer will instantly unlock.
                    </p>
                    <div className="mt-4 bg-[#000814] border border-slate-800 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl font-mono text-xs">
                      <p className="text-slate-400">TARGET ACCOUNT ID: <span className="text-white block mt-0.5 font-bold">{userNode.selected_account_id}</span></p>
                      <p className="text-slate-400">INTERFACE TRACKING: <span className="text-white block mt-0.5 uppercase font-bold text-[#FFD700]">{userNode.account_type} cluster</span></p>
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-mono bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 uppercase tracking-wider self-start sm:self-auto font-bold">
                  Pending Approval
                </span>
              </div>
            </div>
          </main>
        )}

        {userNode && userNode.status === 'rejected' && (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-[#EF4444]/5 border border-[#EF4444]/30 rounded-xl p-8 shadow-xl text-center max-w-2xl mx-auto">
              <div className="w-12 h-12 bg-[#EF4444]/10 text-[#EF4444] rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">✕</div>
              <h3 className="text-xl font-bold text-white tracking-wide">Access Authorization Denied</h3>
              <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto leading-relaxed">
                Your platform authorization sequence was rejected. Please contact Lord Khalif via direct chat infrastructure to verify your network licensing status.
              </p>
              <button
                onClick={() => { setUserNode(null); setShowConnectionModal(true); }}
                className="mt-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-5 py-2.5 rounded-lg transition-colors border border-slate-700"
              >
                Configure Alternative Token Node
              </button>
            </div>
          </main>
        )}

        {userNode && userNode.status === 'approved' && (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {activeTab === 'dashboard' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-5 shadow-md flex items-center justify-between">
                    <div>
                      <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest font-bold">Session P&amp;L</p>
                      <p className={`text-2xl font-mono font-bold mt-1 tracking-tight ${sessionPnLFiltered >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {sessionPnLFiltered >= 0 ? '+' : ''}${sessionPnLFiltered.toFixed(2)}
                      </p>
                    </div>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${sessionPnLFiltered >= 0 ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                      $
                    </div>
                  </div>
                  <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-5 shadow-md flex items-center justify-between">
                    <div>
                      <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest font-bold">Active Threads</p>
                      <p className="text-2xl font-mono font-bold text-white mt-1 tracking-tight">
                        {botsRunning} <span className="text-slate-600 text-sm font-normal">/ 3</span>
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg flex items-center justify-center text-lg">⚙️</div>
                  </div>
                  <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-5 shadow-md flex items-center justify-between">
                    <div>
                      <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest font-bold">Total Contracts</p>
                      <p className="text-2xl font-mono font-bold text-white mt-1 tracking-tight">{filteredTrades.length}</p>
                    </div>
                    <div className="w-10 h-10 bg-[#FFD700]/10 text-[#FFD700] rounded-lg flex items-center justify-center text-lg">📊</div>
                  </div>
                  <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-5 shadow-md flex items-center justify-between">
                    <div>
                      <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest font-bold">Win Rate</p>
                      <p className="text-2xl font-mono font-bold text-white mt-1 tracking-tight">
                        {filteredTrades.length > 0
                          ? `${((filteredTrades.filter((t) => t.result === 'win').length / filteredTrades.length) * 100).toFixed(1)}%`
                          : '0.0%'}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-[#10B981]/10 text-[#10B981] rounded-lg flex items-center justify-center text-lg">🏆</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2">
                    <EquityChart
                      trades={filteredTrades}
                      timeframe={timeframe}
                      onTimeframeChange={setTimeframe}
                    />
                  </div>
                  <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-6">
                    <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-4">// Bot Performance Summary</h3>
                    <div className="space-y-4">
                      {['v75_mean_reversion', 'crash500_hunter', 'boom1000_reversal'].map((botType) => {
                        const botTrades = getBotTrades(botType);
                        const wins = botTrades.filter((t) => t.result === 'win').length;
                        const botPnl = botTrades.reduce((s, t) => s + Number(t.pnl), 0);
                        const botInst = bots.find((b) => b.bot_type === botType);
                        return (
                          <div key={botType} className="bg-[#000814]/60 border border-slate-800/60 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {botInst?.status === 'running' && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
                                )}
                                <span className="text-xs font-bold text-white font-mono">{getBotLabel(botType)}</span>
                              </div>
                              <span className={`text-[10px] font-mono font-bold ${botPnl >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                                {botPnl >= 0 ? '+' : ''}${botPnl.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex gap-3 text-[10px] font-mono text-slate-500">
                              <span>{botTrades.length} trades</span>
                              <span>{botTrades.length > 0 ? `${((wins / botTrades.length) * 100).toFixed(0)}% WR` : '—'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">// Tactical Core Strategy Arrays</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {['v75_mean_reversion', 'crash500_hunter', 'boom1000_reversal'].map((botType) => {
                      const botInstance = bots.find((b) => b.bot_type === botType);
                      const isRunning = botInstance?.status === 'running';
                      const cfg = botConfigs[botType];
                      const botTrades = getBotTrades(botType);
                      const botWins = botTrades.filter((t) => t.result === 'win').length;
                      const botPnl = botTrades.reduce((s, t) => s + Number(t.pnl), 0);

                      return (
                        <div
                          key={botType}
                          className={`bg-[#0A1929] border rounded-xl p-6 flex flex-col justify-between transition-all duration-300 shadow-xl group ${
                            isRunning ? 'border-[#3B82F6]/40 hover:border-[#3B82F6]/60' : 'border-slate-800 hover:border-[#FFD700]/30'
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-center mb-4">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono font-bold tracking-widest bg-[#FFD700]/5 text-[#FFD700] border border-[#FFD700]/10 px-2.5 py-0.5 rounded-md uppercase">
                                  {botType.split('_')[0]} INDEX
                                </span>
                                {isRunning && <span className="w-2 h-2 rounded-full bg-status-success animate-pulse shadow-sm shadow-status-success/50" />}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-md font-mono text-[10px] font-bold tracking-wider uppercase border ${
                                  isRunning
                                    ? 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20'
                                    : 'bg-slate-800/40 text-slate-400 border-slate-700/50'
                                }`}>
                                  {isRunning ? 'Running' : 'Stopped'}
                                </span>
                                <button
                                  onClick={() => setConfiguringBot(botType)}
                                  className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800/60 transition-colors"
                                  title="Configure bot"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <h4 className="text-lg font-bold text-white tracking-wide group-hover:text-[#FFD700] transition-colors">{getBotLabel(botType)}</h4>
                            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                              {botType === 'v75_mean_reversion' && 'Bollinger Bands and RSI extreme confluence structural reversion engine.'}
                              {botType === 'crash500_hunter' && 'Monitors macro step volume triggers to execute counter-trend algorithmic calls.'}
                              {botType === 'boom1000_reversal' && 'Tracks momentum trend lines across tick velocity metrics with strict risk metrics.'}
                            </p>
                            {botTrades.length > 0 && (
                              <div className="mt-3 flex gap-3 text-[10px] font-mono">
                                <span className="text-slate-500">{botTrades.length} trades</span>
                                <span className="text-slate-500">{botTrades.length > 0 ? `${((botWins / botTrades.length) * 100).toFixed(0)}% WR` : '—'}</span>
                                <span className={`font-bold ${botPnl >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                                  {botPnl >= 0 ? '+' : ''}${botPnl.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-6 pt-4 border-t border-slate-800/60 space-y-3 font-mono text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">STAKE AMOUNT:</span>
                              <span className="text-white font-bold">${cfg.stake.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">TICK INTERVAL:</span>
                              <span className="text-white">{cfg.tickInterval} Ticks</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">KILLSWITCH DRAWDOWN:</span>
                              <span className="text-[#EF4444] font-bold">{cfg.maxDrawdown}.0%</span>
                            </div>
                            <div className="pt-2">
                              {isRunning ? (
                                <button
                                  onClick={() => handleStopBot(botType)}
                                  className="w-full bg-[#EF4444] hover:bg-[#EF4444]/90 text-white text-xs font-bold font-mono py-2.5 rounded-lg transition-colors tracking-widest uppercase"
                                >
                                  Terminate Execution
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStartBot(botType)}
                                  className="w-full bg-[#FFD700] hover:bg-[#FFC700] text-[#0A1929] text-xs font-bold font-mono py-2.5 rounded-lg transition-colors tracking-widest uppercase shadow-md shadow-[#FFD700]/5"
                                >
                                  Dispatch Bot Engine
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">// Automated Order Ledger Stream</h2>
                    <div className="w-2.5 h-2.5 bg-[#10B981] rounded-full animate-pulse shadow-lg shadow-[#10B981]/50" title="Live Sync Subscriptions Engaged" />
                  </div>

                  {filteredTrades.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                      <p className="text-slate-500 font-mono text-xs uppercase">Staging cluster synchronized. Fire up a tactical bot card configuration above to map incoming trades live.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider">
                            <th className="py-3 px-4">TIME</th>
                            <th className="py-3 px-4">SYMBOL</th>
                            <th className="py-3 px-4">TYPE</th>
                            <th className="py-3 px-4 text-right">ENTRY</th>
                            <th className="py-3 px-4 text-right">EXIT</th>
                            <th className="py-3 px-4 text-right">P&amp;L</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {filteredTrades.slice(0, 50).map((trade) => (
                            <React.Fragment key={trade.id}>
                              <tr
                                onClick={() => setExpandedTrade(expandedTrade === trade.id ? null : trade.id)}
                                className="hover:bg-[#000814]/40 transition-colors cursor-pointer"
                              >
                                <td className="py-3 px-4 text-slate-400">
                                  {new Date(trade.timestamp).toLocaleTimeString()}
                                </td>
                                <td className="py-3 px-4 font-bold text-white">{trade.symbol}</td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    trade.contract_type === 'CALL' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                                  }`}>
                                    {trade.contract_type}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right text-slate-300">{trade.entry_price.toFixed(2)}</td>
                                <td className="py-3 px-4 text-right text-slate-300">{trade.exit_price.toFixed(2)}</td>
                                <td className={`py-3 px-4 text-right font-bold ${trade.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                  {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                                </td>
                              </tr>
                              {expandedTrade === trade.id && (
                                <tr>
                                  <td colSpan={6} className="p-0">
                                    <TradeDetailPanel trade={trade} onClose={() => setExpandedTrade(null)} />
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'analytics' && (
              <>
                <EquityChart
                  trades={filteredTrades}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-6">
                    <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-4">// Win / Loss Distribution</h3>
                    {filteredTrades.length > 0 ? (
                      <div className="space-y-3">
                        {['v75_mean_reversion', 'crash500_hunter', 'boom1000_reversal'].map((botType) => {
                          const bt = getBotTrades(botType);
                          const wins = bt.filter((t) => t.result === 'win').length;
                          const losses = bt.filter((t) => t.result === 'loss').length;
                          const total = bt.length;
                          if (!total) return null;
                          return (
                            <div key={botType}>
                              <div className="flex justify-between text-xs font-mono mb-1">
                                <span className="text-white font-bold">{getBotLabel(botType)}</span>
                                <span className="text-slate-400">{wins}W / {losses}L</span>
                              </div>
                              <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
                                <div
                                  className="bg-status-success transition-all duration-500"
                                  style={{ width: `${(wins / total) * 100}%` }}
                                />
                                <div
                                  className="bg-status-danger transition-all duration-500"
                                  style={{ width: `${(losses / total) * 100}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-500 font-mono text-xs text-center py-8">No data yet.</p>
                    )}
                  </div>
                  <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-6">
                    <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-4">// Per-Bot P&amp;L Contribution</h3>
                    {filteredTrades.length > 0 ? (
                      <div className="space-y-4">
                        {['v75_mean_reversion', 'crash500_hunter', 'boom1000_reversal'].map((botType) => {
                          const bt = getBotTrades(botType);
                          const pnl = bt.reduce((s, t) => s + Number(t.pnl), 0);
                          const totalPnl = filteredTrades.reduce((s, t) => s + Number(t.pnl), 0);
                          const pct = totalPnl !== 0 ? (pnl / totalPnl) * 100 : 0;
                          return (
                            <div key={botType}>
                              <div className="flex justify-between text-xs font-mono mb-1">
                                <span className="text-white font-bold">{getBotLabel(botType)}</span>
                                <span className={`font-bold ${pnl >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                                  {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
                                <div
                                  className={`transition-all duration-500 ${pnl >= 0 ? 'bg-status-success' : 'bg-status-danger'}`}
                                  style={{ width: `${Math.abs(pct)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-500 font-mono text-xs text-center py-8">No data yet.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'history' && (
              <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-6 shadow-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">// Full Trade History</h2>
                  <div className="flex gap-2">
                    {(['all', 'win', 'loss'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setTradeFilter(f)}
                        className={`px-3 py-1.5 text-[10px] font-mono font-bold rounded-md uppercase tracking-wider transition-all ${
                          tradeFilter === f
                            ? 'bg-gold/10 text-gold border border-gold/20'
                            : 'text-slate-500 hover:text-slate-300 border border-transparent'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredTrades.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-xl">
                    <p className="text-slate-500 font-mono text-xs uppercase">No trades match your filter criteria.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4">Timestamp</th>
                          <th className="py-3 px-4">Symbol</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4 text-right">Entry</th>
                          <th className="py-3 px-4 text-right">Exit</th>
                          <th className="py-3 px-4 text-right">Stake</th>
                          <th className="py-3 px-4 text-right">P&amp;L</th>
                          <th className="py-3 px-4 text-center">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {filteredTrades.map((trade) => (
                          <tr key={trade.id} className="hover:bg-[#000814]/30 transition-colors">
                            <td className="py-3 px-4 text-slate-400">{new Date(trade.timestamp).toLocaleString()}</td>
                            <td className="py-3 px-4 font-bold text-white">{trade.symbol}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                trade.contract_type === 'CALL' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                              }`}>
                                {trade.contract_type}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-slate-300">{trade.entry_price.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right text-slate-300">{trade.exit_price.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right text-slate-300">${Number(trade.stake).toFixed(2)}</td>
                            <td className={`py-3 px-4 text-right font-bold ${trade.pnl >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                              {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                trade.result === 'win' ? 'bg-status-success/10 text-status-success' : 'bg-status-danger/10 text-status-danger'
                              }`}>
                                {trade.result}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">// Bot Configuration Panel</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {['v75_mean_reversion', 'crash500_hunter', 'boom1000_reversal'].map((botType) => {
                    const cfg = botConfigs[botType];
                    return (
                      <div key={botType} className="bg-[#0A1929] border border-slate-800 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">{getBotLabel(botType)}</h3>
                        <div className="space-y-4 font-mono text-sm">
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Stake ($)</label>
                            <p className="text-white font-bold">${cfg.stake.toFixed(2)}</p>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Tick Interval</label>
                            <p className="text-white font-bold">{cfg.tickInterval} ticks</p>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Max Drawdown</label>
                            <p className="text-status-danger font-bold">{cfg.maxDrawdown}%</p>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Max Trades / Day</label>
                            <p className="text-white font-bold">{cfg.maxTradesPerDay}</p>
                          </div>
                          <button
                            onClick={() => setConfiguringBot(botType)}
                            className="w-full border border-gold/30 text-gold font-bold py-2 rounded-lg text-xs hover:bg-gold/5 transition-colors mt-2"
                          >
                            Edit Configuration
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        )}

        {showConnectionModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#0A1929] border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                onClick={() => { setShowConnectionModal(false); setConnectionError(''); setDerivAccounts([]); }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors text-lg"
              >
                ✕
              </button>
              <h3 className="text-xl font-bold text-white tracking-wide mb-2">Configure Gateway Credentials</h3>

              {derivAccounts.length === 0 ? (
                <div className="mt-4 space-y-4">
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Provide your backend infrastructure <span className="text-[#FFD700] font-bold">Personal Access Token (PAT)</span> to fetch available portfolio indices.
                  </p>
                  <div>
                    <label className="block text-xs font-mono uppercase font-bold text-slate-400 mb-2">Deriv Bearer Token Node</label>
                    <input
                      type="password"
                      value={derivToken}
                      onChange={(e) => setDerivToken(e.target.value)}
                      placeholder="pat_19981df..."
                      className="w-full bg-[#000814] border border-slate-800 rounded-lg px-4 py-3 text-white placeholder-slate-600 font-mono text-xs focus:outline-none focus:border-[#FFD700] transition-colors"
                    />
                  </div>
                  {connectionError && (
                    <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3 text-xs text-[#EF4444] font-mono">
                      {connectionError}
                    </div>
                  )}
                  <button
                    onClick={handleConnectDeriv}
                    disabled={isConnecting}
                    className="w-full bg-[#FFD700] hover:bg-[#FFC700] text-[#0A1929] font-bold py-3 rounded-lg text-xs tracking-wider font-mono uppercase transition-opacity disabled:opacity-50"
                  >
                    {isConnecting ? 'Querying Deriv Node...' : 'Query Handshake Token'}
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Select target deployment node interface mapping account ID below:
                  </p>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {derivAccounts.map((account) => (
                      <label
                        key={account.account_id}
                        className={`block border rounded-xl p-4 cursor-pointer transition-all ${
                          selectedAccount === account.account_id
                            ? 'border-[#FFD700] bg-[#FFD700]/5'
                            : 'border-slate-800 hover:border-slate-700 bg-[#000814]/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="deriv_target_account_radio"
                          value={account.account_id}
                          checked={selectedAccount === account.account_id}
                          onChange={(e) => setSelectedAccount(e.target.value)}
                          className="sr-only"
                        />
                        <div className="flex items-center justify-between font-mono text-xs">
                          <div>
                            <p className="font-bold text-white text-sm">{account.account_id}</p>
                            <p className="text-[10px] text-slate-500 uppercase mt-0.5 tracking-wider font-bold">{account.account_type} Portfolio</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[#10B981] font-bold text-sm">${parseFloat(account.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            <p className="text-[10px] text-slate-500 uppercase mt-0.5">{account.currency}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {connectionError && (
                    <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3 text-xs text-[#EF4444] font-mono">
                      {connectionError}
                    </div>
                  )}
                  <button
                    onClick={handleSaveAccount}
                    disabled={isConnecting || !selectedAccount}
                    className="w-full bg-[#FFD700] hover:bg-[#FFC700] text-[#0A1929] font-bold py-3 rounded-lg text-xs tracking-wider font-mono uppercase transition-opacity disabled:opacity-50"
                  >
                    {isConnecting ? 'Registering Cluster Node...' : 'Confirm Node Matrix'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {configuringBot && (
          <BotConfigModal
            botType={configuringBot}
            botLabel={getBotLabel(configuringBot)}
            config={botConfigs[configuringBot]}
            onSave={handleSaveBotConfig}
            onClose={() => setConfiguringBot(null)}
          />
        )}

        <ToastContainer />
      </div>
    </div>
  );
}
