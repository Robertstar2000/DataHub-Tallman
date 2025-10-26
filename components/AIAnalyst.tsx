

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Card from './Card';
import { 
    getAiSqlResponseStream, 
    getWorkflows, 
    getTableSchemas,
    analyzeTableWithAi,
    searchDocumentsWithAi,
    analyzeWorkflowWithAi
} from '../services/api';
import type { Workflow } from '../types';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type AnalysisMode = 'DATABASE' | 'TABLE' | 'DOCUMENTS' | 'WORKFLOW';

const modeConfig: Record<AnalysisMode, { label: string; examples: string[]; placeholder: string; contextLabel?: string }> = {
    DATABASE: {
        label: 'Query SQL Database',
        examples: [
            "Which customer has spent the most money?",
            "What is our best-selling product by revenue?",
            "Show total order value by date as a line chart.",
            "List all orders for 'Innovate Corp'.",
        ],
        placeholder: 'Ask a question about the entire database...',
    },
    TABLE: {
        label: 'Analyze a Table',
        examples: [
            "What is the schema of this table?",
            "Show me the first 5 records.",
            "Are there any null values in the credit_limit column?",
            "What's the average credit limit?",
        ],
        placeholder: 'Ask a question about the selected table...',
        contextLabel: 'Table',
    },
    DOCUMENTS: {
        label: 'Search Documents',
        examples: [
            "Find documents related to 'CloudBook Pro battery life'.",
            "What are the main issues with the 'Mechanic Keyboard'?",
            "Search for sales strategy meeting notes.",
            "Who are the main contacts for 'Project Phoenix'?",
        ],
        placeholder: 'Perform a semantic search on unstructured documents...',
    },
    WORKFLOW: {
        label: 'Analyze a Workflow',
        examples: [
            "Explain what this workflow does in simple terms.",
            "What are the sources and destinations for this pipeline?",
            "Does this workflow have any dependencies?",
            "How could this workflow be optimized?",
        ],
        placeholder: 'Ask a question about the selected workflow...',
        contextLabel: 'Workflow',
    },
};

const getCategoryForTable = (tableName: string): string => {
    if (tableName.startsWith('p21_')) return 'P21 ERP';
    if (tableName.startsWith('por_')) return 'Point of Rental';
    if (tableName.startsWith('qc_')) return 'Quality Control';
    if (tableName.startsWith('mfg_')) return 'Manufacturing';
    if (tableName.startsWith('cascade_')) return 'Cascade Inventory';
    if (tableName.startsWith('wordpress_')) return 'WordPress CMS';
    if (tableName.startsWith('teams_')) return 'Microsoft Teams';
    if (tableName.startsWith('gdrive_')) return 'Google Drive';
    if (tableName.startsWith('stackoverflow_')) return 'Stack Overflow';
    if (tableName.startsWith('daily_sales_metrics')) return 'Reporting';
    if (tableName.startsWith('prediction_')) return 'Predictive Analytics';
    return 'General';
};

const Loader: React.FC = () => (
  <div className="flex items-center space-x-2">
    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
  </div>
);

interface HistoryMessage {
  role: 'user' | 'model';
  parts: string;
  chart?: {
    chartType: 'Bar' | 'Line' | 'Pie';
    title: string;
    data: any[];
  };
}

const COLORS = ['#06b6d4', '#818cf8', '#f87171', '#fbbf24', '#a3e635', '#f472b6'];

