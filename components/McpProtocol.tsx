
import React, { useState, useEffect, useRef } from 'react';
import Card from './Card';
import { getMcpServers, saveMcpServer } from '../services/api';
import type { McpServer, McpServerType } from '../types';
import { useQuery, invalidateQuery } from '../hooks/useQuery';
import { useFocusTrap } from '../hooks/useFocusTrap';
import Button from './common/Button';
import { initialMcpServers, marketplaceMcpServers } from '../data/mcpServers';
import { useUser } from '../contexts/UserContext';
import { AccessDenied } from './common/AccessDenied';

const generateMcpCode = (server: McpServer): string => {
    let endpoints = [];
    if (server.name.toLowerCase().includes('p21') || server.name.toLowerCase().includes('erp')) {
        endpoints = [
            { path: "/customers", methods: ["GET"], description: "Fetch customer data" },
            { path: "/orders", methods: ["GET", "POST"], description: "Fetch and create sales orders" },
            { path: "/inventory", methods: ["GET"], description: "Fetch item stock levels" },
            { path: "/query", methods: ["POST"], description: "Execute SQL Query", schema: { input: "sql_string", output: "json" } }
        ];
    } else if (server.name.toLowerCase().includes('rental') || server.name.toLowerCase().includes('por')) {
        endpoints = [
            { path: "/assets", methods: ["GET"], description: "Fetch rental assets" },
            { path: "/contracts", methods: ["GET"], description: "Fetch active contracts" },
            { path: "/query", methods: ["POST"], description: "Execute MS Jet SQL Query", schema: { input: "ms_jet_sql", output: "json" } }
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

const AddServerWizard: React.FC<{ isOpen: boolean, onClose: () => void, onAdd: (server: Omit<McpServer, 'id' | 'isLoaded'>) => void }> = ({ isOpen, onClose, onAdd }) => {
    const [step, setStep] = useState(1);
    const [serverData, setServerData] = useState<Partial<Omit<McpServer, 'id'|'isLoaded'>>>({
        name: '',
        url: 'mcp://',
        description: '',
        type: 'Custom',
    });
    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(modalRef, isOpen);

    useEffect(() => {
        if(isOpen) {
            setStep(1);
            setServerData({ name: '', url: 'mcp://', description: '', type: 'Custom' });
        }
    }, [isOpen]);

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

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
        <Card ref={modalRef} className="max-w-xl w-full" onClick={e => e.stopPropagation()}>
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
                       <Button 
                            type="button"
                            variant="secondary"
                            onClick={() => setServerData(prev => ({...prev, webhookUrl: `https://in.cloudatahub.io/${Date.now()}`}))}
                            className="mt-2 text-sm py-1 px-3"
                        >
                            Generate URL
                        </Button>
                  </div>
              </div>
          )}
          
          <div className="flex justify-between mt-6">
            <div>
              {step > 1 && <Button variant="secondary" onClick={handleBack}>Back</Button>}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              {step < 2 && <Button variant="primary" onClick={handleNext}>Next</Button>}
              {step === 2 && <Button variant="primary" onClick={handleFinish}>Finish & Add</Button>}
            </div>
          </div>
        </Card>
      </div>
    );
};

const MarketplaceCard: React.FC<{ server: McpServer, onInstall: (server: McpServer) => void }> = ({ server, onInstall }) => (
    <div className="p-4 bg-slate-900/50 rounded-lg flex flex-col justify-between border border-slate-700/50 hover:border-cyan-500/50 transition-colors">
        <div>
            <p className="font-semibold text-slate-200">{server.name}</p>
            <p className="text-xs font-semibold uppercase text-cyan-400 mb-2">{server.category}</p>
            <p className="text-sm text-slate-400 mb-3">{server.description}</p>
        </div>
        <Button
            variant={server.isInstalled ? 'secondary' : 'primary'}
            onClick={() => onInstall(server)}
            disabled={server.isInstalled}
            className="w-full mt-2 text-sm"
        >
            {server.isInstalled ? 'Installed' : 'Install'}
        </Button>
    </div>
);

