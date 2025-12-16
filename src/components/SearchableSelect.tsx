import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SearchableSelectOption {
    value: string;
    label: string;
    subLabel?: string; // Cargo ou ID
}

interface SearchableSelectProps {
    options: SearchableSelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export const SearchableSelect = ({
    options,
    value,
    onChange,
    placeholder = "Selecione...",
    className = "",
    disabled = false
}: SearchableSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input when opened
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            // Small timeout to allow render
            setTimeout(() => searchInputRef.current?.focus(), 50);
        } else {
            setSearchTerm(''); // Reset search when closed
        }
    }, [isOpen]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const lowerTerm = searchTerm.toLowerCase();
        return options.filter(opt =>
            opt.label.toLowerCase().includes(lowerTerm) ||
            (opt.subLabel && opt.subLabel.toLowerCase().includes(lowerTerm))
        );
    }, [options, searchTerm]);

    const selectedOption = options.find(o => o.value === value);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between
                    bg-white border text-left cursor-pointer
                    rounded-lg shadow-sm
                    py-2.5 px-3 text-sm
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                    ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-gray-300'}
                    ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-50'}
                `}
            >
                <span className={`block truncate ${!selectedOption ? 'text-gray-400' : 'text-gray-900'}`}>
                    {selectedOption
                        ? `${selectedOption.label}${selectedOption.subLabel ? ` (${selectedOption.subLabel})` : ''}`
                        : placeholder
                    }
                </span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-100 min-w-[250px]">
                    {/* Search Field */}
                    <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-gray-400"
                                placeholder="Pesquisar..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <ul className="max-h-60 overflow-auto py-1">
                        {filteredOptions.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-gray-500 text-center italic">
                                Nenhum resultado encontrado.
                            </li>
                        ) : (
                            filteredOptions.map(option => (
                                <li
                                    key={option.value}
                                    onClick={() => handleSelect(option.value)}
                                    className={`
                                        cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50
                                        ${option.value === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-900'}
                                    `}
                                >
                                    <div className="flex flex-col">
                                        <span className="block truncate text-sm">{option.label}</span>
                                        {option.subLabel && (
                                            <span className={`block truncate text-xs ${option.value === value ? 'text-indigo-500' : 'text-gray-400'}`}>
                                                {option.subLabel}
                                            </span>
                                        )}
                                    </div>

                                    {option.value === value && (
                                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600">
                                            <Check size={16} />
                                        </span>
                                    )}
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};
