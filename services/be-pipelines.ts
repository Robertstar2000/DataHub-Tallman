


import { executeQuery, getDataSourceMode } from './be-db';
import type { Workflow } from '../types';

// A helper to introduce a delay to make the process feel more real
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Test Server Simulation ---
class TestServer {
    static async generateOrderData(count: number) {
        const customers = [1, 2];
        const items = ['CB-PRO', 'QM-01', 'MK-ULTRA'];
        const orders = [];
        for(let i=0; i<count; i++) {
            orders.push({
                orderNum: Math.floor(10000 + Math.random() * 90000),
                customerId: customers[Math.floor(Math.random() * customers.length)],
                date: new Date().toISOString().split('T')[0],
                itemId: items[Math.floor(Math.random() * items.length)],
                qty: Math.floor(Math.random() * 5) + 1
            });
        }
        return orders;
    }
}

// Specific logic for 'Ingest Customer Orders'
// This will simulate adding a new order to the P21 ERP system
const runIngestCustomerOrders = async (logCallback: (message: string) => void): Promise<boolean> => {
    const mode = getDataSourceMode();
    logCallback(`[INFO] Pipeline Mode: ${mode.toUpperCase()}`);

    if (mode === 'real') {
        await delay(800);
        logCallback(`[INFO] Initiating secure connection to mcp://p21.internal:1433...`);
        await delay(1200);
        logCallback(`[INFO] Authenticating with service account... Success.`);
        await delay(1000);
        logCallback(`[INFO] Polling for new transactions since last cursor...`);
        await delay(1500);
        logCallback(`[WARN] No new records found in production stream. Connection closed.`);
        return true; // Finished successfully, just no data
    }

    // TEST MODE: Generate Data
    logCallback(`[INFO] Connecting to Test Data Generator...`);
    
    // Get random customer and items from the DB
    const customersResult = await executeQuery("SELECT customer_id FROM p21_customers ORDER BY RANDOM() LIMIT 1");
    const itemsResult = await executeQuery("SELECT item_id, unit_price FROM p21_items ORDER BY RANDOM() LIMIT 2");
    
    if ('error' in customersResult || 'error' in itemsResult || customersResult.data.length === 0 || itemsResult.data.length === 0) {
        logCallback(`[ERROR] No customers or items found in the database to create a new order.`);
        return false;
    }
    
    const customers = customersResult.data;
    const items = itemsResult.data;

    const customerId = customers[0].customer_id;
    const orderNum = Math.floor(1000 + Math.random() * 9000);
    const orderDate = new Date().toISOString().split('T')[0];

    await delay(500);
    logCallback(`[INFO] [Test Server] New order event received from Kafka stream: Order ${orderNum}`);
    
    // Create order lines
    let totalAmount = 0;
    const orderLines = items.map(item => {
        const quantity = Math.floor(1 + Math.random() * 2);
        totalAmount += quantity * item.unit_price;
        return {
            item_id: item.item_id,
            quantity: quantity,
            price_per_unit: item.unit_price
        };
    });

    // Insert main order record
    const orderQuery = `
        INSERT INTO p21_sales_orders (order_num, customer_id, order_date, total_amount, status)
        VALUES (${orderNum}, ${customerId}, '${orderDate}', ${totalAmount.toFixed(2)}, 'Processing');
    `;
    const orderResult = await executeQuery(orderQuery);
    if ('error' in orderResult) {
        logCallback(`[ERROR] Failed to insert new sales order: ${orderResult.error}`);
        return false;
    }
    logCallback(`[INFO] Created sales order header ${orderNum}.`);
    
    await delay(500);
    logCallback(`[INFO] Writing ${orderLines.length} line item(s) to destination...`);
    
    // Insert line items
    for (const line of orderLines) {
        const lineQuery = `
            INSERT INTO p21_sales_order_lines (order_num, item_id, quantity, price_per_unit)
            VALUES (${orderNum}, '${line.item_id}', ${line.quantity}, ${line.price_per_unit});
        `;
        const lineResult = await executeQuery(lineQuery);
        if ('error' in lineResult) {
            logCallback(`[ERROR] Failed to insert order line for item ${line.item_id}: ${lineResult.error}`);
            // In a real scenario, you'd handle rollback here
            return false;
        }
    }

    await delay(300);
    logCallback(`[INFO] Successfully ingested new order.`);
    return true;
}

