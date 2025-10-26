// Types for Dashboard Builder
export type ChartType = 'Metric' | 'Bar' | 'Line' | 'Pie';

export interface WidgetConfig {
  id: string;
  title: string;
  type: ChartType;
  colSpan: 1 | 2 | 3 | 4;
  sqlQuery: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: WidgetConfig[];
}

// Types for Workflow Builder
export type WorkflowStatus = 'Live' | 'Hold' | 'Test';
export type WorkflowNodeType = 'Source' | 'Transform' | 'Filter' | 'Validate' | 'Sink' | 'Join' | 'Aggregate';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: Record<string, any>; // e.g., { tableName: 'customers' } for Source, { rules: [...] } for Validate
}

export interface WorkflowEdge {
  id: string;
  source: string; // source node id
  target: string; // target node id
}

export interface WorkflowVersion {
    version: number;
    createdAt: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

export interface ExecutionLog {
    id: string;
    workflowId: string;
    version: number;
    startedAt: string;
    finishedAt: string;
    status: 'Success' | 'Failure';
    logs: string;
    rowsProcessed: number;
}

export interface Workflow {
  id:string;
  name: string;
  lastExecuted: string;
  status: WorkflowStatus;
  // Deprecated fields, replaced by visual builder nodes/edges
  sources?: string[];
  transformer?: string;
  transformerCode?: string;
  destination?: string;
  repartition?: number;
  trigger?: string;
  dependencies?: string[];
  triggersOnSuccess?: string[];
  // New visual builder fields
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  currentVersion: number;
}

// Types for Model Content Protocol
export type McpServerType = 'Official' | 'Custom' | 'DocumentCollection' | 'ExternalAPI' | 'Marketplace';

export interface McpServer {
  id:string;
  name: string;
  url: string;
  type: McpServerType;
  description: string;
  isLoaded?: boolean;
  isInstalled?: boolean; // For Marketplace items
  webhookUrl?: string; // For webhook-enabled MCPs
  category?: 'CRM' | 'eCommerce' | 'Finance' | 'Support'; // For Marketplace
}

// Types for DL Controls
export type Role = 'Admin' | 'Analyst' | 'Viewer';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

// FIX: Moved from unstructuredData.ts to centralize types
// Types for Governance & Security
export interface DataAccessPolicy {
    id: string;
    role: 'Admin' | 'Analyst' | 'Viewer';
    table: string;
    accessLevel: 'all' | 'none' | 'partial';
    columnPermissions?: Record<string, 'visible' | 'masked'>;
    rowLevelSecurity?: string; // e.g., "sales_rep_id = ${user.id}"
}

export interface PiiFinding {
    table: string;
    column: string;
    piiType: 'EMAIL' | 'PHONE' | 'ADDRESS' | 'NAME';
}

export interface AuditLog {
    id: number;
    timestamp: string;
    user: string;
    action: string; // e.g., 'EXECUTE_QUERY', 'RUN_WORKFLOW'
    details: string; // e.g., The SQL query, or the workflow name
}

// Types for Predictive Analytics
export interface PredictionModel {
    id: string;
    name: string;
    sourceTable: string;
    targetColumn: string;
    status: 'Training' | 'Ready' | 'Error';
    createdAt: string;
    accuracy?: number; // e.g., 0.85
    resultTable?: string; // Name of the table where predictions are stored
}
