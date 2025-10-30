
import React, { useState, useEffect } from 'react';
import { unstructuredData } from '../data/unstructuredData';
import type { UnstructuredDocument } from '../data/unstructuredData';
import { processUnstructuredData, findSimilarDocuments } from '../services/api';


const Loader: React.FC = () => (
    <div className="flex items-center space-x-2">
      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
    </div>
  );

const SimilarDocsSkeleton: React.FC = () => (
    <div className="grid grid-cols-3 gap-2">
        {[...Array(3)].map((_, i) => (
            <div key={i} className="p-2 bg-slate-700 rounded-md animate-pulse">
                <div className="h-3 bg-slate-600 rounded w-full mb-1"></div>
                <div className="h-2 bg-slate-600 rounded w-1/2"></div>
            </div>
        ))}
    </div>
);

const UnstructuredDataExplorer: React.FC = () => {
    const [selectedDoc, setSelectedDoc] = useState<UnstructuredDocument | null>(unstructuredData[0]);
    const [similarDocs, setSimilarDocs] = useState<UnstructuredDocument[]>([]);
    const [isSimilarLoading, setIsSimilarLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState<Array<{ type: 'user' | 'ai', content: string }>>([]);
    
    useEffect(() => {
        const getSimilarDocs = async () => {
            if (selectedDoc) {
                setIsSimilarLoading(true);
                try {
                    const similar = await findSimilarDocuments(selectedDoc.id);
                    setSimilarDocs(similar);
                } catch (e) {
                    console.error("Failed to find similar documents", e);
                    setSimilarDocs([]);
                } finally {
                    setIsSimilarLoading(false);
                }
            } else {
                setSimilarDocs([]);
            }
        };
        getSimilarDocs();
    }, [selectedDoc]);

    const handleQuerySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || !selectedDoc) return;
    
        const newHistory = [...chatHistory, { type: 'user' as 'user', content: query }];
        setChatHistory(newHistory);
        setQuery('');
        setIsLoading(true);
    
        try {
          const result = await processUnstructuredData(query, selectedDoc.id);
          setChatHistory([...newHistory, { type: 'ai' as 'ai', content: result }]);
        } catch (err) {
          console.error(err);
          setChatHistory([...newHistory, { type: 'ai' as 'ai', content: 'Sorry, an error occurred.' }]);
        } finally {
          setIsLoading(false);
        }
      };
      
    const examplePrompts = [
        "Summarize this document in 2 sentences.",
        "What is the customer's main issue in this support ticket?",
        "Extract the attendees and action items into a JSON object.",
        "Convert the entire review into a JSON with keys: 'author', 'rating', 'title', and 'comment'."
    ];

    const isJsonString = (str: string) => {
        try {
            const trimmed = str.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                 JSON.parse(trimmed);
                 return true;
            }
        } catch (e) {
            return false;
        }
        return false;
    }

    return (
        <div className="h-full flex gap-6">
            {/* Left Panel: Document Selection */}
            <div className="w-1/3 flex flex-col gap-4">
                <h3 className="text-lg font-semibold text-white">Unstructured Sources</h3>
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg flex-grow overflow-y-auto">
                    <ul>
                    {unstructuredData.map(doc => (
                        <li key={doc.id} onClick={() => { setSelectedDoc(doc); setChatHistory([]); }}
                            className={`p-3 cursor-pointer border-l-4 ${selectedDoc?.id === doc.id ? 'border-cyan-400 bg-cyan-500/10' : 'border-transparent hover:bg-slate-700/50'}`}>
                            <p className="font-semibold text-slate-200">{doc.name}</p>
                            <p className="text-sm text-slate-400">{doc.type}</p>
                        </li>
                    ))}
                    </ul>
                </div>
            </div>

            {/* Right Panel: Chat Interface */}
            <div className="w-2/3 flex flex-col bg-slate-800/50 border border-slate-700/50 rounded-lg">
                <div className="flex-none p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white">
                        Query Document: <span className="text-cyan-400">{selectedDoc?.name || 'None Selected'}</span>
                    </h3>
                </div>
                <div className="flex-grow p-4 space-y-4 overflow-y-auto">
                    {chatHistory.length === 0 && selectedDoc && (
                         <div className="p-3 rounded-lg bg-slate-700 text-slate-200 prose prose-invert max-w-none">
                             <h4 className="text-slate-300">Document Content:</h4>
                             <pre className="whitespace-pre-wrap text-sm">{selectedDoc.content}</pre>
                         </div>
                    )}
                    {chatHistory.map((msg, index) => (
                        <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xl p-3 rounded-lg ${msg.type === 'user' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                                {isJsonString(msg.content) ? (
                                    <pre className="bg-slate-900 p-2 rounded text-sm whitespace-pre-wrap font-mono">{JSON.stringify(JSON.parse(msg.content), null, 2)}</pre>
                                ) : (
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                             <div className="max-w-xl p-3 rounded-lg bg-slate-700 text-slate-200"><Loader/></div>
                        </div>
                    )}
                </div>
                 <div className="flex-none p-4 border-t border-slate-700">
                     <div className="mb-4">
                        <h4 className="text-md font-semibold text-white mb-2">Similar Documents</h4>
                        {isSimilarLoading ? <SimilarDocsSkeleton /> : similarDocs.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                                {similarDocs.map(doc => (
                                     <button key={doc.id} onClick={() => { setSelectedDoc(doc); setChatHistory([]); }} className="p-2 text-xs bg-slate-700 rounded-md text-left text-slate-300 hover:bg-slate-600 transition-colors">
                                        <p className="font-bold truncate">{doc.name}</p>
                                        <p className="text-slate-400">{doc.type}</p>
                                    </button>
                                ))}
                            </div>
                        ) : <p className="text-sm text-slate-400">No similar documents found.</p>}
                     </div>
                     <div className="grid grid-cols-2 gap-2 mb-2">
                        {examplePrompts.slice(0, 4).map(p => (
                            <button key={p} onClick={() => setQuery(p)} className="p-2 text-xs bg-slate-700 rounded-md text-left text-slate-300 hover:bg-slate-600 transition-colors">
                                {p}
                            </button>
                        ))}
                     </div>
                    <form onSubmit={handleQuerySubmit} className="flex gap-2">
                        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} disabled={isLoading || !selectedDoc}
                            className="flex-grow bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-50"
                            placeholder={selectedDoc ? "Ask about the selected document..." : "Select a document first"}
                        />
                        <button type="submit" disabled={isLoading || !query.trim()}
                            className="bg-cyan-500 text-white font-semibold px-6 py-2 rounded-lg hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                        >
                            Send
                        </button>
                    </form>
                 </div>
            </div>
        </div>
    );
};

export default UnstructuredDataExplorer;