// Extended list for "Find Additional MCPs" simulation
const extraMarketplaceMcps: Omit<McpServer, 'id' | 'isLoaded'>[] = [
    { name: 'Salesforce CRM', url: 'mcp://api.salesforce.com', description: 'Connect to Salesforce Cloud objects.', type: 'Marketplace', isInstalled: false, category: 'CRM' },
    { name: 'Jira Software', url: 'mcp://api.atlassian.com', description: 'Project tracking and issue management.', type: 'Marketplace', isInstalled: false, category: 'Support' },
    { name: 'Stripe', url: 'mcp://api.stripe.com', description: 'Payment processing integration.', type: 'Marketplace', isInstalled: false, category: 'Finance' },
    { name: 'Magento', url: 'mcp://api.magento.com', description: 'Open source e-commerce platform.', type: 'Marketplace', isInstalled: false, category: 'eCommerce' },
    { name: 'Intercom', url: 'mcp://api.intercom.io', description: 'Customer messaging platform.', type: 'Marketplace', isInstalled: false, category: 'Support' },
    { name: 'ServiceNow', url: 'mcp://api.servicenow.com', description: 'Enterprise IT service management.', type: 'Marketplace', isInstalled: false, category: 'Support' },
    { name: 'Oracle NetSuite', url: 'mcp://api.netsuite.com', description: 'Cloud business management suite.', type: 'Marketplace', isInstalled: false, category: 'Finance' },
];

