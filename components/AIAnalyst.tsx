
import React, { useState, useRef, useEffect } from 'react';
import Card from './Card';
// FIX: Changed import to be a named import as AnalysisModeSelector is now a named export.
import { AnalysisModeSelector } from './ai-analyst/AnalysisModeSelector';
import ExamplePrompts from './ai-analyst/ExamplePrompts';
import ChatHistory from './ai-analyst/ChatHistory';
import ChatInputForm from './ai-analyst/ChatInputForm';
import { 
    getAiSqlResponseStream, 
    analyzeTableWithAi,
    searchDocumentsWithAi,
    analyzeWorkflowWithAi
} from '../services/api';

export type AnalysisMode = 'DATABASE' | 'TABLE' | 'DOCUMENTS' | 'WORKFLOW';

export const modeConfig: Record<AnalysisMode, { label: string; examples: string[]; placeholder: string; contextLabel?: string }> = {
    DATABASE: {
        label: 'Query SQL Database',
        examples: [
            "Which customer has spent the most money?",
            "What is our best-selling product by revenue?",
            "Show total order value by date as a line chart.",
            "List all orders for 'Innovate Corp'.",
        ],
        placeholder: 'Ask a question about the entire database...',
    },
    TABLE: {
        label: 'Analyze a Table',
        examples: [
            "What is the schema of this table?",
            "Show me the first 5 records.",
            "Are there any null values in the credit_limit column?",
            "What's the average credit limit?",
        ],
        placeholder: 'Ask a question about the selected table...',
        contextLabel: 'Table',
    },
    DOCUMENTS: {
        label: 'Search Documents',
        examples: [
            "Find documents related to 'CloudBook Pro battery life'.",
            "What are the main issues with the 'Mechanic Keyboard'?",
            "Search for sales strategy meeting notes.",
            "Who are the main contacts for 'Project Phoenix'?",
        ],
        placeholder: 'Perform a semantic search on unstructured documents...',
    },
    WORKFLOW: {
        label: 'Analyze a Workflow',
        examples: [
            "Explain what this workflow does in simple terms.",
            "What are the sources and destinations for this pipeline?",
            "Does this workflow have any dependencies?",
            "How could this workflow be optimized?",
        ],
        placeholder: 'Ask a question about the selected workflow...',
        contextLabel: 'Workflow',
    },
};

export interface HistoryMessage {
  role: 'user' | 'model';
  parts: string;
  chart?: {
    chartType: 'Bar' | 'Line' | 'Pie';
    title: string;
    data: any[];
  };
}


const AIAnalyst: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [history, setHistory] = useState<HistoryMessage[]>([]);
    const [error, setError] = useState('');
    
    const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('DATABASE');
    const [selectedContextId, setSelectedContextId] = useState<string>('');

    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setHistory([]);
        setError('');
        setSelectedContextId('');
    }, [analysisMode]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);
    
    const handleQuerySubmit = async (userQuery: string) => {
        if (!userQuery.trim() || 
           ((analysisMode === 'TABLE' || analysisMode === 'WORKFLOW') && !selectedContextId)) {
            return;
        }

        setIsLoading(true);
        setError('');

        setHistory(prev => [...prev, { role: 'user', parts: userQuery }, { role: 'model', parts: '', chart: undefined }]);
        
        try {
            let stream;
            switch(analysisMode) {
                case 'DATABASE':
                    stream = await getAiSqlResponseStream(userQuery);
                    break;
                case 'TABLE':
                    stream = await analyzeTableWithAi(selectedContextId, userQuery);
                    break;
                case 'DOCUMENTS':
                    stream = await searchDocumentsWithAi(userQuery);
                    break;
                case 'WORKFLOW':
                    stream = await analyzeWorkflowWithAi(selectedContextId, userQuery);
                    break;
            }
          
            for await (const chunk of stream) {
                setHistory(prev => {
                    const newHistory = [...prev];
                    const lastMessage = newHistory[newHistory.length - 1];
                    
                    if (chunk.status === 'chart_data' && chunk.chart) {
                        lastMessage.chart = chunk.chart;
                    } else if (chunk.status && chunk.text) {
                        if (chunk.status === 'error') {
                            lastMessage.parts = `Error: ${chunk.text}`;
                            setError(chunk.text);
                        } else {
                           lastMessage.parts += chunk.text;
                        }
                    }
                    return newHistory;
                });
            }
        } catch (err: any) {
            setError('Failed to get response from AI Analyst: ' + err.message);
            console.error(err);
            setHistory(prev => {
                const newHistory = [...prev];
                newHistory[newHistory.length-1].parts = 'An error occurred while processing your request.';
                return newHistory;
            });
        } finally {
            setIsLoading(false);
        }
    };
  
    const handleExampleClick = (exampleQuery: string) => {
        handleQuerySubmit(exampleQuery);
    }
    
    return (
        <div className="space-y-4 flex flex-col h-full">
            <h1 className="text-3xl font-bold text-white">AI Data Analyst</h1>
            <p className="text-slate-400">
                Select an analysis mode to ask questions, perform searches, or analyze components of your data lake.
            </p>
            
            <AnalysisModeSelector 
                analysisMode={analysisMode}
                setAnalysisMode={setAnalysisMode}
                selectedContextId={selectedContextId}
                setSelectedContextId={setSelectedContextId}
            />

            <ExamplePrompts 
                mode={analysisMode}
                onExampleClick={handleExampleClick}
                isLoading={isLoading}
            />

            <Card className="flex-grow flex flex-col">
                <ChatHistory 
                    history={history}
                    isLoading={isLoading}
                    error={error}
                    chatEndRef={chatEndRef}
                />
                <ChatInputForm
                    mode={analysisMode}
                    isLoading={isLoading}
                    onSubmit={handleQuerySubmit}
                />
            </Card>
        </div>
    );
};

export default AIAnalyst;