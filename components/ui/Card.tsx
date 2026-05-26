import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, title, className = '' }) => {
  return (
    <div className={`bg-navy-light border border-slate-800 rounded-lg p-5 transition-all duration-300 hover:border-gold/40 ${className}`}>
      {title && (
        <h3 className="text-lg font-bold text-white mb-4 tracking-wide border-b border-slate-800 pb-2">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
};
