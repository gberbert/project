import { useState, useEffect, useCallback } from 'react';
import { Save, Eye, EyeOff, Check, Shield, ShieldAlert, Settings as SettingsIcon, FileText, RotateCcw, Info, LayoutTemplate, Image as ImageIcon, GripVertical, Trash2, Plus, Upload, X, Bot, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppUser } from '../types/auth';
import { DEFAULT_CONTEXT_RULES, DEFAULT_INTERVIEWER_INSTRUCTION, DEFAULT_INITIAL_UNDERSTANDING_PROMPT, DEFAULT_ARCHITECTURE_PROMPT, geminiService } from '../services/geminiService';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDropzone } from 'react-dropzone';
import { saveImage, deleteImage, getImage } from '../lib/slideStorage';

// --- Interfaces ---

interface OverlayText {
    id: string;
    text: string;
    x: number; // inches (0-10)
    y: number; // inches (0-5.625)
    fontSize: number; // points
    color: string; // hex
    bold?: boolean;
    width?: number; // inches
    height?: number; // inches
}

interface SlideConfig {
    id: string;
    type: 'custom' | 'automatic';
    name: string;
    imageId?: string;
    overlays?: OverlayText[];
}

interface BrandingConfig {
    logoId?: string;
    logoWidth?: number;
    logoHeight?: number;
    logoX?: number;
    logoY?: number;
    titleX?: number;
    titleY?: number;
    lineX?: number;
    lineY?: number;
    lineWidth?: number;
    headerId?: string;
    footerId?: string;
}

interface TemplateConfig {
    slides: SlideConfig[];
    branding: BrandingConfig;
}

const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
    slides: [
        { id: 'auto-1', type: 'automatic', name: 'Conteúdo Gerado (Cronograma, Documentação, etc.)' }
    ],
    branding: {}
};

// --- Sub-Components ---

