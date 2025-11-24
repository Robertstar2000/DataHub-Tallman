
import React from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { HistoryMessage } from '../AIAnalyst';
import { MarkdownRenderer } from '../MarkdownRenderer';

const COLORS = ['#06b6d4', '#818cf8', '#f87171', '#fbbf24', '#a3e635', '#f472b6'];

interface Props {
  history: HistoryMessage[];
  isLoading: boolean;
  error: string;
  chatEndRef: React.RefObject<HTMLDivElement>;
}

const ChartRenderer: React.FC<{ chart: HistoryMessage['chart'] }> = ({ chart }) => {
    if (!chart || !chart.data || chart.data.length === 0) return null;

    const chartProps = {
        data: chart.data,
        margin: { top: 5, right: 30, left: 0, bottom: 5 },
    };

    switch (chart.chartType) {
        case 'Bar':
            return (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart {...chartProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                        <YAxis stroke="#9ca3af" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                        <Bar dataKey="value" fill="#06b6d4" />
                    </BarChart>
                </ResponsiveContainer>
            );
        case 'Line':
             return (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart {...chartProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                        <YAxis stroke="#9ca3af" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                        <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            );
        case 'Pie':
            return (
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8">
                             {chart.data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            );
        default: return null;
    }
};

const ChatHistory: React.FC<Props> = ({ history, isLoading, error, chatEndRef }) => {
  return (
    <div className="flex-grow overflow-y-auto pr-4 -mr-4 space-y-4">
      {history.length === 0 && !isLoading && !error && (
        <div className="flex items-center justify-center h-full">
          <p className="text-slate-500">Your conversation with the AI Analyst will appear here.</p>
        </div>
      )}

      {history.map((msg, index) => (
        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-4xl p-4 rounded-lg prose prose-invert prose-p:my-2 prose-pre:my-2 ${msg.role === 'user' ? 'bg-cyan-600 text-white' : 'bg-slate-700/50 text-slate-200'}`}>
             <MarkdownRenderer content={msg.parts} />
             {msg.chart && <div className="mt-4 bg-slate-800 p-2 rounded-lg not-prose"><ChartRenderer chart={msg.chart} /></div>}
          </div>
        </div>
      ))}

      {isLoading && (history.length === 0 || history[history.length - 1]?.role === 'user') && (
        <div className="flex justify-start">
          <div className="max-w-xl p-4 rounded-lg bg-slate-700/50 text-slate-200">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 text-red-300 border border-red-500/20">
          <strong>Error:</strong> {error}
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  );
};

export default ChatHistory;
