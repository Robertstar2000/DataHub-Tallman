
import type { UnstructuredDocument } from '../data/unstructuredData';
import type { Workflow, McpServer, Dashboard as DashboardType, User, AuditLog, PiiFinding, DataAccessPolicy, PredictionModel, WorkflowVersion, ExecutionLog } from '../types';
import * as dbLogic from './worker/db';

// --- Data Source Mode State ---
let dataSourceMode: 'real' | 'test' = 'test';

export const setDataSourceMode = (mode: 'real' | 'test') => {
    dataSourceMode = mode;
    console.log(`[Backend] Data Source Mode switched to: ${mode.toUpperCase()}`);
};

export const getDataSourceMode = () => {
    return dataSourceMode;
};

// --- Direct Database Access (Main Thread) ---
// The Web Worker has been removed to ensure compatibility. 
// All database operations now occur on the main thread.

export const initializeDatabase = async (dbBytes?: Uint8Array): Promise<string> => {
    try {
        return await dbLogic.initializeDatabase(dbBytes);
    } catch (e: any) {
        console.error("DB Initialization Error:", e);
        throw e;
    }
};

export const executeQuery = async (query: string, params: (string|number)[] = []): Promise<{ headers: string[], data: any[] } | { error: string }> => {
    return await dbLogic.executeQuery(query, params);
};

export const getTableSchemas = async (): Promise<Record<string, { columns: string; mcpSource: string | null; }>> => {
    return await dbLogic.getTableSchemas();
};

export const createTableFromMcp = async (payload: { tableName: string; columns: string; mcpSource: string; }): Promise<{ success: boolean; message: string; }> => {
    return await dbLogic.createTableFromMcp(payload);
}

export const findSimilarDocuments = async (docId: string, count: number = 3): Promise<UnstructuredDocument[]> => {
    return await dbLogic.findSimilarDocuments(docId, count);
};

export const findSimilarDocumentsByQuery = async (query: string, count: number = 5): Promise<UnstructuredDocument[]> => {
    return await dbLogic.findSimilarDocumentsByQuery(query, count);
};

export const getDbStatistics = async (): Promise<any> => {
    return await dbLogic.getDbStatistics();
};

export const exportDb = async (): Promise<Uint8Array> => {
    return await dbLogic.exportDb();
};

export const runMaintenance = async (): Promise<{ success: boolean, message: string }> => {
    return await dbLogic.runMaintenance();
};

export const getVectorStoreStats = async (): Promise<any> => {
    return await dbLogic.getVectorStoreStats();
};

export const rebuildVectorStore = async (): Promise<void> => {
    await dbLogic.rebuildVectorStore();
}

export const getDashboardStats = async (): Promise<any> => {
    return await dbLogic.getDashboardStats();
}

export const getMcpServers = async (): Promise<McpServer[]> => {
    return await dbLogic.getMcpServers();
}
export const getWorkflows = async (): Promise<Workflow[]> => {
    return await dbLogic.getWorkflows();
}
export const getLoadedMcpServers = async (): Promise<McpServer[]> => {
    return await dbLogic.getLoadedMcpServers();
}
export const saveMcpServer = async (server: McpServer): Promise<void> => {
    return await dbLogic.saveMcpServer(server);
}
export const saveWorkflow = async (workflow: Workflow, asNewVersion: boolean): Promise<void> => {
    return await dbLogic.saveWorkflow(workflow, asNewVersion);
}
export const deleteWorkflow = async (id: string): Promise<void> => {
    return await dbLogic.deleteWorkflow(id);
}
export const getDashboards = async (): Promise<DashboardType[]> => {
    return await dbLogic.getDashboards();
}
export const saveDashboard = async (dashboard: DashboardType): Promise<void> => {
    return await dbLogic.saveDashboard(dashboard);
}
export const deleteDashboard = async (id: string): Promise<void> => {
    return await dbLogic.deleteDashboard(id);
}
export const getUsers = async (): Promise<User[]> => {
    return await dbLogic.getUsers();
}
export const saveUser = async (user: User): Promise<void> => {
    return await dbLogic.saveUser(user);
}
export const deleteUser = async (userId: number): Promise<void> => {
    return await dbLogic.deleteUser(userId);
}

export const logAuditEvent = async (payload: { user: string, action: string, details: string }): Promise<void> => {
    await dbLogic.logAuditEvent(payload);
}

export const getAuditLogs = async (): Promise<AuditLog[]> => {
    return await dbLogic.getAuditLogs();
}

export const getPiiFindings = async (): Promise<PiiFinding[]> => {
    return await dbLogic.getPiiFindings();
}

export const getDataAccessPolicies = async (): Promise<DataAccessPolicy[]> => {
    return await dbLogic.getDataAccessPolicies();
}

export const saveDataAccessPolicy = async (policy: DataAccessPolicy): Promise<void> => {
    return await dbLogic.saveDataAccessPolicy(policy);
}

export const getPredictionModels = async (): Promise<PredictionModel[]> => {
    return await dbLogic.getPredictionModels();
}

export const createPrediction = async (modelData: Omit<PredictionModel, 'id' | 'status' | 'createdAt'>): Promise<void> => {
    return await dbLogic.createPrediction(modelData);
}

export const deletePredictionModel = async (modelId: string): Promise<void> => {
    return await dbLogic.deletePredictionModel(modelId);
}

export const getWorkflowVersions = async (workflowId: string): Promise<WorkflowVersion[]> => {
    return await dbLogic.getWorkflowVersions(workflowId);
}

export const getExecutionLogs = async (workflowId: string): Promise<ExecutionLog[]> => {
    return await dbLogic.getExecutionLogs(workflowId);
}
