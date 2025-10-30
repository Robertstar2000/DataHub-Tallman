
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Card from './Card';
import { getTableSchemas, getLoadedMcpServers, createTableFromMcp, getWorkflows, getDashboards } from '../services/api';
import type { McpServer, Workflow, Dashboard } from '../types';
import { useQuery, invalidateQuery } from '../hooks/useQuery';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Button from './common/Button';

interface SchemaField {
  name: string;
  type: string;
}

interface Schema {
  id: string;
  name: string;
  category: string;
  fields: SchemaField[];
  mcpSource: string | null;
}

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

const parseSchemaString = (columns: string): SchemaField[] => {
    if (!columns) return [];
    return columns.split(', ').map(colStr => {
        const match = colStr.match(/(.+)\s\((.+)\)/);
        if (match) {
            return { name: match[1], type: match[2] };
        }
        return { name: colStr, type: 'unknown' };
    });
};

const LineageNode: React.FC<{ label: string; type: string; icon: React.ReactNode }> = ({ label, type, icon }) => (
    <div className="flex flex-col items-center text-center w-32">
        <div className="w-16 h-16 bg-slate-900/50 rounded-lg flex items-center justify-center border border-slate-700 mb-2">{icon}</div>
        <p className="text-sm font-semibold text-slate-200 truncate w-full" title={label}>{label}</p>
        <p className="text-xs text-slate-500">{type}</p>
    </div>
);

const LineageView: React.FC<{ tableName: string; mcpSource: string | null; allWorkflows: Workflow[]; allDashboards: Dashboard[] }> = ({ tableName, mcpSource, allWorkflows, allDashboards }) => {
    const sources = useMemo(() => {
        const sourceList = [];
        if (mcpSource) {
            sourceList.push({ type: 'MCP', name: mcpSource });
        }
        for (const wf of allWorkflows) {
            if (wf.nodes.some(n => n.type === 'Sink' && n.data.tableName === tableName)) {
                sourceList.push({ type: 'Workflow', name: wf.name });
            }
        }
        return sourceList;
    }, [tableName, mcpSource, allWorkflows]);

    const destinations = useMemo(() => {
        const destList = [];
        for (const wf of allWorkflows) {
            if (wf.nodes.some(n => n.type === 'Source' && n.data.tableName === tableName)) {
                destList.push({ type: 'Workflow', name: wf.name });
            }
        }
        for (const db of allDashboards) {
            if (db.widgets.some(w => w.sqlQuery.toLowerCase().includes(`from ${tableName.toLowerCase()}`))) {
                destList.push({ type: 'Dashboard', name: db.name });
            }
        }
        return destList;
    }, [tableName, allWorkflows, allDashboards]);
    
    const icons = {
        MCP: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-cyan-400"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg>,
        Workflow: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-cyan-400"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>,
        Table: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" /></svg>,
        Dashboard: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-cyan-400"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h4.5M12 3v13.5" /></svg>,
    };

    return (
      <div className="flex items-center justify-center p-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-4">{sources.map(s => <LineageNode key={s.name} label={s.name} type={s.type} icon={icons[s.type as keyof typeof icons]} />)}</div>
          <svg className="w-16 h-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          <LineageNode label={tableName} type="Table" icon={icons.Table} />
          <svg className="w-16 h-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          <div className="flex flex-col gap-4">{destinations.map(d => <LineageNode key={d.name} label={d.name} type={d.type} icon={icons[d.type as keyof typeof icons]} />)}</div>
        </div>
      </div>
    );
};

