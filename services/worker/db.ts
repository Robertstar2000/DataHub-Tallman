
import { unstructuredData } from '../../data/unstructuredData';
import type { UnstructuredDocument } from '../../data/unstructuredData';
import { schemaMetadata } from '../../data/schemaMetadata';
import type { Workflow, McpServer, Dashboard as DashboardType, User, AuditLog, PiiFinding, DataAccessPolicy, PredictionModel, WorkflowVersion, ExecutionLog } from '../../types';
import { populateDatabase } from './db-seed';

// --- Constants & Global State ---
const SQL_JS_VERSION = '1.12.0';
const IDB_NAME = 'DataLakeDB';
const IDB_STORE_NAME = 'sqljs';
const IDB_KEY = 'database';
const VECTOR_DIMENSION = 64;

// The SQL.js engine instance
let SQL: any = null;
// The database instance
let db: any = null;
// Flag to track if IndexedDB is available and working
let idbPersistenceEnabled = true;

// --- Types ---
interface VectorDocument extends UnstructuredDocument {
  vector: number[];
}
// In-memory vector store for simulation
let vectorStore: VectorDocument[] = [];

// --- SQL.js Loading & Initialization ---

/**
 * Dynamically imports sql.js.
 */
async function loadSqlJs(): Promise<any> {
    console.log("[DB] Starting loadSqlJs...");
    try {
        // Use a fully qualified URL for the import to ensure it works correctly in the browser
        const module = await import(`https://esm.sh/sql.js@${SQL_JS_VERSION}/dist/sql-wasm.js?external=fs`);
        console.log("[DB] sql.js imported.");
        // Handle various module export shapes
        if (typeof module.default === 'function') return module.default;
        if (typeof module === 'function') return module;
        return module.default || module;
    } catch (error) {
        console.error("[DB] Failed to load sql.js module:", error);
        throw new Error("Could not load SQL engine. Please check your internet connection.");
    }
}

/**
 * Initializes the SQL engine and the database instance.
 */
export async function initializeDatabase(dbBytes?: Uint8Array): Promise<string> {
    console.log("[DB] initializeDatabase starting...");
    try {
        // 1. Initialize the SQL Engine (WASM) if not already done
        if (!SQL) {
            console.log("[DB] Initializing WASM...");
            const initSqlJs = await loadSqlJs();
            
            // Explicitly fetch WASM to avoid fs.readFileSync error in browser environments
            const wasmUrl = `https://esm.sh/sql.js@${SQL_JS_VERSION}/dist/sql-wasm.wasm`;
            console.log("[DB] Fetching WASM from:", wasmUrl);
            
            const wasmResponse = await fetch(wasmUrl);
            if (!wasmResponse.ok) {
                throw new Error(`Failed to fetch WASM: ${wasmResponse.statusText}`);
            }
            const wasmBinary = await wasmResponse.arrayBuffer();

            SQL = await initSqlJs({
                wasmBinary
            });
            console.log("[DB] SQL Engine ready.");
        }

        // 2. Check persistence capability
        idbPersistenceEnabled = await checkIndexedDBAvailability();
        console.log("[DB] Persistence enabled:", idbPersistenceEnabled);

        // 3. Load Database Data
        if (dbBytes) {
            db = new SQL.Database(dbBytes);
            console.log("[DB] Restored from provided byte array.");
        } else if (idbPersistenceEnabled) {
            const savedBytes = await loadDbFromIndexedDB();
            if (savedBytes) {
                db = new SQL.Database(savedBytes);
                console.log("[DB] Loaded persistent state from IndexedDB.");
            } else {
                console.log("[DB] No saved state found. Seeding new database...");
                db = new SQL.Database();
                populateDatabase(db);
            }
        } else {
            console.warn("[DB] Persistence unavailable. Running in-memory mode.");
            db = new SQL.Database();
            populateDatabase(db);
        }

        // 4. Initial Save & Vector Indexing
        if (idbPersistenceEnabled && !dbBytes) {
             await saveDbToIndexedDB(db);
        }
        rebuildVectorStore();

        return 'Database initialized successfully.';
    } catch (e: any) {
        console.error("[DB] Initialization Failed:", e);
        throw new Error(`Failed to initialize database: ${e.message}`);
    }
}

// --- Persistence Layer (IndexedDB) ---

async function checkIndexedDBAvailability(): Promise<boolean> {
    if (typeof indexedDB === 'undefined') return false;
    try {
        await new Promise<void>((resolve, reject) => {
            const req = indexedDB.open('__idb_test__');
            req.onsuccess = () => {
                req.result.close();
                indexedDB.deleteDatabase('__idb_test__');
                resolve();
            };
            req.onerror = () => reject();
        });
        return true;
    } catch {
        return false;
    }
}