const McpProtocol: React.FC = () => {
    const { isAdmin } = useUser();
    const { data: allServers = [], isLoading, refetch } = useQuery<McpServer[]>(['mcpServers'], getMcpServers);
    const [allServersState, setAllServersState] = useState<McpServer[]>([]);
    
    const [activeTab, setActiveTab] = useState<'library' | 'marketplace'>('library');
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [isConfiguring, setIsConfiguring] = useState(false);

    // Marketplace Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearchingRegistry, setIsSearchingRegistry] = useState(false);

    useEffect(() => {
        setAllServersState(allServers);
    }, [allServers]);

    if (!isAdmin) {
        return <AccessDenied />;
    }

    const handleInstallMarketplace = async (serverToInstall: McpServer) => {
        // When installing, mark as installed and loaded, but preserve the original type (Marketplace or Official)
        const installedServer = { ...serverToInstall, isInstalled: true, isLoaded: true };
        setAllServersState(prev => prev.map(s => s.id === installedServer.id ? installedServer : s));
        await saveMcpServer(installedServer);
        invalidateQuery(['mcpServers']);
        invalidateQuery(['loadedMcpServers']);
    }
    
    const handleToggleLoad = async (server: McpServer) => {
        const updatedServer = { ...server, isLoaded: !server.isLoaded };
        
        setAllServersState(allServersState.map(s => s.id === server.id ? updatedServer : s));
        await saveMcpServer(updatedServer);
        invalidateQuery(['mcpServers']);
        invalidateQuery(['loadedMcpServers']);
    };

    const handleAddCustomServer = async (newServerData: Omit<McpServer, 'id'|'isLoaded'>) => {
        const newServer: McpServer = {
            ...newServerData,
            id: `custom-${Date.now()}`,
            isLoaded: true,
        };
        setAllServersState(prev => [...prev, newServer]);
        await saveMcpServer(newServer);
        invalidateQuery(['mcpServers']);
        setIsWizardOpen(false);
    };

    const handleAutoConfigure = async () => {
        setIsConfiguring(true);
        
        try {
            // 1. Create Epicore P21 MCP
            const p21Server: McpServer = {
                id: `p21-sql-adapter-${Date.now()}`,
                name: 'Epicore P21 SQL Interface',
                url: 'mcp://p21.internal:1433',
                type: 'Custom',
                description: 'Direct interface to Epicore P21 ERP. Accepts ANSI SQL queries for reading data and returns results in standard JSON format.',
                isLoaded: true,
                isInstalled: true
            };

            // 2. Create Point of Rental (POR) MCP
            const porServer: McpServer = {
                id: `por-jet-adapter-${Date.now()}`,
                name: 'Point of Rental (POR) Jet Interface',
                url: 'mcp://por.internal:3050',
                type: 'Custom',
                description: 'Interface for Point of Rental database. Accepts Microsoft Jet variant SQL queries and returns results in standard JSON format.',
                isLoaded: true,
                isInstalled: true
            };

            // 3. Lookup and Load Library MCPs that match schema needs
            // In this simulation, we assume the app needs Teams, Drive, and standard connectors.
            const libraryMatches = initialMcpServers.map((s, i) => ({
                ...s,
                id: `lib-server-${i}`, 
                isLoaded: true,
                isInstalled: true,
                type: 'Official' as const
            }));

            // Batch updates
            const newServers = [...allServersState];
            
            // Add P21 if not exists (by name check to avoid dups on multiple clicks)
            if (!newServers.some(s => s.name.includes('Epicore P21 SQL'))) {
                newServers.push(p21Server);
                await saveMcpServer(p21Server);
            }

            // Add POR if not exists
            if (!newServers.some(s => s.name.includes('Point of Rental (POR) Jet'))) {
                newServers.push(porServer);
                await saveMcpServer(porServer);
            }

            // Update or Add Library servers
            for (const libServer of libraryMatches) {
                const existing = newServers.find(s => s.name === libServer.name);
                if (existing) {
                    if (!existing.isLoaded) {
                        existing.isLoaded = true;
                        await saveMcpServer(existing);
                    }
                } else {
                    // If for some reason it's missing from DB but in our static list
                    newServers.push(libServer);
                    await saveMcpServer(libServer);
                }
            }

            setAllServersState(newServers);
            invalidateQuery(['mcpServers']);
            invalidateQuery(['loadedMcpServers']);
            
            alert("Successfully created P21 & POR interfaces and loaded matching library MCPs.");

        } catch (e) {
            console.error("Auto-configuration failed", e);
            alert("Failed to auto-configure sources.");
        } finally {
            setIsConfiguring(false);
        }
    };

    const handleSearchRegistry = async () => {
        setIsSearchingRegistry(true);
        // Simulate network delay for "searching online"
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const existingNames = new Set(allServersState.map(s => s.name));
        // Select 1-3 random new servers to "find"
        const newServers = extraMarketplaceMcps
            .filter(s => !existingNames.has(s.name))
            .filter(() => Math.random() > 0.2) // Random chance to find each
            .map((s, i) => ({
                ...s,
                id: `market-new-${Date.now()}-${i}`,
                isInstalled: false,
                isLoaded: false
            } as McpServer));

        if (newServers.length > 0) {
            const updatedState = [...allServersState, ...newServers];
            setAllServersState(updatedState);
            // Persist them so they stay in the list
            for (const s of newServers) {
                await saveMcpServer(s);
            }
            invalidateQuery(['mcpServers']);
        }
        setIsSearchingRegistry(false);
    };

    // Filtering Logic
    // Library: Show "Official" OR "Marketplace" types that ARE installed.
    const libraryServers = allServersState.filter(s => (s.type === 'Official' || s.type === 'Marketplace') && s.isInstalled);
    
    // Custom: Show only "Custom" type.
    const customServers = allServersState.filter(s => s.type === 'Custom');
    
    // Marketplace: Show all "Marketplace" type servers (installed or not).
    const marketplaceServers = allServersState.filter(s => s.type === 'Marketplace');
    
    // Apply Search Filter to Marketplace
    const filteredMarketplaceServers = marketplaceServers.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.category && s.category.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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
                        <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                            <h2 className="text-xl font-bold text-white">Custom Servers</h2>
                            <div className="flex gap-2">
                                <Button 
                                    variant="secondary" 
                                    className="text-xs py-1 px-2" 
                                    onClick={handleAutoConfigure}
                                    disabled={isConfiguring}
                                    title="Create P21/POR Adapters and load needed sources"
                                >
                                    {isConfiguring ? 'Configuring...' : 'Auto-Configure Sources'}
                                </Button>
                                <Button variant="primary" className="text-xs py-1 px-2" onClick={() => setIsWizardOpen(true)}>+ New Custom MCP</Button>
                            </div>
                        </div>
                         <ServerList servers={customServers} onToggleLoad={handleToggleLoad} isLoading={isLoading} />
                    </Card>
                     <Card>
                        <h2 className="text-xl font-bold text-white mb-4">My Installed Connectors</h2>
                         <ServerList servers={libraryServers} onToggleLoad={handleToggleLoad} isLoading={isLoading} />
                    </Card>
                </div>
            )}

            {activeTab === 'marketplace' && (
                <Card>
                     <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                        <h2 className="text-xl font-bold text-white">Connector Marketplace</h2>
                        <div className="flex items-center gap-2 flex-grow md:flex-grow-0">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Search connectors..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none w-64"
                                />
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 absolute right-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <Button 
                                variant="secondary" 
                                onClick={handleSearchRegistry}
                                disabled={isSearchingRegistry}
                                className="whitespace-nowrap text-sm"
                            >
                                {isSearchingRegistry ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                                        Searching...
                                    </span>
                                ) : (
                                    'Find Additional MCPs'
                                )}
                            </Button>
                        </div>
                     </div>
                     
                     {filteredMarketplaceServers.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredMarketplaceServers.map(s => <MarketplaceCard key={s.id} server={s} onInstall={handleInstallMarketplace} />)}
                        </div>
                     ) : (
                        <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-lg">
                            <p className="text-slate-400 mb-2">No connectors found.</p>
                            <p className="text-xs text-slate-500">Try searching for "Salesforce", "Jira", or click "Find Additional MCPs" to refresh the online registry.</p>
                        </div>
                     )}
                </Card>
            )}

            <AddServerWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} onAdd={handleAddCustomServer} />
        </div>
    );
};

