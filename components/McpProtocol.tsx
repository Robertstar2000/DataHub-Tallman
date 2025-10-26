
import React, { useState, useEffect } from 'react';
import Card from './Card';
import { getMcpServers, saveMcpServer } from '../services/api';
import type { McpServer, McpServerType } from '../types';

const generateMcpCode = (server: McpServer): string => {
    let endpoints = [];
    if (server.name.toLowerCase().includes('p21') || server.name.toLowerCase().includes('erp')) {
        endpoints = [
            { path: "/customers", methods: ["GET"], description: "Fetch customer data" },
            { path: "/orders", methods: ["GET", "POST"], description: "Fetch and create sales orders" },
            { path: "/inventory", methods: ["GET"], description: "Fetch item stock levels" }
        ];
    } else if (server.name.toLowerCase().includes('wordpress') || server.name.toLowerCase().includes('cms')) {
        endpoints = [
            { path: "/posts", methods: ["GET"], description: "Fetch all posts" },
            { path: "/products", methods: ["GET"], description: "Fetch all products" }
        ];
    } else if (server.type === 'DocumentCollection') {
        endpoints = [
            { path: "/search", methods: ["POST"], description: "Perform a semantic search query." },
            { path: "/documents/{id}", methods: ["GET"], description: "Retrieve a specific document by its ID." }
        ];
    } else if (server.type === 'ExternalAPI' || server.type === 'Marketplace') {
         endpoints = [
            { path: "/records", methods: ["GET"], description: "Fetch a list of records." },
            { path: "/records", methods: ["POST"], description: "Create a new record." }
        ];
    } else {
        endpoints = [
            { path: "/health", methods: ["GET"], description: "Health check endpoint" },
            { path: "/data", methods: ["GET", "POST"], description: "Generic data endpoint" }
        ];
    }

    const config = {
      mcpVersion: "1.1.0",
      serverInfo: {
        id: server.id,
        name: server.name,
        url: server.url,
        description: server.description,
        type: server.type
      },
      endpoints,
      auth: {
        type: server.type === 'Official' ? "OAUTH2" : "API_KEY"
      },
      ...(server.webhookUrl && { webhooks: { ingestUrl: server.webhookUrl } })
    };
    return JSON.stringify(config, null, 2);
};

const AddServerWizard: React.FC<{ onClose: () => void, onAdd: (server: Omit<McpServer, 'id' | 'isLoaded'>) => void }> = ({ onClose, onAdd }) => {
    const [step, setStep] = useState(1);
    const [serverData, setServerData] = useState<Partial<Omit<McpServer, 'id'|'isLoaded'>>>({
        name: '',
        url: 'mcp://',
        description: '',
        type: 'Custom',
    });

    const handleNext = () => setStep(s => s + 1);
    const handleBack = () => setStep(s => s - 1);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setServerData(prev => ({ ...prev, [name]: value }));
    };

    const handleFinish = () => {
        if (!serverData.name || !serverData.url) {
            alert("Name and URL are required.");
            return;
        }
        onAdd(serverData as Omit<McpServer, 'id'|'isLoaded'>);
    };

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
        <Card className="max-w-xl w-full" onClick={e => e.stopPropagation()}>
          <h2 className="text-2xl font-bold text-white mb-4">New Custom MCP Wizard</h2>
          
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-cyan-400">Step 1: Basic Information</h3>
              <div>
                  <label className="block text-slate-400 mb-1">Server Name</label>
                  <input name="name" value={serverData.name} onChange={handleChange} placeholder="e.g., My Internal API" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
              </div>
              <div>
                  <label className="block text-slate-400 mb-1">Server URL</label>
                  <input name="url" value={serverData.url} onChange={handleChange} placeholder="mcp://my-api.internal" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
              </div>
              <div>
                  <label className="block text-slate-400 mb-1">Description</label>
                  <textarea name="description" value={serverData.description} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white" />
              </div>
            </div>
          )}

          {step === 2 && (
              <div className="space-y-4">
                  <h3 className="font-semibold text-cyan-400">Step 2: Webhooks (Optional)</h3>
                  <p className="text-sm text-slate-400">Enable real-time data ingestion by providing a webhook URL.</p>
                  <div>
                      <label className="block text-slate-400 mb-1">Webhook URL</label>
                      <input 
                          name="webhookUrl" 
                          value={serverData.webhookUrl || ''} 
                          readOnly 
                          placeholder="Click to generate"
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-cyan-300 font-mono" 
                      />
                       <button 
                            type="button"
                            onClick={() => setServerData(prev => ({...prev, webhookUrl: `https://in.cloudatahub.io/${Date.now()}`}))}
                            className="mt-2 text-sm bg-slate-600 hover:bg-slate-500 text-white font-semibold py-1 px-3 rounded-lg"
                        >
                            Generate URL
                        </button>
                  </div>
              </div>
          )}
          
          <div className="flex justify-between mt-6">
            <div>
              {step > 1 && <button onClick={handleBack} className="bg-slate-600 btn">Back</button>}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="bg-slate-600 btn">Cancel</button>
              {step < 2 && <button onClick={handleNext} className="bg-cyan-500 btn">Next</button>}
              {step === 2 && <button onClick={handleFinish} className="bg-cyan-500 btn">Finish & Add</button>}
            </div>
          </div>
        </Card>
        <style>{`.btn { @apply text-white font-semibold px-6 py-2 rounded-lg transition-colors; }`}</style>
      </div>
    );
};

