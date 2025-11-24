
import type { McpServer, OtherInterface } from '../types';

// The data for the MCP server library has been updated as per the new specifications.
export const initialMcpServers: { name: string; url: string; description: string; type: 'Official' }[] = [
    {
        name: 'Microsoft Graph (Teams)',
        url: 'github.com/floriscornel/teams-mcp',
        description: 'Supports messaging, reading channels, and user management. Includes a Python-based server for deep integration.',
        type: 'Official',
    },
    {
        name: 'Google Drive / Workspace',
        url: 'github.com/isaacphi/mcp-gdrive',
        description: 'Comprehensive server for Google Workspace, integrating Drive, Calendar, Gmail, Docs, Sheets, and more.',
        type: 'Official',
    },
    {
        name: 'Microsoft 365 (OneDrive)',
        url: 'Bundled Connector',
        description: 'Provides a "Files / Docs / Office" MCP server bundled inside a broader Microsoft 365 MCP connector.',
        type: 'Official',
    },
    {
        name: 'Microsoft Power BI',
        url: 'Bundled Connector',
        description: 'Enables data lake content to be surfaced as a Power BI dataset for enterprise reporting and dashboards.',
        type: 'Official',
    },
    {
        name: 'Stack Overflow for Teams',
        url: 'Stack Overflow Enterprise',
        description: 'Makes enterprise knowledge Q&A content available to MCP agents and other services.',
        type: 'Official',
    },
    {
        name: 'Slack',
        url: 'Various (See MCP Directories)',
        description: 'Multiple MCP servers exist in public directories for integrating with Slack workspaces.',
        type: 'Official',
    },
];

export const marketplaceMcpServers: Omit<McpServer, 'id' | 'isLoaded'>[] = [
    {
        name: 'HubSpot Connector',
        url: 'api.hubapi.com',
        description: 'Sync contacts, companies, deals, and tickets from your HubSpot CRM.',
        type: 'Marketplace',
        isInstalled: false,
        category: 'CRM'
    },
    {
        name: 'Shopify Connector',
        url: 'my-store.myshopify.com/admin/api',
        description: 'Integrate your eCommerce store by syncing products, orders, and customers.',
        type: 'Marketplace',
        isInstalled: false,
        category: 'eCommerce'
    },
    {
        name: 'Zendesk Connector',
        url: 'my-company.zendesk.com/api/v2',
        description: 'Pull support tickets, users, and satisfaction ratings for analysis.',
        type: 'Marketplace',
        isInstalled: false,
        category: 'Support'
    },
    {
        name: 'QuickBooks Online',
        url: 'quickbooks.api.intuit.com/v3',
        description: 'Sync invoices, bills, customers, and vendors from your accounting software.',
        type: 'Marketplace',
        isInstalled: false,
        category: 'Finance'
    },
];

export const indexedDocumentCollections: { name: string; url: string; description: string; type: 'DocumentCollection' }[] = [
    {
        name: 'Internal Knowledge Base',
        url: 'vector-index://stackoverflow',
        description: 'Semantic index of all questions and answers from the internal Stack Overflow for Teams.',
        type: 'DocumentCollection',
    },
    {
        name: 'Customer Communications',
        url: 'vector-index://support-tickets',
        description: 'Index of all customer support tickets, emails, and chat transcripts for sentiment analysis.',
        type: 'DocumentCollection',
    },
    {
        name: 'Meeting & Project Notes',
        url: 'vector-index://teams-gdrive',
        description: 'Combined index of meeting notes from Teams and project documentation from Google Drive.',
        type: 'DocumentCollection',
    },
];

export const externalApiConnectors: { name: string; url: string; description: string; type: 'ExternalAPI' }[] = [
    {
        name: 'Dun & Bradstreet',
        url: 'api.dnb.com/v2',
        description: 'Provides business credit reports and financial data for vetting new customers.',
        type: 'ExternalAPI',
    },
    {
        name: 'HubSpot CRM',
        url: 'api.hubapi.com',
        description: 'Connector for ingesting lead, contact, and company data from the corporate CRM.',
        type: 'ExternalAPI',
    },
    {
        name: 'Shopify eCommerce',
        url: 'my-store.myshopify.com/admin/api',
        description: 'API for syncing product, inventory, and order data with the public eCommerce platform.',
        type: 'ExternalAPI',
    },
];


// Pre-load custom, mock MCPs as per the user request
export const initialCustomServers: McpServer[] = [
    { id: 'custom-1', name: 'Epicore P21', url: 'mcp://p21.internal:8080', description: 'ERP data interface for orders and inventory.', type: 'Custom' },
    { id: 'custom-2', name: 'Point of Rental (POR)', url: 'mcp://por.internal:8080', description: 'Rental management system data.', type: 'Custom' },
    { id: 'custom-3', name: 'Rubbergoods Tests', url: 'mcp://qc-rubber.internal', description: 'Quality control data from rubber goods testing.', type: 'Custom' },
    { id: 'custom-4', name: 'Fiberglass Tests', url: 'mcp://qc-fiberglass.internal', description: 'Quality control data from fiberglass testing.', type: 'Custom' },
    { id: 'custom-5', name: 'Swivel Tests', url: 'mcp://qc-swivel.internal', description: 'Quality control data from swivel joint testing.', type: 'Custom' },
    { id: 'custom-6', name: 'WordPress Interface', url: 'mcp://cms.internal/wp-json', description: 'Content management system interface.', type: 'Custom' },
];


export const otherInterfaces: OtherInterface[] = [
  { name: 'FedEx Shipping API', type: 'API', description: 'Real-time shipping rates and label generation.', status: 'Active' },
  { name: 'Stripe Payment Gateway', type: 'API', description: 'Processes customer credit card payments.', status: 'Active' },
  { name: 'EDI 850 (Purchase Order)', type: 'EDI', description: 'Receives POs from major retail partners.', status: 'Active' },
  { name: 'EDI 810 (Invoice)', type: 'EDI', description: 'Sends invoices to major retail partners.', status: 'Active' },
  { name: 'Supplier SFTP Drop', type: 'File Transfer', description: 'Daily inventory level files from suppliers.', status: 'Active' },
  { name: 'Power BI DirectQuery', type: 'Direct DB', description: 'Connection for corporate sales dashboard.', status: 'Active' },
  { name: 'Haas CNC Machine API', type: 'Shop Floor', description: 'Pulls production metrics from manufacturing floor.', status: 'Active' },
  { name: 'SendGrid SMTP Relay', type: 'API', description: 'Sends transactional emails (e.g., order confirmations).', status: 'Active' },
];
