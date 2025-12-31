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
    let tableBuffer: string[] = [];
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

    const flushTable = () => {
        if (tableBuffer.length > 0) {
            const rows = tableBuffer.map(row =>
                row.split('|')
                    .map(cell => cell.trim())
                    .filter((cell, i, arr) => i > 0 && i < arr.length - 1) // Remove first/last empty from |...| split
            );

            if (rows.length >= 2) {
                const headerRow = rows[0];
                const dataRows = rows.slice(1).filter(r => !r[0]?.match(/^[: -]+$/)); // Remove separator row like |---|

                elements.push(
                    <div key={`table-${currentKey++}`} className="overflow-x-auto rounded-lg border border-gray-200 mb-6 shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 text-gray-700 font-semibold">
                                <tr>
                                    {headerRow.map((header, i) => (
                                        <th key={i} className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                                            {parseInlineFormatting(header)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                {dataRows.map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                                        {row.map((cell, j) => (
                                            <td key={j} className="px-6 py-4 whitespace-nowrap md:whitespace-normal text-gray-700 leading-snug">
                                                {parseInlineFormatting(cell)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
            tableBuffer = [];
        }
    };

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) {
            flushList();
            flushTable();
            return;
        }

        // Table detection
        if (trimmed.startsWith('|')) {
            flushList(); // Close list if open
            tableBuffer.push(trimmed);
            return;
        }

        // List Item detection
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            flushTable(); // Close table if open
            listBuffer.push(trimmed.substring(2));
            return;
        }

        // If we hit a non-list/non-table item, flush buffers
        flushList();
        flushTable();

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
    flushTable();

    return (
        <div className={`text-gray-700 text-sm leading-relaxed ${className}`}>
            {elements}
        </div>
    );
};

// Helper to handle **bold**, *italic* and <br/>
const parseInlineFormatting = (text: string): React.ReactNode[] => {
    // Handle <br/> first by splitting
    if (text.includes('<br/>') || text.includes('<br>')) {
        const parts = text.split(/<br\/?>/g);
        // Flatten the results of recursive calls
        return parts.reduce((acc: React.ReactNode[], part, i) => {
            if (i > 0) acc.push(<br key={`br-${i}`} />);
            acc.push(...parseInlineFormatting(part));
            return acc;
        }, []);
    }

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
