import React, { useState, useEffect } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';

interface EditableTextProps {
    id: string; // Unique ID for persistence
    initialValue: string;
    placeholder?: string;
    isRich?: boolean; // If true, renders textarea for larger content
    label?: string;
    className?: string;
}

export const EditableText = ({ id, initialValue, placeholder, isRich = false, label, className = '' }: EditableTextProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(initialValue);
    const [savedValue, setSavedValue] = useState(initialValue);

    // Load from local storage on mount
    useEffect(() => {
        const stored = localStorage.getItem(`antigravity_text_${id}`);
        if (stored) {
            setValue(stored);
            setSavedValue(stored);
        }
    }, [id]);

    const handleSave = () => {
        setSavedValue(value);
        localStorage.setItem(`antigravity_text_${id}`, value);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setValue(savedValue);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className={`relative bg-white border border-indigo-200 rounded-lg shadow-sm p-4 animate-in fade-in zoom-in-95 duration-200 ${className}`}>
                {label && <label className="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">{label}</label>}
                {isRich ? (
                    <textarea
                        className="w-full text-gray-800 text-sm p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder}
                        autoFocus
                    />
                ) : (
                    <input
                        type="text"
                        className="w-full text-gray-800 font-medium text-lg p-2 border-b-2 border-indigo-500 focus:outline-none"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder}
                        autoFocus
                    />
                )}
                <div className="flex justify-end gap-2 mt-3">
                    <button onClick={handleCancel} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                        <X size={18} />
                    </button>
                    <button onClick={handleSave} className="p-1 text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 rounded-full">
                        <Check size={18} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className={`group cursor-pointer relative border border-transparent hover:border-gray-200 hover:bg-gray-50 rounded-lg p-2 -ml-2 transition-all ${className}`}
        >
            {label && <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</label>}
            <div className={`${isRich ? 'text-sm text-gray-600 leading-relaxed whitespace-pre-wrap' : 'text-lg font-medium text-gray-800'}`}>
                {savedValue || <span className="text-gray-400 italic">{placeholder || 'Clique para adicionar texto...'}</span>}
            </div>

            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Pencil size={14} className="text-gray-400" />
            </div>
        </div>
    );
};
