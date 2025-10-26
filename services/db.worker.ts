// This file runs in a separate thread and acts as a message-passing
// wrapper around the core database logic.

import initSqlJs from 'https://esm.sh/sql.js@1.10.3';
import * as dbLogic from './db-logic';

self.onmessage = async (e: MessageEvent) => {
    const { id, action, payload } = e.data;

    try {
        let result: any;
        switch(action) {
            case 'initializeDatabase':
                result = await dbLogic.initializeDatabase(initSqlJs, payload?.dbBytes);
                break;
            case 'executeQuery':
                result = dbLogic.executeQuery(payload.query, payload.params);
                break;
            case 'getTableSchemas':
                result = dbLogic.getTableSchemas();
                break;
            case 'createTableFromMcp':
                result = dbLogic.createTableFromMcp(payload);
                break;
            case 'findSimilarDocuments':
                result = dbLogic.findSimilarDocuments(payload.docId, payload.count);
                break;
            case 'findSimilarDocumentsByQuery':
                result = dbLogic.findSimilarDocumentsByQuery(payload.query, payload.count);
                break;
            case 'getDbStatistics':
                result = dbLogic.getDbStatistics();
                break;
            case 'exportDb':
                result = dbLogic.exportDb();
                break;
            case 'runMaintenance':
                result = dbLogic.runMaintenance();
                break;
            case 'getVectorStoreStats':
                result = dbLogic.getVectorStoreStats();
                break;
            case 'rebuildVectorStore':
                dbLogic.rebuildVectorStore();
                result = 'Vector store rebuilt.';
                break;
            case 'getDashboardStats':
                result = dbLogic.getDashboardStats();
                break;
            case 'getMcpServers':
                result = dbLogic.getMcpServers();
                break;
            case 'getWorkflows':
                result = dbLogic.getWorkflows();
                break;
            case 'getLoadedMcpServers':
                result = dbLogic.getLoadedMcpServers();
                break;
            case 'saveMcpServer':
                dbLogic.saveMcpServer(payload.server);
                result = 'MCP server saved.';
                break;
            case 'saveWorkflow':
                dbLogic.saveWorkflow(payload.workflow, payload.asNewVersion);
                result = 'Workflow saved.';
                break;
            case 'deleteWorkflow':
                dbLogic.deleteWorkflow(payload.id);
                result = 'Workflow deleted.';
                break;
            case 'getDashboards':
                result = dbLogic.getDashboards();
                break;
            case 'saveDashboard':
                dbLogic.saveDashboard(payload.dashboard);
                result = 'Dashboard saved.';
                break;
            case 'deleteDashboard':
                dbLogic.deleteDashboard(payload.id);
                result = 'Dashboard deleted.';
                break;
            case 'getUsers':
                result = dbLogic.getUsers();
                break;
            case 'saveUser':
                dbLogic.saveUser(payload.user);
                result = 'User saved.';
                break;
            case 'deleteUser':
                dbLogic.deleteUser(payload.userId);
                result = 'User deleted.';
                break;
            // FIX: Add handlers for new functions
            case 'logAuditEvent':
                dbLogic.logAuditEvent(payload);
                result = 'Audit event logged.';
                break;
            case 'getAuditLogs':
                result = dbLogic.getAuditLogs();
                break;
            case 'getPiiFindings':
                result = dbLogic.getPiiFindings();
                break;
            case 'getDataAccessPolicies':
                result = dbLogic.getDataAccessPolicies();
                break;
            case 'saveDataAccessPolicy':
                dbLogic.saveDataAccessPolicy(payload.policy);
                result = 'Policy saved.';
                break;
            case 'getPredictionModels':
                result = dbLogic.getPredictionModels();
                break;
            case 'createPrediction':
                dbLogic.createPrediction(payload.modelData);
                result = 'Prediction model created.';
                break;
            case 'deletePredictionModel':
                dbLogic.deletePredictionModel(payload.modelId);
                result = 'Prediction model deleted.';
                break;
            case 'getWorkflowVersions':
                result = dbLogic.getWorkflowVersions(payload.workflowId);
                break;
            case 'getExecutionLogs':
                result = dbLogic.getExecutionLogs(payload.workflowId);
                break;
            default:
                throw new Error(`Unknown worker action: ${action}`);
        }
        self.postMessage({ id, result });
    } catch (error: any) {
        self.postMessage({ id, error: error.message, action });
    }
};