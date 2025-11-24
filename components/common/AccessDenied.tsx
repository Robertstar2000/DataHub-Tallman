
import React from 'react';
import Card from '../Card';

export const AccessDenied: React.FC = () => (
    <div className="flex items-center justify-center h-full">
        <Card className="border-red-500/50 bg-red-900/20 max-w-md text-center p-8">
            <div className="mx-auto w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-slate-300">You do not have the required permissions (Admin) to view this area or perform this action.</p>
        </Card>
    </div>
);
