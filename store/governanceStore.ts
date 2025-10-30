
import { createStore } from './createStore';
import type { DataAccessPolicy } from '../types';

interface GovernanceState {
  policies: DataAccessPolicy[];
  setPolicies: (policies: DataAccessPolicy[]) => void;
  updatePolicy: (policy: DataAccessPolicy) => void;
}

export const useGovernanceStore = createStore<GovernanceState>((set, get) => ({
  policies: [],
  setPolicies: (policies) => set({ policies }),
  updatePolicy: (policy) => {
    set((state) => {
        const policies = state.policies;
        const index = policies.findIndex(p => p.id === policy.id);
        const newPolicies = [...policies];
        if (index > -1) {
            newPolicies[index] = policy;
        } else {
            newPolicies.push(policy);
        }
        return { policies: newPolicies };
    });
  },
}));