function openIdb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, 1);
        request.onerror = () => reject("Error opening IndexedDB");
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
                db.createObjectStore(IDB_STORE_NAME);
            }
        };
    });
}

async function saveDbToIndexedDB(dbInstance: any) {
    if (!dbInstance || !idbPersistenceEnabled) return;
    try {
        const dbHandle = await openIdb();
        const tx = dbHandle.transaction(IDB_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        const data = dbInstance.export();
        store.put(data, IDB_KEY);
        
        return new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => { dbHandle.close(); resolve(); };
            tx.onerror = () => { dbHandle.close(); reject(tx.error); };
        });
    } catch (e) {
        console.warn("[DB] Failed to save to IndexedDB:", e);
    }
}

async function loadDbFromIndexedDB(): Promise<Uint8Array | null> {
    if (!idbPersistenceEnabled) return null;
    try {
        const dbHandle = await openIdb();
        const tx = dbHandle.transaction(IDB_STORE_NAME, 'readonly');
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.get(IDB_KEY);

        return new Promise((resolve, reject) => {
            req.onsuccess = () => {
                dbHandle.close();
                resolve(req.result || null);
            };
            req.onerror = () => {
                dbHandle.close();
                reject(req.error);
            };
        });
    } catch (e) {
        console.warn("[DB] Failed to load from IndexedDB:", e);
        return null;
    }
}

// --- Core Database Operations ---

function isModifyingQuery(query: string): boolean {
    const q = query.trim().toUpperCase();
    return q.startsWith('INSERT') || q.startsWith('UPDATE') || q.startsWith('DELETE') || 
           q.startsWith('CREATE') || q.startsWith('DROP') || q.startsWith('ALTER') || 
           q.startsWith('VACUUM') || q.startsWith('REPLACE');
}

export async function executeQuery(query: string, params: (string | number | null)[] = []) {
    if (!db) throw new Error("Database not initialized");
    try {
        if (isModifyingQuery(query)) {
            db.run(query, params);
            // Fire and forget save
            saveDbToIndexedDB(db).catch(err => console.error("Save failed:", err));
            return { headers: [], data: [] };
        } else {
            const stmt = db.prepare(query);
            stmt.bind(params);
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            
            const headers = results.length > 0 ? Object.keys(results[0]) : [];
            return { headers, data: results };
        }
    } catch (e: any) {
        console.error("[DB] SQL Error:", e.message, "Query:", query);
        // Return the error in a format the API expects, not throw
        return { error: e.message };
    }
}

// --- Vector Store Logic ---

const dot = (a: number[], b: number[]) => a.reduce((sum, val, i) => sum + val * b[i], 0);
const magnitude = (v: number[]) => Math.sqrt(dot(v, v));
const cosineSimilarity = (a: number[], b: number[]) => {
    const magA = magnitude(a);
    const magB = magnitude(b);
    return (magA && magB) ? dot(a, b) / (magA * magB) : 0;
};
const createRandomVector = () => {
    const v = Array.from({ length: VECTOR_DIMENSION }, () => Math.random() * 2 - 1);
    const mag = magnitude(v);
    return v.map(val => val / mag);
};

export function rebuildVectorStore() {
    if (!db) return;
    console.log("[DB] Rebuilding vector store...");
    vectorStore = [];

    unstructuredData.forEach(doc => {
        vectorStore.push({ ...doc, vector: createRandomVector() });
    });

    for (const [tableName, meta] of Object.entries(schemaMetadata)) {
        if (meta.inVectorStore) {
            try {
                const res = db.exec(`SELECT * FROM ${tableName}`);
                if (res.length > 0 && res[0].values) {
                    const columns = res[0].columns;
                    res[0].values.forEach((row: any[]) => {
                        const rowObj: any = {};
                        columns.forEach((col: string, i: number) => rowObj[col] = row[i]);
                        
                        const content = Object.entries(rowObj)
                            .filter(([k, v]) => typeof v === 'string' && !k.toLowerCase().includes('id'))
                            .map(([k, v]) => `${k}: ${v}`).join('\n');
                        
                        const name = rowObj.name || rowObj.title || rowObj.item_description || `${tableName} Record`;
                        const id = `sql:${tableName}:${rowObj.id || rowObj.item_id || rowObj.question_id || Math.random()}`;
                        
                        vectorStore.push({
                            id,
                            name,
                            type: `SQL Record: ${tableName}`,
                            content,
                            vector: createRandomVector()
                        });
                    });
                }
            } catch (e) {
                console.error(`[DB] Vector Indexing Error for ${tableName}:`, e);
            }
        }
    }
    console.log(`[DB] VectorStore rebuilt with ${vectorStore.length} documents.`);
}

