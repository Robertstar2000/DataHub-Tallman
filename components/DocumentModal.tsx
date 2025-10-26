import React, { useState, useEffect } from 'react';
import Card from './Card';
import { MarkdownRenderer } from './MarkdownRenderer';

interface DocumentModalProps {
  show: boolean;
  onClose: () => void;
}

interface Document {
  key: string;
  title: string;
  path: string;
  description: string;
}

const documents: Document[] = [
  { key: 'user_instructions', title: 'User Instructions', path: '/user_instructions.md', description: 'Step-by-step guide for using the application.' },
  { key: 'full_list_features', title: 'Full Feature List', path: '/full_list_features.md', description: 'A comprehensive list of all platform features.' },
  { key: 'code_architecture', title: 'Code Architecture', path: '/code_architecture.md', description: 'Technical deep-dive into the application structure.' },
  { key: 'mcp_requirements', title: 'MCP Requirements', path: '/MCP_requirements.md', description: 'Technical specifications for the MCP interface.' },
  { key: 'interfaces_requirements', title: 'Interface Requirements', path: '/interfaces_requirements.md', description: 'Technical specifications for other system interfaces.' },
  { key: 'help', title: 'General Help', path: '/help.md', description: 'General help and frequently asked questions.' },
];

const DocumentModal: React.FC<DocumentModalProps> = ({ show, onClose }) => {
  const [selectedDocKey, setSelectedDocKey] = useState<string>(documents[0].key);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      const selectedDoc = documents.find(d => d.key === selectedDocKey);
      if (selectedDoc) {
        setIsLoading(true);
        setError(null);
        fetch(selectedDoc.path)
          .then(res => {
            if (!res.ok) throw new Error(`File not found: ${selectedDoc.path}`);
            return res.text();
          })
          .then(text => {
            setContent(text);
          })
          .catch(err => {
            console.error("Failed to load document:", err);
            setError("Could not load the selected document. Please try again.");
          })
          .finally(() => {
            setIsLoading(false);
          });
      }
    }
  }, [show, selectedDocKey]);
  
  // Reset to first doc when modal is opened
  useEffect(() => {
      if (show) {
          setSelectedDocKey(documents[0].key);
      }
  }, [show]);

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <Card 
        className="max-w-6xl w-full h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-none flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-white">Platform Documentation</h1>
            <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white font-bold"
                aria-label="Close documents modal"
            >
                &times;
            </button>
        </div>
        <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
            {/* Left: Document List */}
            <div className="lg:col-span-1 flex flex-col bg-slate-900/50 rounded-lg p-2">
                <ul className="flex-grow overflow-y-auto space-y-1">
                    {documents.map(doc => (
                    <li
                        key={doc.key}
                        onClick={() => setSelectedDocKey(doc.key)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedDocKey === doc.key
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'hover:bg-slate-700/50 text-slate-300'
                        }`}
                    >
                        <h3 className="font-semibold">{doc.title}</h3>
                        <p className="text-sm text-slate-400">{doc.description}</p>
                    </li>
                    ))}
                </ul>
            </div>
            {/* Right: Content Viewer */}
            <div className="lg:col-span-3 overflow-y-auto pr-4 -mr-4">
                {isLoading ? (
                <div className="flex items-center justify-center h-full">
                    <p className="text-slate-400">Loading document...</p>
                </div>
                ) : error ? (
                <div className="flex items-center justify-center h-full">
                    <p className="text-red-400">{error}</p>
                </div>
                ) : (
                <div className="prose prose-slate prose-invert max-w-none prose-headings:text-cyan-400 prose-strong:text-white prose-code:text-cyan-300 prose-code:bg-slate-900/50 prose-code:rounded prose-code:px-1.5 prose-code:py-1 prose-a:text-cyan-400 hover:prose-a:text-cyan-300">
                    <MarkdownRenderer content={content} />
                </div>
                )}
            </div>
        </div>
      </Card>
    </div>
  );
};

export default DocumentModal;