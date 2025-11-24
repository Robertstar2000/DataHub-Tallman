
import React, { forwardRef } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const Card = forwardRef<HTMLDivElement, CardProps>(({ children, className = '', ...rest }, ref) => {
  return (
    <div 
      ref={ref}
      className={`bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export default Card;
