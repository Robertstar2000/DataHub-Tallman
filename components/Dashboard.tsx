
import React, { useState, useEffect } from 'react';
import Card from './Card';
import { getDashboardStats, getLoadedMcpServers } from '../services/api';
import type { WorkflowStatus, McpServer } from '../types';
import type { View } from '../App';
import { useQuery, invalidateQuery } from '../hooks/useQuery';
import Button from './common/Button';

interface StatusData {
  mcpCount: number;
  workflowCounts: Record<WorkflowStatus, number>;
  dbStats: any; 
  vectorStats: any; 
}

interface Anomaly {
    id: number;
    metric: string;
    change: string;
    severity: 'Warning' | 'Critical';
    timestamp: string;
}

interface DashboardProps {
  setCurrentView: (view: View) => void;
}

const SkeletonBox: React.FC<{className?: string}> = ({ className }) => <div className={`bg-slate-700/50 rounded-lg animate-pulse ${className}`} />;

const StatCardSkeleton: React.FC = () => (
    <Card>
        <div className="flex items-center">
            <SkeletonBox className="w-12 h-12 rounded-lg mr-4" />
            <div className="flex-1">
                <SkeletonBox className="h-4 w-2/3 mb-2" />
                <SkeletonBox className="h-8 w-1/3" />
            </div>
        </div>
    </Card>
);

const DashboardSkeleton: React.FC = () => (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
          <SkeletonBox className="h-9 w-1/3" />
          <SkeletonBox className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="lg:col-span-1 h-60"><SkeletonBox className="w-full h-full" /></Card>
            <Card className="lg:col-span-1 h-60"><SkeletonBox className="w-full h-full" /></Card>
        </div>
        <Card className="h-60"><SkeletonBox className="w-full h-full" /></Card>
    </div>
);


