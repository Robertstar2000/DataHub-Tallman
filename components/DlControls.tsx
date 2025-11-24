
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Card from './Card';
import { getWorkflows, getUsers, saveUser, deleteUser, setDataSourceMode, getDataSourceMode, runMaintenance, rebuildVectorStore, executeWorkflow } from '../services/api';
import type { WorkflowStatus, Workflow, User, Role } from '../types';
import { useQuery, invalidateQuery } from '../hooks/useQuery';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Button from './common/Button';
import { useUser } from '../contexts/UserContext';

interface Policy {
  id: string;
  name: string;
  enabled: boolean;
}

const mockPolicies: Policy[] = [
  { id: 'pol1', name: "Enforce PII Masking on 'customers' table", enabled: true },
  { id: 'pol2', name: 'Require Schema Validation for new pipelines', enabled: true },
  { id: 'pol3', name: 'Data Retention: Auto-delete raw data after 90 days', enabled: false },
  { id: 'pol4', name: 'Audit all queries against financial data', enabled: true },
];

const mockUsage: Record<string, { value: number; unit: string; }> = {
  compute: { value: 850, unit: 'vCPU-hours' },
  storage: { value: 450, unit: 'GB-months' },
  api: { value: 120, unit: 'k-calls' },
};


const ToggleSwitch: React.FC<{ enabled: boolean; onChange: () => void }> = ({ enabled, onChange }) => (
  <button
    onClick={onChange}
    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${enabled ? 'bg-cyan-500' : 'bg-slate-600'}`}
  >
    <span
      className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
    />
  </button>
);

const AddUserModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (name: string, email: string) => void;
}> = ({ isOpen, onClose, onAdd }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(modalRef, isOpen);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && email.trim()) {
            onAdd(name, email);
        }
    };
    
    useEffect(() => {
        if (isOpen) {
            setName('');
            setEmail('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <Card ref={modalRef} className="max-w-md w-full" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-4">Add New User</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="user-name" className="block text-slate-400 mb-1">Full Name</label>
                        <input 
                            id="user-name" 
                            name="name" 
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required 
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" 
                        />
                    </div>
                    <div>
                        <label htmlFor="user-email" className="block text-slate-400 mb-1">Email Address</label>
                        <input 
                            id="user-email" 
                            name="email" 
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required 
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" 
                        />
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
                        <Button variant="primary" type="submit">Add User</Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};


const DlControls: React.FC = () => {
  const { isAdmin, refreshUsers } = useUser();
  const { data: users = [], refetch: refetchUsers } = useQuery<User[]>(['users'], getUsers);
  const [usersState, setUsersState] = useState<User[]>([]);

  const [policies, setPolicies] = useState<Policy[]>(mockPolicies);
  const [optimizing, setOptimizing] = useState(false);
  const [processing, setProcessing] = useState(false); // State for manual cycle
  const { data: workflows = [] } = useQuery<Workflow[]>(['workflows'], getWorkflows);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isTestMode, setIsTestMode] = useState(getDataSourceMode() === 'test');

  useEffect(() => {
    setUsersState(users);
  }, [users]);
  
  useEffect(() => {
      // Sync local state if changed externally (though usually only changed here)
      setIsTestMode(getDataSourceMode() === 'test');
  }, []);

  const handleModeToggle = async () => {
      const newMode = isTestMode ? 'real' : 'test';
      await setDataSourceMode(newMode);
      setIsTestMode(newMode === 'test');
  };

  const handleRoleChange = async (userId: number, newRole: Role) => {
    if (!isAdmin) {
        alert("Access Denied: Only Admins can change user roles.");
        return;
    }

    // Check if we are changing the last admin to non-admin
    const userToUpdate = usersState.find(u => u.id === userId);
    const adminCount = usersState.filter(u => u.role === 'Admin').length;
    
    if (userToUpdate?.role === 'Admin' && newRole !== 'Admin' && adminCount <= 1) {
        alert("Operation Failed: You cannot remove the last Administrator.");
        return;
    }

    if (userToUpdate) {
        const updatedUser = { ...userToUpdate, role: newRole };
        setUsersState(usersState.map(u => (u.id === userId ? updatedUser : u)));
        try {
            await saveUser(updatedUser);
            invalidateQuery(['users']);
            refreshUsers(); // Sync context
        } catch (e) {
            alert(`Failed to update user role: ${e instanceof Error ? e.message : String(e)}`);
            console.error("Error updating user role:", e);
            refetchUsers(); // Revert on failure by refetching
        }
    }
  };

  const handlePolicyToggle = (policyId: string) => {
    if (!isAdmin) return; // Simple guard, though UI should ideally disable it
    setPolicies(policies.map(p => (p.id === policyId ? { ...p, enabled: !p.enabled } : p)));
  };
  
  const handleOptimize = () => {
      setOptimizing(true);
      setTimeout(() => setOptimizing(false), 1500);
  }

  const handleRunProcessingCycle = async () => {
      setProcessing(true);
      try {
          // 1. Find key workflows to run (simulation of a scheduler)
          // In a real app, this would likely call a backend endpoint to run due schedules.
          // Here we explicitly run ingestion and analytics to ensure data changes.
          const allWorkflows = await getWorkflows();
          const ingestionWf = allWorkflows.find(w => w.id === 'wf-ingest-p21-orders');
          const analyticsWf = allWorkflows.find(w => w.id === 'wf-calculate-daily-metrics');

          const dummyLog = (msg: string) => console.log(`[Background Cycle]: ${msg}`);

          if (ingestionWf) {
             await executeWorkflow(ingestionWf, dummyLog);
          }
          if (analyticsWf) {
             await executeWorkflow(analyticsWf, dummyLog);
          }

          // 2. Maintenance & Indexing
          await runMaintenance();
          await rebuildVectorStore();
          
          // 3. Refresh global queries so Dashboard updates immediately
          invalidateQuery(['dashboardStats']);
          invalidateQuery(['dbStatistics']);
          invalidateQuery(['vectorStoreStats']);

          alert("Full processing cycle completed: Data ingested, metrics calculated, and indexes rebuilt.");
      } catch (e: any) {
          alert(`Processing failed: ${e.message}`);
      } finally {
          setProcessing(false);
      }
  }

  const handleSaveNewUser = async (name: string, email: string) => {
    if (!isAdmin) return;
    try {
        const newUser: User = {
          id: Date.now(),
          name,
          email,
          role: 'Viewer',
        };
        await saveUser(newUser);
        invalidateQuery(['users']);
        refreshUsers();
        setIsAddUserModalOpen(false);
    } catch (e) {
        alert(`Failed to add user: ${e instanceof Error ? e.message : String(e)}`);
        console.error("Error adding user:", e);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!isAdmin) {
        alert("Access Denied: Only Admins can delete users.");
        return;
    }

    const userToDelete = usersState.find(u => u.id === userId);
    if (!userToDelete) return;

    const adminCount = usersState.filter(u => u.role === 'Admin').length;
    if (userToDelete.role === 'Admin' && adminCount <= 1) {
        alert("Operation Failed: You cannot delete the last Administrator.");
        return;
    }

    if (window.confirm(`Are you sure you want to delete user "${userToDelete.name}"? This action cannot be undone.`)) {
        try {
            // Optimistic update
            setUsersState(prev => prev.filter(u => u.id !== userId));
            await deleteUser(userId);
            invalidateQuery(['users']);
            refreshUsers();
        } catch (e) {
            alert(`Failed to delete user: ${e instanceof Error ? e.message : String(e)}`);
            console.error("Error deleting user:", e);
            refetchUsers();
        }
    }
  };

  const workflowStatusCounts = useMemo(() => {
    return workflows.reduce((acc, workflow) => {
      acc[workflow.status] = (acc[workflow.status] || 0) + 1;
      return acc;
    }, {} as Record<WorkflowStatus, number>);
  }, [workflows]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Data Lake Controls</h1>
      <p className="text-slate-400 max-w-3xl">
        This console provides centralized control over the entire platform. Manage user access, set global data policies, monitor pipeline health, and oversee costs from a single command center.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Environment */}
        <Card className="flex flex-col justify-between border-l-4 border-cyan-500">
            <div>
                <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl font-bold text-white">System Environment</h2>
                    <Button 
                        variant="secondary" 
                        onClick={handleRunProcessingCycle} 
                        disabled={processing}
                        className="text-xs py-1 px-3"
                    >
                        {processing ? 'Processing...' : 'Run Processing Cycle'}
                    </Button>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                    Toggle between simulating connections to live external systems (Real) or using the internal Test Server for data generation.
                </p>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isTestMode ? 'bg-yellow-400' : 'bg-green-500'} animate-pulse`}></div>
                    <div>
                        <p className="font-semibold text-white">{isTestMode ? 'Test Server Mode' : 'Real External Data'}</p>
                        <p className="text-xs text-slate-400">{isTestMode ? 'Generating simulated traffic' : 'Connecting to live endpoints'}</p>
                    </div>
                </div>
                <ToggleSwitch enabled={isTestMode} onChange={handleModeToggle} />
            </div>
        </Card>

        {/* Pipeline Oversight */}
        <Card>
            <h2 className="text-xl font-bold text-white mb-4">Workflow Oversight</h2>
            <div className="flex justify-around text-center">
                <div>
                    <p className="text-4xl font-bold text-green-400">{workflowStatusCounts.Live || 0}</p>
                    <p className="text-slate-400">Live</p>
                </div>
                 <div>
                    <p className="text-4xl font-bold text-blue-400">{workflowStatusCounts.Test || 0}</p>
                    <p className="text-slate-400">Test</p>
                </div>
                 <div>
                    <p className="text-4xl font-bold text-yellow-400">{workflowStatusCounts.Hold || 0}</p>
                    <p className="text-slate-400">On Hold</p>
                </div>
            </div>
        </Card>

        {/* User Management */}
        <Card className="flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">User & Access Management</h2>
            {isAdmin && (
                <button onClick={() => setIsAddUserModalOpen(true)} className="flex items-center justify-center w-8 h-8 text-lg rounded-md bg-slate-600 hover:bg-slate-500 text-white font-semibold shadow-md transition-transform hover:scale-105" title="Add User">+</button>
            )}
          </div>
          <div className="flex-grow overflow-y-auto space-y-2 win-scrollbar pr-2" style={{maxHeight: '250px'}}>
            {usersState.map(user => (
              <div key={user.id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-slate-700/30 hover:border-slate-600 transition-colors">
                <div>
                  <p className="font-semibold text-slate-200">{user.name}</p>
                  <p className="text-sm text-slate-400">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                      value={user.role}
                      disabled={!isAdmin}
                      onChange={e => handleRoleChange(user.id, e.target.value as Role)}
                      className="bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option>Admin</option>
                      <option>Analyst</option>
                      <option>Viewer</option>
                    </select>
                     {isAdmin && (
                        <Button variant="danger" onClick={() => handleDeleteUser(user.id)} aria-label={`Delete user ${user.name}`} className="w-8 h-8 p-0 flex-shrink-0 flex items-center justify-center" title="Delete User">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </Button>
                     )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Data Governance */}
        <Card className="flex flex-col">
          <h2 className="text-xl font-bold text-white mb-4">Global Data Policies</h2>
           <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-3">
            {policies.map(policy => (
                <div key={policy.id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
                    <p className="text-slate-300 mr-4">{policy.name}</p>
                    <ToggleSwitch enabled={policy.enabled} onChange={() => isAdmin ? handlePolicyToggle(policy.id) : alert("Only Admins can change global policies.")} />
                </div>
            ))}
          </div>
        </Card>

        {/* Compute Usage */}
        <Card>
            <h2 className="text-xl font-bold text-white mb-4">Compute Usage</h2>
            <p className="text-sm text-slate-400 mb-4">A breakdown of simulated resource consumption across the platform.</p>
            <div className="space-y-4 mb-4">
                {Object.entries(mockUsage).map(([key, {value, unit}]) => (
                    <div key={key} className="flex justify-between items-baseline">
                        <span className="capitalize text-slate-300">{key}</span>
                        <span className="font-mono text-cyan-300">{value.toLocaleString()} <span className="text-xs text-slate-500">{unit}</span></span>
                    </div>
                ))}
            </div>
            <Button 
              variant="secondary"
              className="w-full"
              onClick={handleOptimize} 
              disabled={optimizing}
            >
              {optimizing ? 'Analyzing...' : 'Run Usage Analysis'}
            </Button>
        </Card>
      </div>
       <AddUserModal isOpen={isAddUserModalOpen} onClose={() => setIsAddUserModalOpen(false)} onAdd={handleSaveNewUser} />
       <style>{`
        .win-scrollbar::-webkit-scrollbar {
          width: 16px;
        }
        .win-scrollbar::-webkit-scrollbar-track {
          background: #1e293b; /* slate-800 */
        }
        .win-scrollbar::-webkit-scrollbar-thumb {
          background-color: #475569; /* slate-600 */
          border: 3px solid #1e293b; /* slate-800, creates the inset look */
        }
        .win-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #64748b; /* slate-500 */
        }
      `}</style>
    </div>
  );
};

export default DlControls;
