import React, { useState, useEffect } from 'react';
import Card from './Card';
import { getTableSchemas, createPrediction, getPredictionModels, deletePredictionModel, executeQuery } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { PredictionModel } from '../types';

const ModelView: React.FC<{ model: PredictionModel, onDelete: (id: string) => void }> = ({ model, onDelete }) => {
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const historyQuery = `SELECT "${model.dateColumn}" AS name, "${model.targetColumn}" AS actual FROM "${model.sourceTable}" ORDER BY name`;
                const forecastQuery = `SELECT prediction_date AS name, predicted_value AS predicted FROM "${model.resultTable}" ORDER BY name`;
                
                const [historyRes, forecastRes] = await Promise.all([
                    executeQuery(historyQuery),
                    executeQuery(forecastQuery)
                ]);

                // FIX: Check for errors individually to allow TypeScript to narrow the types.
                if ('error' in historyRes) {
                    throw new Error(historyRes.error);
                }
                if ('error' in forecastRes) {
                    throw new Error(forecastRes.error);
                }
                
                const mergedData = [...historyRes.data];
                const forecastMap = new Map(forecastRes.data.map(d => [d.name, d.predicted]));
                
                mergedData.forEach(d => {
                    if (forecastMap.has(d.name)) {
                        d.predicted = forecastMap.get(d.name);
                        forecastMap.delete(d.name);
                    }
                });
                
                forecastMap.forEach((value, name) => {
                    mergedData.push({ name, predicted: value });
                });

                setChartData(mergedData.sort((a, b) => a.name.localeCompare(b.name)));

            } catch (error) {
                console.error("Failed to fetch chart data for model:", model.name, error);
            } finally {
                setIsLoading(false);
            }
        };

        if (model.status === 'Ready' && model.resultTable) {
            fetchData();
        } else {
            setIsLoading(false);
        }
    }, [model]);

    const forecastStartIndex = chartData.findIndex(d => d.predicted !== undefined && d.actual === undefined);

    return (
        <Card>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h2 className="text-xl font-bold text-white">{model.name}</h2>
                    <p className="text-sm text-slate-400">Forecasting <span className="font-mono text-cyan-400">{model.targetColumn}</span> from <span className="font-mono text-cyan-400">{model.sourceTable}</span></p>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${model.status === 'Ready' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                    {model.status}
                </span>
            </div>
            
            <div className="w-full h-72 my-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-slate-400">Loading chart data...</div>
                ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tick={{ transform: 'translate(0, 5)' }} />
                            <YAxis stroke="#9ca3af" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                            <Legend />
                            <Line type="monotone" dataKey="actual" name="Historical" stroke="#818cf8" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="predicted" name="Forecast" stroke="#06b6d4" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            {forecastStartIndex > 0 && (
                                <ReferenceLine x={chartData[forecastStartIndex].name} stroke="#f87171" strokeDasharray="3 3" label={{ value: 'Forecast Start', position: 'insideTop', fill: '#f87171' }} />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                     <div className="flex items-center justify-center h-full text-slate-500">No data available for visualization.</div>
                )}
            </div>
            
             <div className="flex justify-between items-center text-sm text-slate-400 border-t border-slate-700/50 pt-4">
                <div className="space-y-1">
                    <p><strong>Created:</strong> {new Date(model.createdAt).toLocaleString()}</p>
                    {model.accuracy && <p><strong>Simulated Accuracy:</strong> { (model.accuracy * 100).toFixed(1) }%</p>}
                </div>
                <button onClick={() => onDelete(model.id)} className="bg-red-800/80 hover:bg-red-700 text-white font-semibold px-3 py-1 rounded-md text-sm">Delete</button>
            </div>
        </Card>
    );
};


