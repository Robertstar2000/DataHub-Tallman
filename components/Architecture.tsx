
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Card from './Card';
import type { View } from '../App';
import { getWorkflows, saveWorkflow, getDashboards } from '../services/api';
import type { Workflow, Dashboard } from '../types';
import { schemaMetadata } from '../data/schemaMetadata';


// Define types for our diagram components
interface Hotspot {
  id: string;
  title: string;
  description: string;
  top: string;
  left: string;
  targetView?: View;
}

interface ArchitectureProps {
  setCurrentView: (view: View) => void;
}

const detailIcons: Record<string, React.ReactNode> = {
  'SQL DB': <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-cyan-400"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" /></svg>,
  'Vector DB': <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-fuchsia-400"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.572L16.5 21.75l-.398-1.178a3.375 3.375 0 00-2.456-2.456L12.75 18l1.178-.398a3.375 3.375 0 002.456-2.456L16.5 14.25l.398 1.178a3.375 3.375 0 002.456 2.456L20.25 18l-1.178.398a3.375 3.375 0 00-2.456 2.456z" /></svg>,
  'External': <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>,
  'Dashboard': <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-cyan-400"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h4.5M12 3v13.5" /></svg>,
  'Workflow': <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-cyan-400"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>,
  'Trigger': <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-yellow-400"><path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" /></svg>,
};


const toolHotspots: Hotspot[] = [
  { id: 'workflow-builder', title: 'Workflow Builder', description: 'The Workflow Builder is used to design, schedule, and monitor the data pipelines that move and transform data from the sources into the various storage zones of the data lake.', top: '50%', left: '37.5%', targetView: 'workflow-builder' },
  { id: 'schema-explorer', title: 'Schema Explorer', description: 'The Schema Explorer provides a user-friendly interface to browse, search, and manage the technical metadata stored in the Data Catalog. It is the central source of truth for all data assets in the lake.', top: '80%', left: '50%', targetView: 'schema-explorer' },
  { id: 'dashboard-builder', title: 'Dashboard Builder', description: 'The Dashboard Builder allows users to create custom visualizations and dashboards by connecting directly to the Curated Zone. It empowers business users to perform self-service analytics.', top: '35%', left: '87.5%', targetView: 'dashboard-builder' },
  { id: 'dl-maintenance', title: 'DL Maintenance', description: 'DL Maintenance tools interact with all layers of the data lake to ensure data quality, manage partitioning strategies, handle data lifecycle policies, and perform optimizations for cost and performance.', top: '5%', left: '62.5%', targetView: 'db-maintenance' },
  { id: 'dl-controls', title: 'DL Controls', description: 'The Data Lake Controls console provides centralized control over the entire platform, including user access, security policies, cost management, and auditing across all architectural components.', top: '95%', left: '50%', targetView: 'dl-controls' },
];

const DiagramCard: React.FC<{ title: string; children?: React.ReactNode; className?: string; onClick?: () => void; }> = ({ title, children, className, onClick }) => (
  <div className={`bg-slate-800/70 border border-slate-700/80 rounded-lg p-4 text-center ${className}`}>
    <h3 
      onClick={onClick} 
      className={`text-lg font-bold text-cyan-400 mb-2 ${onClick ? 'cursor-pointer hover:underline' : ''}`}
    >
      {title}
    </h3>
    {children}
  </div>
);

const DetailItem: React.FC<{ name: string; type: string; role?: string; icon: React.ReactNode; onClick?: () => void }> = ({ name, type, role, icon, onClick }) => (
    <div
        onClick={onClick}
        className={`p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 flex items-start gap-3 text-left transition-colors ${onClick ? 'cursor-pointer hover:bg-slate-700/50' : ''}`}
        title={name}
    >
        <div className="flex-shrink-0 w-8 h-8 bg-slate-800 rounded-md flex items-center justify-center">{icon}</div>
        <div className="flex-grow min-w-0">
            <p className="font-semibold text-slate-200 text-sm truncate">{name}</p>
            <p className="text-xs text-slate-400">{type}{role && <span className="text-slate-500"> ({role})</span>}</p>
        </div>
    </div>
);

const generateDefaultScript = (workflow: Workflow): string => {
    return `/**
 * Transformer for: ${workflow.name}
 * Sources: ${(workflow.sources || []).join(', ')}
 * Destination: ${workflow.destination}
 */
export default function transform(data) {
  // Add your custom transformation logic here.
  console.log('Processing data for workflow: ${workflow.name}');
  
  const processedData = data.map(record => ({
    ...record,
    processed_at: new Date().toISOString(),
    workflow_id: '${workflow.id}'
  }));

  return processedData;
}`;
};