const SlideOverlayEditor = ({ slide, preview, branding, logoPreview, onClose, onSave }: { slide: SlideConfig, preview?: string, branding?: BrandingConfig, logoPreview?: string | null, onClose: () => void, onSave: (overlays: OverlayText[], branding?: BrandingConfig) => void }) => {
    const isAuto = slide.type === 'automatic';
    const [overlays, setOverlays] = useState<OverlayText[]>(slide.overlays || []);
    const [localBranding, setLocalBranding] = useState<BrandingConfig>(branding || {});
    const [logoRatio, setLogoRatio] = useState<number | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Drag State
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
    const [elemStart, setElemStart] = useState<{ x: number, y: number } | null>(null);

    const handleAddText = () => {
        const newText: OverlayText = {
            id: Date.now().toString(),
            text: "Novo Texto",
            x: 1.0,
            y: 1.0,
            fontSize: 18,
            color: "000000",
            bold: false,
            width: 8.0
        };
        setOverlays([...overlays, newText]);
        setSelectedId(newText.id);
    };

    const handleUpdate = (id: string, updates: Partial<OverlayText>) => {
        setOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
    };

    const handleDelete = (id: string) => {
        setOverlays(prev => prev.filter(o => o.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    // Drag Handlers
    const handleMouseDown = (e: React.MouseEvent, id: string, startX: number, startY: number) => {
        e.stopPropagation();
        setSelectedId(id);
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setElemStart({ x: startX, y: startY });
    };

    // Sync branding prop
    useEffect(() => {
        if (branding) {
            setLocalBranding(branding);
            if (branding.logoWidth && branding.logoHeight) {
                setLogoRatio(branding.logoWidth / branding.logoHeight);
            }
        }
    }, [branding]);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !dragStart || !elemStart || !selectedId) return;

        const dxPx = e.clientX - dragStart.x;
        const dyPx = e.clientY - dragStart.y;
        const pxPerInch = 100; // 1000px / 10in

        const dxIn = dxPx / pxPerInch;
        const dyIn = dyPx / pxPerInch;

        if (selectedId === 'logo') {
            setLocalBranding(prev => ({
                ...prev,
                logoX: Math.max(0, parseFloat((elemStart.x + dxIn).toFixed(2))),
                logoY: Math.max(0, parseFloat((elemStart.y + dyIn).toFixed(2)))
            }));
        } else {
            setOverlays(prev => prev.map(o => o.id === selectedId ? {
                ...o,
                x: Math.max(0, parseFloat((elemStart.x + dxIn).toFixed(2))),
                y: Math.max(0, parseFloat((elemStart.y + dyIn).toFixed(2)))
            } : o));
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragStart(null);
        setElemStart(null);
    };

    const selected = selectedId === 'logo' ? null : overlays.find(o => o.id === selectedId);

    const handleSaveClick = () => {
        if (isAuto) {
            onSave([], localBranding); // Pass empty overlays (auto slides don't have custom text overlays usually, or keep them empty)
        } else {
            onSave(overlays);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
        >
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Editar Layout: {slide.name}</h3>
                        <p className="text-xs text-gray-500">
                            {isAuto
                                ? "Arraste o logo para posicionar. Ajuste configurações na barra lateral."
                                : "Adicione textos dinâmicos. Arraste para mover."}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                        <button onClick={handleSaveClick} className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-2">
                            <Save size={16} /> Salvar Alterações
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Canvas Area */}
                    <div className="flex-1 bg-gray-200 p-8 flex items-center justify-center overflow-auto relative select-none">
                        {/* Slide Container 16:9 */}
                        <div
                            className="relative bg-white shadow-lg overflow-hidden"
                            style={{
                                width: '1000px',
                                aspectRatio: '16/9',
                                backgroundImage: !isAuto && preview ? `url(${preview})` : 'none',
                                backgroundSize: 'cover',
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'center',
                            }}
                        >
                            {/* Auto Slide Branding Elements */}
                            {/* Auto Slide Branding Elements */}
                            {isAuto && (
                                <>
                                    {logoPreview && (
                                        <div
                                            onMouseDown={(e) => handleMouseDown(e, 'logo', localBranding.logoX ?? 8.4, localBranding.logoY ?? 0.15)}
                                            // FORCE VISIBLE BORDER for debug
                                            className={`absolute cursor-move border-2 border-dashed ${selectedId === 'logo' ? 'border-indigo-600 z-10' : 'border-red-500/50 hover:border-red-600'} transition-colors`}
                                            style={{
                                                left: `${((localBranding.logoX ?? 8.4) / 10) * 100}%`,
                                                top: `${((localBranding.logoY ?? 0.15) / 5.625) * 100}%`,
                                                width: `${((localBranding.logoWidth ?? 1.5) / 10) * 100}%`,
                                                minHeight: '20px', // Ensure visibility if img fails
                                                backgroundColor: 'rgba(255,0,0,0.05)' // Verify position
                                            }}
                                        >
                                            <img
                                                src={logoPreview}
                                                alt="Logo"
                                                className="w-full h-auto pointer-events-none"
                                                onLoad={(e) => {
                                                    const r = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight;
                                                    if (r && !isNaN(r)) setLogoRatio(r);
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Draggable Title */}
                                    <div
                                        onMouseDown={(e) => handleMouseDown(e, 'title', localBranding.titleX ?? 0.5, localBranding.titleY ?? 0.5)}
                                        className={`absolute cursor-move border-2 border-dashed ${selectedId === 'title' ? 'border-indigo-600 z-10' : 'border-gray-200 hover:border-gray-400'}`}
                                        style={{
                                            left: `${((localBranding.titleX ?? 0.5) / 10) * 100}%`,
                                            top: `${((localBranding.titleY ?? 0.5) / 5.625) * 100}%`,
                                            right: '5%', // Pin to right edge (approx 0.5in)
                                            width: 'auto',
                                            height: 'auto',
                                        }}
                                    >
                                        <h1
                                            className="font-bold pointer-events-none whitespace-nowrap leading-none"
                                            style={{
                                                fontSize: '26px', // 20pt matches PPT
                                                color: '#00204A', // Matches PPT COLOR_PRIMARY
                                                fontFamily: 'Arial, sans-serif'
                                            }}
                                        >
                                            Solução Técnica & Escopo
                                        </h1>
                                    </div>

                                    {/* Draggable Divider Line */}
                                    <div
                                        onMouseDown={(e) => handleMouseDown(e, 'line', localBranding.lineX ?? 0.5, localBranding.lineY ?? 0.9)}
                                        className={`absolute cursor-move border-2 border-dashed ${selectedId === 'line' ? 'border-indigo-600 z-10' : 'border-gray-200 hover:border-gray-400'} flex items-start justify-center`}
                                        style={{
                                            left: `${((localBranding.lineX ?? 0.5) / 10) * 100}%`,
                                            top: `${((localBranding.lineY ?? 0.9) / 5.625) * 100}%`,
                                            width: `${((localBranding.lineWidth ?? 9.0) / 10) * 100}%`,
                                            height: '24px', // Hit area
                                        }}
                                    >
                                        <div className="w-full pointer-events-none rounded-full mt-0" style={{ height: '3px', backgroundColor: '#0072BC' }} />
                                    </div>
                                </>
                            )}

                            {/* Text Overlays */}
                            {!isAuto && overlays.map(ol => (
                                <div
                                    key={ol.id}
                                    onMouseDown={(e) => handleMouseDown(e, ol.id, ol.x, ol.y)}
                                    className={`absolute cursor-move border hover:border-indigo-300 transition-colors ${selectedId === ol.id ? 'border-indigo-600 ring-1 ring-indigo-600 z-10' : 'border-transparent'}`}
                                    style={{
                                        left: `${(ol.x / 10) * 100}%`,
                                        top: `${(ol.y / 5.625) * 100}%`,
                                        fontSize: `${ol.fontSize}px`,
                                        color: `#${ol.color}`,
                                        fontWeight: ol.bold ? 'bold' : 'normal',
                                        width: ol.width ? `${(ol.width / 10) * 100}%` : 'auto',
                                        height: ol.height ? `${(ol.height / 5.625) * 100}%` : 'auto',
                                        whiteSpace: ol.width ? 'normal' : 'nowrap',
                                        wordWrap: 'break-word',
                                        lineHeight: '1.2'
                                    }}
                                >
                                    {ol.text}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar Controls */}
                    <div className="w-80 bg-white border-l border-gray-200 p-4 flex flex-col gap-6 overflow-y-auto">
                        {!isAuto && (
                            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
                                <button onClick={handleAddText} className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm">
                                    <Plus size={16} /> Adicionar Texto
                                </button>
                            </div>
                        )}

                        {isAuto && selectedId === 'logo' && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
                                <h4 className="text-sm font-bold text-gray-900 border-b pb-2">Editar Logo</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">X (pol)</label>
                                        <input
                                            type="number" step="0.1"
                                            value={localBranding.logoX ?? 8.4}
                                            onChange={e => setLocalBranding(p => ({ ...p, logoX: parseFloat(e.target.value) }))}
                                            className="w-full px-2 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">Y (pol)</label>
                                        <input
                                            type="number" step="0.1"
                                            value={localBranding.logoY ?? 0.15}
                                            onChange={e => setLocalBranding(p => ({ ...p, logoY: parseFloat(e.target.value) }))}
                                            className="w-full px-2 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Largura (pol)</label>
                                    <input
                                        type="number" step="0.1"
                                        value={localBranding.logoWidth ?? 1.5}
                                        onChange={e => {
                                            const val = Math.max(0.1, parseFloat(e.target.value));
                                            setLocalBranding(p => ({
                                                ...p,
                                                logoWidth: val,
                                                logoHeight: logoRatio ? val / logoRatio : p.logoHeight
                                            }));
                                        }}
                                        className="w-full px-2 py-2 border rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {isAuto && selectedId === 'title' && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
                                <h4 className="text-sm font-bold text-gray-900 border-b pb-2">Editar Título</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">X (pol)</label>
                                        <input
                                            type="number" step="0.1"
                                            value={localBranding.titleX ?? 0.5}
                                            onChange={e => setLocalBranding(p => ({ ...p, titleX: parseFloat(e.target.value) }))}
                                            className="w-full px-2 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">Y (pol)</label>
                                        <input
                                            type="number" step="0.1"
                                            value={localBranding.titleY ?? 0.5}
                                            onChange={e => setLocalBranding(p => ({ ...p, titleY: parseFloat(e.target.value) }))}
                                            className="w-full px-2 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {isAuto && selectedId === 'line' && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
                                <h4 className="text-sm font-bold text-gray-900 border-b pb-2">Editar Linha Divisória</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">X (pol)</label>
                                        <input
                                            type="number" step="0.1"
                                            value={localBranding.lineX ?? 0.5}
                                            onChange={e => setLocalBranding(p => ({ ...p, lineX: parseFloat(e.target.value) }))}
                                            className="w-full px-2 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">Y (pol)</label>
                                        <input
                                            type="number" step="0.1"
                                            value={localBranding.lineY ?? 0.9}
                                            onChange={e => setLocalBranding(p => ({ ...p, lineY: parseFloat(e.target.value) }))}
                                            className="w-full px-2 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Largura (pol)</label>
                                    <input
                                        type="number" step="0.1"
                                        value={localBranding.lineWidth ?? 9.0}
                                        onChange={e => setLocalBranding(p => ({ ...p, lineWidth: parseFloat(e.target.value) }))}
                                        className="w-full px-2 py-2 border rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {selected ? (
                            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
                                <h4 className="text-sm font-bold text-gray-900 border-b pb-2">Editar Texto Selecionado</h4>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Conteúdo</label>
                                    <input
                                        type="text"
                                        value={selected.text}
                                        onChange={e => handleUpdate(selected.id, { text: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors outline-none focus:ring-2 focus:ring-indigo-500"
                                    />

                                    {/* Variable Injectors */}
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <button
                                            onClick={() => handleUpdate(selected.id, { text: selected.text + "{cliente}" })}
                                            className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded text-[10px] font-medium transition-colors"
                                            title="Nome do Cliente"
                                        >
                                            + {`{cliente}`}
                                        </button>
                                        <button
                                            onClick={() => handleUpdate(selected.id, { text: selected.text + "{projeto}" })}
                                            className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded text-[10px] font-medium transition-colors"
                                            title="Nome do Projeto"
                                        >
                                            + {`{projeto}`}
                                        </button>
                                        <button
                                            onClick={() => handleUpdate(selected.id, { text: selected.text + "{data}" })}
                                            className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded text-[10px] font-medium transition-colors"
                                            title="Data Atual (DD/MM/AAAA)"
                                        >
                                            + {`{data}`}
                                        </button>
                                        <button
                                            onClick={() => handleUpdate(selected.id, { text: selected.text + "{contexto}" })}
                                            className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded text-[10px] font-medium transition-colors"
                                            title="Conteúdo: Context Overview"
                                        >
                                            + {`{contexto}`}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">Variáveis serão preenchidas ao gerar o PPT.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">X (pol)</label>
                                        <input
                                            type="number" step="0.1"
                                            value={selected.x}
                                            onChange={e => handleUpdate(selected.id, { x: parseFloat(e.target.value) })}
                                            className="w-full px-2 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">Y (pol)</label>
                                        <input
                                            type="number" step="0.1"
                                            value={selected.y}
                                            onChange={e => handleUpdate(selected.id, { y: parseFloat(e.target.value) })}
                                            className="w-full px-2 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">W (pol)</label>
                                        <input
                                            type="number" step="0.1"
                                            value={selected.width && selected.width > 0 ? selected.width : ''}
                                            onChange={e => handleUpdate(selected.id, { width: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-2 py-2 border rounded-lg text-sm"
                                            placeholder="Auto"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">H (pol)</label>
                                        <input
                                            type="number" step="0.1"
                                            value={selected.height && selected.height > 0 ? selected.height : ''}
                                            onChange={e => handleUpdate(selected.id, { height: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-2 py-2 border rounded-lg text-sm"
                                            placeholder="Auto"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">Tamanho (pt)</label>
                                        <input
                                            type="number"
                                            value={selected.fontSize}
                                            onChange={e => handleUpdate(selected.id, { fontSize: parseInt(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500">Cor (Hex)</label>
                                        <div className="flex items-center gap-2">
                                            {/* Color Picker */}
                                            <div className="relative w-8 h-8 rounded border border-gray-300 overflow-hidden shrink-0 cursor-pointer">
                                                <input
                                                    type="color"
                                                    value={`#${selected.color}`}
                                                    onChange={e => handleUpdate(selected.id, { color: e.target.value.replace('#', '').toUpperCase() })}
                                                    className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 p-0 m-0 border-0 cursor-pointer"
                                                />
                                            </div>
                                            {/* Hex Input */}
                                            <input
                                                type="text"
                                                value={selected.color}
                                                onChange={e => handleUpdate(selected.id, { color: e.target.value.replace('#', '').toUpperCase() })}
                                                className="w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase"
                                                maxLength={6}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={selected.bold}
                                            onChange={e => handleUpdate(selected.id, { bold: e.target.checked })}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Negrito
                                    </label>
                                </div>

                                <button
                                    onClick={() => handleDelete(selected.id)}
                                    className="w-full mt-4 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={14} /> Excluir Texto
                                </button>
                            </div>
                        ) : (!isAuto && (
                            <div className="text-center text-gray-400 mt-10 text-sm">
                                Selecione um texto para editar
                            </div>
                        ))}

                        {isAuto && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <h5 className="text-xs font-bold text-gray-500 mb-2 uppercase">Ferramentas de Logo</h5>
                                <div className="text-[10px] text-gray-400 font-mono mb-2">
                                    Pos: {localBranding.logoX?.toFixed(2) ?? '?'}" x {localBranding.logoY?.toFixed(2) ?? '?'}"
                                </div>
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <button
                                        onClick={() => setLocalBranding(p => ({ ...p, logoX: 8.4, logoY: 0.15 }))}
                                        className="py-1 px-2 bg-gray-50 text-gray-600 rounded text-[10px] hover:bg-gray-100 border border-gray-200"
                                    >
                                        Resetar (Canto)
                                    </button>
                                    <button
                                        onClick={() => setLocalBranding(p => ({ ...p, logoX: 4, logoY: 2.5 }))}
                                        className="py-1 px-2 bg-gray-50 text-gray-600 rounded text-[10px] hover:bg-gray-100 border border-gray-200"
                                    >
                                        Mover Centro
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (logoRatio && localBranding.logoWidth) {
                                                setLocalBranding(p => ({ ...p, logoHeight: p.logoWidth! / logoRatio }));
                                            }
                                        }}
                                        className="col-span-2 py-1 px-2 bg-indigo-50 text-indigo-700 rounded text-[10px] hover:bg-indigo-100 border border-indigo-200 font-bold"
                                    >
                                        Corrigir Proporção (Original)
                                    </button>
                                </div>
                            </div>
                        )}

                        {isAuto && !selectedId && (
                            <div className="text-center text-gray-400 mt-2 text-xs px-4">
                                {logoPreview
                                    ? "O logo está destacado com borda vermelha/azul para facilitar a localização."
                                    : (
                                        <div className="text-red-500">
                                            Nenhum logo disponível.<br />
                                            Carregue um logo na seção "Branding Global".
                                        </div>
                                    )
                                }
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Sortable List Item
const SortableSlideItem = ({ slide, onDelete, onEdit, preview }: { slide: SlideConfig; onDelete: (id: string) => void; onEdit?: (slide: SlideConfig) => void; preview?: string }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: slide.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 9999 : 'auto',
    };

    const isAuto = slide.type === 'automatic';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-3 p-3 rounded-lg border mb-2 ${isDragging ? 'shadow-lg ring-2 ring-indigo-500 bg-white' : 'bg-white border-gray-200'}`}
        >
            <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600 p-1">
                <GripVertical size={20} />
            </div>

            <div className={`p-1 rounded overflow-hidden flex-shrink-0 border border-gray-100 ${isAuto ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                {preview ? (
                    <img src={preview} alt="Slide Preview" className="h-10 w-16 object-cover rounded-sm" />
                ) : (
                    <div className={`h-10 w-16 flex items-center justify-center ${isAuto ? 'text-indigo-400' : 'text-gray-300'}`}>
                        {isAuto ? <LayoutTemplate size={20} /> : <ImageIcon size={20} />}
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isAuto ? 'text-indigo-900' : 'text-gray-900'}`}>
                    {slide.name}
                </p>
                {slide.type === 'automatic' && (
                    <span className="text-[10px] text-indigo-500 uppercase font-bold tracking-wider">Sistema</span>
                )}
                {slide.type === 'custom' && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">Slide Fixo (Imagem)</span>
                        {slide.overlays && slide.overlays.length > 0 && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
                                {slide.overlays.length} textos
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={() => onEdit && onEdit(slide)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    title={isAuto ? "Editar Layout/Branding" : "Editar Textos Sobrepostos"}
                >
                    {isAuto ? <LayoutTemplate size={18} /> : <FileText size={18} />}
                </button>
                {!isAuto && (
                    <button
                        onClick={() => onDelete(slide.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Excluir Slide"
                    >
                        <Trash2 size={18} />
                    </button>
                )}
            </div>
        </div>
    );
};

export const SettingsView = () => {
    const { user, isAdmin, approveUser, toggleAI } = useAuth();
    const [activeTab, setActiveTab] = useState<'general' | 'prompts' | 'template'>('general');

    // Config State
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [message, setMessage] = useState('');

    // Model Config State
    const [textModel, setTextModel] = useState('gemini-1.5-flash');
    const [imageModel, setImageModel] = useState('gemini-3-pro-image-preview');

    // Prompts State
    const [customContextRules, setCustomContextRules] = useState('');
    const [interviewerPrompt, setInterviewerPrompt] = useState('');
    const [initialPrompt, setInitialPrompt] = useState('');
    const [architecturePrompt, setArchitecturePrompt] = useState('');
    const [activePromptTab, setActivePromptTab] = useState<'initial' | 'generation' | 'interviewer' | 'architecture'>('initial');

    // Template & Users State
    const [templateConfig, setTemplateConfig] = useState<TemplateConfig>(DEFAULT_TEMPLATE_CONFIG);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [editingSlide, setEditingSlide] = useState<string | null>(null);
    const [users, setUsers] = useState<AppUser[]>([]);
    useEffect(() => {
        const storedKey = localStorage.getItem('GEMINI_API_KEY');
        if (storedKey) setApiKey(storedKey);

        const storedTextModel = localStorage.getItem('GEMINI_TEXT_MODEL');
        if (storedTextModel) setTextModel(storedTextModel);

        const storedImageModel = localStorage.getItem('GEMINI_IMAGE_MODEL');
        if (storedImageModel) setImageModel(storedImageModel);

        const storedRules = localStorage.getItem('GEMINI_CUSTOM_CONTEXT_RULES');
        setCustomContextRules(storedRules || DEFAULT_CONTEXT_RULES);

        const storedInterviewer = localStorage.getItem('GEMINI_INTERVIEWER_RULES');
        setInterviewerPrompt(storedInterviewer || DEFAULT_INTERVIEWER_INSTRUCTION);

        const storedInitial = localStorage.getItem('GEMINI_INITIAL_UNDERSTANDING_PROMPT');
        setInitialPrompt(storedInitial || DEFAULT_INITIAL_UNDERSTANDING_PROMPT);

        const storedArchitecture = localStorage.getItem('GEMINI_ARCHITECTURE_PROMPT');
        setArchitecturePrompt(storedArchitecture || DEFAULT_ARCHITECTURE_PROMPT);

        const storedTemplate = localStorage.getItem('PPT_TEMPLATE_CONFIG');
        if (storedTemplate) {
            try {
                const parsed = JSON.parse(storedTemplate);
                // Ensure Auto Slide exists
                if (!parsed.slides.find((s: SlideConfig) => s.type === 'automatic')) {
                    parsed.slides.push(DEFAULT_TEMPLATE_CONFIG.slides[0]);
                }
                setTemplateConfig(parsed);
                // Load Logo Preview
                if (parsed.branding?.logoId) {
                    getImage(parsed.branding.logoId).then(setLogoPreview);
                }
            } catch (e) {
                console.error("Failed to load template config", e);
            }
        }
    }, []);

    // Auto-save Prompts
    useEffect(() => {
        localStorage.setItem('GEMINI_CUSTOM_CONTEXT_RULES', customContextRules);
    }, [customContextRules]);

    useEffect(() => {
        localStorage.setItem('GEMINI_INITIAL_UNDERSTANDING_PROMPT', initialPrompt);
    }, [initialPrompt]);

    useEffect(() => {
        localStorage.setItem('GEMINI_INTERVIEWER_RULES', interviewerPrompt);
    }, [interviewerPrompt]);

    useEffect(() => {
        localStorage.setItem('GEMINI_ARCHITECTURE_PROMPT', architecturePrompt);
    }, [architecturePrompt]);

    // Auto-save Template Config changes
    useEffect(() => {
        if (templateConfig !== DEFAULT_TEMPLATE_CONFIG) {
            localStorage.setItem('PPT_TEMPLATE_CONFIG', JSON.stringify(templateConfig));
        }
    }, [templateConfig]);

    // State for Slide Previews (thumbnails)
    const [slidePreviews, setSlidePreviews] = useState<Record<string, string>>({});

    // Fetch slide previews when list changes
    useEffect(() => {
        const fetchPreviews = async () => {
            const newPreviews: Record<string, string> = {};
            let hasChanges = false;

            for (const slide of templateConfig.slides) {
                if (slide.type === 'custom' && slide.imageId && !slidePreviews[slide.id]) {
                    try {
                        const imgData = await getImage(slide.imageId);
                        if (imgData) {
                            newPreviews[slide.id] = imgData;
                            hasChanges = true;
                        }
                    } catch (e) {
                        console.error(`Failed to load preview for slide ${slide.id}`, e);
                    }
                }
            }

            if (hasChanges) {
                setSlidePreviews(prev => ({ ...prev, ...newPreviews }));
            }
        };

        if (activeTab === 'template') {
            fetchPreviews();
        }
    }, [templateConfig.slides, slidePreviews, activeTab]);

    // Subscribe to users if Admin
    useEffect(() => {
        if (!isAdmin) return;

        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => d.data() as AppUser);
            setUsers(list);
        });
        return () => unsubscribe();
    }, [isAdmin]);

    // DND Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setTemplateConfig((items) => {
                const oldIndex = items.slides.findIndex((i) => i.id === active.id);
                const newIndex = items.slides.findIndex((i) => i.id === over.id);
                const newSlides = arrayMove(items.slides, oldIndex, newIndex);
                return { ...items, slides: newSlides };
            });
        }
    };

    const onDropSlide = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        // Handle all dropped files
        for (const file of acceptedFiles) {
            const id = `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const imageId = `img-${id}`;

            try {
                await saveImage(imageId, file);
                const newSlide: SlideConfig = {
                    id,
                    type: 'custom',
                    name: file.name.replace(/\.[^/.]+$/, ""), // remove extension
                    imageId
                };
                setTemplateConfig(prev => ({
                    ...prev,
                    slides: [...prev.slides, newSlide]
                }));
            } catch (e) {
                console.error(e);
                alert(`Erro ao salvar imagem do slide ${file.name}.`);
            }
        }
    }, []);

    const { getRootProps: getSlideRootProps, getInputProps: getSlideInputProps } = useDropzone({
        onDrop: onDropSlide,
        accept: { 'image/*': [] },
        // maxFiles removed to allow multiple
        multiple: true
    });

    const handleDeleteBranding = async (type: 'logo' | 'header' | 'footer') => {
        const imageId = templateConfig.branding[`${type}Id` as keyof BrandingConfig];
        if (imageId && typeof imageId === 'string') {
            try {
                await deleteImage(imageId);
            } catch (e) {
                console.error("Error deleting branding image", e);
            }
        }

        setTemplateConfig(prev => {
            const newBranding = { ...prev.branding };
            delete newBranding[`${type}Id` as keyof BrandingConfig];
            if (type === 'logo') {
                delete newBranding.logoWidth;
                delete newBranding.logoHeight;
            }
            return {
                ...prev,
                branding: newBranding
            };
        });

        if (type === 'logo') setLogoPreview(null);
    };

    const handleSaveOverlays = (overlays: OverlayText[], updatedBranding?: BrandingConfig) => {
        if (!editingSlide) return;

        setTemplateConfig(prev => ({
            ...prev,
            slides: prev.slides.map(s => s.id === editingSlide ? { ...s, overlays } : s),
            branding: updatedBranding ? { ...prev.branding, ...updatedBranding } : prev.branding
        }));
        setEditingSlide(null);
    };

    const handleBrandingUpload = async (type: 'logo' | 'header' | 'footer', files: File[]) => {
        if (files.length === 0) return;
        const file = files[0];
        const imageId = `brand-${type}`;

        try {
            await saveImage(imageId, file);

            let dims = {};
            if (type === 'logo') {
                // Calculate Dimensions
                const reader = new FileReader();
                reader.readAsDataURL(file);
                await new Promise<void>((resolve) => {
                    reader.onload = (e) => {
                        const img = new Image();
                        img.src = e.target?.result as string;
                        img.onload = () => {
                            const targetH = 0.5;
                            const ratio = img.naturalWidth / img.naturalHeight;
                            const targetW = targetH * ratio;

                            dims = { logoWidth: targetW, logoHeight: targetH };
                            resolve();
                        };
                    };
                });
            }

            setTemplateConfig(prev => ({
                ...prev,
                branding: { ...prev.branding, [`${type}Id`]: imageId, ...dims }
            }));

            if (type === 'logo') {
                const preview = await getImage(imageId);
                setLogoPreview(preview);
            }
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar imagem de branding.");
        }
    };

    const handleDeleteSlide = async (id: string, imageId?: string) => {
        if (confirm("Remover este slide?")) {
            if (imageId) await deleteImage(imageId);
            setTemplateConfig(prev => ({
                ...prev,
                slides: prev.slides.filter(s => s.id !== id)
            }));
        }
    };

    const handleSave = () => {
        localStorage.setItem('GEMINI_API_KEY', apiKey);
        localStorage.setItem('GEMINI_TEXT_MODEL', textModel);
        localStorage.setItem('GEMINI_IMAGE_MODEL', imageModel);

        // Save Custom Rules
        if (customContextRules !== DEFAULT_CONTEXT_RULES) {
            localStorage.setItem('GEMINI_CUSTOM_CONTEXT_RULES', customContextRules);
        } else {
            localStorage.removeItem('GEMINI_CUSTOM_CONTEXT_RULES');
        }

        // Save Interviewer Rules
        if (interviewerPrompt !== DEFAULT_INTERVIEWER_INSTRUCTION) {
            localStorage.setItem('GEMINI_INTERVIEWER_RULES', interviewerPrompt);
        } else {
            localStorage.removeItem('GEMINI_INTERVIEWER_RULES');
        }

        // Save Initial Understanding Prompt
        if (initialPrompt !== DEFAULT_INITIAL_UNDERSTANDING_PROMPT) {
            localStorage.setItem('GEMINI_INITIAL_UNDERSTANDING_PROMPT', initialPrompt);
        } else {
            localStorage.removeItem('GEMINI_INITIAL_UNDERSTANDING_PROMPT');
        }

        // Save Template Config
        localStorage.setItem('PPT_TEMPLATE_CONFIG', JSON.stringify(templateConfig));

        // Re-initialize service with new config
        if (apiKey) {
            geminiService.initialize(apiKey);
        }

        setMessage('Configurações salvas com sucesso!');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleResetPrompt = () => {
        if (window.confirm("Tem certeza que deseja restaurar as regras originais do prompt selecionado?")) {
            if (activePromptTab === 'generation') {
                setCustomContextRules(DEFAULT_CONTEXT_RULES);
            } else if (activePromptTab === 'interviewer') {
                setInterviewerPrompt(DEFAULT_INTERVIEWER_INSTRUCTION);
            } else {
                setInitialPrompt(DEFAULT_INITIAL_UNDERSTANDING_PROMPT);
            }
        }
    };

    const handleToggleAccess = async (targetUid: string, currentStatus: boolean) => {
        try {
            await approveUser(targetUid, !currentStatus);
        } catch (e) {
            console.error(e);
            alert("Erro ao atualizar status.");
        }
    };

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${activeTab === id
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
                }`}
        >
            <Icon size={16} />
            {label}
        </button>
    );

    // Branding Dropzones
    const { getRootProps: getLogoProps, getInputProps: getLogoInput, isDragActive: isLogoDrag } = useDropzone({
        onDrop: (f) => handleBrandingUpload('logo', f), accept: { 'image/*': [] }, maxFiles: 1
    });

    const editingSlideObj = editingSlide ? templateConfig.slides.find(s => s.id === editingSlide) : null;

    return (
        <div className="w-full h-full flex flex-col bg-gray-50/30">
            {/* Header Sticky */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 md:p-6 border-b border-gray-100 bg-white shadow-sm z-10 shrink-0">
                <div className="mb-4 sm:mb-0">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">Configurações</h2>
                    <p className="text-sm text-gray-500">Gerencie acessos, integrações e comportamento da IA</p>
                </div>

                {/* Tabs Header */}
                <div className="flex gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200 overflow-x-auto max-w-full">
                    <TabButton id="general" label="Geral" icon={SettingsIcon} />
                    <TabButton id="template" label="Template PPT" icon={LayoutTemplate} />
                    <TabButton id="prompts" label="Prompt IA" icon={FileText} />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'general' && (
                    <div className="h-full overflow-y-auto p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="max-w-7xl mx-auto space-y-6">
                            {/* Access Management (Master Only) */}
                            {isAdmin && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6 border-b pb-4">
                                        <div className="p-2 bg-indigo-50 rounded-lg">
                                            <ShieldAlert className="text-indigo-600" size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">Gestão de Acessos</h3>
                                            <p className="text-sm text-gray-500">Aprovação de logins e controle de permissões</p>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                                <tr>
                                                    <th className="px-6 py-4 font-semibold">Usuário</th>
                                                    <th className="px-6 py-4 font-semibold">Email</th>
                                                    <th className="px-6 py-4 text-center font-semibold">Perfil</th>
                                                    <th className="px-6 py-4 text-center font-semibold">Acesso IA</th>
                                                    <th className="px-6 py-4 text-center font-semibold">Status</th>
                                                    <th className="px-6 py-4 text-right font-semibold">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {users.map(u => (
                                                    <tr key={u.uid} className="bg-white hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-gray-900">
                                                            <div className="flex items-center gap-2">
                                                                {u.displayName || 'Sem Nome'}
                                                                {u.uid === user?.uid && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">VOCÊ</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-500">{u.email}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold ${u.role === 'master' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                {u.role.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {u.role !== 'master' && (
                                                                <div className="flex justify-center">
                                                                    <label className="relative inline-flex items-center cursor-pointer group" title="Permitir uso de IA">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="sr-only peer"
                                                                            checked={u.canUseAI}
                                                                            onChange={() => toggleAI && toggleAI(u.uid, !u.canUseAI)}
                                                                        />
                                                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                                    </label>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {u.isApproved ? (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-bold text-xs border border-green-100">
                                                                    <Check size={12} /> Ativo
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-xs border border-amber-100 animate-pulse">
                                                                    <Shield size={12} /> Pendente
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {u.role !== 'master' && (
                                                                u.isApproved ? (
                                                                    <button
                                                                        onClick={() => handleToggleAccess(u.uid, true)}
                                                                        className="text-red-500 hover:text-red-700 font-medium text-xs border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded transition-colors"
                                                                    >
                                                                        Bloquear
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleToggleAccess(u.uid, false)}
                                                                        className="bg-green-600 text-white hover:bg-green-700 font-medium text-xs px-4 py-1.5 rounded shadow-sm shadow-green-200 transition-all transform active:scale-95"
                                                                    >
                                                                        Aprovar Acesso
                                                                    </button>
                                                                )
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* API Key Section */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <div className="p-1.5 bg-gray-100 rounded text-gray-600">
                                        <SettingsIcon size={20} />
                                    </div>
                                    Integrações & Chaves
                                </h3>

                                <div className="max-w-2xl">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Google Gemini API Key</label>
                                    <div className="relative group">
                                        <input
                                            type={showKey ? "text" : "password"}
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="Cole sua API Key do Google AI Studio aqui"
                                            className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono text-sm bg-gray-50 focus:bg-white"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                        Necessário para utilizar as funcionalidades de Estimativa Inteligente.
                                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline inline-flex items-center gap-0.5 ml-1">
                                            Obter chave <span className="text-[10px]">↗</span>
                                        </a>
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Modelo de Texto (LLM)</label>
                                            <input
                                                type="text"
                                                value={textModel}
                                                onChange={(e) => setTextModel(e.target.value)}
                                                placeholder="ex: gemini-1.5-flash"
                                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono text-sm bg-gray-50 focus:bg-white"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">Padrão: gemini-1.5-flash</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Modelo de Imagem (Futuro)</label>
                                            <input
                                                type="text"
                                                value={imageModel}
                                                onChange={(e) => setImageModel(e.target.value)}
                                                placeholder="ex: gemini-3-pro-image-preview"
                                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono text-sm bg-gray-50 focus:bg-white"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">Padrão: gemini-3-pro-image-preview</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'template' && (
                    <div className="h-full overflow-y-auto p-4 md:p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Left Column: Branding */}
                            <div className="lg:col-span-1 space-y-6">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        Branding Global
                                    </h3>
                                    <p className="text-xs text-gray-500 mb-6">Estes elementos serão aplicados aos Slides Automáticos.</p>

                                    <div className="space-y-4">
                                        {/* LOGO */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Logomarca (PNG)</label>
                                                {templateConfig.branding.logoId && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteBranding('logo');
                                                        }}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                                                        title="Remover Logo"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>

                                            <div {...getLogoProps()} className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors relative ${isLogoDrag ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                                <input {...getLogoInput()} />

                                                {logoPreview ? (
                                                    // Logo with Info Overlay
                                                    <div className="flex flex-col items-center gap-2 w-full">
                                                        <div className="h-24 w-full flex items-center justify-center bg-gray-50 rounded border border-gray-100 p-2">
                                                            <img src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain" />
                                                        </div>
                                                        <div className="w-full mt-2 pt-2 border-t border-gray-100 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
                                                            <div className="text-[10px] text-center text-gray-400 font-mono">
                                                                {(templateConfig.branding.logoWidth ?? 0).toFixed(2)}" x {(templateConfig.branding.logoHeight ?? 0).toFixed(2)}"
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Pos X (pol)</label>
                                                                    <input
                                                                        type="number" step="0.1"
                                                                        value={templateConfig.branding.logoX ?? 8.4}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value);
                                                                            setTemplateConfig(prev => ({ ...prev, branding: { ...prev.branding, logoX: val } }));
                                                                        }}
                                                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white"
                                                                        placeholder="8.4"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Pos Y (pol)</label>
                                                                    <input
                                                                        type="number" step="0.1"
                                                                        value={templateConfig.branding.logoY ?? 0.15}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value);
                                                                            setTemplateConfig(prev => ({ ...prev, branding: { ...prev.branding, logoY: val } }));
                                                                        }}
                                                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white"
                                                                        placeholder="0.15"
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase">Largura (pol)</label>
                                                                <input
                                                                    type="number" step="0.1"
                                                                    value={templateConfig.branding.logoWidth ?? 1.5}
                                                                    onChange={(e) => {
                                                                        const newW = parseFloat(e.target.value);
                                                                        if (newW > 0) {
                                                                            const currentW = templateConfig.branding.logoWidth || 1.5;
                                                                            const currentH = templateConfig.branding.logoHeight || 0.5;
                                                                            const ratio = currentW / currentH;
                                                                            const newH = newW / ratio;

                                                                            setTemplateConfig(prev => ({
                                                                                ...prev,
                                                                                branding: {
                                                                                    ...prev.branding,
                                                                                    logoWidth: newW,
                                                                                    logoHeight: newH
                                                                                }
                                                                            }));
                                                                        }
                                                                    }}
                                                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white"
                                                                />
                                                                <p className="text-[10px] text-gray-400 text-right">Altura Auto: {(templateConfig.branding.logoHeight ?? 0).toFixed(2)}"</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-gray-400 py-4">
                                                        <ImageIcon className="mx-auto mb-2" size={24} />
                                                        <span className="text-xs">Arraste logo aqui</span>
                                                    </div>
                                                )}

                                                {templateConfig.branding.logoId && !logoPreview && (
                                                    /* State where ID exists but preview loading/failed or not set yet? Shouldn't happen usually with preview state sync. */
                                                    <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-1"><Check size={8} /></div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Slides Manager */}
                            <div className="lg:col-span-2">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full min-h-[500px]">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">Estrutura de Slides</h3>
                                            <p className="text-sm text-gray-500">Defina a ordem do PPT Final. Arraste para reordenar.</p>
                                        </div>
                                        <div {...getSlideRootProps()} className="cursor-pointer">
                                            <input {...getSlideInputProps()} />
                                            <button className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-sm font-bold border border-indigo-200 transition-colors">
                                                <Plus size={16} /> Add Slide da Capa/Fim
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-200 overflow-y-auto">
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <SortableContext
                                                items={templateConfig.slides.map(s => s.id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                {templateConfig.slides.map((slide) => (
                                                    <SortableSlideItem
                                                        key={slide.id}
                                                        slide={slide}
                                                        onDelete={(id) => handleDeleteSlide(id, slide.imageId)}
                                                        onEdit={() => setEditingSlide(slide.id)}
                                                        preview={slidePreviews[slide.id]}
                                                    />
                                                ))}
                                            </SortableContext>
                                        </DndContext>

                                        {templateConfig.slides.length === 0 && (
                                            <div className="text-center py-10 text-gray-400">
                                                Nenhum slide configurado.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                )}

                {activeTab === 'prompts' && (
                    <div className="h-full flex flex-col p-4 md:p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                            {/* Prompt Type Tabs */}
                            <div className="flex border-b border-gray-100 bg-gray-50/50">
                                <button
                                    onClick={() => setActivePromptTab('initial')}
                                    className={`flex-1 py-3 px-4 text-sm font-bold transition-colors ${activePromptTab === 'initial' ? 'border-b-2 border-indigo-600 text-indigo-700 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                                >
                                    1. Entendimento Inicial
                                </button>
                                <button
                                    onClick={() => setActivePromptTab('interviewer')}
                                    className={`flex-1 py-3 px-4 text-sm font-bold transition-colors ${activePromptTab === 'interviewer' ? 'border-b-2 border-indigo-600 text-indigo-700 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                                >
                                    2. Entrevistador (Chat)
                                </button>
                                <button
                                    onClick={() => setActivePromptTab('generation')}
                                    className={`flex-1 py-3 px-4 text-sm font-bold transition-colors ${activePromptTab === 'generation' ? 'border-b-2 border-indigo-600 text-indigo-700 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                                >
                                    3. Documentação (Estimar)
                                </button>
                                <button
                                    onClick={() => setActivePromptTab('architecture')}
                                    className={`flex-1 py-3 px-4 text-sm font-bold transition-colors ${activePromptTab === 'architecture' ? 'border-b-2 border-indigo-600 text-indigo-700 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                                >
                                    4. Arquitetura (Imagem)
                                </button>
                            </div>

                            {/* Prompt Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-gray-100 bg-white gap-4">
                                <div>
                                    {activePromptTab === 'initial' ? (
                                        <>
                                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                <Sparkles size={20} className="text-indigo-600" />
                                                Validação de Entendimento (Fase 1)
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Prompt que orienta a IA a explicar o que entendeu do projeto ANTES de iniciar as perguntas.
                                            </p>
                                        </>
                                    ) : activePromptTab === 'interviewer' ? (
                                        <>
                                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                <Bot size={20} className="text-indigo-600" />
                                                Instruções do Sistema (Fase 2 - Chat)
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Define a personalidade, regras de perguntas e algoritmo de confiança da entrevista.
                                            </p>
                                        </>
                                    ) : activePromptTab === 'architecture' ? (
                                        <>
                                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                <ImageIcon size={20} className="text-indigo-600" />
                                                Prompt de Arquitetura (Fase 4 - Visual)
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Define como a IA deve instruir o modelo de imagem a gerar o diagrama de arquitetura.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                <FileText size={20} className="text-indigo-600" />
                                                Regras de Documentação (Fase 3 - Saída)
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Edite apenas as regras de geração da Documentação Técnica (Contexto) e Planejamento.
                                            </p>
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={handleResetPrompt}
                                    className="flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 px-3 py-2 rounded-lg transition-all shadow-sm"
                                    title="Restaurar regra padrão"
                                >
                                    <RotateCcw size={14} />
                                    Restaurar Padrão
                                </button>
                            </div>

                            {/* Prompt Editor */}
                            <div className="flex-1 relative group bg-indigo-50/10 flex flex-col">

                                {activePromptTab === 'generation' ? (
                                    <>
                                        {/* Top "Locked" Context hint */}
                                        <div className="px-6 py-2 bg-gray-100 border-b border-gray-200 text-xs text-gray-400 font-mono select-none flex items-center gap-2">
                                            <Info size={12} />
                                            [SISTEMA: Identidade, Regras SDLC e Formato JSON] (Não editável)
                                        </div>
                                        <div className="px-6 py-2 bg-indigo-100/50 border-b border-indigo-100 text-xs text-indigo-700 font-bold font-mono select-none uppercase tracking-wide">
                                            ↓ Suas regras de geração (Injetadas no prompt)
                                        </div>

                                        <textarea
                                            value={customContextRules}
                                            onChange={(e) => setCustomContextRules(e.target.value)}
                                            className="flex-1 w-full p-4 md:p-6 font-mono text-sm leading-relaxed text-indigo-900 bg-white outline-none resize-none selection:bg-indigo-100"
                                            placeholder="Digite as instruções para Contexto e Planejamento aqui..."
                                            spellCheck={false}
                                        />

                                        {/* Bottom "Locked" Context hint */}
                                        <div className="px-6 py-2 bg-gray-100 border-t border-gray-200 text-xs text-gray-400 font-mono select-none flex items-center gap-2">
                                            <Info size={12} />
                                            [SISTEMA: Exemplo de Saída JSON] (Não editável)
                                        </div>
                                    </>
                                ) : activePromptTab === 'architecture' ? (
                                    <>
                                        <div className="px-6 py-2 bg-indigo-100/50 border-b border-indigo-100 text-xs text-indigo-700 font-bold font-mono select-none uppercase tracking-wide">
                                            ↓ Prompt Gerador de Imagem (Meta-Prompt)
                                        </div>
                                        <textarea
                                            value={architecturePrompt}
                                            onChange={(e) => setArchitecturePrompt(e.target.value)}
                                            className="flex-1 w-full p-4 md:p-6 font-mono text-sm leading-relaxed text-indigo-900 bg-white outline-none resize-none selection:bg-indigo-100"
                                            placeholder="Digite as instruções para a IA criar o prompt da imagem..."
                                            spellCheck={false}
                                        />
                                    </>
                                ) : activePromptTab === 'interviewer' ? (
                                    <>
                                        <div className="px-6 py-2 bg-indigo-100/50 border-b border-indigo-100 text-xs text-indigo-700 font-bold font-mono select-none uppercase tracking-wide">
                                            ↓ Instrução de Sistema Completa (Substitui o padrão)
                                        </div>
                                        <textarea
                                            value={interviewerPrompt}
                                            onChange={(e) => setInterviewerPrompt(e.target.value)}
                                            className="flex-1 w-full p-4 md:p-6 font-mono text-sm leading-relaxed text-indigo-900 bg-white outline-none resize-none selection:bg-indigo-100"
                                            placeholder="Digite as instruções completas para o comportamento da IA..."
                                            spellCheck={false}
                                        />
                                    </>
                                ) : (
                                    <>
                                        <div className="px-6 py-2 bg-indigo-100/50 border-b border-indigo-100 text-xs text-indigo-700 font-bold font-mono select-none uppercase tracking-wide">
                                            ↓ Instrução para Fase de Entendimento Inicial (Validação)
                                        </div>
                                        <textarea
                                            value={initialPrompt}
                                            onChange={(e) => setInitialPrompt(e.target.value)}
                                            className="flex-1 w-full p-4 md:p-6 font-mono text-sm leading-relaxed text-indigo-900 bg-white outline-none resize-none selection:bg-indigo-100"
                                            placeholder="Digite as instruções para a IA resumir o projeto..."
                                            spellCheck={false}
                                        />
                                    </>
                                )}

                                {/* Stats Overlay */}
                                <div className="absolute top-24 right-8 pointer-events-none opacity-50 text-[10px] text-gray-400 bg-white/90 px-2 py-1 rounded border border-gray-100 backdrop-blur-sm z-10">
                                    {(activePromptTab === 'generation' ? customContextRules : activePromptTab === 'interviewer' ? interviewerPrompt : activePromptTab === 'architecture' ? architecturePrompt : initialPrompt).length} caracteres
                                </div>
                            </div>

                            {/* Prompt Footer/Meta */}
                            {activePromptTab === 'generation' && (
                                <div className="p-3 bg-blue-50 border-t border-blue-100 text-xs text-blue-800 flex items-start gap-2">
                                    <Info size={14} className="mt-0.5 shrink-0" />
                                    <span className="opacity-90 leading-relaxed">
                                        O texto acima será inserido no centro do Prompt do Sistema, entre as regras rígidas do sistema (SDLC) e o formato de saída JSON.
                                        Use isso para personalizar o estilo da documentação ou adicionar novas seções ao relatório.
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Global Actions Footer - Always visible */}
            <div className="p-4 md:p-6 border-t border-gray-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 shrink-0 flex justify-between items-center">
                <div className="flex-1">
                    {message && (
                        <span className="inline-flex items-center gap-2 text-green-700 bg-green-50 px-3 py-1.5 rounded-lg text-sm font-medium animate-in slide-in-from-left-2 fade-in">
                            <Check size={16} /> {message}
                        </span>
                    )}
                </div>

                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 transition-all font-bold transform active:scale-95"
                >
                    <Save size={18} />
                    Salvar Alterações
                </button>
            </div>

            {/* Overlay Editor Modal */}
            {/* Overlay Editor Modal */}
            {editingSlideObj && (
                <SlideOverlayEditor
                    slide={editingSlideObj}
                    preview={slidePreviews[editingSlideObj.id]}
                    branding={templateConfig.branding}
                    logoPreview={logoPreview}
                    onClose={() => setEditingSlide(null)}
                    onSave={handleSaveOverlays}
                />
            )}
        </div>
    );
};
