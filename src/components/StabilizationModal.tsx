import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import { differenceInBusinessDays, isBefore, startOfDay, format, addBusinessDays, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Calendar, CheckCircle, ArrowRight, X } from 'lucide-react';

interface StabilizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
    onUpdateTasks: (updates: { id: string, changes: Partial<Task> }[]) => Promise<void>;
}

interface Issue {
    taskId: string;
    taskName: string;
    type: 'delayed' | 'not_started' | 'lagging';
    description: string;
    currentProgress: number;
    currentStart: Date;
    currentEnd: Date;
    // Proposed corrections
    newProgress: number;
    newEndDate: string; // YYYY-MM-DD for input
    customRealStartDate?: string;
    customRealEndDate?: string;
    action: 'keep' | 'update_progress' | 'reschedule' | 'complete' | 'complete_on_time' | 'complete_custom' | 'blocked_by_client' | 'unblock_client';
    // Blockage specific
    isBlocked: boolean;
    activeBlockageStart?: Date; // Added for validation
    blockageStartDate?: string;
    blockageEndDate?: string; // Added for retroactive unblock
    blockageReason?: string;
}

export const StabilizationModal = ({ isOpen, onClose, tasks, onUpdateTasks }: StabilizationModalProps) => {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const today = startOfDay(new Date());
        const detectedIssues: Issue[] = [];

        tasks.forEach(task => {
            if (task.type === 'project') return; // Skip groups

            const parseDate = (d: any) => {
                if (!d) return new Date();
                if (d instanceof Date) return d;
                if (typeof d.toDate === 'function') return d.toDate();
                return new Date(d);
            }

            const start = startOfDay(parseDate(task.start));
            const end = startOfDay(parseDate(task.end));
            const progress = task.progress || 0;
            const currentBlockage = task.clientBlockages?.find(b => !b.end);
            const isBlocked = !!currentBlockage;

            // 1. COMPLETED? Skip
            if (progress === 100) return;

            // Common Expected Calc
            let expected = 0;
            if (isBefore(start, today)) {
                const totalDays = Math.max(1, differenceInBusinessDays(end, start));
                const elapsed = Math.max(0, differenceInBusinessDays(today, start));
                expected = Math.min(100, Math.round((elapsed / totalDays) * 100));
            }

            // Detect Issues
            let type: Issue['type'] | null = null;
            let description = '';

            if (isBefore(end, today)) {
                type = 'delayed';
                description = `Deveria ter terminado em ${format(end, 'dd/MM')}. Deveria estar em 100%.`;
            } else if (isBefore(start, today) && progress === 0) {
                type = 'not_started';
                description = `Deveria ter iniciado em ${format(start, 'dd/MM')}. Deveria estar em ${expected}%.`;
            } else if (isBefore(start, today) && (expected - progress > 20)) {
                type = 'lagging';
                description = `Ritmo lento. Esperado ~${expected}% (Decorridos ${Math.max(0, differenceInBusinessDays(today, start))}/${Math.max(1, differenceInBusinessDays(end, start))} dias).`;
            }

            if (type || isBlocked) {
                // If blocked, we allow showing it even if not strictly "delayed" (or maybe user wants to unblock it)
                // But generally blocking happens *because* of delay or causes it.
                // If it's blocked, we definitely show it.
                detectedIssues.push({
                    taskId: task.id,
                    taskName: task.name,
                    type: type || 'delayed', // Default to delayed if just blocked but weird state? Actually likely delayed.
                    description: type ? description : 'Tarefa Bloqueada pelo Cliente.',
                    currentProgress: progress,
                    currentStart: task.start,
                    currentEnd: task.end,
                    newProgress: progress,
                    newEndDate: format(new Date(), 'yyyy-MM-dd'),
                    action: 'keep',
                    isBlocked: isBlocked,
                    activeBlockageStart: currentBlockage ? parseDate(currentBlockage.start) : undefined,
                    blockageReason: ''
                });
            }
        });

        setIssues(detectedIssues);
    }, [isOpen, tasks]);

    const handleActionChange = (index: number, action: Issue['action']) => {
        const copy = [...issues];
        copy[index].action = action;

        // Defaults
        if (action === 'complete' || action === 'complete_on_time' || action === 'complete_custom') {
            copy[index].newProgress = 100;
        }

        if (action === 'complete_custom') {
            const task = tasks.find(t => t.id === copy[index].taskId);
            copy[index].customRealStartDate = copy[index].customRealStartDate || (task ? format(task.start, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
            copy[index].customRealEndDate = copy[index].customRealEndDate || format(new Date(), 'yyyy-MM-dd');
        }

        if (action === 'blocked_by_client') {
            copy[index].blockageStartDate = format(new Date(), 'yyyy-MM-dd');
        }

        if (action === 'unblock_client') {
            copy[index].blockageEndDate = format(new Date(), 'yyyy-MM-dd');
        }

        setIssues(copy);
    };

    const updateIssue = (index: number, field: keyof Issue, value: any) => {
        const copy = [...issues];
        (copy[index] as any)[field] = value;

        if (field === 'newProgress' && value !== copy[index].currentProgress) {
            if (value === 100) copy[index].action = 'complete';
            else copy[index].action = 'update_progress';
        }
        if (field === 'newEndDate' && value !== format(copy[index].currentEnd, 'yyyy-MM-dd')) {
            copy[index].action = 'reschedule';
        }
        setIssues(copy);
    };

    const handleSave = async () => {
        setIsSaving(true);
        const updates: { id: string, changes: Partial<Task> }[] = [];

        issues.forEach(issue => {
            if (issue.action === 'keep') return;

            const change: Partial<Task> = {};
            const task = tasks.find(t => t.id === issue.taskId);

            if (issue.action === 'blocked_by_client') {
                let blockageDate = new Date();
                if (issue.blockageStartDate) {
                    const [y, m, d] = issue.blockageStartDate.split('-').map(Number);
                    blockageDate = new Date(y, m - 1, d, 12, 0, 0);
                }

                const newBlockage = {
                    id: crypto.randomUUID(),
                    start: blockageDate,
                    reason: issue.blockageReason || 'Motivo não especificado'
                };
                change.clientBlockages = [...(task?.clientBlockages || []), newBlockage];
            }
            else if (issue.action === 'unblock_client') {
                let unblockDate = new Date();
                if (issue.blockageEndDate) {
                    const [y, m, d] = issue.blockageEndDate.split('-').map(Number);
                    unblockDate = new Date(y, m - 1, d, 12, 0, 0);
                }

                change.clientBlockages = task?.clientBlockages?.map(b =>
                    (!b.end) ? { ...b, end: unblockDate } : b
                );
            }
            else if (issue.action === 'complete') {
                change.progress = 100;
            }
            else if (issue.action === 'complete_on_time') {
                change.progress = 100;
                if (task) {
                    change.realStart = task.start;
                    change.realEnd = task.end;
                }
            }
            else if (issue.action === 'complete_custom') {
                change.progress = 100;
                if (issue.customRealStartDate) {
                    const [y, m, d] = issue.customRealStartDate.split('-').map(Number);
                    change.realStart = new Date(y, m - 1, d, 12, 0, 0);
                }
                if (issue.customRealEndDate) {
                    const [y, m, d] = issue.customRealEndDate.split('-').map(Number);
                    change.realEnd = new Date(y, m - 1, d, 18, 0, 0);
                }
            }
            else if (issue.action === 'update_progress') {
                change.progress = Math.min(100, Math.max(0, issue.newProgress));
            }
            else if (issue.action === 'reschedule') {
                const [y, m, d] = issue.newEndDate.split('-').map(Number);
                const newEnd = new Date(y, m - 1, d, 18, 0, 0);
                if (isValid(newEnd)) {
                    change.end = newEnd;
                }
            }

            if (Object.keys(change).length > 0) {
                updates.push({ id: issue.taskId, changes: change });
            }
        });

        await onUpdateTasks(updates);
        setIsSaving(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            <AlertTriangle className="text-amber-500" />
                            Estabilização do Cronograma
                        </h2>
                        <p className="text-gray-500 mt-2">
                            Validação de {issues.length} tarefas com pendências ou atrasos até hoje ({format(new Date(), 'dd/MM/yyyy')}).
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
                    {issues.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center">
                            <CheckCircle size={64} className="text-green-500 mb-4" />
                            <h3 className="text-xl font-bold text-gray-900">Tudo Certo!</h3>
                            <p className="text-gray-500 mt-2">Não encontramos tarefas atrasadas ou com evolução pendente.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {issues.map((issue, idx) => (
                                <div key={issue.taskId} className={`bg-white border rounded-lg p-5 shadow-sm transition-all ${issue.action !== 'keep' ? 'border-indigo-300 ring-1 ring-indigo-50' : 'border-gray-200'}`}>
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-6">

                                        {/* Task Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${issue.type === 'delayed' ? 'bg-red-100 text-red-700' :
                                                    issue.type === 'not_started' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {issue.type === 'delayed' ? 'Atrasada' : issue.type === 'not_started' ? 'Não Iniciou' : 'Defasada'}
                                                </span>
                                                {issue.isBlocked && (
                                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-600 text-white animate-pulse">
                                                        BLOQUEADO PELO CLIENTE
                                                    </span>
                                                )}
                                                <h4 className="font-bold text-gray-900">{issue.taskName}</h4>
                                            </div>
                                            <p className="text-sm text-gray-500">{issue.description}</p>
                                            <div className="text-xs text-gray-400 mt-2 flex gap-4">
                                                <span>Progress Atual: <b>{issue.currentProgress}%</b></span>
                                                <span>Fim Previsto: <b>{format(issue.currentEnd, 'dd/MM/yyyy')}</b></span>
                                                {issue.isBlocked && issue.activeBlockageStart && (
                                                    <span className="text-red-400 flex items-center gap-1">
                                                        <Calendar size={10} />
                                                        Bloqueado em: {format(new Date(issue.activeBlockageStart), 'dd/MM/yyyy')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Interaction Zone */}
                                        <div className="flex flex-wrap items-center gap-6 bg-gray-50 p-3 rounded-lg border border-gray-100">

                                            {/* Action Selector */}
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Ação</label>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={() => handleActionChange(idx, 'update_progress')}
                                                        className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${issue.action === 'update_progress' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
                                                    >
                                                        Evoluir
                                                    </button>
                                                    <button
                                                        onClick={() => handleActionChange(idx, 'reschedule')}
                                                        className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${issue.action === 'reschedule' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'}`}
                                                    >
                                                        Reprogramar
                                                    </button>

                                                    {issue.isBlocked ? (
                                                        <button
                                                            onClick={() => handleActionChange(idx, 'unblock_client')}
                                                            className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors border-red-200 text-red-700 bg-red-50 hover:bg-red-100 ${issue.action === 'unblock_client' ? 'ring-2 ring-red-400' : ''}`}
                                                        >
                                                            Desbloqueio pelo cliente
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleActionChange(idx, 'blocked_by_client')}
                                                            className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors border-red-200 text-red-600 hover:bg-red-50 ${issue.action === 'blocked_by_client' ? 'bg-red-100 font-bold' : 'bg-white'}`}
                                                        >
                                                            Bloqueado pelo cliente
                                                        </button>
                                                    )}

                                                    <div className="flex gap-1 w-full">
                                                        <button
                                                            onClick={() => handleActionChange(idx, 'complete_custom')}
                                                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded border transition-colors ${issue.action === 'complete_custom' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                                                        >
                                                            Conc. Atraso/Ant.
                                                        </button>
                                                        <button
                                                            onClick={() => handleActionChange(idx, 'complete_on_time')}
                                                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded border transition-colors ${issue.action === 'complete_on_time' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'}`}
                                                        >
                                                            Conc. Prazo
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Dynamic Inputs */}
                                            <div className="w-[180px] border-l border-gray-200 pl-6 flex flex-col justify-center">
                                                {(issue.action === 'complete_on_time') && (
                                                    <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
                                                        <CheckCircle size={16} /> Será 100% (No Prazo)
                                                    </div>
                                                )}

                                                {issue.action === 'blocked_by_client' && (
                                                    <div className="flex flex-col gap-2">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-red-500 uppercase block mb-1">Início do Bloqueio</label>
                                                            <input
                                                                type="date"
                                                                value={issue.blockageStartDate}
                                                                onChange={(e) => updateIssue(idx, 'blockageStartDate', e.target.value)}
                                                                max={format(new Date(), 'yyyy-MM-dd')}
                                                                min={format(issue.currentStart, 'yyyy-MM-dd')}
                                                                className="w-full text-xs p-1 border border-red-200 rounded focus:border-red-500 outline-none font-medium text-red-700"
                                                                required
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-red-500 uppercase block mb-1">Motivo</label>
                                                            <textarea
                                                                value={issue.blockageReason}
                                                                onChange={(e) => updateIssue(idx, 'blockageReason', e.target.value)}
                                                                className="w-full text-xs p-2 border border-red-200 rounded focus:border-red-500 outline-none bg-red-50 resize-none h-14"
                                                                placeholder="Descreva o motivo..."
                                                            ></textarea>
                                                        </div>
                                                    </div>
                                                )}

                                                {issue.action === 'unblock_client' && (
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[10px] font-bold text-green-600 uppercase block mb-1">Data de Desbloqueio</label>
                                                        <input
                                                            type="date"
                                                            value={issue.blockageEndDate}
                                                            onChange={(e) => updateIssue(idx, 'blockageEndDate', e.target.value)}
                                                            max={format(new Date(), 'yyyy-MM-dd')}
                                                            min={issue.activeBlockageStart ? format(new Date(issue.activeBlockageStart), 'yyyy-MM-dd') : undefined}
                                                            className="w-full text-xs p-1 border border-green-200 rounded focus:border-green-500 outline-none font-medium text-green-700"
                                                            required
                                                        />
                                                        <div className="text-[10px] text-green-500 font-medium">
                                                            Contador será interrompido na data acima.
                                                        </div>
                                                    </div>
                                                )}

                                                {issue.action === 'complete_custom' && (
                                                    <div className="flex flex-col gap-2">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Início Real</label>
                                                            <input
                                                                type="date"
                                                                value={issue.customRealStartDate}
                                                                onChange={(e) => updateIssue(idx, 'customRealStartDate', e.target.value)}
                                                                className="w-full text-xs p-1 border border-indigo-200 rounded focus:border-indigo-500 outline-none"
                                                                required
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Fim Real</label>
                                                            <input
                                                                type="date"
                                                                value={issue.customRealEndDate}
                                                                onChange={(e) => updateIssue(idx, 'customRealEndDate', e.target.value)}
                                                                className="w-full text-xs p-1 border border-indigo-200 rounded focus:border-indigo-500 outline-none"
                                                                required
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {issue.action === 'update_progress' && (
                                                    <div>
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Novo %</label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="range"
                                                                min="0" max="100"
                                                                value={issue.newProgress}
                                                                onChange={(e) => updateIssue(idx, 'newProgress', parseInt(e.target.value))}
                                                                className="w-20 accent-blue-600 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                                            />
                                                            <span className="text-sm font-bold text-blue-700 w-8 text-right">{issue.newProgress}%</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {issue.action === 'reschedule' && (
                                                    <div>
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Nova Data Fim</label>
                                                        <input
                                                            type="date"
                                                            value={issue.newEndDate}
                                                            onChange={(e) => updateIssue(idx, 'newEndDate', e.target.value)}
                                                            className="w-full text-xs p-1.5 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 outline-none text-gray-700 font-medium"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-gray-100 bg-white flex justify-end gap-3 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || issues.length === 0}
                        className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSaving ? 'Salvando...' : `Aplicar ${issues.filter(i => i.action !== 'keep').length} Correções`}
                    </button>
                </div>
            </div>
        </div>
    );
};
