
import React, { useMemo, useEffect } from 'react';
import { getTableSchemas, getWorkflows } from '../../services/api';
import type { Workflow } from '../../types';
import type { AnalysisMode } from '../AIAnalyst';
import { modeConfig } from '../AIAnalyst';
import { useQuery } from '../../hooks/useQuery';

const getCategoryForTable = (tableName: string): string => {
    if (tableName.startsWith('p21_')) return 'P21 ERP';
    if (tableName.startsWith('por_')) return 'Point of Rental';
    if (tableName.startsWith('qc_')) return 'Quality Control';
    if (tableName.startsWith('mfg_')) return 'Manufacturing';
    if (tableName.startsWith('cascade_')) return 'Cascade Inventory';
    if (tableName.startsWith('wordpress_')) return 'WordPress CMS';
    if (tableName.startsWith('teams')) return 'Microsoft Teams';
    if (tableName.startsWith('gdrive_')) return 'Google Drive';
    if (tableName.startsWith('stackoverflow_')) return 'Stack Overflow';
    if (tableName.startsWith('daily_sales_metrics')) return 'Reporting';
    if (tableName.startsWith('prediction_')) return 'Predictive Analytics';
    return 'General';
};

interface Props {
  analysisMode: AnalysisMode;
  setAnalysisMode: (mode: AnalysisMode) => void;
  selectedContextId: string;
  setSelectedContextId: (id: string) => void;
}

// FIX: Added 'export' to make the component importable.
export const AnalysisModeSelector: React.FC<Props> = ({
  analysisMode,
  setAnalysisMode,
  selectedContextId,
  setSelectedContextId
}) => {
    const { data: schemas = {} } = useQuery(['tableSchemas'], getTableSchemas);
    const { data: workflows = [] } = useQuery<Workflow[]>(['workflows'], getWorkflows);
    
    const tableOptions = useMemo(() => {
        return Object.keys(schemas).map(tableName => ({
            id: tableName,
            name: tableName,
            category: getCategoryForTable(tableName)
        }));
    }, [schemas]);
    
    const workflowOptions = useMemo(() => {
        return workflows.map(wf => ({ id: wf.id, name: wf.name }));
    }, [workflows]);
    
    const currentConfig = modeConfig[analysisMode];

    // Reset context when context-dependent mode is selected but no context is available
    useEffect(() => {
        if (analysisMode === 'TABLE' && tableOptions.length > 0 && !selectedContextId) {
            setSelectedContextId(tableOptions[0].id);
        }
        if (analysisMode === 'WORKFLOW' && workflowOptions.length > 0 && !selectedContextId) {
            setSelectedContextId(workflowOptions[0].id);
        }
    }, [analysisMode, selectedContextId, tableOptions, workflowOptions, setSelectedContextId]);


    return (
        <div className="flex gap-4 items-end">
            <div className="flex-none">
                <label htmlFor="analysis-mode" className="block text-slate-400 mb-1">Analysis Mode</label>
                <select 
                    id="analysis-mode"
                    value={analysisMode} 
                    onChange={e => setAnalysisMode(e.target.value as AnalysisMode)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white font-semibold"
                >
                    {(Object.keys(modeConfig) as AnalysisMode[]).map(mode => (
                        <option key={mode} value={mode}>{modeConfig[mode].label}</option>
                    ))}
                </select>
            </div>
            
            {currentConfig.contextLabel && (
                <div className="flex-grow">
                    <label htmlFor="context-selector" className="block text-slate-400 mb-1">{currentConfig.contextLabel}</label>
                     <select 
                        id="context-selector"
                        value={selectedContextId} 
                        onChange={e => setSelectedContextId(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                        disabled={(analysisMode === 'TABLE' && tableOptions.length === 0) || (analysisMode === 'WORKFLOW' && workflowOptions.length === 0)}
                    >
                        {analysisMode === 'TABLE' && tableOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        {analysisMode === 'WORKFLOW' && workflowOptions.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
            )}
        </div>
    );
};
