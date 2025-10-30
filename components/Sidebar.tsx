
import React from 'react';
import type { View } from '../App';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  onOpenDocModal: () => void;
}

const NavItem: React.FC<{
  viewName: View;
  label: string;
  currentView: View;
  setCurrentView: (view: View) => void;
  children: React.ReactNode;
}> = ({ viewName, label, currentView, setCurrentView, children }) => {
  const isActive = currentView === viewName;

  return (
    <li>
      <button
        onClick={() => setCurrentView(viewName)}
        role="menuitem"
        aria-current={isActive ? 'page' : undefined}
        className={`w-full flex items-center p-3 my-1 rounded-lg text-left cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
          isActive
            ? 'bg-cyan-500/20 text-cyan-400'
            : 'hover:bg-slate-700/50 text-slate-400 hover:text-slate-200'
        }`}
      >
        <span className="w-6 h-6 mr-3 flex-shrink-0">{children}</span>
        <span className="font-medium">{label}</span>
      </button>
    </li>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, onOpenDocModal }) => {
  return (
    <aside className="w-64 bg-slate-800/50 p-4 border-r border-slate-700/50 flex flex-col">
      <div className="flex items-center mb-8 flex-shrink-0">
        <div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center mr-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4M4 7l8 5 8-5" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white">Central Data Hub</h1>
      </div>
      <nav className="flex-grow overflow-y-auto pr-2 -mr-2">
        <ul role="menu">
          {/* Core Views */}
          <NavItem viewName="dashboard" label="Hub Status Board" currentView={currentView} setCurrentView={setCurrentView}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
          </NavItem>
          <NavItem viewName="architecture" label="Architecture" currentView={currentView} setCurrentView={setCurrentView}>
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>
          </NavItem>
          <NavItem viewName="explorer" label="Data Explorer" currentView={currentView} setCurrentView={setCurrentView}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" /></svg>
          </NavItem>
          <NavItem viewName="ai-analyst" label="AI Analyst" currentView={currentView} setCurrentView={setCurrentView}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m1.5-4.5V21m6-18v1.5m3.75-1.5v1.5m3.75 1.5v1.5m0 3.75v1.5m0 3.75v1.5m0 3.75v1.5M12 3v1.5m0 3.75v1.5m0 3.75v1.5m0 3.75v1.5" /></svg>
          </NavItem>
          <NavItem viewName="predictive-analytics" label="Predictive Analytics" currentView={currentView} setCurrentView={setCurrentView}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
          </NavItem>
          
          <div className="my-2 border-t border-slate-700/50"></div>
          
          {/* Builder Tools */}
          <li className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Builders</li>
          <NavItem viewName="workflow-builder" label="Workflow Manager" currentView={currentView} setCurrentView={setCurrentView}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>
          </NavItem>
          <NavItem viewName="dashboard-builder" label="Dashboard Builder" currentView={currentView} setCurrentView={setCurrentView}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h4.5M12 3v13.5" /></svg>
          </NavItem>
          <NavItem viewName="schema-explorer" label="Schema Explorer" currentView={currentView} setCurrentView={setCurrentView}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338A2.25 2.25 0 0017.088 3.75H15M4.5 3.75L5.106 5.338m0 0L5.71 6.912M5.106 5.338l.604.604m-1.208 0l.604-.604m-2.412 8.252l.604-.604M12 15a3 3 0 100-6 3 3 0 000 6z" /></svg>
          </NavItem>

          <div className="my-2 border-t border-slate-700/50"></div>
          
          {/* Admin & Governance */}
          <li className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</li>
          <NavItem viewName="mcp-protocol" label="MCP" currentView={currentView} setCurrentView={setCurrentView}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm-3 0h.008v.008h-.008v-.008z" />
            </svg>
          </NavItem>
           <NavItem viewName="io-management" label="I/O Management" currentView={currentView} setCurrentView={setCurrentView}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </NavItem>
          <NavItem viewName="data-governance" label="Data Governance" currentView={currentView} setCurrentView={setCurrentView}>
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286zm0 13.036h.008v.008h-.008v-.008z" /></svg>
          </NavItem>
          <NavItem viewName="dl-controls" label="DL Controls" currentView={currentView} setCurrentView={setCurrentView}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3V7.5a3 3 0 013-3h13.5a3 3 0 013 3v3.75a3 3 0 01-3 3m-13.5 0h13.5" /></svg>
          </NavItem>
          <NavItem viewName="audit-log" label="Audit Log" currentView={currentView} setCurrentView={setCurrentView}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
          </NavItem>
          <NavItem viewName="db-maintenance" label="DB Maintenance" currentView={currentView} setCurrentView={setCurrentView}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.472-2.472a.375.375 0 000-.53l-2.472-2.472M11.42 15.17l-4.693 4.693a2.121 2.121 0 01-3-3l4.693-4.693m-4.693-4.693l4.693-4.693a2.121 2.121 0 013 3L6.727 7.5M11.42 15.17l-4.693 4.693" /></svg>
          </NavItem>

          <div className="my-2 border-t border-slate-700/50"></div>

          {/* Resources */}
          <li className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Resources</li>
          <li>
            <button
              onClick={onOpenDocModal}
              role="menuitem"
              aria-label="Open documents viewer"
              className="w-full flex items-center p-3 my-1 rounded-lg text-left cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 hover:bg-slate-700/50 text-slate-400 hover:text-slate-200"
            >
              <span className="w-6 h-6 mr-3 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              </span>
              <span className="font-medium">Documents</span>
            </button>
            </li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
