import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { Session } from '../types';
import { loadSession, saveSession } from '../utils/database';

interface AppContextType {
  session: Session | null;
  login: (userId: string, userName: string, role: 'supplier' | 'rf', supplierId?: string) => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function validateSession(session: Session | null): Session | null {
  if (!session) return null;
  if (session.role === 'supplier' && session.supplier_id) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(session.supplier_id)) {
      return null;
    }
  }
  return session;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const loaded = loadSession();
    const validated = validateSession(loaded);
    if (!validated && loaded) {
      saveSession(null);
    }
    return validated;
  });

  const login = (userId: string, userName: string, role: 'supplier' | 'rf', supplierId?: string) => {
    const newSession: Session = {
      user_id: userId,
      user_name: userName,
      role,
      supplier_id: supplierId,
    };

    if (role === 'supplier') {
      localStorage.removeItem('supplier_quote_inputs');
      localStorage.removeItem('supplier_response_inputs');
      localStorage.removeItem('supplier_expanded_rows');
    }

    setSession(newSession);
    saveSession(newSession);
  };

  const logout = () => {
    setSession(null);
    saveSession(null);
  };

  return (
    <AppContext.Provider value={{ session, login, logout }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
