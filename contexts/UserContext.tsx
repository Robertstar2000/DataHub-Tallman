
import React, { createContext, useState, useEffect, useContext } from 'react';
import { User } from '../types';
import { getUsers } from '../services/api';

interface UserContextType {
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  allUsers: User[];
  refreshUsers: () => Promise<void>;
  isAdmin: boolean;
  canEdit: boolean;
}

export const UserContext = createContext<UserContextType>({
    currentUser: null,
    setCurrentUser: () => {},
    allUsers: [],
    refreshUsers: async () => {},
    isAdmin: false,
    canEdit: false,
});

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const refreshUsers = async () => {
    try {
        const users = await getUsers();
        setAllUsers(users);
        
        if (!currentUser) {
            const defaultUser = users.find(u => u.email === 'Robertstar@aol.com') || users.find(u => u.role === 'Admin') || users[0];
            if (defaultUser) setCurrentUser(defaultUser);
        } else {
            // Refresh current user object to get latest role if changed
            const updatedCurrent = users.find(u => u.id === currentUser.id);
            if (updatedCurrent) {
                setCurrentUser(updatedCurrent);
            } else if (users.length > 0) {
                 // Current user was deleted, fallback
                 setCurrentUser(users[0]);
            }
        }
    } catch (e) {
        console.error("Failed to load users for context", e);
    }
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const isAdmin = currentUser?.role === 'Admin';
  const canEdit = currentUser?.role === 'Admin' || currentUser?.role === 'Analyst';

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, allUsers, refreshUsers, isAdmin, canEdit }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
