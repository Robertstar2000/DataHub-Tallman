
import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, className = '', ...props }) => {
  const baseClasses = 'font-semibold px-4 py-2 rounded-lg transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed';
  
  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-cyan-500 text-white hover:bg-cyan-600',
    secondary: 'bg-slate-700 text-white hover:bg-slate-600',
    danger: 'bg-red-800/80 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-slate-300 hover:bg-slate-700/50',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
