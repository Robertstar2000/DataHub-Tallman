

import React, { useState, useEffect, useRef } from 'react';
import Card from './Card';
import { getLoadedMcpServers } from '../services/api';
import type { McpServer, OtherInterface } from '../types';
import { mcpFunctions } from '../data/mcpFunctions';
import { otherInterfaces, interfaceIcons } from '../data/mcpServers';

// Mock data and types
type QueryFrequency = 'real-time' | '5m' | '1h' | 'daily';
const FREQUENCY_OPTIONS: { value: QueryFrequency; label: string }[] = [
    { value: 'real-time', label: 'Real-time' },
    { value: '5m', label: 'Every 5 minutes' },
    { value: '1h', label: 'Every hour' },
    { value: 'daily', label: 'Daily' },
];

interface McpConfig {
    queryFrequency: QueryFrequency;
}

interface IoLog {
    id: number;
    timestamp: string;
    message: string;
}

const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const generateMockLog = (mcpName: string, type: 'uploads' | 'downloads'): { log: IoLog; functionName: string } => {
    const templateKey = Object.keys(mcpFunctions).find(key => mcpName.includes(key)) || 'Default';
    const availableFunctions = mcpFunctions[templateKey][type];
    const selectedFunction = getRandomElement(availableFunctions);
    
    let message = selectedFunction.template;

    // Replace placeholders
    message = message.replace('{n}', String(getRandomInt(1, 20)));
    message = message.replace('{c_name}', getRandomElement(['Innovate Corp', 'Builders LLC', 'New Horizons']));
    message = message.replace('{sku}', getRandomElement(['CB-PRO', 'QM-01', 'SW-JOINT-V2']));
    message = message.replace('{asset}', getRandomElement(['Excavator EX-500', 'Scissor Lift SL-30']));

    const log = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        message,
    };
    
    return { log, functionName: selectedFunction.name };
};

const InterfaceList: React.FC = () => (
    <div className="overflow-y-auto space-y-2 pr-2 -mr-2 max-h-[250px]">
        {otherInterfaces.map(iface => (
            <div key={iface.name} className="p-3 bg-slate-900/50 rounded-lg">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-slate-800 rounded-md flex items-center justify-center">
                            {interfaceIcons[iface.type]}
                        </div>
                        <div>
                            <p className="font-semibold text-slate-200">{iface.name}</p>
                            <p className="text-xs text-slate-400">{iface.description}</p>
                        </div>
                    </div>
                     <div className="flex items-center text-xs font-semibold text-green-400 whitespace-nowrap">
                        <span className="w-2 h-2 rounded-full mr-2 bg-green-500 animate-pulse"></span>
                        {iface.status}
                    </div>
                </div>
            </div>
        ))}
    </div>
);


