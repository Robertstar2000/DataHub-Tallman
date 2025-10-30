
// This file contains the core database logic, designed to be run either
// within a Web Worker or directly on the main thread as a fallback.

import type { Database } from 'sql.js';
import initSqlJs from 'sql.js';
import { unstructuredData } from '../data/unstructuredData';
import type { UnstructuredDocument } from '../data/unstructuredData';
import { initialCustomServers, initialMcpServers, indexedDocumentCollections, externalApiConnectors, marketplaceMcpServers } from '../data/mcpServers';
import { initialWorkflows } from '../data/workflows';
import { schemaMetadata } from '../data/schemaMetadata';
// FIX: Added WidgetConfig to the import list to resolve the type error.
import type { Workflow, McpServer, Dashboard as DashboardType, User, AuditLog, PiiFinding, DataAccessPolicy, PredictionModel, WorkflowVersion, ExecutionLog, WidgetConfig } from '../types';

let db: Database | null = null;
let SQL: any = null; // To hold the initialized sql.js object
let idbPersistenceEnabled = true;

// --- IndexedDB Helpers ---
const IDB_NAME = 'DataLakeDB';
const IDB_STORE_NAME = 'sqljs';
const IDB_KEY = 'database';

async function canUseIndexedDB(): Promise<boolean> {
    try {
        await new Promise<void>((resolve, reject) => {
            if (typeof indexedDB === 'undefined' || !indexedDB) {
                return reject(new Error('IndexedDB is not supported.'));
            }
            try {
                const request = indexedDB.open('__idb_test__');
                request.onsuccess = (event) => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    db.close();
                    indexedDB.deleteDatabase('__idb_test__');
                    resolve();
                };
                request.onerror = () => reject(request.error || new Error('Failed to open test DB.'));
                request.onblocked = () => reject(new Error('Test DB open was blocked.'));
            } catch (e) {
                reject(e);
            }
        });
        return true;
    } catch (e) {
        console.warn("IndexedDB availability test failed. Persistence will be disabled for this session.", e);
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

async function saveDbToIndexedDB(dbInstance: Database | null) {
    if (!dbInstance || !idbPersistenceEnabled) return;
    try {
        const dbHandle = await openIdb();
        const transaction = dbHandle.transaction(IDB_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(IDB_STORE_NAME);
        const dbBytes = dbInstance.export();
        store.put(dbBytes, IDB_KEY);
        return new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => {
                dbHandle.close();
                resolve();
            };
            transaction.onerror = (event) => {
                dbHandle.close();
                reject(`Error saving DB to IndexedDB: ${(event.target as IDBTransaction).error}`);
            };
        });
    } catch(e) {
        console.warn("Could not save database to IndexedDB. Disabling persistence for this session.", e);
        idbPersistenceEnabled = false;
    }
}

async function loadDbFromIndexedDB(): Promise<Uint8Array | null> {
    if (!idbPersistenceEnabled) return null;

    const dbHandle = await openIdb();
    const transaction = dbHandle.transaction(IDB_STORE_NAME, 'readonly');
    const store = transaction.objectStore(IDB_STORE_NAME);
    const request = store.get(IDB_KEY);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            dbHandle.close();
            resolve(request.result ? (request.result as Uint8Array) : null);
        };
        request.onerror = () => {
            dbHandle.close();
            reject("Error loading DB from IndexedDB");
        };
    });
}

// Vector Store
interface VectorDocument extends UnstructuredDocument {
  vector: number[];
}
let vectorStore: VectorDocument[] = [];
const VECTOR_DIMENSION = 64;

const dot = (a: number[], b: number[]): number => a.map((x, i) => a[i] * b[i]).reduce((m, n) => m + n);
const magnitude = (vec: number[]): number => Math.sqrt(dot(vec, vec));
const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    const magA = magnitude(vecA);
    const magB = magnitude(vecB);
    if (magA === 0 || magB === 0) return 0;
    return dot(vecA, vecB) / (magA * magB);
};

export function rebuildVectorStore() {
  if (!db) return;
  vectorStore = [];
  unstructuredData.forEach(doc => {
    let vector = Array.from({ length: VECTOR_DIMENSION }, () => Math.random() * 2 - 1);
    const mag = magnitude(vector);
    vector = vector.map(v => v / mag);
    vectorStore.push({ ...doc, vector });
  });

  Object.entries(schemaMetadata).forEach(([tableName, meta]) => {
    if (meta.inVectorStore) {
        try {
            const result = executeQuery(`SELECT * FROM ${tableName}`);
            if ('error' in result) {
                console.error(`Failed to get data from ${tableName} for vector store`, result.error);
                return;
            }
            const { data } = result;
            data.forEach((row: any) => {
                const content = Object.keys(row).filter(key => typeof row[key] === 'string' && key.toLowerCase() !== 'id').map(key => `${key}: ${row[key]}`).join('\n');
                const name = row.name || row.title || row.item_description || `${tableName} Row`;
                const id = `sql:${tableName}:${row.id || row.item_id || row.question_id || row.message_id || Math.random()}`;
                let vector = Array.from({ length: VECTOR_DIMENSION }, () => Math.random() * 2 - 1);
                const mag = magnitude(vector);
                vector = vector.map(v => v / mag);
                vectorStore.push({ id, name, content, type: `SQL Record: ${tableName}`, vector });
            });
        } catch (e) {
            console.error(`Failed to replicate data from ${tableName} to vector store`, e);
        }
    }
  });
};

