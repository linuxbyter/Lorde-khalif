import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseStyles = 'px-4 py-2.5 rounded font-semibold text-sm transition-all duration-200 tracking-wide disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-gold text-navy-dark hover:bg-gold-light active:bg-gold-dark shadow-md shadow-gold/10',
    secondary: 'border border-gold text-gold hover:bg-gold hover:text-navy-dark',
    danger: 'bg-status-danger text-white hover:bg-red-600',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
