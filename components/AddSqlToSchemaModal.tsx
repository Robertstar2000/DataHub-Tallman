


import React, { useState, useEffect, useRef } from 'react';
import Card from './Card';
import Button from './common/Button';
import { executeQuery, getLoadedMcpServers, saveWorkflow } from '../services/api';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { McpServer, Workflow } from '../types';
import { otherInterfaces } from '../data/mcpServers';

interface AddSqlToSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSql?: string;
}

// Best-effort SQL templates for known data sources
const SQL_TEMPLATES: Record<string, string> = {
  'Epicore P21': `SELECT order_num, customer_id, order_date, total_amount \nFROM p21_sales_orders \nWHERE status = 'Shipped' \nAND order_date >= DATE('now', '-30 days');`,
  'Point of Rental': `SELECT asset_id, asset_name, status, daily_rate \nFROM por_rental_assets \nWHERE status = 'Available' \nORDER BY daily_rate DESC;`,
  'Rubbergoods Tests': `SELECT item_id, test_date, result, leakage_ma \nFROM qc_rubber_goods_tests \nWHERE result = 'Fail' \nAND leakage_ma > 5.0;`,
  'Fiberglass Tests': `SELECT serial_number_tested, test_date, load_lbs \nFROM qc_fiberglass_tests \nWHERE deflection_in > 0.5;`,
  'Swivel Tests': `SELECT * \nFROM qc_swivel_tests \nWHERE rotation_torque_nm > 100;`,
  'WordPress': `SELECT product_id, product_name, stock_quantity \nFROM wordpress_products \nWHERE stock_quantity < 10;`,
  'Microsoft Graph': `SELECT user_id, sent_datetime, content \nFROM teams_messages \nWHERE content LIKE '%urgent%' \nORDER BY sent_datetime DESC;`,
  'Google Drive': `SELECT file_name, owner_email, file_size \nFROM gdrive_files \nWHERE mime_type = 'application/pdf' \nAND file_size > 1000000;`,
  'Stack Overflow': `SELECT title, author_email, creation_date \nFROM stackoverflow_questions \nWHERE tags LIKE '%p21%' \nORDER BY creation_date DESC;`,
  'HubSpot': `-- Mock for HubSpot: Syncing recent customers\nSELECT customer_id, company_name, contact_email \nFROM p21_customers \nWHERE last_credit_check_date IS NULL;`, 
  'Default': `SELECT * \nFROM [source_table] \nLIMIT 100;`
};

