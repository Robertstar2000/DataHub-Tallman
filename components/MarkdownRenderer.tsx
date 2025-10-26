
import React from 'react';

// Simple Markdown Parser and Renderer
export const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const renderLine = (line: string, index: number) => {
    // Headings
    if (line.startsWith('## ')) return <h2 key={index} className="text-2xl font-bold text-white mt-6 mb-2">{line.substring(3)}</h2>;
    if (line.startsWith('# ')) return <h1 key={index} className="text-3xl font-bold text-cyan-400 mb-4">{line.substring(2)}</h1>;
    if (line.startsWith('### ')) return <h3 key={index} className="text-xl font-semibold text-cyan-300 mt-4 mb-2">{line.substring(4)}</h3>;
    
    // Horizontal Rule
    if (line.startsWith('---')) return <hr key={index} className="border-slate-600 my-6" />;

    // Blockquote
    if (line.startsWith('> ')) return <blockquote key={index} className="border-l-4 border-slate-600 pl-4 italic text-slate-400 my-4"><p>{renderInline(line.substring(2))}</p></blockquote>;
    
    // List items
    if (line.startsWith('- ')) return <li key={index} className="ml-6 list-disc text-slate-300">{renderInline(line.substring(2))}</li>;
    
    // Plain paragraph
    if (line.trim() === '') return null; // Ignore empty lines for paragraphs
    return <p key={index} className="text-slate-300 mb-2">{renderInline(line)}</p>;
  };
  
  const renderInline = (text: string) => {
    const parts = text
      .split(/(\*\*.*?\*\*|`.*?`)/g)
      .filter(Boolean);

    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="bg-slate-900 text-cyan-300 font-mono text-sm px-1.5 py-0.5 rounded">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const lines = content.split('\n');
  const elements = [];
  let inList = false;
  let inCodeBlock = false;
  let codeBlockContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
        if (inCodeBlock) {
            // End of code block
            elements.push(<pre key={`code-block-${i}`} className="bg-slate-950/70 p-4 rounded-lg my-4 overflow-x-auto"><code className="text-sm font-mono text-cyan-300">{codeBlockContent}</code></pre>);
            codeBlockContent = '';
            inCodeBlock = false;
        } else {
            // Start of code block
            inCodeBlock = true;
            inList = false; // A code block breaks a list
        }
        continue;
    }
    
    if (inCodeBlock) {
        codeBlockContent += line + '\n';
        continue;
    }

    const isListItem = line.startsWith('- ');
    
    if (isListItem && !inList) {
      inList = true;
      elements.push(<ul key={`ul-start-${i}`} className="space-y-1 mb-4">{renderLine(line, i)}</ul>);
    } else if (isListItem && inList) {
      const lastElement = elements[elements.length - 1];
      if (lastElement && lastElement.type === 'ul') {
          const newChildren = React.Children.toArray(lastElement.props.children);
          newChildren.push(renderLine(line, i));
          elements[elements.length - 1] = React.cloneElement(lastElement, {}, newChildren);
      }
    } else {
      inList = false;
      const renderedLine = renderLine(line, i);
      if(renderedLine) elements.push(renderedLine);
    }
  }

  return <div>{elements}</div>;
};
