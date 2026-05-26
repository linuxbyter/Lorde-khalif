'use client';

import React, { useEffect, useState } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { createClient } from '../../lib/supabase/client';


// Architectural Interfaces
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

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const supabase = createClient();

  // Core Platform State
  const [userNode, setUserNode] = useState<UserNode | null>(null);
  const [derivAccounts, setDerivAccounts] = useState<DerivAccount[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [sessionPnL, setSessionPnL] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Deriv Handshake Modal State
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [derivToken, setDerivToken] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  // Initial Sync Lifecycle
  useEffect(() => {
    if (isLoaded && user) {
      fetchUserNode();
      const unsubscribe = subscribeToTrades();
      return () => {
        unsubscribe();
      };
    }
  }, [isLoaded, user]);

  // Read User Status Node from Supabase
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

  // Step 1: Query API to Validate Personal Access Token and Extract Account Array
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

  // Step 2: Store Chosen Node Specifications and Set State to Pending Approval
  const handleSaveAccount = async () => {
    if (!selectedAccount) {
      setConnectionError('Please select an account');
      return;
    }

    setIsConnecting(true);

    try {
      const accountData = derivAccounts.find(acc => acc.account_id === selectedAccount);

      const { data, error } = await supabase
        .from('user_nodes')
        .insert({
          clerk_user_id: user?.id,
          deriv_token: derivToken.trim(),
          selected_account_id: selectedAccount,
          account_type: accountData?.account_type || 'demo',
          status: 'pending_approval',
        })
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

  // Pull Active Strategies Engine Configurations
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

  // Pull History Batch Data
  const fetchTrades = async () => {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user?.id)
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;
      setTrades(data || []);

      const totalPnL = data?.reduce((sum, trade) => sum + parseFloat(trade.pnl.toString()), 0) || 0;
      setSessionPnL(totalPnL);
    } catch (err) {
      console.error('Error fetching trades:', err);
    }
  };

  // Real-time Event Subscriptions via Supabase Channels
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
          setTrades((prev) => [newTrade, ...prev.slice(0, 19)]);
          setSessionPnL((prev) => prev + parseFloat(newTrade.pnl.toString()));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Dispatches Activation Target Command Loop
  const handleStartBot = async (botType: string) => {
    try {
      const response = await fetch('/api/bots/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botType }), // Matches Claude's expected key parameter
      });

      if (response.ok) {
        fetchBots();
      }
    } catch (err) {
      console.error('Error starting bot:', err);
    }
  };

  // Dispatches Termination Command Loop
  const handleStopBot = async (botId: string) => {
    try {
      const response = await fetch('/api/bots/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId }), // Matches Claude's expected key parameter
      });

      if (response.ok) {
        fetchBots();
      }
    } catch (err) {
      console.error('Error stopping bot:', err);
    }
  };

  const getBotLabel = (type: string) => {
    switch (type) {
      case 'v75_mean_reversion': return 'V75 Mean Reversion';
      case 'crash500_hunter': return 'Crash 500 Hunter';
      case 'boom1000_reversal': return 'Boom 1000 Reversal';
      default: return type;
    }
  };

  // Render Spinner if Client Hooks haven't loaded
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-[#000814] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFD700]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000814] text-white flex flex-col font-sans">
      
      {/* Top Navigation Bar with Identity Controllers */}
      <nav className="border-b border-slate-800 bg-[#0A1929]/50 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-widest text-[#FFD700]">LORDE AI</h1>
          <span className="text-slate-500 font-mono text-xs hidden sm:inline">/ CORE OPERATIONAL TERMINAL</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white font-mono">{user?.primaryEmailAddress?.emailAddress}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">NODE ID: {user?.id.substring(0, 8)}</p>
          </div>
          <UserButton />
        </div>
      </nav>

      {/* Main Workspace Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* State Conditional View 1: Unconnected Instance Profile */}
        {!userNode && (
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
        )}

        {/* State Conditional View 2: Account Awaiting Lord Khalif Approval Banners */}
        {userNode && userNode.status === 'pending_approval' && (
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
        )}

        {/* State Conditional View 3: Administrative Access Suspension Panel */}
        {userNode && userNode.status === 'rejected' && (
          <div className="bg-[#EF4444]/5 border border-[#EF4444]/30 rounded-xl p-8 shadow-xl text-center max-w-2xl mx-auto">
            <div className="w-12 h-12 bg-[#EF4444]/10 text-[#EF4444] rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">✕</div>
            <h3 className="text-xl font-bold text-white tracking-wide">Access Authorization Denied</h3>
            <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto leading-relaxed">
              Your platform authorization sequence was rejected. Please contact Lord Khalif via direct chat infrastructure to verify your network licensing status.
            </p>
            <button
              onClick={() => {
                setUserNode(null);
                setShowConnectionModal(true);
              }}
              className="mt-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-5 py-2.5 rounded-lg transition-colors border border-slate-700"
            >
              Configure Alternative Token Node
            </button>
          </div>
        )}

        {/* State Conditional View 4: Core Approved SaaS Working Terminal Dashboard layout */}
        {userNode && userNode.status === 'approved' && (
          <>
            {/* Global Metrics Metrics Banner Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-5 shadow-md flex items-center justify-between">
                <div>
                  <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest font-bold">Session Metrics P&L</p>
                  <p className={`text-2xl font-mono font-bold mt-1 tracking-tight ${sessionPnL >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {sessionPnL >= 0 ? '+' : ''}${sessionPnL.toFixed(2)}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${sessionPnL >= 0 ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                  $
                </div>
              </div>

              <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-5 shadow-md flex items-center justify-between">
                <div>
                  <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest font-bold">Active Threads</p>
                  <p className="text-2xl font-mono font-bold text-white mt-1 tracking-tight">
                    {bots.filter(b => b.status === 'running').length} <span className="text-slate-600 text-sm font-normal">/ 3</span>
                  </p>
                </div>
                <div className="w-10 h-10 bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg flex items-center justify-center text-lg">⚙️</div>
              </div>

              <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-5 shadow-md flex items-center justify-between">
                <div>
                  <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest font-bold">Total Dispatched Contracts</p>
                  <p className="text-2xl font-mono font-bold text-white mt-1 tracking-tight">{trades.length}</p>
                </div>
                <div className="w-10 h-10 bg-[#FFD700]/10 text-[#FFD700] rounded-lg flex items-center justify-center text-lg">📊</div>
              </div>

              <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-5 shadow-md flex items-center justify-between">
                <div>
                  <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest font-bold">Strategic Win Rate</p>
                  <p className="text-2xl font-mono font-bold text-white mt-1 tracking-tight">
                    {trades.length > 0 
                      ? `${((trades.filter(t => t.result === 'win').length / trades.length) * 100).toFixed(1)}%`
                      : '0.0%'
                    }
                  </p>
                </div>
                <div className="w-10 h-10 bg-[#10B981]/10 text-[#10B981] rounded-lg flex items-center justify-center text-lg">🏆</div>
              </div>
            </div>

            {/* Strategic Algorithmic Grid Cluster Control Modules */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold tracking-wide text-white font-mono uppercase text-slate-400 text-xs">// Tactical Core Strategy Arrays</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['v75_mean_reversion', 'crash500_hunter', 'boom1000_reversal'].map((botType) => {
                  const botInstance = bots.find(b => b.bot_type === botType);
                  const isRunning = botInstance?.status === 'running';

                  return (
                    <div key={botType} className="bg-[#0A1929] border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-[#FFD700]/30 transition-all duration-300 shadow-xl group">
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-mono font-bold tracking-widest bg-[#FFD700]/5 text-[#FFD700] border border-[#FFD700]/10 px-2.5 py-0.5 rounded-md uppercase">
                            {botType.split('_')[0]} INDEX
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-md font-mono text-[10px] font-bold tracking-wider uppercase border ${
                            isRunning 
                              ? 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20' 
                              : 'bg-slate-800/40 text-slate-400 border-slate-700/50'
                          }`}>
                            {isRunning ? 'RUNNING' : 'STOPPED'}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold text-white tracking-wide group-hover:text-[#FFD700] transition-colors">{getBotLabel(botType)}</h4>
                        <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                          {botType === 'v75_mean_reversion' && 'Bollinger Bands and RSI extreme confluence structural reversion engine.'}
                          {botType === 'crash500_hunter' && 'Monitors macro step volume triggers to execute counter-trend algorithmic calls.'}
                          {botType === 'boom1000_reversal' && 'Tracks momentum trend lines across tick velocity metrics with strict risk metrics.'}
                        </p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-800/60 space-y-3 font-mono text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">STAKE AMOUNT:</span>
                          <span className="text-white font-bold">$100.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">TICK INTERVAL:</span>
                          <span className="text-white">5 Ticks</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">KILLSWITCH DRAWDOWN:</span>
                          <span className="text-[#EF4444] font-bold">20.0%</span>
                        </div>

                        <div className="pt-2">
                          {isRunning ? (
                            <button
                              onClick={() => handleStopBot(botInstance!.id)}
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

            {/* Realtime Ledger Logs Data Mapping */}
            <div className="bg-[#0A1929] border border-slate-800 rounded-xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-md font-bold text-white font-mono uppercase tracking-wide text-slate-400 text-xs">// Automated Order Ledger Stream</h2>
                <div className="w-2.5 h-2.5 bg-[#10B981] rounded-full animate-pulse shadow-lg shadow-[#10B981]/50" title="Live Sync Subscriptions Engaged"></div>
              </div>
              
              {trades.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                  <p className="text-slate-500 font-mono text-xs uppercase">Staging cluster synchronized. Fire up a tactical bot card configuration above to map incoming trades live.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">TIMESTAMP</th>
                        <th className="py-3 px-4">SYMBOL INDEX</th>
                        <th className="py-3 px-4">CONTRACT TYPE</th>
                        <th className="py-3 px-4 text-right">ENTRY VALUE</th>
                        <th className="py-3 px-4 text-right">EXIT VALUE</th>
                        <th className="py-3 px-4 text-right">PROFIT / LOSS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {trades.map((trade) => (
                        <tr key={trade.id} className="hover:bg-[#000814]/30 transition-colors">
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
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Two-Stage Execution Connection Handshake Overlay Modal */}
      {showConnectionModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0A1929] border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowConnectionModal(false);
                setConnectionError('');
                setDerivAccounts([]);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors text-lg"
            >
              ✕
            </button>

            <h3 className="text-xl font-bold text-white tracking-wide mb-2">Configure Gateway Credentials</h3>

            {derivAccounts.length === 0 ? (
              // Phase Step 1 Form view layout
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
              // Phase Step 2 Form view radio selection matrix
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

    </div>
  );
}