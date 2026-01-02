import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project, ProjectOtherCost, Task } from '../types';
import { ProjectService } from '../services/projectService';
import { Save, DollarSign, Plus, Trash2, Tag, ChevronDown, Search } from 'lucide-react';
import { addMonths, startOfMonth } from 'date-fns';

const COST_TYPES = [
    "Licenças",
    "Aereo",
    "Hotel",
    "Alimentação",
    "Gasolina",
    "Horas Extras",
    "Aluguel Notebook"
];

interface Props {
    project: Project;
    tasks: Task[];
}

export const ProjectOtherCostsTab = ({ project, tasks }: Props) => {
    // 1. Calculate Timeline
    const { months } = useMemo(() => {
        if (!tasks.length && !project.start) {
            const now = startOfMonth(new Date());
            return { startMonth: now, months: [now] };
        }

        const dates = tasks.map(t => [t.start, t.end]).flat();
        if (project.start) dates.push(new Date(project.start));
        if (project.end) dates.push(new Date(project.end));

        const minDate = dates.reduce((min, d) => d < min ? d : min, dates[0]);
        const maxDate = dates.reduce((max, d) => d > max ? d : max, dates[0]);

        const start = startOfMonth(minDate);
        const end = addMonths(maxDate, 12); // +1 Year

        const monthList = [];
        let current = start;
        while (current <= end) {
            monthList.push(current);
            current = addMonths(current, 1);
        }

        return { startMonth: start, months: monthList };
    }, [tasks, project.start, project.end]);

    // 2. State
    const [costs, setCosts] = useState<ProjectOtherCost[]>(project.otherCosts || []);
    const [isEditing, setIsEditing] = useState(false);

    // 3. Helpers
    const handleAddRow = () => {
        const newCost: ProjectOtherCost = {
            id: crypto.randomUUID(),
            description: 'Novo Custo',
            type: '',
            values: {}
        };
        setCosts([...costs, newCost]);
        setIsEditing(true);
    };

    const handleRemoveRow = (id: string) => {
        setCosts(prev => prev.filter(c => c.id !== id));
        setIsEditing(true);
    };

    const handleUpdateRowMeta = (id: string, field: 'description' | 'type', value: string) => {
        setCosts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
        setIsEditing(true);
    };

    const handleUpdateValue = (id: string, monthStr: string, value: number) => {
        setCosts(prev => prev.map(c => {
            if (c.id === id) {
                return {
                    ...c,
                    values: { ...c.values, [monthStr]: value }
                };
            }
            return c;
        }));
        setIsEditing(true);
    };

    const handleSave = async () => {
        try {
            await ProjectService.updateProject(project.id, { otherCosts: costs });
            setIsEditing(false);
            alert("Custos salvos!");
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar.");
        }
    };

    // 4. Totals
    const monthlyTotals = months.map(m => {
        const mStr = m.toISOString().slice(0, 7);
        return costs.reduce((acc, curr) => acc + (curr.values[mStr] || 0), 0);
    });

    const grandTotal = monthlyTotals.reduce((a, b) => a + b, 0);

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Tag className="text-pink-600" />
                        Outros Custos
                    </h3>
                    <p className="text-xs text-gray-500">
                        Custos adicionais (Software, Infra, Viagens, etc).
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right mr-4">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Outros</p>
                        <p className="text-lg font-bold text-pink-600">
                            {grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                        </p>
                    </div>

                    <button
                        onClick={handleAddRow}
                        className="flex items-center gap-2 text-pink-600 hover:bg-pink-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-transparent hover:border-pink-100"
                    >
                        <Plus size={16} />
                        Adicionar
                    </button>
                    {isEditing && (
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-pink-700 transition-colors"
                        >
                            <Save size={16} />
                            Salvar
                        </button>
                    )}
                </div>
            </div>

            {/* Matrix Table */}
            <div className="flex-1 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200 border-separate border-spacing-0">
                    <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-r shadow-sm w-64 z-30">
                                Descrição
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-r w-48">
                                Tipo
                            </th>
                            {months.map(m => (
                                <th key={m.toISOString()} className="px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase border-b border-r min-w-[100px] bg-gray-50">
                                    {m.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                                </th>
                            ))}
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-900 uppercase border-b border-l bg-gray-50 min-w-[120px]">
                                Total
                            </th>
                            <th className="px-2 py-3 border-b bg-gray-50 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {costs.length === 0 && (
                            <tr>
                                <td colSpan={months.length + 4} className="text-center py-8 text-gray-400 text-sm italic">
                                    Nenhum custo adicional registrado. Clique em "Adicionar" para começar.
                                </td>
                            </tr>
                        )}
                        {costs.map((cost) => {
                            const rowTotal = Object.values(cost.values).reduce((a, b) => a + b, 0);
                            return (
                                <tr key={cost.id} className="hover:bg-gray-50 group">
                                    {/* Description (Sticky) */}
                                    <td className="sticky left-0 bg-white group-hover:bg-gray-50 px-2 py-1 border-r shadow-sm z-10 align-middle">
                                        <input
                                            type="text"
                                            value={cost.description}
                                            onChange={(e) => handleUpdateRowMeta(cost.id, 'description', e.target.value)}
                                            className="w-full border-none bg-transparent focus:ring-0 text-sm font-medium text-gray-900 placeholder-gray-400"
                                            placeholder="Descrição do custo..."
                                        />
                                    </td>
                                    {/* Type Selector (Custom) */}
                                    <td className="px-2 py-1 border-r align-middle bg-white relative">
                                        <TypeSelector
                                            value={cost.type}
                                            onChange={(val) => handleUpdateRowMeta(cost.id, 'type', val)}
                                        />
                                    </td>

                                    {/* Monthly Values */}
                                    {months.map(m => {
                                        const mStr = m.toISOString().slice(0, 7);
                                        const val = cost.values[mStr] || 0;
                                        return (
                                            <td key={mStr} className="px-1 py-1 border-r text-right align-middle">
                                                <input
                                                    type="number"
                                                    value={val > 0 ? val : ''}
                                                    onChange={(e) => handleUpdateValue(cost.id, mStr, parseFloat(e.target.value) || 0)}
                                                    className="w-full text-right bg-transparent border-none p-1 text-xs focus:ring-1 focus:ring-pink-300 rounded font-mono text-gray-700"
                                                    placeholder="-"
                                                />
                                            </td>
                                        );
                                    })}

                                    {/* Row Total */}
                                    <td className="px-4 py-2 text-right text-sm font-bold text-pink-700 bg-gray-50 border-l align-middle">
                                        {rowTotal > 0 ? (rowTotal).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-'}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-2 text-center align-middle">
                                        <button
                                            onClick={() => handleRemoveRow(cost.id)}
                                            className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Remover custo"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}

                        {/* Totals Row */}
                        <tr className="bg-gray-100 font-bold border-t-2 border-gray-200">
                            <td className="sticky left-0 bg-gray-100 px-4 py-3 text-sm text-gray-900 border-r shadow-sm z-10 border-t border-gray-300">
                                TOTAL OUTROS
                            </td>
                            <td className="bg-gray-100 border-r border-t border-gray-300"></td>
                            {monthlyTotals.map((tot, idx) => (
                                <td key={idx} className="px-2 py-3 text-right text-xs text-gray-900 border-t border-gray-300 border-r border-gray-200">
                                    {tot > 0 ? tot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '-'}
                                </td>
                            ))}
                            <td className="px-4 py-3 text-right text-xs text-pink-800 border-t border-gray-300 border-l bg-pink-50">
                                {grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                            </td>
                            <td className="bg-gray-100 border-t border-gray-300"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Custom Components ---

const TypeSelector = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
        }
        setIsOpen(!isOpen);
        setSearch(''); // Reset search on open
    };

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    };

    // Auto-focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const filteredOptions = COST_TYPES.filter(t => t.toLowerCase().includes(search.toLowerCase()));

    return (
        <>
            <div
                ref={triggerRef}
                onClick={toggle}
                className={`flex items-center justify-between w-full px-2 py-1.5 text-xs text-gray-700 bg-white border border-transparent hover:border-gray-300 rounded cursor-pointer transition-all ${!value && 'text-gray-400'}`}
            >
                <span className="truncate">{value || "Selecione..."}</span>
                <ChevronDown size={14} className="text-gray-400 flex-shrink-0 ml-1" />
            </div>

            {isOpen && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-start justify-start"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="fixed bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
                        style={{
                            top: coords.top + 4,
                            left: coords.left,
                            width: Math.max(coords.width, 200),
                            maxHeight: '300px'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                            <Search size={14} className="text-gray-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar tipo..."
                                className="w-full bg-transparent border-none p-0 text-xs focus:ring-0 text-gray-700 placeholder-gray-400"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && filteredOptions.length > 0) {
                                        handleSelect(filteredOptions[0]);
                                    }
                                }}
                            />
                        </div>
                        <div className="overflow-y-auto max-h-[200px] p-1">
                            {filteredOptions.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-gray-400 text-center italic">
                                    Nenhuma opção encontrada.
                                </div>
                            ) : (
                                filteredOptions.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => handleSelect(opt)}
                                        className={`w-full text-left px-3 py-2 text-xs rounded hover:bg-pink-50 hover:text-pink-700 transition-colors ${value === opt ? 'bg-pink-50 text-pink-700 font-medium' : 'text-gray-700'}`}
                                    >
                                        {opt}
                                    </button>
                                ))
                            )}
                            {search && !filteredOptions.includes(search) && (
                                <button
                                    onClick={() => handleSelect(search)}
                                    className="w-full text-left px-3 py-2 text-xs rounded hover:bg-gray-50 text-indigo-600 border-t border-gray-100 mt-1 font-medium italic"
                                >
                                    Usar "{search}"
                                </button>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
