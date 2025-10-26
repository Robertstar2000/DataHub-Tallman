
import React, { useState, useEffect } from 'react';
import Card from './Card';
import { getTableSchemas, getPiiFindings, getDataAccessPolicies, saveDataAccessPolicy } from '../services/api';
import type { Role, PiiFinding, DataAccessPolicy } from '../types';

const ROLES: Role[] = ['Admin', 'Analyst', 'Viewer'];

const DataGovernance: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'policies' | 'pii'>('policies');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Data Governance</h1>
      <p className="text-slate-400 max-w-3xl">
        Define and enforce rules for data security and compliance. Manage role-based access to tables and columns, and scan for Personally Identifiable Information (PII) to apply masking policies.
      </p>

      <div className="flex border-b border-slate-700">
        <TabButton name="policies" activeView={activeTab} setActiveView={setActiveTab}>Access Policies (RBAC)</TabButton>
        <TabButton name="pii" activeView={activeTab} setActiveView={setActiveTab}>PII Scanner</TabButton>
      </div>

      {activeTab === 'policies' && <AccessPolicies />}
      {activeTab === 'pii' && <PiiScanner />}
    </div>
  );
};

const TabButton: React.FC<{name: 'policies' | 'pii', activeView: string, setActiveView: (t: 'policies' | 'pii') => void, children: React.ReactNode}> = ({ name, activeView, setActiveView, children }) => {
    const isActive = name === activeView;
    return (
        <button onClick={() => setActiveView(name)} className={`px-4 py-2 -mb-px font-medium text-lg border-b-2 transition-colors duration-200 ${isActive ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {children}
        </button>
    )
}

const AccessPolicies: React.FC = () => {
    const [policies, setPolicies] = useState<DataAccessPolicy[]>([]);
    const [schemas, setSchemas] = useState<Record<string, {columns: string}>>({});
    const [selectedRole, setSelectedRole] = useState<Role>('Analyst');
    
    useEffect(() => {
        const loadData = async () => {
            const [fetchedPolicies, fetchedSchemas] = await Promise.all([getDataAccessPolicies(), getTableSchemas()]);
            setPolicies(fetchedPolicies);
            setSchemas(fetchedSchemas);
        };
        loadData();
    }, []);

    const handlePolicyChange = async (policy: DataAccessPolicy) => {
        // In a real app, you'd probably have a more complex state management
        // For this simulation, we just save and refetch
        await saveDataAccessPolicy(policy);
        const fetchedPolicies = await getDataAccessPolicies();
        setPolicies(fetchedPolicies);
    };

    const getPolicyFor = (role: Role, table: string): DataAccessPolicy => {
        return policies.find(p => p.role === role && p.table === table) || {
            id: `${role}-${table}`,
            role,
            table,
            accessLevel: 'all',
        };
    };

    return (
        <Card>
            <div className="flex gap-2 mb-4">
                {ROLES.map(role => (
                    <button 
                        key={role} 
                        onClick={() => setSelectedRole(role)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg ${selectedRole === role ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                        {role}
                    </button>
                ))}
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {Object.keys(schemas).map(table => {
                    const policy = getPolicyFor(selectedRole, table);
                    const columns = schemas[table].columns.split(', ').map(c => c.split(' ')[0]);

                    return (
                        <div key={table} className="p-4 bg-slate-900/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-white">{table}</h3>
                                <select 
                                    value={policy.accessLevel} 
                                    onChange={(e) => handlePolicyChange({...policy, accessLevel: e.target.value as DataAccessPolicy['accessLevel'], columnPermissions: {}})}
                                    className="bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-white"
                                >
                                    <option value="all">Full Access</option>
                                    <option value="partial">Partial Access</option>
                                    <option value="none">No Access</option>
                                </select>
                            </div>
                            {policy.accessLevel === 'partial' && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-700/50">
                                    {columns.map(col => {
                                        const colPerm = policy.columnPermissions?.[col] || 'visible';
                                        return (
                                            <div key={col} className="flex items-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    id={`${table}-${col}`} 
                                                    checked={colPerm === 'visible'}
                                                    onChange={(e) => {
                                                        const newPerms = {...policy.columnPermissions};
                                                        if (e.target.checked) {
                                                            newPerms[col] = 'visible';
                                                        } else {
                                                            newPerms[col] = 'masked';
                                                        }
                                                        handlePolicyChange({...policy, columnPermissions: newPerms});
                                                    }}
                                                    className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-500 rounded focus:ring-cyan-500"
                                                />
                                                <label htmlFor={`${table}-${col}`} className="text-sm text-slate-300">{col}</label>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

const PiiScanner: React.FC = () => {
    const [findings, setFindings] = useState<PiiFinding[]>([]);
    const [isScanning, setIsScanning] = useState(false);

    const handleScan = async () => {
        setIsScanning(true);
        // Simulate a delay for scanning
        await new Promise(resolve => setTimeout(resolve, 2000));
        const fetchedFindings = await getPiiFindings();
        setFindings(fetchedFindings);
        setIsScanning(false);
    };

    return (
         <Card>
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-bold text-white">PII Scan Results</h2>
                 <button onClick={handleScan} disabled={isScanning} className="bg-cyan-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-cyan-600 disabled:bg-slate-600">
                    {isScanning ? 'Scanning...' : 'Run Full Scan'}
                 </button>
            </div>
            {isScanning ? (
                 <div className="text-center py-8">
                     <p className="text-slate-400">Scanning database for PII...</p>
                 </div>
            ) : findings.length === 0 ? (
                 <div className="text-center py-8">
                     <p className="text-slate-400">No PII found, or no scan has been run.</p>
                 </div>
            ) : (
                <div className="divide-y divide-slate-700">
                    <div className="grid grid-cols-4 gap-4 font-semibold text-slate-300 p-3 bg-slate-900/50">
                        <span>Table</span>
                        <span>Column</span>
                        <span>PII Type</span>
                        <span>Action</span>
                    </div>
                    {findings.map((finding, index) => (
                        <div key={index} className="grid grid-cols-4 gap-4 p-3 hover:bg-slate-800/50 items-center">
                            <div className="text-slate-200 font-mono">{finding.table}</div>
                            <div className="text-slate-200 font-mono">{finding.column}</div>
                            <div className="text-yellow-400 font-mono text-sm">{finding.piiType}</div>
                            <button className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold px-3 py-1 rounded-md justify-self-start">Apply Masking Policy</button>
                        </div>
                    ))}
                </div>
            )}
         </Card>
    )
};


export default DataGovernance;
