

import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import Card from './Card';
import type { Workflow, WorkflowStatus, McpServer } from '../types';
import { executeWorkflow, getWorkflows, saveWorkflow, deleteWorkflow as apiDeleteWorkflow, getLoadedMcpServers } from '../services/api';
import { ErrorContext } from '../contexts/ErrorContext';

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

const KanbanCard: React.FC<{ workflow: Workflow; allWorkflows: Workflow[]; onDragStart: (workflow: Workflow) => void, onEdit: (workflow: Workflow) => void, onRun: (workflow: Workflow) => void, isRunning: boolean, isDisabled: boolean }> = ({ workflow, allWorkflows, onDragStart, onEdit, onRun, isRunning, isDisabled }) => {
  const statusStyle = statusColors[workflow.status];
  const getWorkflowName = (id: string) => allWorkflows.find(w => w.id === id)?.name || id;
  
  return (
    <Card 
      className={`p-4 mb-4 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
      draggable={!isDisabled}
      onDragStart={() => onDragStart(workflow)}
    >
      <div className="flex justify-between items-start">
        <h4 className="font-bold text-white mb-2">{workflow.name}</h4>
      </div>
      <div className="text-xs text-slate-400 space-y-2">
        <p><span className="font-semibold">Source(s):</span> {workflow.sources?.[0]}{workflow.sources && workflow.sources.length > 1 && ` (+${workflow.sources.length - 1})`}</p>
        <p><span className="font-semibold">Dest:</span> {workflow.destination}</p>
      </div>
      {(workflow.dependencies?.length || 0) > 0 || (workflow.triggersOnSuccess?.length || 0) > 0 ? (
        <div className="text-xs text-slate-400 space-y-1 mt-2 pt-2 border-t border-slate-700/50">
           {workflow.dependencies && workflow.dependencies.length > 0 && (
            <p><span className="font-semibold">Depends on:</span> {getWorkflowName(workflow.dependencies[0])}{workflow.dependencies.length > 1 && ` (+${workflow.dependencies.length - 1})`}</p>
          )}
          {workflow.triggersOnSuccess && workflow.triggersOnSuccess.length > 0 && (
             <p><span className="font-semibold">Triggers:</span> {getWorkflowName(workflow.triggersOnSuccess[0])}{workflow.triggersOnSuccess.length > 1 && ` (+${workflow.triggersOnSuccess.length - 1})`}</p>
          )}
        </div>
      ) : null}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-700/50">
         <div className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
          <span className={`w-2 h-2 rounded-full mr-2 ${statusStyle.dot}`}></span>
          {workflow.status}
        </div>
        <p className="text-xs text-slate-500">Last run: {workflow.lastExecuted}</p>
      </div>
       <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700/50">
            <button onClick={() => onRun(workflow)} disabled={isRunning || isDisabled} className="flex-1 px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-xs rounded font-semibold disabled:bg-slate-600">Run</button>
            <button onClick={() => onEdit(workflow)} disabled={isRunning || isDisabled} className="flex-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-xs rounded font-semibold disabled:bg-slate-600">Edit</button>
        </div>
    </Card>
  );
};

const WorkflowManager: React.FC = () => {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loadedMcps, setLoadedMcps] = useState<McpServer[]>([]);
    const [mode, setMode] = useState<'list' | 'kanban' | 'edit' | 'create'>('list');
    const [activeWorkflow, setActiveWorkflow] = useState<Partial<Workflow> | null>(null);
    const [runningWorkflow, setRunningWorkflow] = useState<Workflow | null>(null);
    const [executionLogs, setExecutionLogs] = useState<string[]>([]);
    const [isPipelineRunning, setIsPipelineRunning] = useState(false);
    const [draggedItem, setDraggedItem] = useState<Workflow | null>(null);
    const [dragOverStatus, setDragOverStatus] = useState<WorkflowStatus | null>(null);
    
    const { addError, clearErrorsBySource } = useContext(ErrorContext);
    const ERROR_SOURCE = 'WorkflowManager';
    
    const mcpNames = useMemo(() => loadedMcps.map(s => s.name), [loadedMcps]);

    useEffect(() => {
        const fetchData = async () => {
            const [wfs, mcps] = await Promise.all([getWorkflows(), getLoadedMcpServers()]);
            setWorkflows(wfs);
            setLoadedMcps(mcps);
        }
        fetchData();
    }, []);
    
    useEffect(() => {
        clearErrorsBySource(ERROR_SOURCE);
        workflows.forEach(wf => {
            const allEndpoints = [...(wf.sources || []), wf.destination];
            for (const endpoint of allEndpoints) {
                if (endpoint && endpoint.startsWith('MCP: ') && !mcpNames.includes(endpoint.substring(5))) {
                     addError(`Workflow "${wf.name}" is disabled: Required MCP "${endpoint.substring(5)}" is not loaded.`, ERROR_SOURCE);
                }
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workflows, mcpNames]);
    
    const isWorkflowDisabled = (workflow: Workflow): boolean => {
        const allEndpoints = [...(workflow.sources || []), workflow.destination];
        for (const endpoint of allEndpoints) {
            if (endpoint && endpoint.startsWith('MCP: ') && !mcpNames.includes(endpoint.substring(5))) {
                return true;
            }
        }
        return false;
    }

    const sourceOptions = useMemo(() => [...GENERIC_SOURCES, ...mcpNames.map(name => `MCP: ${name}`)], [mcpNames]);
    const destinationOptions = useMemo(() => [...GENERIC_DESTINATIONS, ...mcpNames.map(name => `MCP: ${name}`)], [mcpNames]);

    const handleCreate = () => {
        setActiveWorkflow({ name: '', status: 'Test', sources: [sourceOptions[0]], transformer: 'Custom JavaScript', destination: destinationOptions[0], trigger: 'On demand', repartition: 8, dependencies: [], triggersOnSuccess: []});
        setMode('create');
    };

    const handleEdit = (workflow: Workflow) => {
        setActiveWorkflow(JSON.parse(JSON.stringify(workflow)));
        setMode('edit');
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this workflow?')) {
            await apiDeleteWorkflow(id);
            setWorkflows(workflows.filter(wf => wf.id !== id));
        }
    };

    const handleSave = async (workflowToSave: Workflow) => {
        let updatedWorkflows;
        const isNew = !workflowToSave.id;
        if (isNew) {
            const newWorkflow = { ...workflowToSave, id: `wf-${Date.now()}`, lastExecuted: 'Never' };
            workflowToSave = newWorkflow; // update to save the one with ID
            updatedWorkflows = [...workflows, newWorkflow];
        } else {
            updatedWorkflows = workflows.map(wf => wf.id === workflowToSave.id ? workflowToSave : wf);
        }
        setWorkflows(updatedWorkflows);
        // FIX: The saveWorkflow function requires a second argument 'asNewVersion'
        await saveWorkflow(workflowToSave, isNew);

        setMode(mode === 'kanban' || mode === 'list' ? mode : 'list');
        setActiveWorkflow(null);
    };

    const handleCancel = () => {
        setMode(mode === 'kanban' || mode === 'list' ? mode : 'list');
        setActiveWorkflow(null);
    };

    const handleRunWorkflow = async (workflowToRun: Workflow) => {
        if (isWorkflowDisabled(workflowToRun)) {
            alert("Cannot run workflow. One of its required MCP servers is not loaded.");
            return;
        }
        setRunningWorkflow(workflowToRun);
        setExecutionLogs([]);
        setIsPipelineRunning(true);

        const logCallback = (message: string) => {
            setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
        };

        const success = await executeWorkflow(workflowToRun, logCallback);

        if (success) {
            // Refetch workflows to get all updates from the triggered chain
            const finalWorkflows = await getWorkflows();
            setWorkflows(finalWorkflows);
        }
        setIsPipelineRunning(false);
    };

    const handleDragStart = (workflow: Workflow) => setDraggedItem(workflow);
    
    const handleDrop = async (targetStatus: WorkflowStatus) => {
        if (!draggedItem) return;
        const updatedWorkflow = { ...draggedItem, status: targetStatus };
        setWorkflows(workflows.map(p => p.id === draggedItem.id ? updatedWorkflow : p));
        // FIX: The saveWorkflow function requires a second argument 'asNewVersion'
        await saveWorkflow(updatedWorkflow, false);
        setDraggedItem(null);
        setDragOverStatus(null);
    };
    
    const handleDragEnter = (status: WorkflowStatus) => {
        if (draggedItem && draggedItem.status !== status) setDragOverStatus(status);
    };
    
    const handleDragLeave = () => setDragOverStatus(null);
    
    const getWorkflowName = (id: string) => workflows.find(w => w.id === id)?.name || id;

    const renderContent = () => {
        if (mode === 'edit' || mode === 'create') {
            return <WorkflowEditor 
                workflow={activeWorkflow!} 
                allWorkflows={workflows}
                sourceOptions={sourceOptions}
                destinationOptions={destinationOptions}
                onSave={handleSave} 
                onCancel={handleCancel} 
            />;
        }

        if (mode === 'kanban') {
            return (
                <div className="flex-grow flex gap-6">
                    {STATUSES.map(status => (
                        <div
                            key={status}
                            className={`flex-1 bg-slate-900/50 rounded-lg p-4 transition-colors duration-200 ${dragOverStatus === status ? 'bg-slate-700/50' : ''}`}
                            onDragEnter={(e) => { e.preventDefault(); handleDragEnter(status); }}
                            onDragOver={(e) => e.preventDefault()}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => { e.preventDefault(); handleDrop(status); }}
                        >
                            <h3 className={`text-lg font-bold text-white mb-4 pb-2 border-b-2 ${statusColors[status].border}`}>{status} ({workflows.filter(p => p.status === status).length})</h3>
                            <div className="space-y-4 overflow-y-auto h-[calc(100vh-300px)] pr-2">
                               {workflows.filter(p => p.status === status).map(p => <KanbanCard key={p.id} workflow={p} allWorkflows={workflows} onDragStart={handleDragStart} onEdit={handleEdit} onRun={handleRunWorkflow} isRunning={isPipelineRunning} isDisabled={isWorkflowDisabled(p)} />)}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {workflows.map(wf => {
                    const isDisabled = isWorkflowDisabled(wf);
                    return (
                        <Card key={wf.id} className={`${isDisabled ? 'opacity-60 bg-slate-800/20' : ''}`}>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                                <div className="md:col-span-1">
                                    <h2 className="text-xl font-bold text-white">{wf.name}</h2>
                                    <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${statusColors[wf.status].bg} ${statusColors[wf.status].text}`}>
                                        {wf.status}
                                    </span>
                                    <p className="text-xs text-slate-400 mt-2">Last run: {wf.lastExecuted}</p>
                                </div>
                                <div className="md:col-span-2 space-y-3">
                                    <div className="flex flex-col space-y-2 text-sm">
                                    <div className="flex items-start"><span className="font-semibold text-slate-400 w-24 flex-shrink-0">Source(s):</span> <div className="flex flex-col">{wf.sources?.map((s, i) => <span key={i} className="font-mono text-slate-300">{s}</span>)}</div></div>
                                    <div className="flex items-center"><span className="font-semibold text-slate-400 w-24">Transformer:</span> <span className="font-mono text-slate-300">{wf.transformer}</span></div>
                                    <div className="flex items-center"><span className="font-semibold text-slate-400 w-24">Destination:</span> <span className="font-mono text-slate-300">{wf.destination}</span></div>
                                    </div>
                                    {(wf.dependencies?.length || 0) > 0 || (wf.triggersOnSuccess?.length || 0) > 0 ? (
                                        <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-700/50">
                                        {wf.dependencies && wf.dependencies.length > 0 && (
                                            <div className="flex items-start"><span className="font-semibold text-slate-300 w-24 flex-shrink-0">Depends on:</span> <div className="flex flex-col">{wf.dependencies.map(id => <span key={id}>{getWorkflowName(id)}</span>)}</div></div>
                                        )}
                                        {wf.triggersOnSuccess && wf.triggersOnSuccess.length > 0 && (
                                            <div className="flex items-start"><span className="font-semibold text-slate-300 w-24 flex-shrink-0">Triggers:</span> <div className="flex flex-col">{wf.triggersOnSuccess.map(id => <span key={id}>{getWorkflowName(id)}</span>)}</div></div>
                                        )}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="md:col-span-1 flex md:flex-col md:items-end gap-2">
                                    <button onClick={() => handleRunWorkflow(wf)} disabled={isPipelineRunning || isDisabled} className="w-full md:w-auto px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-sm rounded-lg font-semibold disabled:bg-slate-600 disabled:cursor-not-allowed">
                                        Run
                                    </button>
                                    <button onClick={() => handleEdit(wf)} disabled={isPipelineRunning || isDisabled} className="w-full md:w-auto px-4 py-2 bg-slate-700 hover:bg-slate-600 text-sm rounded-lg font-semibold disabled:bg-slate-600 disabled:cursor-not-allowed">
                                        Edit
                                    </button>
                                    <button onClick={() => handleDelete(wf.id)} disabled={isPipelineRunning} className="w-full md:w-auto px-4 py-2 bg-red-800/80 hover:bg-red-800 text-sm rounded-lg font-semibold disabled:bg-slate-600 disabled:cursor-not-allowed">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        );
    };

    const isListView = mode !== 'edit' && mode !== 'create';

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white">Workflow Manager</h1>
                <div className="flex items-center gap-4">
                     {isListView && (
                        <div className="flex items-center bg-slate-700/50 rounded-lg p-1">
                            <button onClick={() => setMode('list')} className={`px-3 py-1 text-sm rounded-md ${mode === 'list' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>List</button>
                            <button onClick={() => setMode('kanban')} className={`px-3 py-1 text-sm rounded-md ${mode === 'kanban' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>Kanban</button>
                        </div>
                     )}
                    <button onClick={handleCreate} className="bg-cyan-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-cyan-600">
                        Create New Workflow
                    </button>
                </div>
            </div>

            {renderContent()}

            {runningWorkflow && <ExecutionLogModal workflow={runningWorkflow} onClose={() => setRunningWorkflow(null)} logs={executionLogs} isRunning={isPipelineRunning} />}
            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.3s ease-out; }
            `}</style>
        </div>
    );
}

export default WorkflowManager;