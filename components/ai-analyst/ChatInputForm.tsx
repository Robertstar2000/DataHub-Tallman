import React from 'react';
import { AnalysisMode, modeConfig } from '../AIAnalyst';

interface Props {
  mode: AnalysisMode;
  isLoading: boolean;
  onSubmit: (query: string) => void;
}

const ChatInputForm: React.FC<Props> = ({ mode, isLoading, onSubmit }) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get('query') as string;
    onSubmit(query);
    e.currentTarget.reset();
  };

  return (
    <form onSubmit={handleSubmit} className="flex-none pt-4 border-t border-slate-700/50 flex gap-2">
      <input
        type="text"
        name="query"
        disabled={isLoading}
        placeholder={modeConfig[mode].placeholder}
        className="flex-grow bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-50"
        autoComplete="off"
      />
      <button type="submit" disabled={isLoading} className="bg-cyan-500 text-white font-semibold px-6 py-2 rounded-lg hover:bg-cyan-600 disabled:bg-slate-600">
        Send
      </button>
    </form>
  );
};

export default ChatInputForm;
