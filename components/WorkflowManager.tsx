

import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import Card from './Card';
import type { Workflow, WorkflowStatus, McpServer } from '../types';
import { executeWorkflow, getWorkflows, saveWorkflow, deleteWorkflow as apiDeleteWorkflow, getLoadedMcpServers } from '../services/api';
import { ErrorContext } from '../contexts/ErrorContext';
import { otherInterfaces } from '../data/mcpServers';

const statusColors: Record<WorkflowStatus, { bg: string; text: string; dot: string; border: string; }> = {
  Live: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500', border: 'border-green-500/50' },
  Test: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500', border: 'border-blue-500/50' },
  Hold: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-500', border: 'border-yellow-500/50' },
};
const STATUSES: WorkflowStatus[] = ['Live', 'Test', 'Hold'];

const GENERIC_SOURCES = ["Kafka Topic: new_orders", "Data Lake: p21_sales_orders", "S3 Bucket: raw-logs"];
const GENERIC_DESTINATIONS = ["Data Lake: p21_sales_orders", "Data Lake: daily_sales_metrics", "Redshift Table: dim_products"];

const MultiSelectCheckboxes: React.FC<{
    label: string;
    options: { id: string; name: string }[];
    selectedIds: string[];
    onChange: (selectedIds: string[]) => void;
}> = ({ label, options, selectedIds, onChange }) => {
    const handleToggle = (id: string) => {
        const newSelected = selectedIds.includes(id)
            ? selectedIds.filter(selectedId => selectedId !== id)
            : [...selectedIds, id];
        onChange(newSelected);
    };

    return (
        <div>
            <label className="block text-slate-400 mb-2">{label}</label>
            <div className="max-h-32 overflow-y-auto bg-slate-900/50 border border-slate-600 rounded-lg p-2 space-y-1">
                {options.length > 0 ? options.map(option => (
                    <div key={option.id} className="flex items-center p-1 rounded hover:bg-slate-700/50">
                        <input
                            type="checkbox"
                            id={`cb-${label}-${option.id}`}
                            checked={selectedIds.includes(option.id)}
                            onChange={() => handleToggle(option.id)}
                            className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-500 rounded focus:ring-cyan-500"
                        />
                        <label htmlFor={`cb-${label}-${option.id}`} className="ml-2 text-sm text-slate-300">
                            {option.name}
                        </label>
                    </div>
                )) : <p className="text-sm text-slate-500 text-center p-2">No other workflows available.</p>}
            </div>
        </div>
    );
};

