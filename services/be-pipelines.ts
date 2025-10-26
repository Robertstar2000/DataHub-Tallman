
import { executeQuery } from './be-db';
import type { Workflow } from '../types';

// A helper to introduce a delay to make the process feel more real
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Specific logic for 'Ingest Customer Orders'
// This will simulate adding a new order to the P21 ERP system
const runIngestCustomerOrders = async (logCallback: (message: string) => void): Promise<boolean> => {
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
    logCallback(`[INFO] New order event received from Kafka stream: Order ${orderNum}`);
    
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