const PredictiveAnalytics: React.FC = () => {
    const [models, setModels] = useState<PredictionModel[]>([]);
    const [view, setView] = useState<'list' | 'create'>('list');
    const [isLoading, setIsLoading] = useState(true);

    const loadModels = async () => {
        setIsLoading(true);
        const fetchedModels = await getPredictionModels();
        setModels(fetchedModels);
        setIsLoading(false);
    };

    useEffect(() => {
        loadModels();
    }, []);

    const handleModelCreated = () => {
        loadModels();
        setView('list');
    };

    const handleModelDeleted = async (modelId: string) => {
        if (window.confirm("Are you sure you want to delete this prediction model and its results?")) {
            await deletePredictionModel(modelId);
            loadModels();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white">Predictive Analytics</h1>
                {view === 'list' && (
                    <button onClick={() => setView('create')} className="bg-cyan-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-cyan-600">
                        + New Prediction Model
                    </button>
                )}
            </div>
            <p className="text-slate-400 max-w-3xl">
                Leverage historical data to forecast future trends. Select a dataset, choose a target to predict, and let the system build and train a model for you—no code required.
            </p>

            {view === 'list' && (
                <div className="space-y-6">
                    {isLoading ? (
                        <p className="text-slate-400">Loading models...</p>
                    ) : models.length > 0 ? (
                        models.map(model => (
                           <ModelView key={model.id} model={model} onDelete={handleModelDeleted} />
                        ))
                    ) : (
                         <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-lg">
                            <p className="text-slate-400 mb-4">You haven't created any prediction models yet.</p>
                            <button onClick={() => setView('create')} className="bg-cyan-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-cyan-600">
                                Create Your First Model
                            </button>
                        </div>
                    )}
                </div>
            )}
            {view === 'create' && <CreateModelView onCancel={() => setView('list')} onCreated={handleModelCreated} />}
        </div>
    );
};


const CreateModelView: React.FC<{ onCancel: () => void, onCreated: () => void }> = ({ onCancel, onCreated }) => {
    const [modelName, setModelName] = useState('');
    const [sourceTable, setSourceTable] = useState('');
    const [targetColumn, setTargetColumn] = useState('');
    const [dateColumn, setDateColumn] = useState('');
    
    const [allTables, setAllTables] = useState<string[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [isTraining, setIsTraining] = useState(false);
    const [trainingStatus, setTrainingStatus] = useState('');

    useEffect(() => {
        const fetchTables = async () => {
            const schemas = await getTableSchemas();
            setAllTables(Object.keys(schemas));
        };
        fetchTables();
    }, []);

    useEffect(() => {
        const fetchColumns = async () => {
            if (sourceTable) {
                const schemas = await getTableSchemas();
                const schemaString = schemas[sourceTable]?.columns;
                if (schemaString) {
                    const cols = schemaString.split(', ').map(s => s.split(' ')[0]);
                    setColumns(cols);
                    setTargetColumn('');
                    setDateColumn('');
                }
            } else {
                setColumns([]);
            }
        };
        fetchColumns();
    }, [sourceTable]);

    const handleTrainModel = async () => {
        if (!modelName || !sourceTable || !targetColumn || !dateColumn) {
            alert("Please fill all fields.");
            return;
        }
        setIsTraining(true);
        setTrainingStatus("Initializing model...");
        
        const modelData = { name: modelName, sourceTable, targetColumn, dateColumn };

        // Simulate training process
        setTimeout(() => setTrainingStatus("Analyzing historical data..."), 1000);
        setTimeout(() => setTrainingStatus("Training forecasting model... (this is a simulation)"), 2500);
        
        await createPrediction(modelData);
        
        setTimeout(() => {
            setTrainingStatus("Model trained successfully!");
            setIsTraining(false);
            onCreated();
        }, 4000);
    };

    return (
        <Card>
            <h2 className="text-2xl font-bold text-white mb-4">Create New Prediction Model</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-slate-400 mb-1">Model Name</label>
                        <input value={modelName} onChange={e => setModelName(e.target.value)} placeholder="e.g., Q4 Revenue Forecast" className="w-full bg-slate-700 input-style" />
                    </div>
                    <div>
                        <label className="block text-slate-400 mb-1">Source Table</label>
                        <select value={sourceTable} onChange={e => setSourceTable(e.target.value)} className="w-full bg-slate-700 input-style">
                            <option value="">Select a table...</option>
                            {allTables.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-slate-400 mb-1">Target Column (to predict)</label>
                        <select value={targetColumn} onChange={e => setTargetColumn(e.target.value)} disabled={!sourceTable} className="w-full bg-slate-700 input-style">
                             <option value="">Select a column...</option>
                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-slate-400 mb-1">Date/Time Column</label>
                        <select value={dateColumn} onChange={e => setDateColumn(e.target.value)} disabled={!sourceTable} className="w-full bg-slate-700 input-style">
                             <option value="">Select a column...</option>
                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                 <div className="bg-slate-900/50 rounded-lg p-4 flex flex-col items-center justify-center">
                    {isTraining ? (
                        <div className="text-center">
                            <svg className="mx-auto h-12 w-12 text-cyan-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-slate-300 mt-4">{trainingStatus}</p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="text-slate-400 mb-4">Once configured, the system will analyze the historical data to build a time-series forecasting model.</p>
                             <button onClick={handleTrainModel} className="bg-cyan-500 text-white font-semibold px-6 py-2 rounded-lg hover:bg-cyan-600">
                                Train Model
                            </button>
                        </div>
                    )}
                 </div>
            </div>

             <div className="flex justify-end gap-4 pt-6 mt-6 border-t border-slate-700/50">
                <button onClick={onCancel} className="bg-slate-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-slate-500">Cancel</button>
            </div>
             <style>{`.input-style { @apply border border-slate-600 rounded-lg px-4 py-2 text-white disabled:opacity-50; }`}</style>
        </Card>
    );
};

export default PredictiveAnalytics;