const WorkflowEditor: React.FC<{ 
    workflow: Partial<Workflow>, 
    allWorkflows: Workflow[],
    sourceOptions: string[],
    destinationOptions: string[],
    onSave: (wf: Workflow) => void, 
    onCancel: () => void 
}> = ({ workflow, allWorkflows, sourceOptions, destinationOptions, onSave, onCancel }) => {
    const [editedWorkflow, setEditedWorkflow] = useState<Partial<Workflow>>(workflow);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(editedWorkflow as Workflow);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setEditedWorkflow(prev => ({ ...prev, [name]: name === 'repartition' ? parseInt(value, 10) : value }));
    }
    
    const handleSourceChange = (index: number, value: string) => {
        const newSources = [...(editedWorkflow.sources || [])];
        newSources[index] = value;
        setEditedWorkflow(prev => ({ ...prev, sources: newSources }));
    };

    const handleAddSource = () => {
        if ((editedWorkflow.sources || []).length < 4) {
            setEditedWorkflow(prev => ({
                ...prev,
                sources: [...(prev.sources || []), sourceOptions[0]]
            }));
        }
    };

    const handleRemoveSource = (index: number) => {
        const newSources = (editedWorkflow.sources || []).filter((_, i) => i !== index);
        setEditedWorkflow(prev => ({ ...prev, sources: newSources }));
    };

    const workflowOptions = allWorkflows
        .filter(wf => wf.id !== editedWorkflow.id)
        .map(wf => ({ id: wf.id, name: wf.name }));

    return (
        <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
                <h2 className="text-2xl font-bold text-white">{workflow.id ? 'Edit Workflow' : 'Create New Workflow'}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-slate-400 mb-1">Workflow Name</label>
                        <input name="name" value={editedWorkflow.name || ''} onChange={handleChange} required className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
                    </div>
                     <div>
                        <label className="block text-slate-400 mb-1">Status</label>
                        <select name="status" value={editedWorkflow.status || 'Test'} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white">
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="border-t border-slate-700/50 pt-6 space-y-4">
                     <h3 className="text-lg font-semibold text-cyan-400">Pipeline</h3>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start text-center">
                         <div>
                            <label className="block text-slate-400 mb-1">Source(s)</label>
                            <div className="space-y-2">
                                {(editedWorkflow.sources || []).map((source, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <select
                                            value={source}
                                            onChange={(e) => handleSourceChange(index, e.target.value)}
                                            required
                                            className="flex-grow bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                                        >
                                            {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        {(editedWorkflow.sources || []).length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSource(index)}
                                                className="w-8 h-8 flex-shrink-0 bg-red-800/80 text-white rounded-lg flex items-center justify-center hover:bg-red-800"
                                            >
                                                &times;
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {(editedWorkflow.sources || []).length < 4 && (
                                <button
                                    type="button"
                                    onClick={handleAddSource}
                                    className="w-full mt-2 text-sm bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 rounded-lg"
                                >
                                    + Add Source
                                </button>
                            )}
                         </div>
                         <div className="text-slate-500 font-bold text-2xl hidden md:flex items-center justify-center pt-8">→</div>
                         <div className="pt-7">
                            <label className="block text-slate-400 mb-1">Transformer</label>
                             <input name="transformer" value={editedWorkflow.transformer || ''} onChange={handleChange} required className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
                         </div>
                         <div className="text-slate-500 font-bold text-2xl hidden md:flex items-center justify-center pt-8">→</div>
                         <div className="pt-7">
                            <label className="block text-slate-400 mb-1">Destination</label>
                            <select name="destination" value={editedWorkflow.destination || ''} onChange={handleChange} required className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white">
                                 {destinationOptions.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                         </div>
                         {editedWorkflow.transformer === 'Custom JavaScript' && (
                            <div className="md:col-span-3 pt-4">
                                <label className="block text-slate-400 mb-1 text-left">Transformer Code (JavaScript)</label>
                                <textarea
                                    name="transformerCode"
                                    value={editedWorkflow.transformerCode || '/**\n * @param {any[]} data - The data from the source.\n * @returns {any[]} The transformed data for the destination.\n */\nfunction transform(data) {\n  // Your code here\n  return data;\n}'}
                                    onChange={handleChange}
                                    placeholder="function transform(data) { return data; }"
                                    className="w-full h-48 bg-slate-900 border border-slate-600 rounded-lg p-3 font-mono text-sm text-cyan-300 focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-y"
                                />
                            </div>
                        )}
                     </div>
                </div>
                
                 <div className="border-t border-slate-700/50 pt-6 space-y-4">
                    <h3 className="text-lg font-semibold text-cyan-400">Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-slate-400 mb-1">Trigger / Schedule</label>
                            <input name="trigger" value={editedWorkflow.trigger || ''} onChange={handleChange} required className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-slate-400 mb-1">Repartition Partitions</label>
                            <input type="number" name="repartition" min="1" value={editedWorkflow.repartition || 2} onChange={handleChange} required className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-700/50 pt-6 space-y-4">
                    <h3 className="text-lg font-semibold text-cyan-400">Dependencies & Triggers</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <MultiSelectCheckboxes
                            label="Runs After (Dependencies)"
                            options={workflowOptions}
                            selectedIds={editedWorkflow.dependencies || []}
                            onChange={(deps) => setEditedWorkflow(prev => ({ ...prev, dependencies: deps }))}
                        />
                         <MultiSelectCheckboxes
                            label="On Success, Triggers"
                            options={workflowOptions}
                            selectedIds={editedWorkflow.triggersOnSuccess || []}
                            onChange={(triggers) => setEditedWorkflow(prev => ({ ...prev, triggersOnSuccess: triggers }))}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onCancel} className="bg-slate-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-slate-500 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" className="bg-cyan-500 text-white font-semibold px-6 py-2 rounded-lg hover:bg-cyan-600 transition-colors">
                        Save Workflow
                    </button>
                </div>
            </form>
        </Card>
    );
};

const ExecutionLogModal: React.FC<{ workflow: Workflow, onClose: () => void, logs: string[], isRunning: boolean }> = ({ workflow, onClose, logs, isRunning }) => {
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);
    
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={!isRunning ? onClose : undefined}>
            <Card className="max-w-2xl w-full flex flex-col" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-2">{isRunning ? 'Executing' : 'Execution Log'}: {workflow.name}</h2>
                <p className="text-slate-400 mb-4">This is the real-time log output from the pipeline execution.</p>
                <div ref={logContainerRef} className="h-64 bg-slate-900/50 p-3 rounded-lg overflow-y-auto font-mono text-sm text-slate-300 flex-grow">
                    {logs.map((log, i) => <p key={i} className="animate-fade-in">{log}</p>)}
                    {isRunning && <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse mt-2"></div>}
                </div>
                <button onClick={onClose} disabled={isRunning} className="mt-4 w-full bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed">
                    {isRunning ? 'Running...' : 'Close'}
                </button>
            </Card>
        </div>
    );
};

// FIX: Removed empty const declaration which caused a syntax error.
const WorkflowManager: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [allWorkflows, setAllWorkflows] = useState<Workflow[]>([]); // For dependency picker
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'list' | 'edit' | 'create'>('list');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Partial<Workflow> | null>(null);
  const { addError, clearErrorsBySource } = useContext(ErrorContext);
  const SOURCE_ID = 'WorkflowManager';

  // Execution log state
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [workflowForLog, setWorkflowForLog] = useState<Workflow | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    clearErrorsBySource(SOURCE_ID);
    try {
      const [wfs, mcps] = await Promise.all([getWorkflows(), getLoadedMcpServers()]);
      setWorkflows(wfs);
      setAllWorkflows(wfs); // Keep a full list for dependency picker
      setMcpServers(mcps);
    } catch (e: any) {
      addError(`Failed to load workflows: ${e.message}`, SOURCE_ID);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setView('edit');
  };
  
  const handleCreate = () => {
    setSelectedWorkflow({
        id: `wf-${Date.now()}`,
        name: 'New Workflow',
        status: 'Test',
        sources: [],
        nodes: [],
        edges: [],
        currentVersion: 1,
    });
    setView('create');
  };

  const handleCancel = () => {
    setSelectedWorkflow(null);
    setView('list');
  };

  const handleSave = async (workflowToSave: Workflow) => {
    try {
      await saveWorkflow(workflowToSave, false);
      await loadData();
      setView('list');
      setSelectedWorkflow(null);
    } catch (e: any) {
      addError(`Failed to save workflow: ${e.message}`, SOURCE_ID);
    }
  };

  const handleDelete = async (workflowId: string) => {
    if (window.confirm('Are you sure you want to delete this workflow?')) {
      try {
        await apiDeleteWorkflow(workflowId);
        await loadData();
      } catch (e: any) {
        addError(`Failed to delete workflow: ${e.message}`, SOURCE_ID);
      }
    }
  };

  const handleRun = (workflow: Workflow) => {
    setWorkflowForLog(workflow);
    setExecutionLogs([]);
    setIsLogModalOpen(true);
    setIsExecuting(true);
    
    executeWorkflow(workflow, (logMessage) => {
      setExecutionLogs(prev => [...prev, logMessage]);
    }).finally(() => {
      setIsExecuting(false);
    });
  };

  const sourceOptions = useMemo(() => {
      const mcpSources = mcpServers.map(s => `MCP: ${s.name}`);
      const otherSourceOptions = otherInterfaces.map(i => `${i.type}: ${i.name}`);
      return [...mcpSources, ...otherSourceOptions, ...GENERIC_SOURCES];
  }, [mcpServers]);
  
  const destinationOptions = useMemo(() => {
      const mcpDests = mcpServers.map(s => `MCP: ${s.name}`);
      return [...mcpDests, ...GENERIC_DESTINATIONS];
  }, [mcpServers]);

  if (isLoading) {
    return <div>Loading workflows...</div>;
  }
  
  if (view === 'edit' || view === 'create') {
    return (
      <WorkflowEditor
        workflow={selectedWorkflow!}
        allWorkflows={allWorkflows}
        sourceOptions={sourceOptions}
        destinationOptions={destinationOptions}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Workflow Manager</h1>
        <button onClick={handleCreate} className="bg-cyan-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-cyan-600">
            + New Workflow
        </button>
      </div>
      <p className="text-slate-400 max-w-3xl">
          Design, monitor, and manage the automated data pipelines that power your data lake.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workflows.map(wf => (
          <Card key={wf.id} className={`flex flex-col justify-between border-l-4 ${statusColors[wf.status].border} ${statusColors[wf.status].bg}`}>
            <div>
                <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-white mb-2">{wf.name}</h3>
                    <div className={`flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[wf.status].bg} ${statusColors[wf.status].text}`}>
                        <span className={`w-2 h-2 rounded-full mr-2 ${statusColors[wf.status].dot}`}></span>
                        {wf.status}
                    </div>
                </div>
                <p className="text-sm text-slate-400 mb-1"><strong>Trigger:</strong> {wf.trigger}</p>
                <p className="text-sm text-slate-400 mb-1"><strong>Source(s):</strong> {(wf.sources || []).join(', ')}</p>
                <p className="text-sm text-slate-400"><strong>Destination:</strong> {wf.destination}</p>
            </div>
            <div className="border-t border-slate-700/50 mt-4 pt-4 flex gap-2">
                <button onClick={() => handleRun(wf)} className="flex-1 btn-secondary text-sm">Run</button>
                <button onClick={() => handleEdit(wf)} className="flex-1 btn-secondary text-sm">Edit</button>
                <button onClick={() => handleDelete(wf.id)} className="w-10 bg-red-800/80 text-white rounded-lg flex items-center justify-center hover:bg-red-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
          </Card>
        ))}
      </div>
      
      {isLogModalOpen && workflowForLog && (
        <ExecutionLogModal 
            workflow={workflowForLog}
            onClose={() => setIsLogModalOpen(false)}
            logs={executionLogs}
            isRunning={isExecuting}
        />
      )}

      <style>{`
        .btn-secondary { @apply bg-slate-700 text-white font-semibold px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};
export default WorkflowManager;