const AddSqlToSchemaModal: React.FC<AddSqlToSchemaModalProps> = ({ isOpen, onClose, initialSql = '' }) => {
  const [source, setSource] = useState('');
  const [frequency, setFrequency] = useState('Daily');
  const [targetSchema, setTargetSchema] = useState('');
  const [sql, setSql] = useState(initialSql);
  const [isValidated, setIsValidated] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (isOpen) {
      // If initialSql is provided (e.g. from Data Explorer), use it and don't overwrite
      setSql(initialSql);
      setTestStatus('idle');
      setTestMessage('');
      setIsValidated(false);
      setTargetSchema('');
      
      // Load sources
      getLoadedMcpServers().then(servers => {
        const mcpNames = servers.map(s => `MCP: ${s.name}`);
        const otherNames = otherInterfaces.map(i => `${i.type}: ${i.name}`);
        const allSources = [...mcpNames, ...otherNames];
        
        setAvailableSources(allSources);
        if (allSources.length > 0 && !source) {
            setSource(allSources[0]);
        }
      });
    }
  }, [isOpen, initialSql]);

  // Logic to update SQL template when Source changes, ONLY if SQL is empty or matches another template (clean state)
  useEffect(() => {
      if (!source || initialSql) return;

      // Extract the core name (e.g., "Epicore P21" from "MCP: Epicore P21")
      const sourceName = source.includes(':') ? source.split(':')[1].trim() : source;
      
      // Find a matching template key
      const templateKey = Object.keys(SQL_TEMPLATES).find(key => sourceName.includes(key));
      const template = templateKey ? SQL_TEMPLATES[templateKey] : SQL_TEMPLATES['Default'];

      setSql(template);
      setIsValidated(false); // Reset validation if source/sql changes
      setTestStatus('idle');
  }, [source, initialSql]);

  const handleTest = async () => {
    if (!sql.trim()) {
      setTestStatus('error');
      setTestMessage('SQL cannot be empty.');
      return;
    }

    setTestStatus('testing');
    try {
      // Simulate testing by running a limited version of the query
      const testQuery = sql.trim().replace(/;$/, '') + ' LIMIT 1';
      const result = await executeQuery(testQuery);
      
      if ('error' in result) {
        setTestStatus('error');
        setTestMessage(`Syntax Error: ${result.error}`);
      } else {
        setTestStatus('success');
        setTestMessage('Query executed successfully. Structure valid.');
      }
    } catch (e: any) {
      setTestStatus('error');
      setTestMessage(e.message || 'Unknown error during test.');
    }
  };

  const handleSave = async () => {
    if (!targetSchema || !source || !sql) return;

    const newWorkflow: Workflow = {
      id: `wf-sql-${Date.now()}`,
      name: `SQL Pipeline: ${targetSchema}`,
      status: 'Test', // Default to test until fully deployed
      sources: [source],
      destination: targetSchema,
      trigger: frequency,
      transformer: 'Custom SQL',
      transformerCode: sql,
      lastExecuted: 'Never',
      nodes: [], // Simplified representation for this quick-add feature
      edges: [],
      currentVersion: 1
    };

    try {
      await saveWorkflow(newWorkflow, false);
      onClose();
    } catch (e) {
      console.error("Failed to save workflow", e);
      setTestStatus('error');
      setTestMessage('Failed to save pipeline definition.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <Card ref={modalRef} className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white mb-4">Define SQL Pipeline to Schema</h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1 text-sm">Source Interface</label>
              <select 
                value={source} 
                onChange={e => setSource(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
              >
                {availableSources.length > 0 ? (
                  availableSources.map(s => <option key={s} value={s}>{s}</option>)
                ) : (
                  <option value="" disabled>No sources available</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 text-sm">Update Frequency</label>
              <select 
                value={frequency} 
                onChange={e => setFrequency(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
              >
                <option value="Real-time">Real-time (Streaming)</option>
                <option value="Hourly">Hourly</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="On Demand">On Demand</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 text-sm">Target Schema / Table Name</label>
            <input 
              type="text" 
              value={targetSchema} 
              onChange={e => setTargetSchema(e.target.value)}
              placeholder="e.g., analytical_daily_summary"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 text-sm">SQL Transformation Logic</label>
            <textarea 
              value={sql}
              onChange={e => setSql(e.target.value)}
              placeholder="SELECT ... FROM ... WHERE ..."
              className="w-full h-48 bg-slate-900 border border-slate-600 rounded-lg p-3 font-mono text-sm text-cyan-300 focus:ring-2 focus:ring-cyan-500 outline-none resize-y"
            />
            <p className="text-xs text-slate-500 mt-1">Pre-populated with a best-effort template for the selected source.</p>
          </div>

          {/* Test & Validation Section */}
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-white">Validation</h3>
              <Button 
                variant="secondary" 
                type="button" 
                onClick={handleTest}
                disabled={testStatus === 'testing'}
                className="text-xs py-1 px-3"
              >
                {testStatus === 'testing' ? 'Testing...' : 'Test SQL'}
              </Button>
            </div>
            
            {testStatus !== 'idle' && (
              <div className={`text-xs p-2 rounded mb-3 ${testStatus === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {testMessage}
              </div>
            )}

            <div className="flex items-center">
              <input 
                type="checkbox" 
                id="approval-check" 
                checked={isValidated}
                onChange={e => setIsValidated(e.target.checked)}
                className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-500 rounded focus:ring-cyan-500"
              />
              <label htmlFor="approval-check" className="ml-2 text-sm text-slate-300 select-none">
                I certify that these results are validated and accurate.
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button 
              variant="primary" 
              onClick={handleSave}
              disabled={!isValidated || !targetSchema || !sql}
              title={!isValidated ? "Please validate and approve results first" : "Save pipeline"}
            >
              Create Pipeline
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AddSqlToSchemaModal;
