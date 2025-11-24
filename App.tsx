
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Architecture from './components/Architecture';
import DataExplorer from './components/DataExplorer';
import AIAnalyst from './components/AIAnalyst';
import SchemaExplorer from './components/SchemaExplorer';
import DashboardBuilder from './components/DashboardBuilder';
import WorkflowManager from './components/WorkflowManager';
import DlControls from './components/DlControls';
import DbMaintenance from './components/DbMaintenance';
import McpProtocol from './components/McpProtocol';
import IoManagement from './components/IoManagement';
import { initializeDatabase } from './services/api';
import HelpModal from './components/HelpModal';
import { ErrorProvider } from './contexts/ErrorContext';
import { UserProvider } from './contexts/UserContext';
import ErrorHeader from './components/ErrorHeader';
import PredictiveAnalytics from './components/PredictiveAnalytics';
import DataGovernance from './components/DataGovernance';
import AuditLog from './components/AuditLog';
import DocumentModal from './components/DocumentModal';
import { useQuery } from './hooks/useQuery';

export type View = 'dashboard' | 'architecture' | 'explorer' | 'ai-analyst' | 'schema-explorer' | 'dashboard-builder' | 'workflow-builder' | 'dl-controls' | 'db-maintenance' | 'mcp-protocol' | 'io-management' | 'predictive-analytics' | 'data-governance' | 'audit-log';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  const { isLoading: isDbLoading, error: dbError } = useQuery(
    ['initializeDatabase'],
    async () => {
        console.log("[App] Starting database initialization...");
        const res = await initializeDatabase();
        console.log("[App] Database initialization complete.");
        return res;
    },
    { staleTime: Infinity } // This should only run once
  );

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard setCurrentView={setCurrentView} />;
      case 'architecture':
        return <Architecture setCurrentView={setCurrentView} />;
      case 'explorer':
        return <DataExplorer />;
      case 'ai-analyst':
        return <AIAnalyst />;
      case 'schema-explorer':
        return <SchemaExplorer />;
      case 'dashboard-builder':
        return <DashboardBuilder />;
      case 'workflow-builder':
        return <WorkflowManager />;
      case 'dl-controls':
        return <DlControls />;
      case 'db-maintenance':
        return <DbMaintenance />;
      case 'mcp-protocol':
        return <McpProtocol />;
      case 'io-management':
        return <IoManagement />;
      case 'predictive-analytics':
        return <PredictiveAnalytics />;
      case 'data-governance':
        return <DataGovernance />;
      case 'audit-log':
        return <AuditLog />;
      default:
        return <Dashboard setCurrentView={setCurrentView} />;
    }
  };

  if (isDbLoading) {
    return (
      <div className="flex h-screen bg-slate-900 text-slate-200 items-center justify-center">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-cyan-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-xl mt-4">Initializing Data Lake...</p>
        </div>
      </div>
    );
  }

  if (dbError) {
     console.error("[App] Fatal DB Error:", dbError);
     return (
      <div className="flex h-screen bg-slate-900 text-slate-200 items-center justify-center">
        <div className="text-center max-w-2xl w-full p-8 bg-slate-800 rounded-lg">
           <h2 className="text-2xl font-bold text-red-400 mb-4">Initialization Failed</h2>
           <p className="mb-4 text-slate-400">Check console logs for more details.</p>
          <pre className="text-slate-300 text-left whitespace-pre-wrap font-mono bg-slate-900 p-4 rounded-md overflow-x-auto">{dbError instanceof Error ? dbError.stack : String(dbError)}</pre>
        </div>
      </div>
    );
  }

  return (
    <ErrorProvider>
      <UserProvider>
        <div className="flex flex-col h-screen bg-slate-900 text-slate-200">
          <ErrorHeader />
          <div className="flex flex-1 min-h-0">
            <Sidebar currentView={currentView} setCurrentView={setCurrentView} onOpenDocModal={() => setIsDocModalOpen(true)} />
            <main className="flex-1 p-8 overflow-y-auto">
              {renderContent()}
            </main>
          </div>

          <button
            onClick={() => setIsHelpOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-cyan-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-cyan-600 transition-all duration-200 transform hover:scale-110 z-40"
            aria-label="Open help guide"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <HelpModal show={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
          <DocumentModal show={isDocModalOpen} onClose={() => setIsDocModalOpen(false)} />
        </div>
      </UserProvider>
    </ErrorProvider>
  );
};

export default App;
