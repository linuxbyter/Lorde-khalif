import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</label>}
      <input
        className={`bg-navy-dark border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gold transition-all font-sans placeholder:text-slate-600 ${className}`}
        {...props}
      />
    </div>
  );
};