const Dashboard: React.FC<DashboardProps> = ({ setCurrentView }) => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  const { data: statusData, isLoading: isStatsLoading, refetch: refetchStats } = useQuery<StatusData>(['dashboardStats'], getDashboardStats);
  const { data: loadedMcps, isLoading: isMcpsLoading, refetch: refetchMcps } = useQuery<McpServer[]>(['loadedMcpServers'], getLoadedMcpServers);

  const mockAnomalies: Omit<Anomaly, 'id' | 'timestamp'>[] = [
      { metric: 'P21 Order Ingestion', change: '-45% vs. 7-day avg', severity: 'Critical' },
      { metric: 'API Latency (HubSpot)', change: '+120% vs. hourly avg', severity: 'Warning' },
      { metric: 'New Customer Signups', change: '+300% last hour', severity: 'Warning' },
      { metric: 'DB CPU Utilization', change: '89% sustained', severity: 'Critical' },
  ];

  useEffect(() => {
    const anomalyInterval = setInterval(() => {
        const newAnomalyData = mockAnomalies[Math.floor(Math.random() * mockAnomalies.length)];
        const newAnomaly: Anomaly = {
            ...newAnomalyData,
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString(),
        };
        setAnomalies(prev => [newAnomaly, ...prev].slice(0, 5));
    }, 8000); // Add a new anomaly every 8 seconds

    return () => clearInterval(anomalyInterval);
  }, []);

  const handleRefresh = () => {
    refetchStats();
    refetchMcps();
  };
  
  const isLoading = isStatsLoading || isMcpsLoading;

  const StatCard: React.FC<{title: string, value: string | number, icon: React.ReactNode, tooltipText: string}> = ({ title, value, icon, tooltipText }) => (
    <div className="relative group">
      <Card>
        <div className="flex items-center">
          <div className="p-3 bg-slate-700/50 rounded-lg mr-4">
              {icon}
          </div>
          <div>
              <h3 className="text-lg font-semibold text-slate-400">{title}</h3>
              <p className="text-3xl font-bold text-white">{value}</p>
          </div>
        </div>
      </Card>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-slate-900 border border-slate-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {tooltipText}
      </div>
    </div>
  );
  
  const LinkArrow = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-colors">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );

  if (isLoading || !statusData) {
    return <DashboardSkeleton />;
  }

  const workflowStatusOrder: WorkflowStatus[] = ['Live', 'Test', 'Hold'];
  const totalRows = Object.values(statusData.dbStats.tableCounts).reduce((sum: number, count: number) => sum + count, 0);
  const statusColors: Record<WorkflowStatus, { text: string; dot: string; }> = {
    Live: { text: 'text-green-400', dot: 'bg-green-500' },
    Test: { text: 'text-blue-400', dot: 'bg-blue-500' },
    Hold: { text: 'text-yellow-400', dot: 'bg-yellow-500' },
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Hub Status Board</h1>
        <Button
          variant="secondary"
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 4l1.5 1.5A9 9 0 0120.5 10.5M20 20l-1.5-1.5A9 9 0 003.5 13.5" /></svg>
          {isLoading ? 'Refreshing...' : 'Refresh Status'}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div onClick={() => setCurrentView('mcp-protocol')} className="cursor-pointer transition-transform duration-200 hover:scale-105">
          <StatCard title="Active MCPs" value={statusData.mcpCount} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg>} tooltipText="Number of custom MCPs connected to the data lake. Click to manage." />
        </div>
        <div onClick={() => setCurrentView('workflow-builder')} className="cursor-pointer transition-transform duration-200 hover:scale-105">
          <StatCard title="Live Workflows" value={statusData.workflowCounts.Live || 0} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>} tooltipText="Data pipelines currently in a 'Live' operational state. Click to manage." />
        </div>
        <div onClick={() => setCurrentView('schema-explorer')} className="cursor-pointer transition-transform duration-200 hover:scale-105">
          <StatCard title="DB Tables" value={Object.keys(statusData.dbStats.tableCounts).length} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4M4 7l8 5 8-5" /></svg>} tooltipText="Total number of tables in the SQL data warehouse. Click to explore schema." />
        </div>
        <div onClick={() => setCurrentView('explorer')} className="cursor-pointer transition-transform duration-200 hover:scale-105">
          <StatCard title="Indexed Docs" value={statusData.vectorStats.documentCount} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>} tooltipText="Documents indexed in the vector store for AI search. Click to explore." />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card onClick={() => setCurrentView('workflow-builder')} className="lg:col-span-1 cursor-pointer transition-all duration-200 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 group">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-white">Workflow Status</h3>
            <LinkArrow />
          </div>
          <div className="space-y-4">
            {workflowStatusOrder.map(status => (
                <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center">
                        <span className={`w-3 h-3 rounded-full mr-3 ${statusColors[status].dot}`}></span>
                        <span className={`font-semibold ${statusColors[status].text}`}>{status}</span>
                    </div>
                    <span className="font-mono text-xl text-white">{statusData.workflowCounts[status] || 0}</span>
                </div>
            ))}
          </div>
        </Card>
        <Card onClick={() => setCurrentView('db-maintenance')} className="lg:col-span-1 cursor-pointer transition-all duration-200 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 group">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-white">Data Store Health</h3>
            <LinkArrow />
          </div>
            <div className="space-y-4">
                <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">Total SQL DB Size</span>
                    <span className="font-mono text-xl text-white">{(statusData.dbStats.dbSizeBytes / 1024).toFixed(2)} KB</span>
                </div>
                <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">Total SQL Rows</span>
                    <span className="font-mono text-xl text-white">{totalRows.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-baseline pt-3 border-t border-slate-700/50">
                    <span className="text-slate-400">Vector Indexed Documents</span>
                    <span className="font-mono text-xl text-white">{statusData.vectorStats.documentCount}</span>
                </div>
            </div>
        </Card>
        <Card className="lg:col-span-1 transition-all duration-200 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 group">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">AI Anomaly Detection</h3>
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
            </div>
            <div className="space-y-2">
                {anomalies.map(anomaly => (
                    <div key={anomaly.id} className={`p-2 rounded-md border-l-4 ${anomaly.severity === 'Critical' ? 'bg-red-500/10 border-red-500' : 'bg-yellow-500/10 border-yellow-500'}`}>
                        <p className={`font-semibold ${anomaly.severity === 'Critical' ? 'text-red-300' : 'text-yellow-300'}`}>{anomaly.metric}</p>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-300">{anomaly.change}</span>
                            <span className="text-slate-500">{anomaly.timestamp}</span>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
      </div>
      
       <Card onClick={() => setCurrentView('mcp-protocol')} className="cursor-pointer transition-all duration-200 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 group">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-white">MCP Connections</h3>
            <LinkArrow />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(loadedMcps || []).map(server => (
                <div key={server.id} className="p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center mb-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                        <p className="font-semibold text-slate-200">{server.name}</p>
                    </div>
                    <p className="text-xs text-cyan-400 font-mono truncate" title={server.url}>{server.url}</p>
                </div>
            ))}
          </div>
        </Card>
    </div>
  );
};

export default Dashboard;
