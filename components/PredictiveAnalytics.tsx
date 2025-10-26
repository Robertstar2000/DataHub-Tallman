
import React, { useState, useEffect } from 'react';
import Card from './Card';
import { getTableSchemas, createPrediction, getPredictionModels, deletePredictionModel } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { PredictionModel } from '../types';

const PredictiveAnalytics: React.FC = () => {
    const [models, setModels] = useState<PredictionModel[]>([]);
    const [view, setView] = useState<'list' | 'create'>('list');

    const loadModels = async () => {
        const fetchedModels = await getPredictionModels();
        setModels(fetchedModels);
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {models.map(model => (
                        <Card key={model.id}>
                            <div className="flex justify-between items-start mb-2">
                                <h2 className="text-xl font-bold text-white">{model.name}</h2>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${model.status === 'Ready' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                                    {model.status}
                                </span>
                            </div>
                            <div className="text-sm text-slate-400 space-y-1 mb-4">
                                <p><strong>Source:</strong> <span className="font-mono">{model.sourceTable}</span></p>
                                <p><strong>Target:</strong> <span className="font-mono">{model.targetColumn}</span></p>
                                <p><strong>Created:</strong> {new Date(model.createdAt).toLocaleString()}</p>
                                {model.accuracy && <p><strong>Accuracy:</strong> { (model.accuracy * 100).toFixed(1) }%</p>}
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => handleModelDeleted(model.id)} className="bg-red-800/80 hover:bg-red-700 text-white font-semibold px-3 py-1 rounded-md text-sm">Delete</button>
                            </div>
                        </Card>
                    ))}
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
