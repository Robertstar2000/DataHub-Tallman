

import * as beDb from './be-db';
import * as beGemini from './be-gemini';
import * as bePipelines from './be-pipelines';
import type { UnstructuredDocument } from '../data/unstructuredData';
// FIX: Import new types from the centralized types.ts file
import type { Workflow, McpServer, Dashboard, User, PredictionModel, DataAccessPolicy, PiiFinding, AuditLog, WorkflowVersion, ExecutionLog } from '../types';

/**
 * This file acts as the frontend's API client.
 * In a real application, the functions in this file would be making `fetch` calls
 * to a remote backend server. Here, they call the `be-*.ts` files directly
 * but simulate the asynchronous nature of network requests with a delay.
 */

const simulateLatency = (ms: number = 200) => new Promise(resolve => setTimeout(resolve, ms));

const logAuditEvent = (action: string, details: string) => {
    // In a real app, user might come from an auth context
    // FIX: Call the newly implemented logAuditEvent function
    beDb.logAuditEvent({ user: 'Analyst', action, details });
};

// --- DB API ---
export const initializeDatabase = async (dbBytes?: Uint8Array) => {
    await simulateLatency(1000); // DB init can be slow
    return beDb.initializeDatabase(dbBytes);
};

export const executeQuery = async (query: string): Promise<{ headers: string[], data: any[] } | { error: string }> => {
    await simulateLatency(300);
    logAuditEvent('EXECUTE_QUERY', query);
    return beDb.executeQuery(query);
};

export const getTableSchemas = async (): Promise<Record<string, { columns: string, mcpSource: string | null }>> => {
    await simulateLatency();
    return beDb.getTableSchemas();
};

export const createTableFromMcp = async (payload: { tableName: string, columns: string, mcpSource: string }): Promise<{ success: boolean, message: string }> => {
    await simulateLatency(500);
    logAuditEvent('CREATE_TABLE', `Created table ${payload.tableName} from MCP ${payload.mcpSource}`);
    return beDb.createTableFromMcp(payload);
}

export const findSimilarDocuments = async (docId: string, count: number = 3): Promise<UnstructuredDocument[]> => {
    await simulateLatency();
    return beDb.findSimilarDocuments(docId, count);
};

export const getDbStatistics = async () => {
    await simulateLatency();
    return beDb.getDbStatistics();
};

export const exportDb = async (): Promise<Uint8Array> => {
    await simulateLatency(500);
    logAuditEvent('EXPORT_DB', 'Database exported to file.');
    return beDb.exportDb();
};

export const runMaintenance = async (): Promise<{ success: boolean, message: string }> => {
    await simulateLatency(500);
    logAuditEvent('RUN_MAINTENANCE', 'VACUUM command executed.');
    return beDb.runMaintenance();
};

export const getVectorStoreStats = async () => {
    await simulateLatency();
    return beDb.getVectorStoreStats();
};

export const rebuildVectorStore = async (): Promise<void> => {
    await simulateLatency(500);
    logAuditEvent('REBUILD_VECTOR_STORE', 'Vector store index rebuilt.');
    return beDb.rebuildVectorStore();
}

export const getDashboardStats = async () => {
    await simulateLatency(400);
    return beDb.getDashboardStats();
}


// --- Gemini API ---
export const processUnstructuredData = async (request: string, documentId: string): Promise<string> => {
    await simulateLatency(800);
    logAuditEvent('AI_PROCESS_UNSTRUCTURED', `Document: ${documentId}, Request: ${request}`);
    return beGemini.processUnstructuredData(request, documentId);
};

export const getAiSqlResponseStream = (query: string) => {
    logAuditEvent('AI_ANALYST_QUERY', `Database Query: ${query}`);
    return beGemini.getAiSqlResponseStream(query);
};

export const analyzeTableWithAi = (tableName: string, query: string) => {
    logAuditEvent('AI_ANALYST_QUERY', `Table Analysis on ${tableName}: ${query}`);
    return beGemini.analyzeTableWithAi(tableName, query);
};

export const searchDocumentsWithAi = (query: string) => {
    logAuditEvent('AI_ANALYST_QUERY', `Document Search: ${query}`);
    return beGemini.searchDocumentsWithAi(query);
};

export const analyzeWorkflowWithAi = (workflowId: string, query: string) => {
    logAuditEvent('AI_ANALYST_QUERY', `Workflow Analysis on ${workflowId}: ${query}`);
    return beGemini.analyzeWorkflowWithAi(workflowId, query);
};

export const searchSchemaWithAi = async (searchQuery: string) => {
    await simulateLatency(800);
    logAuditEvent('AI_SCHEMA_SEARCH', searchQuery);
    return beGemini.searchSchemaWithAi(searchQuery);
};

// FIX: Implement missing function call
export const generateSqlWithAi = async (prompt: string) => {
    await simulateLatency(800);
    logAuditEvent('AI_SQL_GENERATION', prompt);
    return beGemini.generateSqlWithAi(prompt);
};

// FIX: Implement missing function call
export const generateWorkflowWithAi = async (prompt: string) => {
    await simulateLatency(1200);
    logAuditEvent('AI_WORKFLOW_GENERATION', prompt);
    return beGemini.generateWorkflowWithAi(prompt);
}


