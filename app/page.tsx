import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#000814] text-white flex flex-col justify-between selection:bg-gold/30">
      {/* Premium Glass Header */}
      <header className="border-b border-slate-800/60 bg-navy/80 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gold font-bold text-2xl tracking-widest font-sans drop-shadow-[0_0_12px_rgba(255,215,0,0.2)]">
              LORDE AI
            </span>
            <span className="bg-gold/10 text-gold text-[9px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded border border-gold/30 font-mono">
              MVP v1.0
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/sign-in" className="text-sm font-semibold text-slate-300 hover:text-gold transition-colors duration-200">
              Sign In
            </Link>
            <Link href="/sign-up" className="bg-gold text-navy-dark px-5 py-2 rounded font-bold text-sm hover:bg-gold-light active:scale-95 transition-all shadow-md shadow-gold/10">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Main Presentation Tier */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-20 flex flex-col items-center justify-center">
        <div className="text-center max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-bold font-sans tracking-tight text-white leading-[1.1] mb-6">
            Automate Your Trading with <span className="text-gold bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">Premium Algorithmic</span> Execution
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-base md:text-lg leading-relaxed mb-10">
            Connect your Deriv API keys to unlock advanced quantitative systems optimized for high-yield synthetic asset indices. Private access strictly handled via coordinator authorization.
          </p>

          <div className="flex flex-wrap gap-4 justify-center items-center mb-24">
            <Link href="/sign-up" className="bg-gold text-navy-dark px-8 py-4 rounded text-base font-bold hover:bg-gold-light transition-all shadow-xl shadow-gold/10 hover:-translate-y-0.5">
              Access Trading Platform
            </Link>
            <a href="#strategies" className="border border-slate-800 bg-navy/30 text-slate-300 px-8 py-4 rounded text-base font-semibold hover:border-gold/50 hover:text-gold transition-all">
              Explore Strategies
            </a>
          </div>
        </div>

        {/* Premium Dark Strategy Grid */}
        <section id="strategies" className="w-full pt-16 border-t border-slate-900">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-wide text-white">Institutional Grade Strategies</h2>
            <p className="text-slate-500 text-sm mt-2">Continuous volatility assessment engines configured for 24/7 deployment.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
            {/* Strategy 1 */}
            <div className="bg-navy border border-slate-800/80 p-8 rounded-xl relative overflow-hidden group hover:border-gold/30 transition-all duration-300 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <span className="text-xs font-mono text-gold font-bold uppercase tracking-widest bg-gold/5 border border-gold/20 px-3 py-1 rounded">
                    Volatility 75 Index
                  </span>
                  <span className="text-slate-500 bg-slate-900 p-1.5 rounded-full text-xs">🔒</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-white tracking-wide">V75 Mean Reversion Bot</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Utilizes localized Bollinger Band volatility expansions mapped with an overarching 14-period RSI indicator to trace extreme structural overextensions.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>STAKE: $100</span>
                <span>PROTECTION: 20% DD</span>
              </div>
            </div>

            {/* Strategy 2 */}
            <div className="bg-navy border border-slate-800/80 p-8 rounded-xl relative overflow-hidden group hover:border-gold/30 transition-all duration-300 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <span className="text-xs font-mono text-gold font-bold uppercase tracking-widest bg-gold/5 border border-gold/20 px-3 py-1 rounded">
                    Crash 500 Index
                  </span>
                  <span className="text-slate-500 bg-slate-900 p-1.5 rounded-full text-xs">🔒</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-white tracking-wide">Crash 500 Spike Hunter</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Tracks sudden algorithmic spikes greater than 5% within a single tick, dropping immediate reversal executions to trade systemic flash recoveries.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>STAKE: $100</span>
                <span>COOLDOWN: 30 MINS</span>
              </div>
            </div>

            {/* Strategy 3 */}
            <div className="bg-navy border border-slate-800/80 p-8 rounded-xl relative overflow-hidden group hover:border-gold/30 transition-all duration-300 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <span className="text-xs font-mono text-gold font-bold uppercase tracking-widest bg-gold/5 border border-gold/20 px-3 py-1 rounded">
                    Boom 1000 Index
                  </span>
                  <span className="text-slate-500 bg-slate-900 p-1.5 rounded-full text-xs">🔒</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-white tracking-wide">Boom 1000 Reversal Bot</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Identifies parabolic trend acceleration on hyper-extended volume profiles, managing dynamic trailing risk profiles across structural reversals.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>STAKE: $100</span>
                <span>TRAILING STOP: 15%</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-950 bg-[#00040a] text-center py-6 text-xs text-slate-600 font-mono tracking-wider">
        &copy; 2026 LORDE AI. PRIVATE MEMBERSHIP ACCESS ONLY.
      </footer>
    </div>
  );
}
