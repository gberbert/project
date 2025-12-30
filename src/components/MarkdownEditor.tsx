import React, { useRef, useEffect } from 'react';
import {
    Bold, Italic, List, Heading1, Heading2, Quote, Code,
    Link, Image, Eraser, Check, X, Undo, Redo
} from 'lucide-react';

interface MarkdownEditorProps {
    initialValue: string;
    onSave: (value: string) => void;
    onCancel: () => void;
    label?: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ initialValue, onSave, onCancel, label }) => {
    const [value, setValue] = React.useState(initialValue);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);

    const insertText = (before: string, after: string = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = value.substring(start, end);

        const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
        setValue(newText);

        // Reset selection (simple approach: select the wrapped text)
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + before.length, end + before.length);
        }, 0);
    };

    const ToolbarButton = ({ icon: Icon, onClick, title }: { icon: any, onClick: () => void, title: string }) => (
        <button
            type="button"
            onClick={onClick}
            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title={title}
        >
            <Icon size={16} />
        </button>
    );

    return (
        <div className="bg-white rounded-xl border-2 border-indigo-100 shadow-lg animate-in fade-in zoom-in-95 duration-200">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-50 bg-gray-50/50 rounded-t-lg">
                <div className="flex items-center gap-1">
                    {label && <span className="text-xs font-bold text-gray-400 mr-2 uppercase tracking-wider">{label}</span>}
                    <div className="h-4 w-px bg-gray-200 mx-1" />
                    <ToolbarButton icon={Bold} onClick={() => insertText('**', '**')} title="Negrito" />
                    <ToolbarButton icon={Italic} onClick={() => insertText('*', '*')} title="Itálico" />
                    <div className="h-4 w-px bg-gray-200 mx-1" />
                    <ToolbarButton icon={Heading1} onClick={() => insertText('# ')} title="Título 1" />
                    <ToolbarButton icon={Heading2} onClick={() => insertText('## ')} title="Título 2" />
                    <div className="h-4 w-px bg-gray-200 mx-1" />
                    <ToolbarButton icon={List} onClick={() => insertText('- ')} title="Lista" />
                    <ToolbarButton icon={Quote} onClick={() => insertText('> ')} title="Citação" />
                    <ToolbarButton icon={Code} onClick={() => insertText('```\n', '\n```')} title="Código" />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setValue('')}
                        className="text-xs text-red-400 hover:text-red-600 font-medium px-2"
                    >
                        Limpar
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="p-2">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full min-h-[200px] p-3 text-sm text-gray-800 bg-transparent border-0 focus:ring-0 resize-none font-mono leading-relaxed placeholder-gray-300"
                    placeholder="Escreva seu conteúdo aqui... Suporta Markdown."
                />
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 p-3 bg-gray-50 rounded-b-lg border-t border-gray-100">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                >
                    <X size={16} />
                    Cancelar
                </button>
                <button
                    onClick={() => onSave(value)}
                    className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md shadow-indigo-100 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                    <Check size={16} />
                    Salvar Alterações
                </button>
            </div>
        </div>
    );
};
