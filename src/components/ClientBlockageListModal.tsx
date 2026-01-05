import React, { useState, useMemo } from 'react';
import { Task } from '../types';
import { format } from 'date-fns';
import { AlertTriangle, X, Clock, ChevronDown, ChevronUp, AlertOctagon, Trash2 } from 'lucide-react';
import { calculateBusinessHours } from '../lib/utils';

interface ClientBlockageListModalProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
    resources: any[];
    onUpdateTasks: (updates: { id: string, changes: Partial<Task> }[]) => Promise<void>;
}

const safeDate = (date: any): Date => {
    if (!date) return new Date();
    let parsed: Date;
    if (date instanceof Date) parsed = date;
    else if (date && typeof date === 'object' && typeof date.toDate === 'function') {
        parsed = date.toDate();
    } else {
        parsed = new Date(date);
    }
    // Final check for validity
    return isNaN(parsed.getTime()) ? new Date() : parsed;
};

interface BlockageItem {
    id?: string; // Add ID field
    taskId: string;
    taskName: string;
    start: Date;
    end?: Date;
    isOngoing: boolean;
    reason: string;
    hours: number;
    cost: number;
    isSystemic: boolean;
    originTaskName?: string;
    rawHours: number; // Duration of delay
}

interface BlockageGroup {
    id: string; // unique key
    originTaskName: string;
    mainReason: string;
    start: Date;
    end?: Date;
    isOngoing: boolean;
    totalHours: number;
    totalCost: number;
    items: BlockageItem[];
}

