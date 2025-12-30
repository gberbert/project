import React, { useRef } from 'react';
import { FileUp, Menu, FolderInput, Download } from 'lucide-react';

interface TopMenuBarProps {
    onImport: (file: File) => void;
    onExport?: () => void;
    onExportProposal?: () => void;
}

export const TopMenuBar: React.FC<TopMenuBarProps> = ({ onImport, onExport, onExportProposal }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onImport(e.target.files[0]);
            // Reset to allow selecting same file again
            e.target.value = '';
        }
    };

    return (
        <div className="bg-white border-b border-gray-200 px-4 flex items-center justify-between shadow-sm z-50 relative h-10">
            <div className="flex items-center gap-6">
                {/* Brand / Logo Area could go here if needed, but we keep it minimal */}

                {/* Menus */}
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <button className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo-600 px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">
                            <FolderInput size={18} />
                            Arquivo
                        </button>

                        {/* Dropdown */}
                        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-100 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-left z-50">
                            <div className="p-1">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors"
                                >
                                    <FileUp size={16} />
                                    <span>Importar Project (.xml)</span>
                                </button>
                                {onExport && (
                                    <button
                                        onClick={onExport}
                                        className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors"
                                    >
                                        <Download size={16} />
                                        <span>Exportar Project (.xml)</span>
                                    </button>
                                )}
                                <div className="h-px bg-gray-100 my-1"></div>
                                {onExportProposal && (
                                    <button
                                        onClick={onExportProposal}
                                        className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors"
                                    >
                                        <Download size={16} className="text-orange-500" />
                                        <span>Baixar Proposta (.pptx)</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="relative group">
                        <button className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo-600 px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">
                            Ajuda
                        </button>
                    </div>
                </div>
            </div>

            {/* Hidden Input */}
            <input
                type="file"
                accept=".xml"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
            />
        </div>
    );
};
