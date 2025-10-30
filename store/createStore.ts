
import { useState, useEffect, useSyncExternalStore } from 'react';

type State = Record<string, any>;
type StateCreator<T extends State> = (set: (partial: Partial<T> | ((state: T) => Partial<T>)) => void, get: () => T) => T;

export const createStore = <T extends State>(createState: StateCreator<T>) => {
  let state: T;
  const listeners = new Set<() => void>();

  const set = (partial: Partial<T> | ((state: T) => Partial<T>)) => {
    const nextPartial = typeof partial === 'function' ? partial(state) : partial;
    const newState = { ...state, ...nextPartial };
    if (newState !== state) {
      state = newState;
      listeners.forEach(listener => listener());
    }
  };

  const get = () => state;

  const subscribe = (callback: () => void) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
  };
  
  state = createState(set, get);
  
  const useStore = () => {
      return useSyncExternalStore(subscribe, get, get);
  };

  return useStore;
};
