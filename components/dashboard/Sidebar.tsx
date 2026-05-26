'use client';

import React from 'react';

export type ViewTab = 'dashboard' | 'analytics' | 'history' | 'settings';

interface SidebarProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  botsRunning: number;
  isCollapsed: boolean;
  onToggle: () => void;
}

const tabs: { id: ViewTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'analytics', label: 'Analytics', icon: '◆' },
  { id: 'history', label: 'Trade History', icon: '◇' },
  { id: 'settings', label: 'Bot Settings', icon: '⚙' },
];

export const Sidebar = ({ activeTab, onTabChange, botsRunning, isCollapsed, onToggle }: SidebarProps) => {
  return (
    <>
      {!isCollapsed && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onToggle} />
      )}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen z-40 bg-[#0A1929] border-r border-slate-800 flex flex-col transition-all duration-300 ${
          isCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-16' : 'translate-x-0 w-64'
        }`}
      >
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-800 shrink-0">
          {isCollapsed ? (
            <button onClick={onToggle} className="text-gold text-xl font-bold mx-auto">L</button>
          ) : (
            <>
              <span className="text-gold font-bold text-xl tracking-widest">LORDE</span>
              <span className="text-[10px] font-mono text-slate-600 tracking-widest font-bold">v1.0</span>
            </>
          )}
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { onTabChange(tab.id); if (window.innerWidth < 1024) onToggle(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gold/10 text-gold border border-gold/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <span className="text-lg shrink-0">{tab.icon}</span>
                {!isCollapsed && (
                  <>
                    <span className="truncate">{tab.label}</span>
                    {tab.id === 'dashboard' && botsRunning > 0 && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-status-success animate-pulse shadow-sm shadow-status-success/50" />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        <div className={`px-4 py-4 border-t border-slate-800 ${isCollapsed ? 'text-center' : ''}`}>
          <button
            onClick={onToggle}
            className="text-slate-600 hover:text-slate-400 transition-colors text-sm"
          >
            {isCollapsed ? '→' : 'Collapse'}
          </button>
        </div>
      </aside>
    </>
  );
};
