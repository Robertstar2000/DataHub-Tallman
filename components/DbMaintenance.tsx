
import React, { useState, useEffect, useRef } from 'react';
import Card from './Card';
import {
  getDbStatistics,
  exportDb,
  runMaintenance,
  initializeDatabase,
  getVectorStoreStats,
  rebuildVectorStore,
} from '../services/api';

type DbStats = Awaited<ReturnType<typeof getDbStatistics>> | null;
type VectorStats = Awaited<ReturnType<typeof getVectorStoreStats>> | null;

const aiRecommendations = [
    { id: 1, type: 'Quality', text: "Column `contact_email` in `p21_customers` has 2 records with invalid email formats.", severity: 'warning' },
    { id: 2, type: 'Optimization', text: "Table `p21_sales_order_lines` is frequently joined on `item_id`. Consider adding an index.", severity: 'info' },
    { id: 3, type: 'Quality', text: "Found 3 potential duplicate customer records based on address similarity.", severity: 'warning' },
    { id: 4, type: 'Optimization', text: "Table `teams_messages` is growing rapidly. Consider archiving records older than 180 days.", severity: 'info' },
];

const DbMaintenance: React.FC = () => {
  const [dbStats, setDbStats] = useState<DbStats>(null);
  const [vectorStats, setVectorStats] = useState<VectorStats>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState({
    backup: false,
    restore: false,
    maintenance: false,
    rebuild: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (message: string) => {
    setLogs(prev => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev].slice(0, 100));
  };

  const fetchStats = async () => {
    try {
      const sqlStats = await getDbStatistics();
      setDbStats(sqlStats);
      addLog('Fetched latest SQL database statistics.');

      const vecStats = await getVectorStoreStats();
      setVectorStats(vecStats);
      addLog('Fetched latest vector store statistics.');
    } catch (e: any) {
      addLog(`Error fetching stats: ${e.message}`);
    }
  };
  
  useEffect(() => {
    fetchStats();
  }, []);

  const handleBackup = async () => {
    addLog('Starting database backup...');
    setLoading(prev => ({...prev, backup: true}));
    try {
        const data = await exportDb();
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `datalake_backup_${new Date().toISOString().slice(0,10)}.db`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        addLog('Database backup successful.');
    } catch (e: any) {
        addLog(`Backup failed: ${e.message}`);
    } finally {
        setLoading(prev => ({...prev, backup: false}));
    }
  };
  
  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    addLog(`Restoring database from ${file.name}...`);
    setLoading(prev => ({...prev, restore: true}));

    const reader = new FileReader();
    reader.onload = async (e) => {
        const dbBytes = new Uint8Array(e.target?.result as ArrayBuffer);
        try {
            await initializeDatabase(dbBytes);
            addLog('Database restored. App will reload to apply changes.');
            setTimeout(() => window.location.reload(), 2000); // Reload the app
        } catch (err: any) {
            addLog(`Error restoring database: ${err.message}`);
            setLoading(prev => ({...prev, restore: false}));
        }
    };
    reader.onerror = () => {
        addLog(`Error reading file: ${reader.error}`);
        setLoading(prev => ({...prev, restore: false}));
    }
    reader.readAsArrayBuffer(file);
  };

  const handleMaintenance = async () => {
      addLog('Running database maintenance (VACUUM)...');
      setLoading(prev => ({...prev, maintenance: true}));
      try {
          const result = await runMaintenance();
          addLog(result.message);
          if(result.success) await fetchStats(); // Refresh stats after maintenance
      } catch (e: any) {
          addLog(`Maintenance failed: ${e.message}`);
      } finally {
          setLoading(prev => ({...prev, maintenance: false}));
      }
  };

  const handleRebuildIndex = async () => {
      addLog('Rebuilding vector store index...');
      setLoading(prev => ({...prev, rebuild: true}));
      try {
        await rebuildVectorStore();
        addLog('Vector store index rebuilt successfully.');
        await fetchStats(); // Refresh stats
      } catch(e: any) {
        addLog(`Error rebuilding index: ${e.message}`);
      } finally {
        setLoading(prev => ({...prev, rebuild: false}));
      }
  };

  const StatItem: React.FC<{label: string, value: React.ReactNode}> = ({label, value}) => (
    <div className="flex justify-between items-baseline py-2 border-b border-slate-700/50">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-cyan-300">{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">DB Maintenance</h1>
      <p className="text-slate-400">Tools for managing the core SQL database and the vector store for unstructured data.</p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
              <h2 className="text-xl font-bold text-white mb-4">SQL Database Management</h2>
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-2">
                  {dbStats?.tableCounts ? (
                    Object.entries(dbStats.tableCounts).map(([table, count]) => (
                      <StatItem key={table} label={`${table} Rows`} value={count} />
                    ))
                  ) : <StatItem label="Rows" value={'...'} /> }
                  <StatItem label="Database Size" value={dbStats ? `${(dbStats.dbSizeBytes / 1024).toFixed(2)} KB` : '...'} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <button onClick={handleBackup} disabled={loading.backup} className="btn-secondary">{loading.backup ? 'Backing up...' : 'Backup DB'}</button>
                  <button onClick={handleRestoreClick} disabled={loading.restore} className="btn-secondary">{loading.restore ? 'Restoring...' : 'Restore DB'}</button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".db" className="hidden" />
                  <button onClick={handleMaintenance} disabled={loading.maintenance} className="btn-secondary">{loading.maintenance ? 'Running...' : 'Run Maintenance'}</button>
              </div>
          </Card>
          <Card>
              <h2 className="text-xl font-bold text-white mb-4">Vector Store Management</h2>
              <div className="space-y-2 mb-4">
                  <StatItem label="Indexed Documents" value={vectorStats?.documentCount ?? '...'} />
                  <StatItem label="Vector Dimension" value={vectorStats?.vectorDimension ?? '...'} />
              </div>
              <button onClick={handleRebuildIndex} disabled={loading.rebuild} className="btn-primary w-full">{loading.rebuild ? 'Rebuilding...' : 'Rebuild Index'}</button>
          </Card>
           <Card>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m1.5-4.5V21m6-18v1.5m3.75-1.5v1.5m3.75 1.5v1.5m0 3.75v1.5m0 3.75v1.5m0 3.75v1.5M12 3v1.5m0 3.75v1.5m0 3.75v1.5m0 3.75v1.5" /></svg>
                AI Data Steward
              </h2>
               <div className="space-y-2">
                {aiRecommendations.map(rec => (
                    <div key={rec.id} className={`p-2 rounded-md border-l-4 ${rec.severity === 'warning' ? 'bg-yellow-500/10 border-yellow-500' : 'bg-blue-500/10 border-blue-500'}`}>
                        <p className={`font-semibold text-sm ${rec.severity === 'warning' ? 'text-yellow-300' : 'text-blue-300'}`}>{rec.type}</p>
                        <p className="text-xs text-slate-300">{rec.text}</p>
                    </div>
                ))}
            </div>
          </Card>
        </div>

        <Card className="flex flex-col">
          <h2 className="text-xl font-bold text-white mb-4">Activity Log</h2>
          <div className="flex-grow bg-slate-900/50 p-3 rounded-lg overflow-y-auto min-h-[300px]">
            {logs.map((log, i) => (
              <p key={i} className="font-mono text-sm text-slate-300 animate-fade-in">{log}</p>
            ))}
             {logs.length === 0 && <p className="text-slate-500">No activities yet.</p>}
          </div>
        </Card>
      </div>
      
      <style>{`
        .btn-primary { @apply w-full bg-cyan-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-cyan-600 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed; }
        .btn-secondary { @apply w-full bg-slate-700 text-white font-semibold px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default DbMaintenance;