const AddTableModal: React.FC<{
    mcpServers: McpServer[];
    isOpen: boolean;
    onClose: () => void;
    onAdd: (tableName: string, columns: string, mcpSource: string) => Promise<void>;
}> = ({ mcpServers, isOpen, onClose, onAdd }) => {
    const [tableName, setTableName] = useState('');
    const [columns, setColumns] = useState('');
    const [mcpSource, setMcpSource] = useState(mcpServers[0]?.name || '');
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(modalRef, isOpen);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!tableName.trim() || !columns.trim() || !mcpSource) {
            setError("All fields are required.");
            return;
        }
        setIsAdding(true);
        try {
            await onAdd(tableName, columns, mcpSource);
            onClose();
        } catch (e: any) {
            setError(e.message || "An unexpected error occurred.");
        } finally {
            setIsAdding(false);
        }
    };
    
    useEffect(() => {
        if (isOpen) {
            setTableName('');
            setColumns('');
            setError(null);
            setMcpSource(mcpServers[0]?.name || '');
        }
    }, [isOpen, mcpServers]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <Card ref={modalRef} className="max-w-lg w-full" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-4">Extract Table from MCP</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="mcp-source" className="block text-slate-400 mb-1">Source MCP</label>
                        <select id="mcp-source" value={mcpSource} onChange={(e) => setMcpSource(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white">
                            {mcpServers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="table-name" className="block text-slate-400 mb-1">New Table Name</label>
                        <input id="table-name" value={tableName} onChange={e => setTableName(e.target.value)} placeholder="e.g., p21_new_invoices" required className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
                    </div>
                    <div>
                        <label htmlFor="table-columns" className="block text-slate-400 mb-1">Columns</label>
                        <textarea
                            id="table-columns"
                            value={columns}
                            onChange={e => setColumns(e.target.value)}
                            required
                            placeholder="e.g., invoice_id INTEGER, amount REAL, due_date TEXT"
                            className="w-full h-24 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 font-mono text-sm text-cyan-300 placeholder:font-sans placeholder:text-slate-500"
                        />
                         <p className="text-xs text-slate-500 mt-1">Use standard SQL types (TEXT, INTEGER, REAL). Separate columns with commas.</p>
                    </div>
                    {error && <p className="text-sm text-red-400 bg-red-500/10 p-2 rounded-md">{error}</p>}
                    <div className="flex justify-end gap-4 pt-4">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={isAdding}>Cancel</Button>
                        <Button type="submit" variant="primary" disabled={isAdding}>
                            {isAdding ? 'Adding...' : 'Add Table'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

const SchemaListSkeleton: React.FC = () => (
    <div className="space-y-2 pr-2">
        {[...Array(8)].map((_, i) => (
            <div key={i} className="p-3 rounded-lg bg-slate-700/50 animate-pulse">
                <div className="h-4 bg-slate-600 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-600 rounded w-1/2"></div>
            </div>
        ))}
    </div>
);

const SchemaDetailSkeleton: React.FC = () => (
    <div>
        <div className="h-8 bg-slate-700/50 rounded w-1/2 mb-2 animate-pulse"></div>
        <div className="h-4 bg-slate-700/50 rounded w-1/4 mb-6 animate-pulse"></div>
        <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="flex justify-between items-center p-3">
                    <div className="h-4 bg-slate-700/50 rounded w-1/3 animate-pulse"></div>
                    <div className="h-4 bg-slate-700/50 rounded w-1/4 animate-pulse"></div>
                </div>
            ))}
        </div>
    </div>
);

const SchemaExplorer: React.FC = () => {
  const { data: dbSchemas, isLoading: isLoadingSchemas } = useQuery(['tableSchemas'], getTableSchemas);
  const { data: loadedMcps = [] } = useQuery(['loadedMcpServers'], getLoadedMcpServers);
  const { data: allWorkflows = [] } = useQuery(['workflows'], getWorkflows);
  const { data: allDashboards = [] } = useQuery(['dashboards'], getDashboards);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSchema, setSelectedSchema] = useState<Schema | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'lineage'>('details');
  
  const schemas = useMemo<Schema[]>(() => {
    if (!dbSchemas) return [];
    return Object.entries(dbSchemas).map(([tableName, { columns, mcpSource }]) => ({
        id: tableName,
        name: tableName,
        category: getCategoryForTable(tableName),
        fields: parseSchemaString(columns),
        mcpSource: mcpSource
    }));
  }, [dbSchemas]);

  const categories = useMemo(() => {
    return [...new Set(schemas.map(s => s.category))].sort();
  }, [schemas]);
  
  useEffect(() => {
      if(!selectedSchema && schemas.length > 0) {
          setSelectedSchema(schemas[0]);
      } else if (selectedSchema) {
          const updatedSelection = schemas.find(s => s.id === selectedSchema.id) || schemas[0] || null;
          setSelectedSchema(updatedSelection);
      }
  }, [schemas, selectedSchema]);

  const handleAddTable = async (tableName: string, columns: string, mcpSource: string) => {
    await createTableFromMcp({ tableName, columns, mcpSource });
    invalidateQuery(['tableSchemas']);
  };

  const filteredSchemas = useMemo(() => {
    return schemas.filter(schema => {
      const categoryMatch = selectedCategory === 'All' || schema.category === selectedCategory;
      const searchMatch = schema.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (schema.fields && schema.fields.some(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())));
      return categoryMatch && searchMatch;
    });
  }, [schemas, searchTerm, selectedCategory]);

  const isLoading = isLoadingSchemas;

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-white">Schema Explorer</h1>
            <p className="text-slate-400 max-w-3xl mt-1">
                Explore the live database schema, track data lineage to its source MCP, and simulate new table ingestions.
            </p>
        </div>
        <Button
            onClick={() => setIsModalOpen(true)}
            disabled={loadedMcps.length === 0}
            title={loadedMcps.length === 0 ? "Load an MCP in the MCP tab first" : "Extract a new table from a connected MCP"}
        >
            + Extract Table from MCP
        </Button>
      </div>
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        <Card className="lg:col-span-1 flex flex-col">
          <h2 className="text-xl font-semibold text-white mb-4">Schemas</h2>
          <input
            type="text"
            placeholder="Search tables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 mb-4 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2 mb-4">
            <button
                key="All"
                onClick={() => setSelectedCategory('All')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  selectedCategory === 'All'
                    ? 'bg-cyan-500 text-white font-semibold'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                All
              </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  selectedCategory === category
                    ? 'bg-cyan-500 text-white font-semibold'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          {isLoading ? <SchemaListSkeleton /> : (
            <ul className="flex-grow overflow-y-auto space-y-2 pr-2">
                {filteredSchemas.map(schema => (
                <li
                    key={schema.id}
                    onClick={() => setSelectedSchema(schema)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedSchema?.id === schema.id
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'hover:bg-slate-700/50 text-slate-300'
                    }`}
                >
                    <h3 className="font-semibold">{schema.name}</h3>
                    <p className="text-sm text-slate-400">{schema.category}</p>
                </li>
                ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2 flex flex-col">
          <div className="flex-grow overflow-y-auto pr-2">
            {isLoading ? <SchemaDetailSkeleton /> : !selectedSchema ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400">Select a schema to view its details.</p>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-white">{selectedSchema.name}</h2>
                  <p className="text-slate-400">{selectedSchema.category}</p>
                   {selectedSchema.mcpSource && (
                    <div className="mt-2 text-sm inline-flex items-center gap-2 px-2 py-1 bg-slate-700/50 rounded-full">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                       <span className="text-slate-300">Source:</span>
                       <span className="font-semibold text-cyan-400">{selectedSchema.mcpSource}</span>
                    </div>
                  )}
                </div>
                <div className="flex border-b border-slate-700 mb-4">
                    <button onClick={() => setActiveTab('details')} className={`px-4 py-2 -mb-px font-medium text-lg border-b-2 transition-colors duration-200 ${activeTab === 'details' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}>Details</button>
                    <button onClick={() => setActiveTab('lineage')} className={`px-4 py-2 -mb-px font-medium text-lg border-b-2 transition-colors duration-200 ${activeTab === 'lineage' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}>Lineage</button>
                </div>

                {activeTab === 'details' ? (
                    <div className="divide-y divide-slate-700">
                        <div className="grid grid-cols-2 gap-4 font-semibold text-slate-300 p-3 bg-slate-900/50">
                        <div>Field Name</div>
                        <div>Data Type</div>
                        </div>
                        {selectedSchema.fields.map((field, index) => (
                        <div key={index} className="grid grid-cols-2 gap-4 p-3 hover:bg-slate-800/50">
                            <div className="text-slate-200 font-mono">{field.name}</div>
                            <div className="text-cyan-400 font-mono">{field.type}</div>
                        </div>
                        ))}
                    </div>
                ) : (
                    <LineageView 
                        tableName={selectedSchema.name} 
                        mcpSource={selectedSchema.mcpSource} 
                        allWorkflows={allWorkflows}
                        allDashboards={allDashboards}
                    />
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
      <AddTableModal 
        mcpServers={loadedMcps}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddTable}
      />
    </div>
  );
};

export default SchemaExplorer;