function populateNewDatabase(db: Database) {
    const tablesToDrop = [
        'p21_customers', 'p21_items', 'p21_sales_orders', 'p21_sales_order_lines',
        'p21_inventory_locations', 'p21_item_inventory', 'p21_suppliers', 'p21_purchase_orders', 'p21_po_lines',
        'por_rental_assets', 'por_rental_contracts', 'por_contract_lines',
        'qc_tests', 'qc_rubber_goods_tests', 'qc_fiberglass_tests', 'qc_swivel_tests',
        'cascade_locations', 'cascade_inventory', 'mfg_work_orders', 'mfg_boms', 'p21_credit_applications',
        'wordpress_products', 'wordpress_product_categories', 'wordpress_product_category_map',
        'teams_users', 'teams_channels', 'teams_messages', 'gdrive_files',
        'stackoverflow_questions', 'stackoverflow_answers',
        'mcp_servers', 'workflows', 'dashboards', 'dashboard_widgets', 'dl_users',
        'data_lake_table_sources',
        'audit_logs', 'data_access_policies', 'prediction_models', 'workflow_versions', 'execution_logs'
    ];
    tablesToDrop.forEach(table => db.run(`DROP TABLE IF EXISTS ${table};`));

    // --- SCHEMA CREATION ---
    db.run(`CREATE TABLE data_lake_table_sources (table_name TEXT PRIMARY KEY, mcp_source TEXT NOT NULL);`);
    
    db.run(`CREATE TABLE p21_customers ( customer_id INTEGER PRIMARY KEY, company_name TEXT NOT NULL, contact_name TEXT, contact_email TEXT UNIQUE, address TEXT, credit_limit REAL DEFAULT 5000, on_credit_hold INTEGER DEFAULT 0, last_credit_check_date TEXT );`);
    db.run(`CREATE TABLE p21_credit_applications ( application_id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER, application_date TEXT, requested_limit REAL, status TEXT, decision_date TEXT, FOREIGN KEY (customer_id) REFERENCES p21_customers(customer_id) );`);
    db.run(`CREATE TABLE p21_items ( item_id TEXT PRIMARY KEY, item_description TEXT, item_type TEXT, unit_price REAL, quantity_on_hand INTEGER );`);
    db.run(`CREATE TABLE p21_suppliers ( supplier_id INTEGER PRIMARY KEY, supplier_name TEXT NOT NULL, contact_email TEXT );`);
    db.run(`CREATE TABLE p21_purchase_orders ( po_num INTEGER PRIMARY KEY, supplier_id INTEGER, order_date TEXT, total_amount REAL, FOREIGN KEY (supplier_id) REFERENCES p21_suppliers(supplier_id) );`);
    db.run(`CREATE TABLE p21_po_lines ( line_id INTEGER PRIMARY KEY AUTOINCREMENT, po_num INTEGER, item_id TEXT, quantity_ordered INTEGER, FOREIGN KEY (po_num) REFERENCES p21_purchase_orders(po_num), FOREIGN KEY (item_id) REFERENCES p21_items(item_id) );`);
    db.run(`CREATE TABLE p21_inventory_locations ( location_id TEXT PRIMARY KEY, location_name TEXT, is_primary INTEGER DEFAULT 0 );`);
    db.run(`CREATE TABLE p21_item_inventory ( item_id TEXT, location_id TEXT, quantity INTEGER, PRIMARY KEY (item_id, location_id), FOREIGN KEY (item_id) REFERENCES p21_items(item_id), FOREIGN KEY (location_id) REFERENCES p21_inventory_locations(location_id) );`);
    db.run(`CREATE TABLE p21_sales_orders ( order_num INTEGER PRIMARY KEY, customer_id INTEGER, order_date TEXT, total_amount REAL, status TEXT, FOREIGN KEY (customer_id) REFERENCES p21_customers(customer_id) );`);
    db.run(`CREATE TABLE p21_sales_order_lines ( line_id INTEGER PRIMARY KEY AUTOINCREMENT, order_num INTEGER, item_id TEXT, quantity INTEGER, price_per_unit REAL, FOREIGN KEY (order_num) REFERENCES p21_sales_orders(order_num), FOREIGN KEY (item_id) REFERENCES p21_items(item_id) );`);
    db.run(`CREATE TABLE por_rental_assets ( asset_id INTEGER PRIMARY KEY AUTOINCREMENT, asset_name TEXT NOT NULL, asset_category TEXT, daily_rate REAL, status TEXT );`);
    db.run(`CREATE TABLE por_rental_contracts ( contract_id INTEGER PRIMARY KEY, customer_id INTEGER, start_date TEXT, end_date TEXT, total_cost REAL, FOREIGN KEY (customer_id) REFERENCES p21_customers(customer_id) );`);
    db.run(`CREATE TABLE por_contract_lines ( line_id INTEGER PRIMARY KEY AUTOINCREMENT, contract_id INTEGER, asset_id INTEGER, FOREIGN KEY (contract_id) REFERENCES por_rental_contracts(contract_id), FOREIGN KEY (asset_id) REFERENCES por_rental_assets(asset_id) );`);
    db.run(`CREATE TABLE qc_rubber_goods_tests ( test_id INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT, serial_number_tested TEXT, test_date TEXT, result TEXT, voltage_kv INTEGER, leakage_ma REAL, technician_id INTEGER );`);
    db.run(`CREATE TABLE qc_fiberglass_tests ( test_id INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT, serial_number_tested TEXT, test_date TEXT, result TEXT, load_lbs INTEGER, deflection_in REAL, technician_id INTEGER );`);
    db.run(`CREATE TABLE qc_swivel_tests ( test_id INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT, serial_number_tested TEXT, test_date TEXT, result TEXT, rotation_torque_nm REAL, pressure_psi INTEGER, technician_id INTEGER );`);
    db.run(`CREATE TABLE cascade_locations ( location_id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER, location_name TEXT, address TEXT, FOREIGN KEY (customer_id) REFERENCES p21_customers(customer_id) );`);
    db.run(`CREATE TABLE cascade_inventory ( location_id INTEGER, item_id TEXT, quantity INTEGER, min_stock_level INTEGER, max_stock_level INTEGER, last_updated TEXT, PRIMARY KEY (location_id, item_id), FOREIGN KEY (location_id) REFERENCES cascade_locations(location_id), FOREIGN KEY (item_id) REFERENCES p21_items(item_id) );`);
    db.run(`CREATE TABLE mfg_boms ( bom_id INTEGER PRIMARY KEY AUTOINCREMENT, parent_item_id TEXT, component_item_id TEXT, quantity_per_parent INTEGER, FOREIGN KEY (parent_item_id) REFERENCES p21_items(item_id), FOREIGN KEY (component_item_id) REFERENCES p21_items(item_id) );`);
    db.run(`CREATE TABLE mfg_work_orders ( work_order_id INTEGER PRIMARY KEY, item_id_to_produce TEXT, quantity INTEGER, status TEXT, creation_date TEXT, due_date TEXT, type TEXT, FOREIGN KEY (item_id_to_produce) REFERENCES p21_items(item_id) );`);
    db.run(`CREATE TABLE wordpress_products ( product_id INTEGER PRIMARY KEY AUTOINCREMENT, product_name TEXT NOT NULL, description TEXT, price REAL, stock_quantity INTEGER, image_url TEXT );`);
    db.run(`CREATE TABLE wordpress_product_categories ( category_id INTEGER PRIMARY KEY AUTOINCREMENT, category_name TEXT UNIQUE );`);
    db.run(`CREATE TABLE wordpress_product_category_map ( product_id INTEGER, category_id INTEGER, PRIMARY KEY (product_id, category_id) );`);
    db.run(`CREATE TABLE teams_users ( user_id TEXT PRIMARY KEY, display_name TEXT, email TEXT UNIQUE );`);
    db.run(`CREATE TABLE teams_channels ( channel_id TEXT PRIMARY KEY, channel_name TEXT );`);
    db.run(`CREATE TABLE teams_messages ( message_id TEXT PRIMARY KEY, channel_id TEXT, user_id TEXT, sent_datetime TEXT, content TEXT );`);
    db.run(`CREATE TABLE gdrive_files ( file_id TEXT PRIMARY KEY, file_name TEXT, mime_type TEXT, owner_email TEXT, last_modified TEXT, file_size INTEGER );`);
    db.run(`CREATE TABLE stackoverflow_questions ( question_id INTEGER PRIMARY KEY, title TEXT, body TEXT, author_email TEXT, creation_date TEXT, tags TEXT );`);
    db.run(`CREATE TABLE stackoverflow_answers ( answer_id INTEGER PRIMARY KEY, question_id INTEGER, body TEXT, author_email TEXT, is_accepted INTEGER, creation_date TEXT );`);
    db.run(`CREATE TABLE mcp_servers ( id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT, type TEXT, description TEXT, is_loaded INTEGER DEFAULT 0, is_installed INTEGER DEFAULT 0, category TEXT );`);
    db.run(`CREATE TABLE workflows ( id TEXT PRIMARY KEY, name TEXT NOT NULL, lastExecuted TEXT, status TEXT, sources TEXT, transformer TEXT, destination TEXT, repartition INTEGER, trigger TEXT, transformerCode TEXT, dependencies TEXT, triggersOnSuccess TEXT, nodes TEXT, edges TEXT, currentVersion INTEGER );`);
    db.run(`CREATE TABLE dashboards ( id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT );`);
    db.run(`CREATE TABLE dashboard_widgets ( id TEXT PRIMARY KEY, dashboard_id TEXT, title TEXT, type TEXT, colSpan INTEGER, sqlQuery TEXT );`);
    db.run(`CREATE TABLE dl_users ( id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, role TEXT );`);
    db.run(`CREATE TABLE audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, user TEXT, action TEXT, details TEXT);`);
    db.run(`CREATE TABLE data_access_policies (id TEXT PRIMARY KEY, role TEXT, "table" TEXT, accessLevel TEXT, columnPermissions TEXT, rowLevelSecurity TEXT);`);
    db.run(`CREATE TABLE prediction_models (id TEXT PRIMARY KEY, name TEXT, sourceTable TEXT, targetColumn TEXT, status TEXT, createdAt TEXT, accuracy REAL, resultTable TEXT);`);
    db.run(`CREATE TABLE workflow_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT, version INTEGER, createdAt TEXT, nodes TEXT, edges TEXT);`);
    db.run(`CREATE TABLE execution_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT, version INTEGER, startedAt TEXT, finishedAt TEXT, status TEXT, logs TEXT, rowsProcessed INTEGER);`);

    // --- MOCK DATA INSERTION & SOURCE CATALOGING ---
    const p21Mcp = 'Epicore P21';
    db.run("INSERT INTO p21_customers VALUES (1, 'Innovate Corp', 'Alice Johnson', 'alice@innovate.com', '123 Tech Lane', 50000, 0, '2023-01-10'), (2, 'Builders LLC', 'Bob Smith', 'bob@builders.com', '456 Construct Ave', 10000, 1, '2022-11-20');");
    db.run("INSERT INTO data_lake_table_sources VALUES ('p21_customers', ?);", [p21Mcp]);
    db.run("INSERT INTO p21_credit_applications VALUES (1001, 1, '2023-01-09', 50000, 'Approved', '2023-01-10'), (1002, 2, '2023-02-15', 20000, 'Pending', NULL);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('p21_credit_applications', ?);", [p21Mcp]);
    db.run("INSERT INTO p21_items VALUES ('CB-PRO', 'CloudBook Pro Laptop', 'Purchased', 1200.00, 50), ('QM-01', 'Quantum Mouse', 'Purchased', 25.50, 200), ('MK-ULTRA', 'Mechanic Keyboard Ultra', 'Purchased', 75.00, 150), ('SW-ASSY-V2', 'Swivel Assembly V2', 'Manufactured', 250.00, 20), ('SW-JOINT-V2', 'Raw Swivel Joint V2', 'Purchased', 85.00, 100), ('RG-HOSE-A1', 'Rubber Goods Hose A1', 'Purchased', 15.00, 500), ('FG-CASING-S', 'Fiberglass Casing Small', 'Purchased', 45.00, 200), ('FG-LADDER-12', '12ft Fiberglass Ladder', 'Purchased', 180.00, 30);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('p21_items', ?);", [p21Mcp]);
    db.run("INSERT INTO p21_suppliers VALUES (101, 'Global Components Inc.', 'sales@globalcomp.com'), (102, 'Tech Parts Direct', 'contact@techparts.com');");
    db.run("INSERT INTO data_lake_table_sources VALUES ('p21_suppliers', ?);", [p21Mcp]);
    db.run("INSERT INTO p21_purchase_orders VALUES (2001, 101, '2023-02-10', 8500.00), (2002, 102, '2023-02-12', 1500.00);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('p21_purchase_orders', ?);", [p21Mcp]);
    db.run("INSERT INTO p21_po_lines VALUES (3001, 2001, 'SW-JOINT-V2', 100), (3002, 2002, 'MK-ULTRA', 20);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('p21_po_lines', ?);", [p21Mcp]);
    db.run("INSERT INTO p21_inventory_locations VALUES ('MAIN', 'Main Warehouse', 1), ('OVERSTOCK', 'Overstock Warehouse', 0);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('p21_inventory_locations', ?);", [p21Mcp]);
    db.run("INSERT INTO p21_item_inventory VALUES ('CB-PRO', 'MAIN', 50), ('QM-01', 'MAIN', 150), ('QM-01', 'OVERSTOCK', 50);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('p21_item_inventory', ?);", [p21Mcp]);
    db.run("INSERT INTO mfg_boms (parent_item_id, component_item_id, quantity_per_parent) VALUES ('SW-ASSY-V2', 'SW-JOINT-V2', 1), ('SW-ASSY-V2', 'RG-HOSE-A1', 2), ('SW-ASSY-V2', 'FG-CASING-S', 1);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('mfg_boms', ?);", [p21Mcp]);
    db.run("INSERT INTO mfg_work_orders VALUES (5001, 'SW-ASSY-V2', 25, 'In Progress', '2023-03-01', '2023-03-15', 'Manufacturing'), (5002, 'SW-ASSY-V2', 2, 'Pending', '2023-03-05', '2023-03-10', 'Repair');");
    db.run("INSERT INTO data_lake_table_sources VALUES ('mfg_work_orders', ?);", [p21Mcp]);
    db.run("INSERT INTO p21_sales_orders VALUES (101, 1, '2023-01-15', 2400.00, 'Shipped'), (102, 2, '2023-01-16', 75.00, 'Shipped'), (103, 1, '2023-02-05', 1225.50, 'Processing');");
    db.run("INSERT INTO data_lake_table_sources VALUES ('p21_sales_orders', ?);", [p21Mcp]);
    db.run("INSERT INTO p21_sales_order_lines (order_num, item_id, quantity, price_per_unit) VALUES (101, 'CB-PRO', 2, 1200.00), (102, 'MK-ULTRA', 1, 75.00), (103, 'CB-PRO', 1, 1200.00), (103, 'QM-01', 1, 25.50);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('p21_sales_order_lines', ?);", [p21Mcp]);
    
    const porMcp = 'Point of Rental (POR)';
    db.run("INSERT INTO por_rental_assets (asset_name, asset_category, daily_rate, status) VALUES ('Excavator EX-500', 'Heavy Equipment', 350.00, 'Available'), ('Scissor Lift SL-30', 'Aerial Lift', 150.00, 'Rented'), ('Concrete Mixer CM-10', 'Construction', 80.00, 'Available');");
    db.run("INSERT INTO data_lake_table_sources VALUES ('por_rental_assets', ?);", [porMcp]);
    db.run("INSERT INTO por_rental_contracts VALUES (2001, 2, '2023-02-10', '2023-02-17', 1050.00);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('por_rental_contracts', ?);", [porMcp]);
    db.run("INSERT INTO por_contract_lines (contract_id, asset_id) VALUES (2001, 2);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('por_contract_lines', ?);", [porMcp]);
    
    db.run("INSERT INTO qc_rubber_goods_tests (item_id, serial_number_tested, test_date, result, voltage_kv, leakage_ma, technician_id) VALUES ('RG-HOSE-A1', 'SN-RG-1023', '2023-03-02', 'Fail', 40, 5.1, 101), ('RG-HOSE-A1', 'SN-RG-1024', '2023-03-02', 'Pass', 40, 2.3, 101);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('qc_rubber_goods_tests', ?);", ['Rubbergoods Tests']);
    db.run("INSERT INTO qc_fiberglass_tests (item_id, serial_number_tested, test_date, result, load_lbs, deflection_in, technician_id) VALUES ('FG-LADDER-12', 'SN-FG-5501', '2023-03-03', 'Pass', 500, 0.75, 102);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('qc_fiberglass_tests', ?);", ['Fiberglass Tests']);
    db.run("INSERT INTO qc_swivel_tests (item_id, serial_number_tested, test_date, result, rotation_torque_nm, pressure_psi, technician_id) VALUES ('SW-JOINT-V2', 'SN-SW-8808', '2023-03-04', 'Pass', 120.5, 3000, 101);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('qc_swivel_tests', ?);", ['Swivel Tests']);
    db.run("INSERT INTO cascade_locations (customer_id, location_name, address) VALUES (2, 'Builders LLC - Site A', '789 Jobsite Rd');");
    db.run("INSERT INTO data_lake_table_sources VALUES ('cascade_locations', ?);", [p21Mcp]);
    db.run("INSERT INTO cascade_inventory VALUES (1, 'QM-01', 50, 20, 100, '2023-03-05 08:00:00');");
    db.run("INSERT INTO data_lake_table_sources VALUES ('cascade_inventory', ?);", [p21Mcp]);

    const wpMcp = 'WordPress Interface';
    db.run("INSERT INTO wordpress_products (product_id, product_name, description, price, stock_quantity, image_url) VALUES (1, 'CloudBook Pro', 'The ultimate laptop for professionals.', 1200.00, 50, '/images/laptop.jpg'), (2, 'Quantum Mouse', 'A sleek and responsive wireless mouse.', 25.50, 200, '/images/mouse.jpg');");
    db.run("INSERT INTO data_lake_table_sources VALUES ('wordpress_products', ?);", [wpMcp]);
    db.run("INSERT INTO wordpress_product_categories (category_name) VALUES ('Laptops'), ('Accessories');");
    db.run("INSERT INTO data_lake_table_sources VALUES ('wordpress_product_categories', ?);", [wpMcp]);
    db.run("INSERT INTO wordpress_product_category_map VALUES (1, 1), (2, 2);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('wordpress_product_category_map', ?);", [wpMcp]);

    const teamsMcp = 'Microsoft Graph (Teams)';
    db.run("INSERT INTO teams_users VALUES ('alice-id', 'Alice Johnson', 'alice@innovate.com'), ('bob-id', 'Bob Smith', 'bob@builders.com');");
    db.run("INSERT INTO data_lake_table_sources VALUES ('teams_users', ?);", [teamsMcp]);
    db.run("INSERT INTO teams_channels VALUES ('proj-phoenix', 'Project Phoenix');");
    db.run("INSERT INTO data_lake_table_sources VALUES ('teams_channels', ?);", [teamsMcp]);
    db.run("INSERT INTO teams_messages (message_id, channel_id, user_id, sent_datetime, content) VALUES ('msg1', 'proj-phoenix', 'alice-id', '2023-03-05 10:00:00', 'The latest design mockups are in the GDrive folder.');");
    db.run("INSERT INTO data_lake_table_sources VALUES ('teams_messages', ?);", [teamsMcp]);
    
    const gdriveMcp = 'Google Drive / Workspace';
    db.run("INSERT INTO gdrive_files VALUES ('file-abc-123', 'Project Phoenix Mockups.fig', 'application/figma', 'alice@innovate.com', '2023-03-05 09:58:00', 5024000);");
    db.run("INSERT INTO data_lake_table_sources VALUES ('gdrive_files', ?);", [gdriveMcp]);

    const soMcp = 'Stack Overflow for Teams';
    db.run("INSERT INTO stackoverflow_questions (question_id, title, author_email, creation_date, tags) VALUES (1, 'How to connect to the P21 MCP?', 'bob@builders.com', '2023-02-20 14:30:00', 'p21,mcp,api');");
    db.run("INSERT INTO data_lake_table_sources VALUES ('stackoverflow_questions', ?);", [soMcp]);
    db.run("INSERT INTO stackoverflow_answers (question_id, body, author_email, is_accepted, creation_date) VALUES (1, 'You need to use the service account credentials stored in the vault. See the documentation link here...', 'alice@innovate.com', 1, '2023-02-20 15:00:00');");
    db.run("INSERT INTO data_lake_table_sources VALUES ('stackoverflow_answers', ?);", [soMcp]);
    
    const libraryServers: McpServer[] = initialMcpServers.map((s, i) => ({ ...s, id: `lib-server-${i}`, type: 'Official' } as McpServer));
    const docCollections: McpServer[] = indexedDocumentCollections.map((s, i) => ({ ...s, id: `doc-coll-${i}`, type: 'DocumentCollection'}) as McpServer);
    const apiConnectors: McpServer[] = externalApiConnectors.map((s, i) => ({ ...s, id: `api-conn-${i}`, type: 'ExternalAPI'}) as McpServer);
    const marketServers: McpServer[] = marketplaceMcpServers.map((s, i) => ({ ...s, id: `market-server-${i}`}) as McpServer);


    [...libraryServers, ...initialCustomServers, ...docCollections, ...apiConnectors, ...marketServers].forEach(s => {
      db.run('INSERT INTO mcp_servers (id, name, url, type, description, is_loaded, is_installed, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [s.id, s.name, s.url, s.type, s.description, s.isLoaded ? 1 : 0, s.isInstalled ? 1 : 0, s.category || null]);
    });
    initialWorkflows.forEach(w => {
      db.run('INSERT INTO workflows (id, name, lastExecuted, status, sources, transformer, destination, repartition, trigger, transformerCode, dependencies, triggersOnSuccess, nodes, edges, currentVersion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [
        w.id, 
        w.name, 
        w.lastExecuted, 
        w.status, 
        (w.sources || []).join('|||'), 
        w.transformer || null, 
        w.destination || null,
// FIX: Provide a default null value for optional fields to prevent 'undefined' binding error.
        w.repartition || null,
        w.trigger || null, 
        w.transformerCode || null, 
        (w.dependencies || []).join('|||'), 
        (w.triggersOnSuccess || []).join('|||'), 
        JSON.stringify(w.nodes), 
        JSON.stringify(w.edges), 
        w.currentVersion
      ]);
    });
    const initialUsers: User[] = [ { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin' }, { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'Analyst' }, { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'Viewer' }, { id: 4, name: 'Diana Prince', email: 'diana@example.com', role: 'Analyst' }, { id: 5, name: 'Eve Adams', email: 'eve@example.com', role: 'Viewer' }, { id: 6, name: 'Frank Miller', email: 'frank@example.com', role: 'Viewer' }, ];
    initialUsers.forEach(u => { db.run('INSERT INTO dl_users (id, name, email, role) VALUES (?, ?, ?, ?)', [u.id, u.name, u.email, u.role]); });
    db.run("INSERT INTO dashboards VALUES ('sales-overview-1', 'Sales Overview', 'A high-level look at sales performance and key metrics.')");
    const initialWidgets: WidgetConfig[] = [ { id: 'w1', title: 'Total Revenue', type: 'Metric', colSpan: 1, sqlQuery: 'SELECT SUM(total_amount) as value FROM p21_sales_orders' }, { id: 'w2', title: 'Total Orders', type: 'Metric', colSpan: 1, sqlQuery: 'SELECT COUNT(*) as value FROM p21_sales_orders' }, { id: 'w3', title: 'Unique Customers', type: 'Metric', colSpan: 1, sqlQuery: 'SELECT COUNT(DISTINCT customer_id) as value FROM p21_customers' }, { id: 'w4', title: 'Avg. Order Value', type: 'Metric', colSpan: 1, sqlQuery: 'SELECT AVG(total_amount) as value FROM p21_sales_orders' }, { id: 'w5', title: 'Revenue by Product (Top 5)', type: 'Bar', colSpan: 4, sqlQuery: "SELECT i.item_description as name, SUM(ol.quantity * ol.price_per_unit) as value FROM p21_sales_order_lines ol JOIN p21_items i ON ol.item_id = i.item_id GROUP BY i.item_description ORDER BY value DESC LIMIT 5" }, { id: 'w6', title: 'Orders Over Time', type: 'Line', colSpan: 2, sqlQuery: 'SELECT order_date as name, COUNT(order_num) as value FROM p21_sales_orders GROUP BY order_date ORDER BY order_date' }, { id: 'w7', title: 'Top Product Revenue (Pie)', type: 'Pie', colSpan: 2, sqlQuery: "SELECT i.item_description as name, SUM(ol.quantity * ol.price_per_unit) as value FROM p21_sales_order_lines ol JOIN p21_items i ON ol.item_id = i.item_id GROUP BY i.item_description ORDER BY value DESC LIMIT 5" }, ];
    initialWidgets.forEach(w => { db.run("INSERT INTO dashboard_widgets VALUES (?, ?, ?, ?, ?, ?)", [w.id, 'sales-overview-1', w.title, w.type, w.colSpan, w.sqlQuery]); });
}

export async function initializeDatabase(dbBytes?: Uint8Array): Promise<string> {
  // Initialize SQL.js library itself. This only needs to be done once.
  if (!SQL) {
    try {
      // Initialize sql.js by providing a custom function to locate the wasm file.
      // This is the official, most robust way to load sql.js in a browser environment,
      // especially within a web worker, as it avoids issues with relative path resolution.
      SQL = await initSqlJs({
        locateFile: file => `https://unpkg.com/sql.js@1.10.3/dist/${file}`
      });
    } catch (err) {
      console.error('Failed to initialize sql.js:', err);
      // Re-throw the error to be handled by the UI, preventing the app from
      // getting into a broken state.
      throw err;
    }
  }
  
  idbPersistenceEnabled = await canUseIndexedDB();

  if (dbBytes) {
    db = new SQL.Database(dbBytes);
  } else if (idbPersistenceEnabled) {
      try {
        const savedDbBytes = await loadDbFromIndexedDB();
        if (savedDbBytes) {
            db = new SQL.Database(savedDbBytes);
        } else {
            db = new SQL.Database();
            populateNewDatabase(db);
        }
      } catch (e) {
         console.warn("Failed to load from IndexedDB despite successful check. Creating temporary in-memory database.", e);
         idbPersistenceEnabled = false;
         db = new SQL.Database();
         populateNewDatabase(db);
      }
  } else {
    console.log("IndexedDB not available. Creating temporary in-memory database.");
    db = new SQL.Database();
    populateNewDatabase(db);
  }
  
  await saveDbToIndexedDB(db);
  rebuildVectorStore();
  return 'Database initialized successfully.';
};

function isModifyingQuery(query: string): boolean {
    const keywords = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'VACUUM', 'REPLACE'];
    const queryUpper = query.trim().toUpperCase();
    return keywords.some(keyword => queryUpper.startsWith(keyword));
};

export function executeQuery(query: string, params: (string|number|null)[] = []) {
    if (!db) throw new Error("Database not initialized");
    try {
        if (isModifyingQuery(query)) {
            db.run(query, params);
            saveDbToIndexedDB(db).catch(err => console.error("Async DB save failed:", err));
            return { headers: [], data: [] };
        }

        const stmt = db.prepare(query);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();

        if (results.length === 0) {
            return { headers: [], data: [] };
        }
        
        const headers = Object.keys(results[0]);
        return { headers, data: results };

    } catch (e: any) {
        return { error: e.message };
    }
};

export function getTableSchemas(): Record<string, { columns: string, mcpSource: string | null }> {
    if (!db) throw new Error("Database not initialized");
    const tablesResult = executeQuery("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    if ('error' in tablesResult) throw new Error(tablesResult.error);
    const tables = tablesResult.data;

    const schemas: Record<string, { columns: string, mcpSource: string | null }> = {};
    if (tables) {
        tables.forEach(row => {
            const tableName = row.name as string;
            const tableInfoResult = executeQuery(`PRAGMA table_info(${tableName})`);
            if ('error' in tableInfoResult) return;
            const tableInfo = tableInfoResult.data;

            const sourceInfoResult = executeQuery("SELECT mcp_source FROM data_lake_table_sources WHERE table_name = ?", [tableName]);
            if ('error' in sourceInfoResult) return;
            const sourceInfo = sourceInfoResult.data;

            if (tableInfo) {
                const columnNames = tableInfo.map((col: any) => `${col.name} (${col.type})`);
                schemas[tableName] = {
                    columns: columnNames.join(', '),
                    mcpSource: sourceInfo.length > 0 ? sourceInfo[0].mcp_source as string : null
                };
            }
        });
    }
    return schemas;
}

export function createTableFromMcp({ tableName, columns, mcpSource }: { tableName: string, columns: string, mcpSource: string }) {
    if (!db) throw new Error("Database not initialized");
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error("Invalid table name. Only alphanumeric characters and underscores are allowed.");
    }

    try {
        const createStatement = `CREATE TABLE ${tableName} (${columns});`;
        executeQuery(createStatement);

        executeQuery("INSERT INTO data_lake_table_sources (table_name, mcp_source) VALUES (?, ?)", [tableName, mcpSource]);
        
        // Add some dummy data
        const columnDefs = columns.split(',').map(c => {
            const parts = c.trim().split(/\s+/);
            return { name: parts[0], type: (parts[1] || 'TEXT').toUpperCase() };
        });

        const placeholders = columnDefs.map(() => '?').join(',');
        const insertStmt = `INSERT INTO ${tableName} VALUES (${placeholders});`;

        for (let i = 0; i < 5; i++) {
            const rowData = columnDefs.map(col => {
                if (col.type.includes('INTEGER')) return Math.floor(Math.random() * 1000);
                if (col.type.includes('REAL')) return (Math.random() * 1000).toFixed(2);
                if (col.type.includes('TEXT')) return `${col.name}_${i + 1}`;
                return null;
            });
            executeQuery(insertStmt, rowData);
        }
        
        return { success: true, message: `Table '${tableName}' created and populated with 5 mock records.` };
    } catch (e: any) {
        console.error("Error creating table:", e);
        // Attempt to clean up if something went wrong
        executeQuery(`DROP TABLE IF EXISTS ${tableName}`);
        executeQuery("DELETE FROM data_lake_table_sources WHERE table_name = ?", [tableName]);
        throw e;
    }
}

export function findSimilarDocuments(docId: string, count: number = 3): UnstructuredDocument[] {
    const sourceDoc = vectorStore.find(d => d.id === docId);
    if (!sourceDoc) return [];

    return vectorStore
        .filter(d => d.id !== docId)
        .map(otherDoc => ({ doc: otherDoc, similarity: cosineSimilarity(sourceDoc.vector, otherDoc.vector) }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, count)
        .map(item => item.doc);
};

export function findSimilarDocumentsByQuery(query: string, count: number = 5): UnstructuredDocument[] {
    // Simulate creating a vector for the query
    let queryVector = Array.from({ length: VECTOR_DIMENSION }, () => Math.random() * 2 - 1);
    const mag = magnitude(queryVector);
    queryVector = queryVector.map(v => v / mag);

    return vectorStore
        .map(doc => ({ doc, similarity: cosineSimilarity(queryVector, doc.vector) }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, count)
        .map(item => item.doc);
}

export function getDbStatistics() {
  if (!db) throw new Error("Database not initialized");
  const tableCounts: Record<string, number> = {};
  const tablesResult = executeQuery("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  if ('error' in tablesResult) throw new Error(tablesResult.error);
  const tables = tablesResult.data;
  if(tables) {
      tables.forEach((row: any) => {
          const tableName = row.name as string;
          const countResult = executeQuery(`SELECT COUNT(*) as count FROM ${tableName}`);
          if ('error' in countResult) return;
          tableCounts[tableName] = countResult.data[0].count as number;
      })
  }
  const dbSizeBytes = db.export().byteLength;
  return { tableCounts, dbSizeBytes };
};

export function exportDb(): Uint8Array {
  if (!db) throw new Error("Database not initialized");
  return db.export();
};

export function runMaintenance(): { success: boolean, message: string } {
  if (!db) throw new Error("Database not initialized");
  try {
    db.run('VACUUM;');
    saveDbToIndexedDB(db).catch(err => console.error("Async DB save failed:", err));
    return { success: true, message: 'Database maintenance (VACUUM) completed successfully.' };
  } catch (e: any) {
    console.error("Failed to run maintenance", e);
    return { success: false, message: e.message };
  }
};

export function getVectorStoreStats() {
  return { documentCount: vectorStore.length, vectorDimension: VECTOR_DIMENSION };
};

export function getDashboardStats() {
    const mcpResult = executeQuery("SELECT COUNT(*) as count FROM mcp_servers WHERE is_loaded = 1");
    const workflowResult = executeQuery("SELECT status, COUNT(*) as count FROM workflows GROUP BY status");
    if ('error' in mcpResult || 'error' in workflowResult) return {};
    const workflowCounts = workflowResult.data.reduce((acc, row) => { acc[row.status as string] = row.count; return acc; }, {} as Record<string, number>);
    return { dbStats: getDbStatistics(), vectorStats: getVectorStoreStats(), mcpCount: mcpResult.data[0]?.count || 0, workflowCounts };
}

export function getMcpServers(): McpServer[] { return executeQuery("SELECT *, is_loaded as isLoaded, is_installed as isInstalled FROM mcp_servers").data as McpServer[]; }
export function getWorkflows(): Workflow[] {
    const rawWorkflows = executeQuery("SELECT * FROM workflows").data as any[];
    return rawWorkflows.map(w => ({ 
        ...w, 
        sources: w.sources ? String(w.sources).split('|||') : [],
        dependencies: w.dependencies ? String(w.dependencies).split('|||') : [],
        triggersOnSuccess: w.triggersOnSuccess ? String(w.triggersOnSuccess).split('|||') : [],
        nodes: JSON.parse(w.nodes || '[]'),
        edges: JSON.parse(w.edges || '[]'),
    }));
};
export function getLoadedMcpServers(): McpServer[] { return executeQuery("SELECT * FROM mcp_servers WHERE is_loaded = 1").data as McpServer[]; }
export function saveMcpServer(server: McpServer) { executeQuery("REPLACE INTO mcp_servers (id, name, url, type, description, is_loaded, is_installed, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [server.id, server.name, server.url, server.type, server.description, server.isLoaded ? 1 : 0, server.isInstalled ? 1 : 0, server.category || null]); };
export function saveWorkflow(workflow: Workflow, asNewVersion: boolean) { 
    let versionToSave = workflow.currentVersion || 1;
    if (asNewVersion) {
        versionToSave++;
        executeQuery("INSERT INTO workflow_versions (workflow_id, version, createdAt, nodes, edges) VALUES (?, ?, ?, ?, ?)", [workflow.id, versionToSave, new Date().toISOString(), JSON.stringify(workflow.nodes), JSON.stringify(workflow.edges)]);
    }

    executeQuery("REPLACE INTO workflows (id, name, lastExecuted, status, sources, transformer, destination, repartition, trigger, transformerCode, dependencies, triggersOnSuccess, nodes, edges, currentVersion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
        workflow.id, 
        workflow.name, 
        workflow.lastExecuted, 
        workflow.status, 
        (workflow.sources || []).join('|||'), 
        workflow.transformer, 
        workflow.destination, 
        workflow.repartition, 
        workflow.trigger, 
        workflow.transformerCode || null,
        (workflow.dependencies || []).join('|||'),
        (workflow.triggersOnSuccess || []).join('|||'),
        JSON.stringify(workflow.nodes),
        JSON.stringify(workflow.edges),
        versionToSave
    ]); 
};
export function deleteWorkflow(id: string) { executeQuery("DELETE FROM workflows WHERE id = ?", [id]); }
export function getDashboards(): DashboardType[] {
    const dashboardsResult = executeQuery("SELECT * FROM dashboards").data as any[];
    const widgetsResult = executeQuery("SELECT * FROM dashboard_widgets").data as any[];
    return dashboardsResult.map(d => ({ ...d, widgets: widgetsResult.filter(w => w.dashboard_id === d.id) }));
};
export function saveDashboard(dashboard: DashboardType) {
    executeQuery("REPLACE INTO dashboards (id, name, description) VALUES (?, ?, ?)", [dashboard.id, dashboard.name, dashboard.description]);
    executeQuery("DELETE FROM dashboard_widgets WHERE dashboard_id = ?", [dashboard.id]);
    dashboard.widgets.forEach(w => { executeQuery("INSERT INTO dashboard_widgets (id, dashboard_id, title, type, colSpan, sqlQuery) VALUES (?, ?, ?, ?, ?, ?)", [w.id, dashboard.id, w.title, w.type, w.colSpan, w.sqlQuery]); });
};
export function deleteDashboard(id: string) {
    executeQuery("DELETE FROM dashboards WHERE id = ?", [id]);
    executeQuery("DELETE FROM dashboard_widgets WHERE dashboard_id = ?", [id]);
};
export function getUsers(): User[] { return executeQuery("SELECT * FROM dl_users ORDER BY name").data as User[]; }
export function saveUser(user: User) {
    const upsertQuery = `INSERT INTO dl_users (id, name, email, role) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email, role = excluded.role;`;
    const result = executeQuery(upsertQuery, [user.id, user.name, user.email, user.role]);
    if (result.error) throw new Error(`DB Error: ${result.error}`);
};
export function deleteUser(userId: number) {
    const result = executeQuery("DELETE FROM dl_users WHERE id = ?", [userId]);
    if (result.error) throw new Error(`DB Error: ${result.error}`);
};

// --- NEWLY IMPLEMENTED ---
export function logAuditEvent({ user, action, details }: { user: string, action: string, details: string }) {
    executeQuery("INSERT INTO audit_logs (timestamp, user, action, details) VALUES (?, ?, ?, ?)", [new Date().toISOString(), user, action, details]);
}
export function getAuditLogs(): AuditLog[] { return executeQuery("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100").data as AuditLog[]; }
export function getPiiFindings(): PiiFinding[] {
    // This is a mock scan.
    return [
        { table: 'p21_customers', column: 'contact_email', piiType: 'EMAIL' },
        { table: 'p21_customers', column: 'contact_name', piiType: 'NAME' },
        { table: 'p21_customers', column: 'address', piiType: 'ADDRESS' },
    ];
}
export function getDataAccessPolicies(): DataAccessPolicy[] {
    const policies = executeQuery("SELECT id, role, \"table\", accessLevel, columnPermissions, rowLevelSecurity FROM data_access_policies").data as any[];
    return policies.map(p => ({ ...p, columnPermissions: p.columnPermissions ? JSON.parse(p.columnPermissions) : {} }));
}
export function saveDataAccessPolicy(policy: DataAccessPolicy) {
    executeQuery("REPLACE INTO data_access_policies (id, role, \"table\", accessLevel, columnPermissions, rowLevelSecurity) VALUES (?, ?, ?, ?, ?, ?)", [policy.id, policy.role, policy.table, policy.accessLevel, JSON.stringify(policy.columnPermissions || {}), policy.rowLevelSecurity]);
}
export function getPredictionModels(): PredictionModel[] { return executeQuery("SELECT * FROM prediction_models").data as PredictionModel[]; }
export function createPrediction(modelData: Omit<PredictionModel, 'id' | 'status' | 'createdAt'>) {
    const newModel: PredictionModel = {
        ...modelData,
        id: `pred-${Date.now()}`,
        status: 'Ready',
        createdAt: new Date().toISOString(),
        accuracy: Math.random() * (0.95 - 0.75) + 0.75, // Random accuracy between 75% and 95%
        resultTable: `prediction_${modelData.name.replace(/\s+/g, '_').toLowerCase()}`
    };
    executeQuery("INSERT INTO prediction_models (id, name, sourceTable, targetColumn, status, createdAt, accuracy, resultTable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [newModel.id, newModel.name, newModel.sourceTable, newModel.targetColumn, newModel.status, newModel.createdAt, newModel.accuracy, newModel.resultTable]);
}
export function deletePredictionModel(modelId: string) { executeQuery("DELETE FROM prediction_models WHERE id = ?", [modelId]); }
export function getWorkflowVersions(workflowId: string): WorkflowVersion[] { return executeQuery("SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY version DESC", [workflowId]).data as WorkflowVersion[]; }
export function getExecutionLogs(workflowId: string): ExecutionLog[] { return executeQuery("SELECT * FROM execution_logs WHERE workflow_id = ? ORDER BY id DESC", [workflowId]).data as ExecutionLog[]; }
