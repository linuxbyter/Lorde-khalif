'use client';

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface DiscoveredAccount {
  account_id: string;
  balance: string;
  currency: string;
  account_type: 'real' | 'demo';
}

export const ConnectDerivForm = () => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<DiscoveredAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const handleScanToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setAccounts([]);
    
    try {
      const res = await fetch('/api/user/connect-deriv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      setAccounts(data.accounts);
      // Auto-select the demo account if available
      const demo = data.accounts.find((a: DiscoveredAccount) => a.account_type === 'demo');
      if (demo) setSelectedAccountId(demo.account_id);
    } catch (err: any) {
      setError(err.message || 'An error occurred during verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApproval = async () => {
    // This will connect to your database save endpoint in Phase 3
    alert(`Account linked! Saving Account ID: ${selectedAccountId}`);
  };

  return (
    <div className="bg-[#132F4C] border border-slate-800 rounded-xl p-6 max-w-xl w-full mx-auto shadow-xl">
      <h2 className="text-xl font-bold text-white mb-2 tracking-wide">Connect Trading Node</h2>
      <p className="text-xs text-slate-400 mb-6">
        Paste your Deriv Personal Access Token below. Our deployment system will automatically map your secure account pipelines.
      </p>

      <form onSubmit={handleScanToken} className="space-y-4">
        <Input
          label="Deriv Personal Access Token (PAT)"
          type="password"
          placeholder="pat_19981df..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={loading}
        />
        
        {error && <p className="text-xs text-status-danger font-mono bg-status-danger/10 p-2.5 rounded border border-status-danger/20">{error}</p>}

        {accounts.length === 0 && (
          <Button type="submit" fullWidth variant="primary" disabled={loading}>
            {loading ? 'Interrogating Endpoints...' : 'Scan Token & Fetch Accounts'}
          </Button>
        )}
      </form>

      {accounts.length > 0 && (
        <div className="mt-6 space-y-4 pt-6 border-t border-slate-800/80 animate-fadeIn">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Select Targeting Account</label>
          
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div
                key={acc.account_id}
                onClick={() => setSelectedAccountId(acc.account_id)}
                className={`p-4 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                  selectedAccountId === acc.account_id
                    ? 'border-gold bg-gold/5 shadow-md shadow-gold/5'
                    : 'border-slate-800 bg-[#000814]/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${acc.account_type === 'demo' ? 'bg-status-success' : 'bg-status-danger'}`} />
                  <div>
                    <p className="text-sm font-mono font-bold text-white">{acc.account_id}</p>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{acc.account_type} Account</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold text-gold">
                    {acc.currency} {parseFloat(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <Button onClick={handleSubmitApproval} fullWidth variant="secondary" className="mt-4">
            Save Credentials & Request Access Approval
          </Button>
        </div>
      )}
    </div>
  );
};
