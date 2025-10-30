import React from 'react';
import { AnalysisMode, modeConfig } from '../AIAnalyst';

interface Props {
  mode: AnalysisMode;
  onExampleClick: (prompt: string) => void;
  isLoading: boolean;
}

const ExamplePrompts: React.FC<Props> = ({ mode, onExampleClick, isLoading }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {modeConfig[mode].examples.map((example, i) => (
        <button
          key={i}
          onClick={() => onExampleClick(example)}
          disabled={isLoading}
          className="p-2 text-sm bg-slate-700/50 rounded-md text-left text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          {example}
        </button>
      ))}
    </div>
  );
};

export default ExamplePrompts;
