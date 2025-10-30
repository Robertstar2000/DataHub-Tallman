
import React, { useState, useEffect, useRef } from 'react';
import Card from './Card';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface HelpModalProps {
  show: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ show, onClose }) => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, show);

  useEffect(() => {
    if (show) {
      setIsLoading(true);
      fetch('/helpme.md')
        .then(res => {
            if (!res.ok) throw new Error("File not found");
            return res.text();
        })
        .then(text => {
            setContent(text);
            setIsLoading(false);
        })
        .catch(err => {
            setContent("Error: Could not load help content.");
            console.error(err);
            setIsLoading(false);
        });
    }
  }, [show]);

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <Card 
        ref={modalRef}
        className="max-w-4xl w-full h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        <div className="flex-none flex justify-between items-center mb-4">
            <h1 id="help-modal-title" className="text-2xl font-bold text-white">Help & User Guide</h1>
            <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white font-bold"
                aria-label="Close help modal"
            >
                &times;
            </button>
        </div>
        <div className="flex-grow overflow-y-auto pr-4 -mr-4">
            {isLoading ? <p>Loading help content...</p> : <MarkdownRenderer content={content} />}
        </div>
      </Card>
    </div>
  );
};

export default HelpModal;
