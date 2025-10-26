
import React, { useState, useMemo, useEffect } from 'react';
import Card from './Card';
import { getWorkflows, getUsers, saveUser, deleteUser } from '../services/api';
import type { WorkflowStatus, Workflow, User, Role } from '../types';

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
    onClose: () => void;
    onAdd: (name: string, email: string) => void;
}> = ({ onClose, onAdd }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && email.trim()) {
            onAdd(name, email);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <Card className="max-w-md w-full" onClick={e => e.stopPropagation()}>
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
                        <button type="button" onClick={onClose} className="bg-slate-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-slate-500">Cancel</button>
                        <button type="submit" className="bg-cyan-500 text-white font-semibold px-6 py-2 rounded-lg hover:bg-cyan-600">Add User</button>
                    </div>
                </form>
            </Card>
        </div>
    );
};


const DlControls: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [policies, setPolicies] = useState<Policy[]>(mockPolicies);
  const [optimizing, setOptimizing] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  const fetchUsers = async () => {
      try {
        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);
      } catch(e) {
          console.error("Failed to fetch users", e);
          alert("Could not load user data.");
      }
  };

  useEffect(() => {
    getWorkflows().then(setWorkflows);
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: number, newRole: Role) => {
    const userToUpdate = users.find(u => u.id === userId);
    if (userToUpdate) {
        const updatedUser = { ...userToUpdate, role: newRole };
        // Optimistic update
        setUsers(users.map(u => (u.id === userId ? updatedUser : u)));
        try {
            await saveUser(updatedUser);
        } catch (e) {
            alert(`Failed to update user role: ${e instanceof Error ? e.message : String(e)}`);
            console.error("Error updating user role:", e);
            // Revert on failure
            fetchUsers();
        }
    }
  };

  const handlePolicyToggle = (policyId: string) => {
    setPolicies(policies.map(p => (p.id === policyId ? { ...p, enabled: !p.enabled } : p)));
  };
  
  const handleOptimize = () => {
      setOptimizing(true);
      setTimeout(() => setOptimizing(false), 1500);
  }

  const handleSaveNewUser = async (name: string, email: string) => {
    try {
        const newUser: User = {
          id: Date.now(), // Generate a unique ID for the new user. In a real app, this would be handled by the backend.
          name,
          email,
          role: 'Viewer',
        };
        await saveUser(newUser);
        await fetchUsers(); // Refresh the user list from the DB
        setIsAddUserModalOpen(false);
    } catch (e) {
        alert(`Failed to add user: ${e instanceof Error ? e.message : String(e)}`);
        console.error("Error adding user:", e);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    const userToDelete = users.find(u => u.id === userId);
    if (userToDelete && window.confirm(`Are you sure you want to delete user "${userToDelete.name}"?`)) {
        try {
            // Keep optimistic update for good UX
            setUsers(users.filter(u => u.id !== userId));
            await deleteUser(userId);
        } catch (e) {
            alert(`Failed to delete user: ${e instanceof Error ? e.message : String(e)}`);
            console.error("Error deleting user:", e);
            // Revert optimistic update on failure
            fetchUsers();
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
        {/* User Management */}
        <Card className="flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">User & Access Management</h2>
            <button onClick={() => setIsAddUserModalOpen(true)} className="flex items-center justify-center w-8 h-8 text-lg rounded-md bg-slate-600 hover:bg-slate-500 text-white font-semibold">+</button>
          </div>
          <div className="flex-grow overflow-y-auto space-y-2 win-scrollbar pr-2" style={{maxHeight: '250px'}}>
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
                <div>
                  <p className="font-semibold text-slate-200">{user.name}</p>
                  <p className="text-sm text-slate-400">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                      value={user.role}
                      onChange={e => handleRoleChange(user.id, e.target.value as Role)}
                      className="bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    >
                      <option>Admin</option>
                      <option>Analyst</option>
                      <option>Viewer</option>
                    </select>
                     <button onClick={() => handleDeleteUser(user.id)} aria-label={`Delete user ${user.name}`} className="w-8 h-8 flex-shrink-0 bg-red-800/80 text-white rounded-md flex items-center justify-center hover:bg-red-800">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
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
                    <ToggleSwitch enabled={policy.enabled} onChange={() => handlePolicyToggle(policy.id)} />
                </div>
            ))}
          </div>
        </Card>

        {/* Pipeline Oversight */}
        <Card>
            <h2 className="text-xl font-bold text-white mb-4">Workflow Oversight</h2>
            <p className="text-sm text-slate-400 mb-4">A high-level overview of all data workflows across the system.</p>
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
            <p className="text-xs text-center mt-4 text-slate-500">
                These statuses reflect the operational state of data flows from sources to destinations.
            </p>
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
            <button 
              onClick={handleOptimize} 
              disabled={optimizing}
              className="w-full bg-slate-700 text-white font-semibold px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
              {optimizing ? 'Analyzing...' : 'Run Usage Analysis'}
            </button>
        </Card>
      </div>
       {isAddUserModalOpen && <AddUserModal onClose={() => setIsAddUserModalOpen(false)} onAdd={handleSaveNewUser} />}
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