const MarketplaceCard: React.FC<{ server: McpServer, onInstall: (server: McpServer) => void }> = ({ server, onInstall }) => (
    <div className="p-4 bg-slate-900/50 rounded-lg flex flex-col justify-between">
        <div>
            <p className="font-semibold text-slate-200">{server.name}</p>
            <p className="text-xs font-semibold uppercase text-cyan-400 mb-2">{server.category}</p>
            <p className="text-sm text-slate-400 mb-3">{server.description}</p>
        </div>
        <button
            onClick={() => onInstall(server)}
            disabled={server.isInstalled}
            className="w-full mt-2 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-sm rounded font-semibold text-white disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
        >
            {server.isInstalled ? 'Installed' : 'Install'}
        </button>
    </div>
);


const McpProtocol: React.FC = () => {
    const [allServers, setAllServers] = useState<McpServer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'library' | 'marketplace'>('library');
    const [isWizardOpen, setIsWizardOpen] = useState(false);

    useEffect(() => {
        const loadServers = async () => {
            setIsLoading(true);
            const servers = await getMcpServers();
            setAllServers(servers);
            setIsLoading(false);
        };
        loadServers();
    }, []);

    const handleInstallMarketplace = async (serverToInstall: McpServer) => {
        const installedServer = { ...serverToInstall, isInstalled: true, type: serverToInstall.category as McpServerType, isLoaded: true };
        setAllServers(prev => prev.map(s => s.id === installedServer.id ? installedServer : s));
        await saveMcpServer(installedServer);
    }
    
    const handleToggleLoad = async (server: McpServer) => {
        const isCurrentlyLoaded = server.isLoaded;
        const updatedServer = { ...server, isLoaded: !isCurrentlyLoaded };
        
        setAllServers(allServers.map(s => s.id === server.id ? updatedServer : s));
        
        await saveMcpServer(updatedServer);
    };

    const handleAddCustomServer = async (newServerData: Omit<McpServer, 'id'|'isLoaded'>) => {
        const newServer: McpServer = {
            ...newServerData,
            id: `custom-${Date.now()}`,
            isLoaded: true,
        };
        setAllServers([...allServers, newServer]);
        await saveMcpServer(newServer);
        setIsWizardOpen(false);
    };

    const libraryServers = allServers.filter(s => s.type === 'Official' && s.isInstalled);
    const customServers = allServers.filter(s => s.type === 'Custom');
    const marketplaceServers = allServers.filter(s => s.type === 'Marketplace');

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white">Model Content Protocol (MCP)</h1>
            <p className="text-slate-400 max-w-3xl">
                MCPs are the interfaces for all inputs and outputs. Manage connections to your model libraries, data sources, and application servers. Install connectors from the marketplace or use the wizard to add custom endpoints.
            </p>

            <div className="flex border-b border-slate-700">
                <button onClick={() => setActiveTab('library')} className={`px-4 py-2 -mb-px font-medium text-lg border-b-2 ${activeTab === 'library' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}>My Connections</button>
                <button onClick={() => setActiveTab('marketplace')} className={`px-4 py-2 -mb-px font-medium text-lg border-b-2 ${activeTab === 'marketplace' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}>Marketplace</button>
            </div>
            
            {activeTab === 'library' && (
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white">Custom Servers</h2>
                             <button onClick={() => setIsWizardOpen(true)} className="bg-cyan-500 text-white font-semibold px-4 py-1 rounded-lg hover:bg-cyan-600 text-sm">+ New Custom MCP</button>
                        </div>
                         <ServerList servers={customServers} onToggleLoad={handleToggleLoad} isLoading={isLoading} />
                    </Card>
                     <Card>
                        <h2 className="text-xl font-bold text-white mb-4">Installed from Marketplace</h2>
                         <ServerList servers={libraryServers} onToggleLoad={handleToggleLoad} isLoading={isLoading} />
                    </Card>
                </div>
            )}

            {activeTab === 'marketplace' && (
                <Card>
                     <h2 className="text-xl font-bold text-white mb-4">Connector Marketplace</h2>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {marketplaceServers.map(s => <MarketplaceCard key={s.id} server={s} onInstall={handleInstallMarketplace} />)}
                     </div>
                </Card>
            )}

            {isWizardOpen && <AddServerWizard onClose={() => setIsWizardOpen(false)} onAdd={handleAddCustomServer} />}
        </div>
    );
};

const ServerList: React.FC<{ servers: McpServer[], onToggleLoad: (s: McpServer) => void, isLoading: boolean }> = 
({ servers, onToggleLoad, isLoading }) => (
    <div className="flex-grow overflow-y-auto space-y-3 pr-2 -mr-2 max-h-[250px]">
        {isLoading ? <p className="text-slate-400">Loading...</p> : servers.length > 0 ? servers.map(server => (
            <div key={server.id} className="p-3 bg-slate-900/50 rounded-lg">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-semibold text-slate-200">{server.name}</p>
                        <p className="text-xs text-slate-400">{server.description}</p>
                        <p className="text-xs text-cyan-400 font-mono mt-1">{server.url}</p>
                    </div>
                     <button 
                        onClick={() => onToggleLoad(server)}
                        className={`px-3 py-1 text-sm rounded font-semibold text-white whitespace-nowrap ${server.isLoaded ? 'bg-red-800/80 hover:bg-red-700' : 'bg-cyan-500 hover:bg-cyan-600'}`}
                    >
                        {server.isLoaded ? 'Unload' : 'Load'}
                    </button>
                </div>
            </div>
        )) : <p className="text-center text-slate-500 py-4 text-sm">No servers in this category.</p>}
    </div>
);

export default McpProtocol;