const IoManagement: React.FC = () => {
    const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
    const [selectedMcpId, setSelectedMcpId] = useState<string | null>(null);
    const [highlightedFunction, setHighlightedFunction] = useState<{ type: 'uploads' | 'downloads', name: string } | null>(null);
    
    const [configs, setConfigs] = useState<Record<string, McpConfig>>({});
    const [logs, setLogs] = useState<Record<string, { uploads: IoLog[], downloads: IoLog[] }>>({});

    const intervalRef = useRef<number | null>(null);
    const highlightTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const loadServers = async () => {
            const loadedServers = await getLoadedMcpServers();
            setMcpServers(loadedServers);
            if (loadedServers.length > 0) {
                setSelectedMcpId(loadedServers[0].id);
                // Initialize configs and logs for fetched servers
                setConfigs(prev => {
                    const newConfigs = {...prev};
                    loadedServers.forEach(s => {
                        if (!newConfigs[s.id]) newConfigs[s.id] = { queryFrequency: '5m' };
                    });
                    return newConfigs;
                });
                setLogs(prev => {
                    const newLogs = {...prev};
                    loadedServers.forEach(s => {
                        if (!newLogs[s.id]) newLogs[s.id] = { uploads: [], downloads: [] };
                    });
                    return newLogs;
                });
            }
        };
        loadServers();
    }, []);

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);

        if (selectedMcpId) {
            const selectedMcp = mcpServers.find(s => s.id === selectedMcpId);
            if (!selectedMcp) return;

            intervalRef.current = window.setInterval(() => {
                const logType = Math.random() > 0.5 ? 'uploads' : 'downloads';
                const { log: newLog, functionName } = generateMockLog(selectedMcp.name, logType);
                
                setLogs(prevLogs => ({
                    ...prevLogs,
                    [selectedMcpId]: {
                        ...prevLogs[selectedMcpId],
                        [logType]: [newLog, ...prevLogs[selectedMcpId][logType]].slice(0, 50)
                    }
                }));
                
                setHighlightedFunction({ type: logType, name: functionName });
                if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
                highlightTimeoutRef.current = window.setTimeout(() => setHighlightedFunction(null), 2000);

            }, 2500);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        };
    }, [selectedMcpId, mcpServers]);

    const handleConfigChange = (mcpId: string, newConfig: Partial<McpConfig>) => {
        setConfigs(prev => ({
            ...prev,
            [mcpId]: { ...prev[mcpId], ...newConfig }
        }));
    };

    const selectedMcp = mcpServers.find(s => s.id === selectedMcpId);
    const selectedMcpLogs = (selectedMcpId && logs[selectedMcpId]) ? logs[selectedMcpId] : { uploads: [], downloads: [] };
    const selectedMcpConfig = (selectedMcpId && configs[selectedMcpId]) ? configs[selectedMcpId] : null;

    return (
        <div className="space-y-6 h-full flex flex-col">
            <h1 className="text-3xl font-bold text-white">I/O Management</h1>
            <p className="text-slate-400 max-w-3xl">
                Monitor and configure the data ingress (uploads) and egress (downloads) for each connected Model Content Protocol (MCP) server.
            </p>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
                {/* Left: MCP List & Non-MCP Interfaces */}
                 <div className="lg:col-span-1 flex flex-col gap-6">
                    <Card className="flex flex-col">
                        <h2 className="text-xl font-semibold text-white mb-4">Loaded MCPs</h2>
                        <ul className="overflow-y-auto space-y-2 pr-2 -mr-2">
                            {mcpServers.map(server => (
                                <li
                                    key={server.id}
                                    onClick={() => setSelectedMcpId(server.id)}
                                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                                        selectedMcpId === server.id
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'hover:bg-slate-700/50 text-slate-300'
                                    }`}
                                >
                                    <h3 className="font-semibold">{server.name}</h3>
                                    <p className="text-sm text-slate-400 truncate">{server.url}</p>
                                </li>
                            ))}
                        </ul>
                    </Card>
                    
                    <Card className="flex flex-col">
                        <h2 className="text-xl font-semibold text-white mb-4">Coded & API Interfaces</h2>
                        <InterfaceList />
                    </Card>
                </div>
                
                {/* Right: Details & Logs */}
                <Card className="lg:col-span-2 flex flex-col">
                    {!selectedMcp ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-slate-400">Select an MCP to view its I/O details.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="flex-none">
                                <h2 className="text-2xl font-bold text-white">{selectedMcp.name}</h2>
                                <p className="text-slate-400 mb-4">{selectedMcp.description}</p>
                            </div>
                            
                            {/* Function List Section */}
                            <div className="flex-none grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <FunctionList title="Upload Functions" mcpName={selectedMcp.name} type="uploads" highlightedFunction={highlightedFunction} />
                                <FunctionList title="Download Functions" mcpName={selectedMcp.name} type="downloads" highlightedFunction={highlightedFunction} />
                            </div>

                             {/* Config Section */}
                            <div className="flex-none mb-6 p-4 bg-slate-900/50 rounded-lg">
                                <label htmlFor="query-frequency" className="block text-slate-300 font-semibold mb-2">Query Frequency</label>
                                <select
                                    id="query-frequency"
                                    value={selectedMcpConfig?.queryFrequency}
                                    onChange={(e) => handleConfigChange(selectedMcp.id, { queryFrequency: e.target.value as QueryFrequency })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                >
                                    {FREQUENCY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                                <p className="text-xs text-slate-500 mt-2">Sets how often the data lake polls this MCP for new data.</p>
                            </div>

                            {/* Logs Section */}
                            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
                                <LogPanel title="Uploads (MCP → Data Lake)" logs={selectedMcpLogs.uploads} direction="up" />
                                <LogPanel title="Downloads (Data Lake → MCP)" logs={selectedMcpLogs.downloads} direction="down" />
                            </div>
                        </div>
                    )}
                </Card>
            </div>
             <style>{`
                @keyframes fade-in-top { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-top { animation: fade-in-top 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
};

const FunctionList: React.FC<{
    title: string;
    mcpName: string;
    type: 'uploads' | 'downloads';
    highlightedFunction: { type: 'uploads' | 'downloads'; name: string } | null;
}> = ({ title, mcpName, type, highlightedFunction }) => {
    const templateKey = Object.keys(mcpFunctions).find(key => mcpName.includes(key)) || 'Default';
    const functions = mcpFunctions[templateKey][type];

    return (
        <div className="bg-slate-900/50 rounded-lg p-3">
            <h3 className="text-md font-semibold text-slate-200 mb-2">{title}</h3>
            <ul className="space-y-1">
                {functions.map(func => {
                    const isHighlighted = highlightedFunction?.type === type && highlightedFunction?.name === func.name;
                    return (
                        <li 
                            key={func.name} 
                            className={`px-2 py-1 text-sm font-mono rounded-md transition-all duration-200 ${
                                isHighlighted 
                                ? 'bg-cyan-500/20 text-cyan-300 scale-105' 
                                : 'bg-slate-800/60 text-slate-400'
                            }`}
                        >
                            {func.name}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};


const LogPanel: React.FC<{ title: string; logs: IoLog[]; direction: 'up' | 'down'}> = ({ title, logs, direction }) => {
    const Icon = direction === 'up' ? 
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-green-400"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg> :
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-yellow-400"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" /></svg>;
        
    return (
        <div className="bg-slate-900/50 rounded-lg p-3 flex flex-col h-full">
            <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">{Icon} {title}</h3>
            <div className="overflow-y-auto flex-grow pr-2 -mr-2 space-y-2">
                {logs.length > 0 ? (
                    logs.map(log => (
                        <div key={log.id} className="text-sm p-2 bg-slate-800/60 rounded-md animate-fade-in-top">
                            <p className="font-mono text-slate-300">{log.message}</p>
                            <p className="text-xs text-slate-500 text-right">{log.timestamp}</p>
                        </div>
                    ))
                ) : <p className="text-sm text-slate-500 text-center pt-8">Awaiting I/O events...</p>}
            </div>
        </div>
    );
};


export default IoManagement;