const Architecture: React.FC<ArchitectureProps> = ({ setCurrentView }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [workflowScripts, setWorkflowScripts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedWorkflows, fetchedDashboards] = await Promise.all([
                getWorkflows(),
                getDashboards()
            ]);
            setWorkflows(fetchedWorkflows);
            setDashboards(fetchedDashboards);

            if (fetchedWorkflows.length > 0) {
                const initialId = fetchedWorkflows[0].id;
                setSelectedWorkflowId(initialId);
                const initialScripts = fetchedWorkflows.reduce((acc, wf) => {
                    if (wf.transformer === 'Custom JavaScript') {
                        acc[wf.id] = wf.transformerCode || generateDefaultScript(wf);
                    } else {
                        acc[wf.id] = `// This workflow uses the '${wf.transformer}' transformer.\n// Code is not editable for this type.`;
                    }
                    return acc;
                }, {} as Record<string, string>);
                setWorkflowScripts(initialScripts);
            }
        } catch (e) {
            console.error("Failed to load architecture data", e);
        } finally {
            setIsLoading(false);
        }
    };
    loadData();
  }, []);
  
  const handleScriptChange = (workflowId: string, newCode: string) => {
    setWorkflowScripts(prev => ({...prev, [workflowId]: newCode}));
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = window.setTimeout(() => {
        const workflowToUpdate = workflows.find(wf => wf.id === workflowId);
        if (workflowToUpdate && workflowToUpdate.transformer === 'Custom JavaScript') {
            const updatedWorkflow = { ...workflowToUpdate, transformerCode: newCode };
            saveWorkflow(updatedWorkflow, false)
                .then(() => setWorkflows(prev => prev.map(wf => wf.id === workflowId ? updatedWorkflow : wf)))
                .catch(e => console.error("Failed to save script", e));
        }
    }, 500);
  }

  const selectedWorkflow = workflows.find(wf => wf.id === selectedWorkflowId);

  const storageInfo = useMemo(() => {
    if (!selectedWorkflow) return [];
    
    const sourceNodes = selectedWorkflow.nodes.filter(n => n.type === 'Source' || n.type === 'Join');
    const sinkNodes = selectedWorkflow.nodes.filter(n => n.type === 'Sink');

    const getEndpoints = (nodes: typeof sourceNodes) => nodes.flatMap(n => n.data.tableName || n.data.tableNames || n.data.mcp || []);
    
    const sources = getEndpoints(sourceNodes);
    const destinations = getEndpoints(sinkNodes);

    const endpoints = [...sources.map(s => ({name: s, role: 'Source'})), ...destinations.map(d => ({name: d, role: 'Destination'}))];
    const uniqueEndpoints = endpoints.filter((endpoint, index, self) =>
        index === self.findIndex((e) => e.name === endpoint.name && e.role === endpoint.role)
    );

    return uniqueEndpoints.map(endpoint => {
        let type: keyof typeof detailIcons = 'External';
        if (!endpoint.name.includes(':') && !endpoint.name.includes('//')) {
            type = schemaMetadata[endpoint.name]?.inVectorStore ? 'Vector DB' : 'SQL DB';
        }
        return { name: endpoint.name, type, role: endpoint.role };
    });
  }, [selectedWorkflow]);

  const consumptionInfo = useMemo(() => {
    if (!selectedWorkflow) return [];

    const consumers: { name: string; type: keyof typeof detailIcons; targetView?: View }[] = [];

    // 1. Find consumers based on this workflow's output tables
    const destinationTables = selectedWorkflow.nodes
        .filter(n => n.type === 'Sink' && n.data.tableName)
        .map(n => n.data.tableName as string);

    for (const destinationTable of destinationTables) {
        // Find other workflows that use this table as a source
        workflows.forEach(wf => {
            if (wf.id !== selectedWorkflow.id) {
                const isConsumer = wf.nodes.some(n => (n.type === 'Source' || n.type === 'Join') && (n.data.tableName === destinationTable || n.data.tableNames?.includes(destinationTable)));
                if (isConsumer) consumers.push({ name: wf.name, type: 'Workflow', targetView: 'workflow-builder' });
            }
        });
        // Find dashboards that query this table
        dashboards.forEach(db => {
            const isConsumer = db.widgets.some(w =>
                w.sqlQuery.toLowerCase().includes(`from ${destinationTable.toLowerCase()}`) ||
                w.sqlQuery.toLowerCase().includes(`join ${destinationTable.toLowerCase()}`)
            );
            if (isConsumer) consumers.push({ name: db.name, type: 'Dashboard', targetView: 'dashboard-builder' });
        });
    }
    
    // 2. Find consumers based on direct trigger dependencies
    selectedWorkflow.triggersOnSuccess?.forEach(triggeredWfId => {
         const triggeredWf = workflows.find(wf => wf.id === triggeredWfId);
         if (triggeredWf) consumers.push({ name: `Triggers: ${triggeredWf.name}`, type: 'Trigger', targetView: 'workflow-builder' });
    });
    
    // 3. Deduplicate and return
    return consumers.filter((consumer, index, self) => index === self.findIndex((c) => c.name === consumer.name && c.type === consumer.type));
  }, [selectedWorkflow, workflows, dashboards]);


  return (
    <div className="space-y-6 h-full flex flex-col">
      <h1 className="text-3xl font-bold text-white">Interactive Data Flow Architecture</h1>
      <p className="text-slate-400">
        This diagram illustrates the flow of data through the internal corporate data lake. Select a workflow to see its specific lineage.
      </p>
      
      <div className="flex-grow p-4 md:p-8 rounded-lg bg-slate-900/30 border border-slate-700/50 relative overflow-x-auto">
        <div className="flex items-stretch justify-between min-w-[1200px] h-full relative">

            <Arrow isPlaceholder />

            <DiagramCard title="Processing Pipeline" className="w-1/3 h-full !flex flex-col" onClick={() => setCurrentView('workflow-builder')}>
              {isLoading ? <p>Loading workflows...</p> : (
                <>
                  <div className="flex-none flex flex-col mb-2">
                      <label htmlFor="workflow-select" className="text-sm text-slate-400 mb-1 text-left">Selected Workflow:</label>
                      <select
                          id="workflow-select"
                          value={selectedWorkflowId || ''}
                          onChange={(e) => setSelectedWorkflowId(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                      >
                          {workflows.map(wf => <option key={wf.id} value={wf.id}>{wf.name}</option>)}
                      </select>
                  </div>
                  {selectedWorkflow && (
                      <div className="flex-grow min-h-0">
                          <textarea
                              value={workflowScripts[selectedWorkflowId!] || ''}
                              onChange={(e) => {
                                  e.stopPropagation();
                                  handleScriptChange(selectedWorkflowId!, e.target.value);
                              }}
                              disabled={selectedWorkflow?.transformer !== 'Custom JavaScript'}
                              spellCheck="false"
                              className="w-full h-full bg-slate-900/70 p-2 rounded-md text-left text-xs font-mono text-cyan-300 resize-none focus:ring-1 focus:ring-cyan-500 focus:outline-none disabled:text-slate-500 disabled:cursor-not-allowed"
                          />
                      </div>
                  )}
                </>
              )}
            </DiagramCard>
            
            <Arrow />
            
            <DiagramCard title="Data Lake Storage" className="w-1/4 h-full !flex flex-col justify-center" onClick={() => setCurrentView('explorer')}>
                <div className="space-y-3 text-slate-300">
                    {storageInfo.length > 0 ? storageInfo.map(s => (
                        <DetailItem key={`${s.name}-${s.role}`} name={s.name} type={s.type} role={s.role} icon={detailIcons[s.type]} onClick={() => setCurrentView('explorer')} />
                    )) : (
                        <p className="text-sm text-slate-500">Select a workflow to see its data sources and destinations.</p>
                    )}
                </div>
            </DiagramCard>

            <Arrow />

            <DiagramCard title="Consumption" className="w-1/4 h-full !flex flex-col justify-center" onClick={() => setCurrentView('dashboard')}>
                <div className="space-y-3">
                     {consumptionInfo.length > 0 ? consumptionInfo.map(c => (
                        <DetailItem key={c.name} name={c.name} type={c.type} icon={detailIcons[c.type]} onClick={() => c.targetView && setCurrentView(c.targetView)} />
                    )) : (
                        <p className="text-sm text-slate-500">No downstream consumers found for this workflow's output.</p>
                    )}
                </div>
            </DiagramCard>

            {toolHotspots.map(spot => (
                <div
                key={spot.id}
                className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 z-10"
                style={{ top: spot.top, left: spot.left }}
                onClick={() => spot.targetView && setCurrentView(spot.targetView)}
                title={spot.title}
                >
                  <div className="w-full h-full rounded-full bg-cyan-400 animate-ping absolute cursor-pointer"></div>
                  <div className="w-full h-full rounded-full bg-cyan-400 border-2 border-slate-900 cursor-pointer"></div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

const Arrow: React.FC<{isPlaceholder?: boolean}> = ({ isPlaceholder }) => (
    <div className={`text-slate-600 flex-shrink-0 flex items-center justify-center ${isPlaceholder ? 'w-0' : 'w-16'}`}>
        {!isPlaceholder && (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
          </svg>
        )}
    </div>
);

export default Architecture;