export function findSimilarDocuments(docId: string, count: number = 3): UnstructuredDocument[] {
    const target = vectorStore.find(d => d.id === docId);
    if (!target) return [];
    return vectorStore
        .filter(d => d.id !== docId)
        .map(d => ({ doc: d, score: cosineSimilarity(target.vector, d.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .map(r => r.doc);
}

export function findSimilarDocumentsByQuery(query: string, count: number = 5): UnstructuredDocument[] {
    const queryVector = createRandomVector();
    return vectorStore
        .map(d => ({ doc: d, score: cosineSimilarity(queryVector, d.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .map(r => r.doc);
}

// --- Getters ---

export function getTableSchemas() {
    if (!db) throw new Error("DB not initialized");
    try {
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        if (tables.length === 0) return {};
        
        const tableNames = tables[0].values.map((v: any[]) => v[0]);
        const result: Record<string, { columns: string, mcpSource: string | null }> = {};
        
        for (const name of tableNames) {
            const cols = db.exec(`PRAGMA table_info(${name})`);
            const source = db.exec("SELECT mcp_source FROM data_lake_table_sources WHERE table_name = ?", [name]);
            
            if (cols.length > 0) {
                const colStr = cols[0].values.map((c: any[]) => `${c[1]} (${c[2]})`).join(', ');
                const src = (source.length > 0 && source[0].values.length > 0) ? source[0].values[0][0] : null;
                result[name] = { columns: colStr, mcpSource: src };
            }
        }
        return result;
    } catch (e: any) {
        console.error("[DB] getTableSchemas error", e);
        return {};
    }
}

export function createTableFromMcp({ tableName, columns, mcpSource }: { tableName: string, columns: string, mcpSource: string }) {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error("Invalid table name.");
    db.run(`DROP TABLE IF EXISTS ${tableName}`);
    db.run(`CREATE TABLE ${tableName} (${columns});`);
    db.run("REPLACE INTO data_lake_table_sources (table_name, mcp_source) VALUES (?, ?)", [tableName, mcpSource]);
    
    const colDefs = columns.split(',').map(c => {
        const parts = c.trim().split(/\s+/);
        return { name: parts[0], type: (parts[1] || 'TEXT').toUpperCase() };
    });
    const placeholders = colDefs.map(() => '?').join(',');
    const insertQuery = `INSERT INTO ${tableName} VALUES (${placeholders})`;
    
    for (let i = 0; i < 5; i++) {
        const params = colDefs.map(c => {
            if (c.type.includes('INT')) return Math.floor(Math.random() * 100);
            if (c.type.includes('REAL')) return parseFloat((Math.random() * 1000).toFixed(2));
            return `${c.name}_${i}`;
        });
        db.run(insertQuery, params);
    }
    return { success: true, message: `Table ${tableName} created.` };
}

export function getDbStatistics() {
    if (!db) return { tableCounts: {}, dbSizeBytes: 0 };
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    const tableCounts: Record<string, number> = {};
    if (tables.length > 0) {
        tables[0].values.forEach((t: any[]) => {
            const name = t[0];
            const count = db.exec(`SELECT COUNT(*) FROM ${name}`);
            if (count.length > 0) tableCounts[name] = count[0].values[0][0];
        });
    }
    return { tableCounts, dbSizeBytes: db.export().byteLength };
}

export function exportDb(): Uint8Array {
    if (!db) throw new Error("DB not initialized");
    return db.export();
}

export function runMaintenance() {
    if (!db) throw new Error("DB not initialized");
    try {
        db.run("VACUUM;");
        saveDbToIndexedDB(db).catch(console.error);
        return { success: true, message: "VACUUM completed." };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export function getVectorStoreStats() {
    return { documentCount: vectorStore.length, vectorDimension: VECTOR_DIMENSION };
}

export function getDashboardStats() {
    try {
        if (!db) return { mcpCount: 0, workflowCounts: {}, dbStats: { tableCounts: {}, dbSizeBytes: 0}, vectorStats: { documentCount: 0, vectorDimension: 0 }};
        const mcp = db.exec("SELECT COUNT(*) FROM mcp_servers WHERE is_loaded=1");
        const wf = db.exec("SELECT status, COUNT(*) FROM workflows GROUP BY status");
        const wfCounts: Record<string, number> = {};
        if (wf.length > 0) {
            wf[0].values.forEach((row: any[]) => {
                wfCounts[row[0]] = row[1];
            });
        }
        
        return {
            dbStats: getDbStatistics(),
            vectorStats: getVectorStoreStats(),
            mcpCount: (mcp.length > 0) ? mcp[0].values[0][0] : 0,
            workflowCounts: wfCounts
        };
    } catch(e) {
        console.error(e);
        return { mcpCount: 0, workflowCounts: {}, dbStats: {}, vectorStats: {} };
    }
}

// Helpers for sync execution returning typed arrays
function getMany<T>(query: string, params: any[] = []): T[] {
    if (!db) return [];
    try {
        const stmt = db.prepare(query);
        stmt.bind(params);
        const res = [];
        while(stmt.step()) res.push(stmt.getAsObject());
        stmt.free();
        return res as T[];
    } catch (e) {
        console.error(e);
        return [];
    }
}

export function getMcpServers() { return getMany<McpServer>("SELECT *, is_loaded as isLoaded, is_installed as isInstalled FROM mcp_servers"); }
export function getLoadedMcpServers() { return getMany<McpServer>("SELECT * FROM mcp_servers WHERE is_loaded=1"); }
export function saveMcpServer(s: McpServer) { 
    db.run("REPLACE INTO mcp_servers (id, name, url, type, description, is_loaded, is_installed, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
    [s.id, s.name, s.url, s.type, s.description, s.isLoaded ? 1:0, s.isInstalled ? 1:0, s.category || null]); 
    saveDbToIndexedDB(db);
}

export function getWorkflows(): Workflow[] {
    const res = getMany<any>("SELECT * FROM workflows");
    return res.map(w => ({
        ...w,
        sources: w.sources ? String(w.sources).split('|||') : [],
        dependencies: w.dependencies ? String(w.dependencies).split('|||') : [],
        triggersOnSuccess: w.triggersOnSuccess ? String(w.triggersOnSuccess).split('|||') : [],
        nodes: w.nodes ? JSON.parse(w.nodes) : [],
        edges: w.edges ? JSON.parse(w.edges) : [],
    }));
}

export function saveWorkflow(w: Workflow, newVer: boolean) {
    let version = w.currentVersion || 1;
    if (newVer) {
        version++;
        db.run("INSERT INTO workflow_versions (workflow_id, version, createdAt, nodes, edges) VALUES (?,?,?,?,?)", 
            [w.id, version, new Date().toISOString(), JSON.stringify(w.nodes), JSON.stringify(w.edges)]);
    }
    db.run("REPLACE INTO workflows (id, name, lastExecuted, status, sources, transformer, destination, repartition, trigger, transformerCode, dependencies, triggersOnSuccess, nodes, edges, currentVersion) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [w.id, w.name, w.lastExecuted, w.status, (w.sources||[]).join('|||'), w.transformer, w.destination, w.repartition, w.trigger, w.transformerCode, (w.dependencies||[]).join('|||'), (w.triggersOnSuccess||[]).join('|||'), JSON.stringify(w.nodes), JSON.stringify(w.edges), version]
    );
    saveDbToIndexedDB(db);
}
export function deleteWorkflow(id: string) { db.run("DELETE FROM workflows WHERE id=?", [id]); saveDbToIndexedDB(db); }

export function getDashboards(): DashboardType[] {
    const dbs = getMany<any>("SELECT * FROM dashboards");
    const widgets = getMany<any>("SELECT * FROM dashboard_widgets");
    return dbs.map((d: any) => ({
        ...d,
        widgets: widgets.filter((w: any) => w.dashboard_id === d.id)
    }));
}
export function saveDashboard(d: DashboardType) {
    db.run("REPLACE INTO dashboards (id, name, description) VALUES (?,?,?)", [d.id, d.name, d.description]);
    db.run("DELETE FROM dashboard_widgets WHERE dashboard_id=?", [d.id]);
    d.widgets.forEach(w => {
        db.run("INSERT INTO dashboard_widgets (id, dashboard_id, title, type, colSpan, sqlQuery) VALUES (?,?,?,?,?,?)", 
            [w.id, d.id, w.title, w.type, w.colSpan, w.sqlQuery]);
    });
    saveDbToIndexedDB(db);
}
export function deleteDashboard(id: string) {
    db.run("DELETE FROM dashboards WHERE id=?", [id]);
    db.run("DELETE FROM dashboard_widgets WHERE dashboard_id=?", [id]);
    saveDbToIndexedDB(db);
}

export function getUsers() { return getMany<User>("SELECT * FROM dl_users ORDER BY name"); }
export function saveUser(u: User) { 
    const check = getMany("SELECT id FROM dl_users WHERE id=?", [u.id]);
    if (check.length > 0) {
        db.run("UPDATE dl_users SET name=?, email=?, role=? WHERE id=?", [u.name, u.email, u.role, u.id]);
    } else {
        db.run("INSERT INTO dl_users (id, name, email, role) VALUES (?,?,?,?)", [u.id, u.name, u.email, u.role]);
    }
    saveDbToIndexedDB(db);
}
export function deleteUser(id: number) { db.run("DELETE FROM dl_users WHERE id=?", [id]); saveDbToIndexedDB(db); }

export function logAuditEvent(p: any) { db.run("INSERT INTO audit_logs (timestamp, user, action, details) VALUES (?,?,?,?)", [new Date().toISOString(), p.user, p.action, p.details]); saveDbToIndexedDB(db); }
export function getAuditLogs() { return getMany<AuditLog>("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100"); }

export function getPiiFindings(): PiiFinding[] {
    return [
        { table: 'p21_customers', column: 'contact_email', piiType: 'EMAIL' },
        { table: 'p21_customers', column: 'contact_name', piiType: 'NAME' },
        { table: 'p21_customers', column: 'address', piiType: 'ADDRESS' }
    ];
}

export function getDataAccessPolicies() { 
    const res = getMany<any>("SELECT * FROM data_access_policies");
    return res.map((p: any) => ({
        ...p,
        columnPermissions: p.columnPermissions ? JSON.parse(p.columnPermissions) : {}
    }));
}
export function saveDataAccessPolicy(p: DataAccessPolicy) {
    db.run("REPLACE INTO data_access_policies (id, role, \"table\", accessLevel, columnPermissions, rowLevelSecurity) VALUES (?,?,?,?,?,?)",
        [p.id, p.role, p.table, p.accessLevel, JSON.stringify(p.columnPermissions || {}), p.rowLevelSecurity]
    );
    saveDbToIndexedDB(db);
}

export function getPredictionModels() { return getMany<PredictionModel>("SELECT * FROM prediction_models"); }

export async function createPrediction(data: any) {
    if (!db) throw new Error("Database not initialized");
    
    // Sanitize table name to ensure it is a valid SQL identifier.
    // Replace any character that is not a letter or number with an underscore.
    const safeName = data.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    if (!safeName) throw new Error("Model name must contain at least one alphanumeric character.");

    const resultTable = `prediction_${safeName}_${Date.now()}`;
    const id = `pred-${Date.now()}`;
    
    try {
        db.run("INSERT INTO prediction_models (id, name, sourceTable, targetColumn, dateColumn, status, createdAt, accuracy, resultTable) VALUES (?,?,?,?,?,?,?,?,?)",
            [id, data.name, data.sourceTable, data.targetColumn, data.dateColumn, 'Ready', new Date().toISOString(), 0.88, resultTable]
        );
        
        db.run(`CREATE TABLE ${resultTable} (prediction_date TEXT, predicted_value REAL, confidence_upper_bound REAL, confidence_lower_bound REAL, model_id TEXT)`);
        const today = new Date();
        for(let i=0; i<10; i++) {
            const d = new Date(today); d.setDate(today.getDate() + i);
            const val = 1000 + Math.random() * 500;
            db.run(`INSERT INTO ${resultTable} VALUES (?,?,?,?,?)`, [d.toISOString().split('T')[0], val, val*1.1, val*0.9, id]);
        }
        await saveDbToIndexedDB(db);
    } catch (e: any) {
        console.error("Create prediction failed:", e);
        throw new Error(`Failed to create prediction model: ${e.message}`);
    }
}

export function deletePredictionModel(id: string) {
    const m = getMany<any>("SELECT resultTable FROM prediction_models WHERE id=?", [id]);
    if (m.length > 0) db.run(`DROP TABLE IF EXISTS ${m[0].resultTable}`);
    db.run("DELETE FROM prediction_models WHERE id=?", [id]);
    saveDbToIndexedDB(db);
}

export function getWorkflowVersions(wid: string) { return getMany<WorkflowVersion>("SELECT * FROM workflow_versions WHERE workflow_id=? ORDER BY version DESC", [wid]); }
export function getExecutionLogs(wid: string) { return getMany<ExecutionLog>("SELECT * FROM execution_logs WHERE workflow_id=? ORDER BY id DESC", [wid]); }