const ServerList: React.FC<{ servers: McpServer[], onToggleLoad: (s: McpServer) => void, isLoading: boolean }> = 
({ servers, onToggleLoad, isLoading }) => (
    <div className="flex-grow overflow-y-auto space-y-3 pr-2 -mr-2 max-h-[250px]">
        {isLoading ? <p className="text-slate-400">Loading...</p> : servers.length > 0 ? servers.map(server => (
            <div key={server.id} className="p-3 bg-slate-900/50 rounded-lg group relative">
                <div className="flex justify-between items-start">
                    <div className="pr-16">
                        <p className="font-semibold text-slate-200">{server.name}</p>
                        <p className="text-xs text-slate-400">{server.description}</p>
                        <p className="text-xs text-cyan-400 font-mono mt-1 truncate">{server.url}</p>
                    </div>
                     <Button 
                        variant={server.isLoaded ? 'danger' : 'primary'}
                        onClick={() => onToggleLoad(server)}
                        className="px-3 py-1 text-sm whitespace-nowrap absolute top-3 right-3"
                    >
                        {server.isLoaded ? 'Unload' : 'Load'}
                    </Button>
                </div>
                {/* Quick view of generated code for simulation effect */}
                <details className="mt-2">
                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 w-fit">View Code</summary>
                    <pre className="mt-2 p-2 bg-slate-950 rounded text-xs font-mono text-cyan-300 overflow-x-auto">
                        {generateMcpCode(server)}
                    </pre>
                </details>
            </div>
        )) : <p className="text-center text-slate-500 py-4 text-sm">No servers in this category.</p>}
    </div>
);

export default McpProtocol;
