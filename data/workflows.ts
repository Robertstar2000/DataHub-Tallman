

import type { Workflow, WorkflowNode } from '../types';

// FIX: Explicitly type the array as WorkflowNode[] to ensure type compatibility
const defaultNodes: WorkflowNode[] = [
    { id: 'source', type: 'Source', position: { x: 50, y: 150 }, data: { tableName: 'p21_sales_orders' } },
    { id: 'transform', type: 'Transform', position: { x: 300, y: 150 }, data: { script: '/* custom transformation */' } },
    { id: 'sink', type: 'Sink', position: { x: 550, y: 150 }, data: { tableName: 'daily_sales_metrics' } },
];
const defaultEdges = [
    { id: 'e-source-transform', source: 'source', target: 'transform' },
    { id: 'e-transform-sink', source: 'transform', target: 'sink' },
];

// FIX: Removed Omit<> and added deprecated fields to match the full Workflow type, resolving errors in db-logic.
export const initialWorkflows: Workflow[] = [
  {
    id: 'wf-lead-to-order',
    name: 'Lead to Order Conversion',
    lastExecuted: '2023-10-26 11:45:10 AM',
    status: 'Live',
    sources: ['MCP: HubSpot CRM'],
    transformer: 'Qualify Lead',
    destination: 'p21_sales_orders',
    trigger: 'Webhook',
    nodes: [
        { id: 'n1', type: 'Source', position: { x: 50, y: 150 }, data: { mcp: 'HubSpot CRM' } },
        { id: 'n2', type: 'Transform', position: { x: 300, y: 150 }, data: { name: 'Qualify Lead' } },
        { id: 'n3', type: 'Sink', position: { x: 550, y: 150 }, data: { tableName: 'p21_sales_orders' } },
    ],
    edges: [
        { id: 'e1-2', source: 'n1', target: 'n2' },
        { id: 'e2-3', source: 'n2', target: 'n3' },
    ],
    currentVersion: 1,
  },
  {
    id: 'wf-picking-kitting',
    name: 'Warehouse Picking & Kitting',
    lastExecuted: '2023-10-26 12:05:00 PM',
    status: 'Live',
    sources: ['p21_sales_orders'],
    transformer: 'Default',
    destination: 'daily_sales_metrics',
    trigger: 'Hourly',
    nodes: defaultNodes,
    edges: defaultEdges,
    currentVersion: 1,
  },
  {
    id: 'wf-manufacturing',
    name: 'Manufacturing & Assembly',
    lastExecuted: '2023-10-26 09:30:00 AM',
    status: 'Live',
    sources: ['p21_sales_orders'],
    transformer: 'Default',
    destination: 'daily_sales_metrics',
    trigger: 'Daily',
    nodes: defaultNodes,
    edges: defaultEdges,
    currentVersion: 1,
  },
  {
    id: 'wf-repair-flow',
    name: 'Customer Repair Flow',
    lastExecuted: '2023-10-25 04:15:00 PM',
    status: 'Hold',
    sources: ['p21_sales_orders'],
    transformer: 'Default',
    destination: 'daily_sales_metrics',
    trigger: 'Manual',
    nodes: defaultNodes,
    edges: defaultEdges,
    currentVersion: 1,
  },
  {
    id: 'wf-ingest-p21-orders',
    name: 'RUNNABLE: Ingest P21 Sales Orders',
    lastExecuted: 'Never',
    status: 'Test',
    sources: ['Kafka Topic: new_orders'],
    destination: 'p21_sales_orders',
    transformer: 'Pass-through',
    trigger: 'On demand',
    nodes: [
        { id: 'source', type: 'Source', position: { x: 50, y: 150 }, data: { tableName: 'Kafka Topic: new_orders' } },
        { id: 'sink', type: 'Sink', position: { x: 300, y: 150 }, data: { tableName: 'p21_sales_orders' } },
    ],
    edges: [
        { id: 'e-source-sink', source: 'source', target: 'sink' },
    ],
    currentVersion: 1,
  },
   {
    id: 'wf-calculate-daily-metrics',
    name: 'RUNNABLE: Calculate Daily Sales Metrics',
    lastExecuted: 'Never',
    status: 'Test',
    sources: ['p21_sales_orders'],
    destination: 'daily_sales_metrics',
    transformer: 'Aggregate',
    trigger: 'On demand',
    nodes: [
        { id: 'source', type: 'Source', position: { x: 50, y: 150 }, data: { tableName: 'p21_sales_orders' } },
        { id: 'agg', type: 'Aggregate', position: { x: 300, y: 150 }, data: { logic: 'SUM(total) GROUP BY date' } },
        { id: 'sink', type: 'Sink', position: { x: 550, y: 150 }, data: { tableName: 'daily_sales_metrics' } },
    ],
    edges: [
        { id: 'e-source-agg', source: 'source', target: 'agg' },
        { id: 'e-agg-sink', source: 'agg', target: 'sink' },
    ],
    currentVersion: 1,
  },
];