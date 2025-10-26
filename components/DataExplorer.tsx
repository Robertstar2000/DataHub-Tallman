
import React, { useState } from 'react';
import StructuredDataExplorer from './StructuredDataExplorer';
import UnstructuredDataExplorer from './UnstructuredDataExplorer';

type ExplorerView = 'structured' | 'unstructured';

const DataExplorer: React.FC = () => {
  const [activeView, setActiveView] = useState<ExplorerView>('structured');

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex-none flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Data Explorer</h1>
        <div className="flex border-b border-slate-700">
          <TabButton name="structured" activeView={activeView} setActiveView={setActiveView}>Structured Data (SQL)</TabButton>
          <TabButton name="unstructured" activeView={activeView} setActiveView={setActiveView}>Unstructured Data (AI)</TabButton>
        </div>
      </div>
      
      <div className="flex-grow min-h-0">
        {activeView === 'structured' && <StructuredDataExplorer />}
        {activeView === 'unstructured' && <UnstructuredDataExplorer />}
      </div>
    </div>
  );
};

const TabButton: React.FC<{name: ExplorerView, activeView: ExplorerView, setActiveView: (t: ExplorerView) => void, children: React.ReactNode}> = ({ name, activeView, setActiveView, children }) => {
    const isActive = name === activeView;
    return (
        <button onClick={() => setActiveView(name)} className={`px-4 py-2 -mb-px font-medium text-lg border-b-2 transition-colors duration-200 ${isActive ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {children}
        </button>
    )
}

export default DataExplorer;