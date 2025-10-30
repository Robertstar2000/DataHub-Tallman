
import React, { useState, useMemo } from 'react';
import Card from './Card';
import { getAuditLogs } from '../services/api';
import type { AuditLog as AuditLogType } from '../types';
import { useQuery } from '../hooks/useQuery';

const AuditLog: React.FC = () => {
    const { data: logs = [], isLoading } = useQuery<AuditLogType[]>(['auditLogs'], getAuditLogs);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredLogs = useMemo(() => {
        if (!searchTerm) return logs;
        return logs.filter(log => 
            log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.details.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [logs, searchTerm]);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white">Audit Log</h1>
            <p className="text-slate-400 max-w-3xl">
                A chronological, searchable record of all significant events that have occurred within the data platform.
            </p>
            <Card className="flex flex-col">
                 <input
                    type="text"
                    placeholder="Search logs by user, action, or details..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 mb-4 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
                <div className="flex-grow overflow-y-auto" style={{maxHeight: 'calc(100vh - 250px)'}}>
                    <table className="w-full text-left">
                        <thead className="sticky top-0 bg-slate-800 z-10">
                            <tr>
                                <th className="p-3 font-semibold text-slate-300 w-1/6">Timestamp</th>
                                <th className="p-3 font-semibold text-slate-300 w-1/6">User</th>
                                <th className="p-3 font-semibold text-slate-300 w-1/6">Action</th>
                                <th className="p-3 font-semibold text-slate-300 w-3/6">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {isLoading ? (
                                <tr><td colSpan={4} className="text-center p-4 text-slate-400">Loading logs...</td></tr>
                            ) : filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-800/50">
                                    <td className="p-3 font-mono text-sm text-slate-400">{log.timestamp}</td>
                                    <td className="p-3 text-sm text-slate-200">{log.user}</td>
                                    <td className="p-3 font-mono text-sm text-cyan-300">{log.action}</td>
                                    <td className="p-3 font-mono text-sm text-slate-300"><pre className="whitespace-pre-wrap break-all">{log.details}</pre></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default AuditLog;