// --- Pipeline API ---
export const executeWorkflow = (workflow: Workflow, logCallback: (message: string) => void): Promise<boolean> => {
    logAuditEvent('EXECUTE_WORKFLOW', `Workflow Name: ${workflow.name}`);
    return bePipelines.executeWorkflow(workflow, logCallback);
};

// --- App State Management API ---

export const getMcpServers = async (): Promise<McpServer[]> => {
    await simulateLatency();
    return beDb.getMcpServers();
}

export const getLoadedMcpServers = async (): Promise<McpServer[]> => {
    await simulateLatency();
    return beDb.getLoadedMcpServers();
}

// FIX: Corrected function call to pass a single server argument as expected by the new signature.
export const saveMcpServer = async (server: McpServer): Promise<void> => {
    await simulateLatency();
    logAuditEvent('SAVE_MCP', `Saved MCP: ${server.name}, Loaded: ${server.isLoaded}`);
    return beDb.saveMcpServer(server);
}

export const getWorkflows = async (): Promise<Workflow[]> => {
    await simulateLatency();
    return beDb.getWorkflows();
}

// FIX: Implement missing function call
export const getWorkflowVersions = async (workflowId: string): Promise<WorkflowVersion[]> => {
    await simulateLatency();
    return beDb.getWorkflowVersions(workflowId);
}
// FIX: Implement missing function call
export const getExecutionLogs = async (workflowId: string): Promise<ExecutionLog[]> => {
    await simulateLatency();
    return beDb.getExecutionLogs(workflowId);
}

// FIX: Corrected function call to pass both workflow and asNewVersion arguments.
export const saveWorkflow = async (workflow: Workflow, asNewVersion: boolean): Promise<void> => {
    await simulateLatency();
    logAuditEvent('SAVE_WORKFLOW', `Saved workflow: ${workflow.name}, New Version: ${asNewVersion}`);
    return beDb.saveWorkflow(workflow, asNewVersion);
}

export const deleteWorkflow = async (id: string): Promise<void> => {
    await simulateLatency();
    logAuditEvent('DELETE_WORKFLOW', `Deleted workflow ID: ${id}`);
    return beDb.deleteWorkflow(id);
}

export const getDashboards = async (): Promise<Dashboard[]> => {
    await simulateLatency();
    return beDb.getDashboards();
}

export const saveDashboard = async (dashboard: Dashboard): Promise<void> => {
    await simulateLatency();
    logAuditEvent('SAVE_DASHBOARD', `Saved dashboard: ${dashboard.name}`);
    return beDb.saveDashboard(dashboard);
}

export const deleteDashboard = async (id: string): Promise<void> => {
    await simulateLatency();
    logAuditEvent('DELETE_DASHBOARD', `Deleted dashboard ID: ${id}`);
    return beDb.deleteDashboard(id);
}

// --- User Management API ---
export const getUsers = async (): Promise<User[]> => {
    await simulateLatency();
    return beDb.getUsers();
};

export const saveUser = async (user: User): Promise<void> => {
    await simulateLatency();
    logAuditEvent('SAVE_USER', `Saved user: ${user.name}, Role: ${user.role}`);
    return beDb.saveUser(user);
};

export const deleteUser = async (userId: number): Promise<void> => {
    await simulateLatency();
    logAuditEvent('DELETE_USER', `Deleted user ID: ${userId}`);
    return beDb.deleteUser(userId);
};

// --- New Feature APIs ---
// FIX: Implement missing function call
export const getAuditLogs = async (): Promise<AuditLog[]> => {
    await simulateLatency();
    return beDb.getAuditLogs();
};

// FIX: Implement missing function call
export const getPiiFindings = async (): Promise<PiiFinding[]> => {
    await simulateLatency();
    logAuditEvent('PII_SCAN', 'Full database scan for PII initiated.');
    return beDb.getPiiFindings();
};

// FIX: Implement missing function call
export const getDataAccessPolicies = async (): Promise<DataAccessPolicy[]> => {
    await simulateLatency();
    return beDb.getDataAccessPolicies();
};

// FIX: Implement missing function call
export const saveDataAccessPolicy = async (policy: DataAccessPolicy): Promise<void> => {
    await simulateLatency();
    logAuditEvent('SAVE_POLICY', `Policy for ${policy.role} on ${policy.table} set to ${policy.accessLevel}`);
    return beDb.saveDataAccessPolicy(policy);
};

// FIX: Implement missing function call
export const getPredictionModels = async (): Promise<PredictionModel[]> => {
    await simulateLatency();
    return beDb.getPredictionModels();
};

// FIX: Implement missing function call
export const createPrediction = async (modelData: Omit<PredictionModel, 'id' | 'status' | 'createdAt'>): Promise<void> => {
    await simulateLatency(1500); // Simulate model training
    logAuditEvent('CREATE_PREDICTION', `New model created: ${modelData.name}`);
    return beDb.createPrediction(modelData);
};

// FIX: Implement missing function call
export const deletePredictionModel = async (modelId: string): Promise<void> => {
    await simulateLatency();
    logAuditEvent('DELETE_PREDICTION', `Deleted model ID: ${modelId}`);
    return beDb.deletePredictionModel(modelId);
};