export const ClientBlockageListModal = ({ isOpen, onClose, tasks, resources, onUpdateTasks }: ClientBlockageListModalProps) => {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const toggleGroup = (id: string) => {
        const next = new Set(expandedGroups);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedGroups(next);
    };

    const groups = useMemo(() => {
        const rawItems: BlockageItem[] = [];

        // 1. Extract all blockage items
        tasks.forEach(task => {
            if (!task.clientBlockages || task.clientBlockages.length === 0) return;

            // Determine rate
            let rate = task.hourlyRate || 0;
            if (rate === 0 && task.resourceId && resources.length > 0) {
                const res = resources.find(r => r.id === task.resourceId);
                if (res) rate = res.hourlyRate;
            }

            task.clientBlockages.forEach(b => {
                const start = safeDate(b.start);
                const end = b.end ? safeDate(b.end) : new Date();
                const isOngoing = !b.end;
                const hours = calculateBusinessHours(start, end);
                const cost = hours * rate;

                // Detect Systemic
                // Regex matches: [IMPACTO SISTÊMICO] Bloqueio cascata originado em: "NomeDaTarefa".
                const systemicMatch = b.reason.match(/\[IMPACTO SISTÊMICO\] Bloqueio cascata originado em: "(.*?)"/);
                const isSystemic = !!systemicMatch;
                const originTaskName = systemicMatch ? systemicMatch[1] : undefined;

                // For Systemic Blockages, cost/hours are 0 (it's a delay, not idle time)
                // But we keep rawHours for display
                const finalHours = isSystemic ? 0 : hours;
                const finalCost = isSystemic ? 0 : cost;

                rawItems.push({
                    id: b.id, // Pass ID
                    taskId: task.id,
                    taskName: task.name,
                    start,
                    end: b.end ? end : undefined,
                    isOngoing,
                    reason: b.reason,
                    hours: finalHours,
                    cost: finalCost,
                    isSystemic,
                    originTaskName,
                    rawHours: hours // Preservation
                });
            });
        });

        // 2. Grouping Logic
        const groupMap = new Map<string, BlockageGroup>();
        const orphans: BlockageItem[] = [];

        // First pass: Create groups for "Original" blockages (non-systemic)
        rawItems.forEach(item => {
            if (!item.isSystemic) {
                const key = `${item.start.getTime()}_${item.taskName}`;
                groupMap.set(key, {
                    id: key,
                    originTaskName: item.taskName,
                    mainReason: item.reason,
                    start: item.start,
                    end: item.end,
                    isOngoing: item.isOngoing,
                    totalHours: item.hours,
                    totalCost: item.cost,
                    items: [item]
                });
            }
        });

        // Second pass: Attach systemic items to their parents
        rawItems.forEach(item => {
            if (item.isSystemic && item.originTaskName) {
                const key = `${item.start.getTime()}_${item.originTaskName}`;
                const group = groupMap.get(key);
                if (group) {
                    group.items.push(item);
                    group.totalHours += item.hours;
                    group.totalCost += item.cost;
                    // If any item is ongoing, the group is effectively ongoing? 
                    // Usually they share end date, but strict logic:
                    if (item.isOngoing) group.isOngoing = true;
                    // Update end date if parent closed but child open? (Unlikely with current logic)
                } else {
                    orphans.push(item);
                }
            } else if (item.isSystemic && !item.originTaskName) {
                orphans.push(item);
            }
        });

        // Convert map to array and handle orphans (create their own groups)
        const result = Array.from(groupMap.values());

        orphans.forEach(item => {
            // Check if we can group orphans together? 
            // For now, simple standalone groups
            result.push({
                id: item.taskId + item.start.getTime(),
                originTaskName: item.taskName,
                mainReason: item.reason,
                start: item.start,
                end: item.end,
                isOngoing: item.isOngoing,
                totalHours: item.hours,
                totalCost: item.cost,
                items: [item]
            });
        });

        // Sort by start date descending
        return result.sort((a, b) => b.start.getTime() - a.start.getTime());

    }, [tasks, resources]);

    const handleDelete = async (items: BlockageItem[], stopEvent: React.MouseEvent) => {
        stopEvent.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir esse(s) registro(s) de bloqueio? Essa ação não pode ser desfeita.')) return;

        // Collect all blockages to remove (include systemic if deleting origin)
        const updatesMap = new Map<string, any[]>();

        // Pre-fill map with current blockages to avoid overwrite issues
        tasks.forEach(t => {
            if (t.clientBlockages) {
                updatesMap.set(t.id, t.clientBlockages);
            }
        });

        // Set of Blockage IDs to remove
        const idsToRemove = new Set(items.map(i => i.id).filter(Boolean));

        // Detect Systemic Children to remove if we are deleting an Origin
        items.forEach(item => {
            if (!item.isSystemic) {
                // This is an Origin blockage. Find all systemic children.
                // Pattern: [IMPACTO SISTÊMICO] Bloqueio cascata originado em: "{TaskName}"
                // AND start date usually matches.
                // Or better yet, we can match purely on the specific linkage if strictly enforced.
                // But pattern match is current best way.
                const searchPattern = `[IMPACTO SISTÊMICO] Bloqueio cascata originado em: "${item.taskName}"`;

                // Scan all tasks
                tasks.forEach(t => {
                    t.clientBlockages?.forEach(b => {
                        if (b.reason?.includes(searchPattern)) {
                            // Check rough time match to overlap? 
                            // Since systemic blockages are created at same time as parent, this is reasonable.
                            // But safest is to delete all matching that "run".
                            // For simplicty, delete matching reason.
                            // If we want to be very precise, we check date.
                            const bStart = safeDate(b.start).getTime();
                            const iStart = safeDate(item.start).getTime();
                            // Allow small margin or exact? Exact should work if generated by code.
                            if (Math.abs(bStart - iStart) < 10000) { // 10s tolerance
                                idsToRemove.add(b.id);
                            }
                        }
                    });
                });
            }
        });

        const batchUpdates: { id: string, changes: Partial<Task> }[] = [];

        // Apply deletions
        updatesMap.forEach((currentBlockages, taskId) => {
            const hasTarget = currentBlockages.some((b: any) => idsToRemove.has(b.id));
            if (hasTarget) {
                const newList = currentBlockages.filter((b: any) => !idsToRemove.has(b.id));
                batchUpdates.push({ id: taskId, changes: { clientBlockages: newList } });
            }
        });

        if (batchUpdates.length > 0) {
            await onUpdateTasks(batchUpdates);
        }
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-red-50 rounded-t-xl">
                    <h2 className="text-xl font-bold text-red-700 flex items-center gap-2">
                        <AlertTriangle className="text-red-600" />
                        Histórico de Bloqueios pelo Cliente
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-red-100 rounded-full text-red-400 hover:text-red-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    {groups.length === 0 ? (
                        <div className="text-center text-gray-400 py-10">
                            Nenhum bloqueio registrado.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {groups.map((group) => {
                                const isExpanded = expandedGroups.has(group.id);
                                return (
                                    <div key={group.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:border-red-200 transition-colors overflow-hidden">
                                        {/* Main Card Header */}
                                        <div
                                            className="p-5 flex flex-col md:flex-row justify-between gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                            onClick={() => toggleGroup(group.id)}
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${group.isOngoing ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
                                                        {group.isOngoing ? 'ATIVO' : 'FINALIZADO'}
                                                    </span>
                                                    <h4 className="font-bold text-gray-900 text-lg">{group.originTaskName}</h4>
                                                    {group.items.length > 1 && (
                                                        <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100 flex items-center gap-1">
                                                            <AlertOctagon size={10} />
                                                            +{group.items.length - 1} Impactados
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                                    <span className="font-semibold text-gray-700">Motivo:</span> {group.mainReason}
                                                </p>
                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={12} /> Início: {format(group.start, 'dd/MM/yyyy HH:mm')}
                                                    </span>
                                                    {group.end && (
                                                        <span className="flex items-center gap-1">
                                                            Fim: {format(group.end, 'dd/MM/yyyy HH:mm')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Summary Stats & Actions */}
                                            <div className="flex flex-col items-end gap-1 border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-4 min-w-[150px] justify-center text-right">
                                                <button
                                                    onClick={(e) => handleDelete(group.items, e)}
                                                    className="p-1 mb-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Excluir todo este grupo de bloqueios"
                                                >
                                                    <Trash2 size={14} />
                                                </button>

                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Impacto Gerado</span>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-lg font-bold text-red-700">{Math.round(group.totalHours)}h</span>
                                                    <span className="text-sm font-medium text-red-500">
                                                        {group.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </span>
                                                </div>
                                                <div className="mt-2 text-gray-400">
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="border-t border-gray-100 bg-gray-50 p-4 animate-in slide-in-from-top-2 duration-200">
                                                <h5 className="text-xs font-bold text-gray-500 uppercase mb-3 px-2">Detalhamento do Impacto</h5>
                                                <div className="space-y-2">
                                                    {group.items.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between items-center bg-white p-3 rounded border border-gray-200 text-sm">
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-gray-900">{item.taskName}</span>
                                                                {item.isSystemic && <span className="text-[10px] text-amber-600 italic">Impacto Cascata</span>}
                                                            </div>
                                                            <div className="text-right flex items-center gap-4">
                                                                <div>
                                                                    <div className="font-bold text-gray-700 text-right">
                                                                        {item.isSystemic ? (
                                                                            <span className="text-gray-500 text-xs uppercase bg-gray-100 px-2 py-1 rounded inline-block">Reagendamento</span>
                                                                        ) : (
                                                                            <span>{Math.round(item.hours)}h</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 text-right mt-1">
                                                                        {item.isSystemic ? (
                                                                            <span className="text-gray-400">Deslocamento: {Math.round(item.rawHours)}h úteis</span>
                                                                        ) : (
                                                                            item.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => handleDelete([item], e)}
                                                                    className="text-gray-300 hover:text-red-500 p-1 hover:bg-red-50 rounded"
                                                                    title="Excluir este item"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};
