import React from 'react';

interface BadgeProps {
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | 'running' | 'stopped';
}

export const Badge: React.FC<BadgeProps> = ({ status }) => {
  const configs = {
    pending: 'bg-status-warning/10 text-status-warning border border-status-warning/20',
    approved: 'bg-status-success/10 text-status-success border border-status-success/20',
    rejected: 'bg-status-danger/10 text-status-danger border border-status-danger/20',
    suspended: 'bg-slate-800 text-slate-400 border border-slate-700',
    running: 'bg-status-info/10 text-status-info border border-status-info/20 animate-pulse',
    stopped: 'bg-slate-800 text-slate-400 border border-slate-700',
  };

  return (
    <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded font-mono ${configs[status]}`}>
      {status}
    </span>
  );
};
