import React from 'react';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
    if (!content) return null;

    // Pre-processing to fix common AI formatting issues
    // 1. " - **Text**" -> "\n- **Text**" (convert inline bullets to new lines)
    let processedContent = content.replace(/([^\n])\s-\s\*\*/g, '$1\n- **');

    // 2. Ensure headers have newlines before them
    processedContent = processedContent.replace(/([^\n])(#{3,})/g, '$1\n$2');

    const lines = processedContent.split('\n');
    const elements: React.ReactNode[] = [];

    let listBuffer: string[] = [];
    let currentKey = 0;

    const flushList = () => {
        if (listBuffer.length > 0) {
            elements.push(
                <ul key={`list-${currentKey++}`} className="list-disc pl-5 space-y-2 mb-4">
                    {listBuffer.map((item, i) => (
                        <li key={i} className="pl-1">
                            {parseInlineFormatting(item)}
                        </li>
                    ))}
                </ul>
            );
            listBuffer = [];
        }
    };

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) {
            flushList();
            return;
        }

        // List Item detection
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            listBuffer.push(trimmed.substring(2));
            return;
        }

        // If we hit a non-list item, flush the list
        flushList();

        // Headers
        if (trimmed.startsWith('### ')) {
            elements.push(<h4 key={`h4-${currentKey++}`} className="text-lg font-bold text-gray-900 mt-6 mb-3 border-b border-gray-100 pb-2">{trimmed.replace('### ', '')}</h4>);
            return;
        }
        if (trimmed.startsWith('#### ')) {
            elements.push(<h5 key={`h5-${currentKey++}`} className="font-bold text-gray-800 mt-4 mb-2">{trimmed.replace('#### ', '')}</h5>);
            return;
        }

        // Paragraph
        elements.push(
            <p key={`p-${currentKey++}`} className="mb-4 last:mb-0 text-justify">
                {parseInlineFormatting(trimmed)}
            </p>
        );
    });

    // Final flush
    flushList();

    return (
        <div className={`text-gray-700 text-sm leading-relaxed ${className}`}>
            {elements}
        </div>
    );
};

// Helper to handle **bold** and *italic*
const parseInlineFormatting = (text: string): React.ReactNode[] => {
    // Escape check to avoid trying to parse complex regex if not needed
    if (!text.includes('**')) return [text];

    const parts = text.split(/(\*\*.*?\*\*)/g); // Split by bold
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};
