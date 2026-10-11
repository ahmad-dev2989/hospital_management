import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { PatientDto } from '../api/client';

export interface WorkflowAction {
  action: string;
  payload?: any;
}

interface NavigationContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activePatient: PatientDto | null;
  setActivePatient: (patient: PatientDto | null) => void;
  clearActivePatient: () => void;
  workflowAction: WorkflowAction | null;
  clearWorkflowAction: () => void;
  navigateWithWorkflow: (
    targetTab: string,
    patient?: PatientDto | null,
    action?: string,
    payload?: any
  ) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isCommandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTabState] = useState<string>('foundation');
  const [activePatient, setActivePatient] = useState<PatientDto | null>(null);
  const [workflowAction, setWorkflowAction] = useState<WorkflowAction | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
  }, []);

  const clearActivePatient = useCallback(() => {
    setActivePatient(null);
  }, []);

  const clearWorkflowAction = useCallback(() => {
    setWorkflowAction(null);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const openCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false);
  }, []);

  const toggleCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen((prev) => !prev);
  }, []);

  const navigateWithWorkflow = useCallback(
    (targetTab: string, patient?: PatientDto | null, action?: string, payload?: any) => {
      if (patient !== undefined) {
        setActivePatient(patient);
      }
      if (action) {
        setWorkflowAction({ action, payload });
      } else {
        setWorkflowAction(null);
      }
      setActiveTabState(targetTab);
    },
    []
  );

  return (
    <NavigationContext.Provider
      value={{
        activeTab,
        setActiveTab,
        activePatient,
        setActivePatient,
        clearActivePatient,
        workflowAction,
        clearWorkflowAction,
        navigateWithWorkflow,
        isSidebarCollapsed,
        toggleSidebar,
        isCommandPaletteOpen,
        openCommandPalette,
        closeCommandPalette,
        toggleCommandPalette,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