const ChartRenderer: React.FC<{chart: HistoryMessage['chart']}> = ({ chart }) => {
    if (!chart || !chart.data || chart.data.length === 0) return null;
    
    return (
        <div className="my-4 bg-slate-950/50 p-4 rounded-lg">
            <h4 className="font-semibold text-slate-200 mb-4">{chart.title}</h4>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    { chart.chartType === 'Bar' ? (
                        <BarChart data={chart.data} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} interval={0} angle={-30} textAnchor="end" />
                            <YAxis stroke="#9ca3af" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} cursor={{fill: 'rgba(100, 116, 139, 0.1)'}} />
                            <Bar dataKey="value" fill="#06b6d4" />
                        </BarChart>
                    ) : chart.chartType === 'Line' ? (
                        <LineChart data={chart.data} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} interval={'preserveStartEnd'} />
                            <YAxis stroke="#9ca3af" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                            <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2} dot={{ r: 4, fill: '#06b6d4' }} activeDot={{ r: 8 }}/>
                        </LineChart>
                    ) : chart.chartType === 'Pie' ? (
                        <PieChart>
                            <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                {chart.data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                            <Legend />
                        </PieChart>
                    ) : null}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const AIAnalyst: React.FC = () => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [history, setHistory] = useState<HistoryMessage[]>([]);
    const [error, setError] = useState('');
    
    const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('DATABASE');
    const [tableList, setTableList] = useState<string[]>([]);
    const [workflowList, setWorkflowList] = useState<Workflow[]>([]);
    const [selectedContextId, setSelectedContextId] = useState<string>('');

    // State for enhanced table selection
    const [sources, setSources] = useState<string[]>([]);
    const [selectedSource, setSelectedSource] = useState('All');
    const [tableSearchTerm, setTableSearchTerm] = useState('');

    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadContextData = async () => {
            try {
                const [schemas, workflows] = await Promise.all([getTableSchemas(), getWorkflows()]);
                const tables = Object.keys(schemas);
                setTableList(tables);
                setWorkflowList(workflows);
                
                if (tables.length > 0) {
                    const uniqueSources = ['All', ...new Set(tables.map(getCategoryForTable))].sort((a,b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));
                    setSources(uniqueSources);
                }

                if (tables.length > 0) setSelectedContextId(tables[0]);
            } catch (err) {
                console.error("Failed to load context data:", err);
                setError("Could not load table and workflow lists for analysis.");
            }
        };
        loadContextData();
    }, []);

    const filteredTableOptions = useMemo(() => {
        if (analysisMode !== 'TABLE') return [];
        return tableList.filter(table => {
            const sourceMatch = selectedSource === 'All' || getCategoryForTable(table) === selectedSource;
            const searchMatch = table.toLowerCase().includes(tableSearchTerm.toLowerCase());
            return sourceMatch && searchMatch;
        });
    }, [analysisMode, tableList, selectedSource, tableSearchTerm]);

    useEffect(() => {
        setHistory([]);
        setQuery('');
        setError('');
        // Reset table filters when mode changes
        setSelectedSource('All');
        setTableSearchTerm('');

        if (analysisMode === 'TABLE' && tableList.length > 0) {
            setSelectedContextId(tableList[0]);
        } else if (analysisMode === 'WORKFLOW' && workflowList.length > 0) {
            setSelectedContextId(workflowList[0].id);
        } else {
            setSelectedContextId('');
        }
    }, [analysisMode, tableList, workflowList]);

    useEffect(() => {
        if (analysisMode === 'TABLE') {
            if (filteredTableOptions.length > 0) {
                if (!filteredTableOptions.includes(selectedContextId)) {
                    setSelectedContextId(filteredTableOptions[0]);
                }
            } else {
                setSelectedContextId('');
            }
        }
    }, [filteredTableOptions, analysisMode, selectedContextId]);


    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);
    
    const handleQuerySubmit = async (e: React.FormEvent | null, prompt?: string) => {
        if (e) e.preventDefault();
        const userQuery = prompt || query;

        if (!userQuery.trim() || 
           ((analysisMode === 'TABLE' || analysisMode === 'WORKFLOW') && !selectedContextId)) {
            return;
        }

        setIsLoading(true);
        setError('');
        setQuery('');

        setHistory(prev => [...prev, { role: 'user', parts: userQuery }, { role: 'model', parts: '', chart: undefined }]);
        
        try {
            let stream;
            switch(analysisMode) {
                case 'DATABASE':
                    stream = await getAiSqlResponseStream(userQuery);
                    break;
                case 'TABLE':
                    stream = await analyzeTableWithAi(selectedContextId, userQuery);
                    break;
                case 'DOCUMENTS':
                    stream = await searchDocumentsWithAi(userQuery);
                    break;
                case 'WORKFLOW':
                    stream = await analyzeWorkflowWithAi(selectedContextId, userQuery);
                    break;
            }
          
            for await (const chunk of stream) {
                setHistory(prev => {
                    const newHistory = [...prev];
                    const lastMessage = newHistory[newHistory.length - 1];
                    
                    if (chunk.status === 'chart_data' && chunk.chart) {
                        lastMessage.chart = chunk.chart;
                    } else if (chunk.status && chunk.text) {
                        if (chunk.status === 'error') {
                            lastMessage.parts = `Error: ${chunk.text}`;
                            setError(chunk.text);
                        } else {
                           // Simple text stream or final answer from SQL flow
                           lastMessage.parts += chunk.text;
                        }
                    }
                    return newHistory;
                });
            }
        } catch (err: any) {
            setError('Failed to get response from AI Analyst: ' + err.message);
            console.error(err);
            setHistory(prev => {
                const newHistory = [...prev];
                newHistory[newHistory.length-1].parts = 'An error occurred while processing your request.';
                return newHistory;
            });
        } finally {
            setIsLoading(false);
        }
    };
  
    const handleExampleClick = (exampleQuery: string) => {
        setQuery(exampleQuery);
        handleQuerySubmit(null, exampleQuery);
    }

    const renderResponse = (content: string) => {
        const sqlRegex = /```sql\n([\s\S]*?)\n```/g;
        const parts = content.split(sqlRegex);
    
        return parts.map((part, i) => {
            if (i % 2 === 1) {
                return (
                    <pre key={i} className="bg-slate-950 p-3 rounded-md text-cyan-300 font-mono text-sm my-2 overflow-x-auto">
                        <code>{part.trim()}</code>
                    </pre>
                );
            }
            const textParts = part.split(/(\*\*.*?\*\*)/g).filter(Boolean);
            return textParts.map((textPart, j) => {
                if (textPart.startsWith('**') && textPart.endsWith('**')) {
                    return <strong key={`${i}-${j}`}>{textPart.slice(2, -2)}</strong>;
                }
                // Convert markdown-style lists to HTML lists
                return textPart.split('\n').map((line, k) => {
                    if (line.trim().startsWith('- ')) {
                        return <li key={`${i}-${j}-${k}`} className="ml-4 list-disc">{line.substring(2)}</li>;
                    }
                    return <p key={`${i}-${j}-${k}`} className="inline">{line}</p>;
                });
            });
        });
    };

    const currentModeConfig = modeConfig[analysisMode];
    
    return (
        <div className="space-y-4 flex flex-col h-full">
            <h1 className="text-3xl font-bold text-white">AI Data Analyst</h1>
            <p className="text-slate-400">
                Select an analysis mode to ask questions, perform searches, or analyze components of your data lake.
            </p>
            
            <Card className="flex-none flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label htmlFor="analysis-mode" className="block text-sm font-medium text-slate-400 mb-1">Analysis Mode</label>
                    <select id="analysis-mode" value={analysisMode} onChange={e => setAnalysisMode(e.target.value as AnalysisMode)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                        {Object.entries(modeConfig).map(([key, { label }]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>

                {analysisMode === 'TABLE' && (
                    <>
                        <div className="flex-1 min-w-[200px]">
                            <label htmlFor="source-select" className="block text-sm font-medium text-slate-400 mb-1">Source</label>
                            <select id="source-select" value={selectedSource} onChange={e => setSelectedSource(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                {sources.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label htmlFor="table-search" className="block text-sm font-medium text-slate-400 mb-1">Search Table</label>
                            <input id="table-search" type="text" value={tableSearchTerm} onChange={e => setTableSearchTerm(e.target.value)} placeholder="Filter by name..." className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                        </div>
                    </>
                )}

                {currentModeConfig.contextLabel && (
                    <div className="flex-1 min-w-[200px]">
                        <label htmlFor="context-select" className="block text-sm font-medium text-slate-400 mb-1">{currentModeConfig.contextLabel}</label>
                        <select id="context-select" value={selectedContextId} onChange={e => setSelectedContextId(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                            {analysisMode === 'TABLE' ? (
                                filteredTableOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)
                            ) : analysisMode === 'WORKFLOW' ? (
                                workflowList.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)
                            ) : null}
                        </select>
                    </div>
                )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {currentModeConfig.examples.map((q) => (
                    <button key={q} onClick={() => handleExampleClick(q)} disabled={isLoading} className="p-3 bg-slate-800 rounded-lg text-left text-sm text-slate-300 hover:bg-slate-700/50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        {q}
                    </button>
                ))}
            </div>

            <Card className="flex-grow flex flex-col">
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    {history.length === 0 && !isLoading && (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-slate-500">Ask a question to begin analysis.</p>
                        </div>
                    )}
                    {history.map((msg, index) => (
                        <div key={index} className={`p-4 rounded-lg ${msg.role === 'user' ? 'bg-cyan-900/50' : 'bg-slate-900/50'}`}>
                            <h3 className="font-semibold mb-2 capitalize">{msg.role === 'model' ? <span className="text-cyan-400">AI Analyst</span> : 'You'}</h3>
                            {msg.parts && <div className="prose prose-invert prose-p:text-slate-300 prose-strong:text-white whitespace-pre-wrap">{renderResponse(msg.parts)}</div>}
                            {msg.chart && <ChartRenderer chart={msg.chart} />}
                            {isLoading && index === history.length - 1 && msg.role === 'model' && <div className="mt-2"><Loader /></div>}
                        </div>
                    ))}
                    {error && !isLoading && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start space-x-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <h3 className="font-semibold text-red-300">An Error Occurred</h3>
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
                
                <form onSubmit={handleQuerySubmit} className="mt-4 flex gap-4">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={currentModeConfig.placeholder}
                        className="flex-grow bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !query.trim()}
                        className="bg-cyan-500 text-white font-semibold px-6 py-2 rounded-lg hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                        Ask
                    </button>
                </form>
            </Card>
        </div>
    );
};

export default AIAnalyst;