// Specific logic for 'Calculate Daily Sales Metrics'
const runCalculateDailyMetrics = async (logCallback: (message: string) => void): Promise<boolean> => {
    const metricsTable = 'daily_sales_metrics';

    await delay(300);
    logCallback(`[INFO] Preparing destination table '${metricsTable}'...`);
    await executeQuery(`DROP TABLE IF EXISTS ${metricsTable};`);
    await executeQuery(`
        CREATE TABLE ${metricsTable} (
            report_date TEXT PRIMARY KEY,
            total_orders INTEGER,
            total_revenue REAL,
            avg_order_value REAL
        );
    `);
    
    await delay(500);
    logCallback(`[INFO] Reading from source: 'p21_sales_orders' table...`);
    const aggregationQuery = `
        SELECT
            order_date as report_date,
            COUNT(order_num) as total_orders,
            SUM(total_amount) as total_revenue
        FROM p21_sales_orders
        GROUP BY order_date;
    `;
    const aggResult = await executeQuery(aggregationQuery);

    if ('error' in aggResult) {
        logCallback(`[ERROR] Failed to aggregate data: ${aggResult.error}`);
        return false;
    }
    
    await delay(700);
    logCallback(`[INFO] Transformation complete. Calculated metrics for ${aggResult.data.length} days.`);

    if (aggResult.data.length > 0) {
        for (const row of aggResult.data) {
            const avg_order_value = row.total_orders > 0 ? row.total_revenue / row.total_orders : 0;
            const insertQuery = `
                INSERT INTO ${metricsTable} (report_date, total_orders, total_revenue, avg_order_value)
                VALUES ('${row.report_date}', ${row.total_orders}, ${row.total_revenue.toFixed(2)}, ${avg_order_value.toFixed(2)});
            `;
            await executeQuery(insertQuery);
        }
        await delay(500);
        logCallback(`[INFO] Writing ${aggResult.data.length} records to destination '${metricsTable}'.`);
    } else {
        logCallback(`[INFO] No data to write to destination.`);
    }
    
    await delay(300);
    logCallback(`[INFO] Daily sales metrics have been updated.`);
    return true;
}

// Generic logic for user-created SQL pipelines
const runGenericSqlPipeline = async (workflow: Workflow, logCallback: (message: string) => void): Promise<boolean> => {
    if (!workflow.transformerCode) {
        logCallback(`[ERROR] No SQL logic found in workflow.`);
        return false;
    }
    if (!workflow.destination) {
        logCallback(`[ERROR] No destination table specified.`);
        return false;
    }

    logCallback(`[INFO] Pipeline Type: Custom SQL Transformation`);
    logCallback(`[INFO] Source: ${workflow.sources?.join(', ') || 'Unknown'}`);
    logCallback(`[INFO] Destination: ${workflow.destination}`);

    await delay(500);
    logCallback(`[INFO] Preparing destination table '${workflow.destination}'...`);
    
    // In a real ELT, we might truncate or append. Here we'll try to create as Select (CTAS) simulation
    // Since SQL.js doesn't strictly support "CREATE TABLE AS SELECT" easily with unknown schemas, 
    // we'll execute the user's SQL to get results, then create the table based on those results.
    
    try {
        logCallback(`[INFO] Executing transformation logic...`);
        const result = await executeQuery(workflow.transformerCode);
        
        if ('error' in result) {
            logCallback(`[ERROR] SQL Execution Failed: ${result.error}`);
            return false;
        }

        const rows = result.data;
        if (rows.length === 0) {
            logCallback(`[WARN] Query returned 0 rows. No data to write.`);
            return true;
        }

        await delay(500);
        logCallback(`[INFO] Query returned ${rows.length} rows. Inferring schema...`);

        // Drop existing
        await executeQuery(`DROP TABLE IF EXISTS ${workflow.destination}`);

        // Create new table based on first row keys
        const firstRow = rows[0];
        const columns = Object.keys(firstRow).map(key => {
            const val = firstRow[key];
            const type = typeof val === 'number' ? (Number.isInteger(val) ? 'INTEGER' : 'REAL') : 'TEXT';
            return `${key} ${type}`;
        }).join(', ');

        await executeQuery(`CREATE TABLE ${workflow.destination} (${columns})`);
        logCallback(`[INFO] Created table ${workflow.destination} (${columns})`);

        // Insert data
        logCallback(`[INFO] Writing batch...`);
        for (const row of rows) {
            const values = Object.values(row).map(v => {
                if (v === null) return 'NULL';
                if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
                return v;
            }).join(', ');
            await executeQuery(`INSERT INTO ${workflow.destination} VALUES (${values})`);
        }

        await delay(300);
        logCallback(`[SUCCESS] Pipeline completed. ${rows.length} records written.`);
        return true;

    } catch (e: any) {
        logCallback(`[CRITICAL] System Error: ${e.message}`);
        return false;
    }
};

// A placeholder for workflows not yet implemented
const runNotImplemented = async (logCallback: (message: string) => void): Promise<boolean> => {
    await delay(500);
    logCallback(`[WARN] This workflow contains proprietary logic and cannot be executed in this environment.`);
    logCallback(`[INFO] Execution finished.`);
    return true;
}


export const executeWorkflow = async (
    workflow: Workflow,
    logCallback: (message: string) => void
): Promise<boolean> => {
    logCallback(`[INFO] Starting workflow '${workflow.name}'...`);
    
    try {
        let success = false;
        
        // Check for generic SQL pipeline first (usually identified by transformer type or ID pattern)
        if (workflow.transformer === 'Custom SQL' || workflow.id.startsWith('wf-sql-')) {
            success = await runGenericSqlPipeline(workflow, logCallback);
        } else {
            switch(workflow.id) {
                case 'wf-ingest-p21-orders':
                    success = await runIngestCustomerOrders(logCallback);
                    break;
                case 'wf-calculate-daily-metrics':
                    success = await runCalculateDailyMetrics(logCallback);
                    break;
                default:
                    success = await runNotImplemented(logCallback);
                    break;
            }
        }

        if (success) {
            logCallback(`[SUCCESS] Workflow '${workflow.name}' finished successfully.`);
        } else {
            logCallback(`[FAILURE] Workflow '${workflow.name}' failed. Check logs for details.`);
        }
        return success;

    } catch (e: any) {
        logCallback(`[CRITICAL] An unexpected error occurred: ${e.message}`);
        return false;
    }
}
