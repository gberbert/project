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
    currentEnd: Date;
    // Proposed corrections
    newProgress: number;
    newEndDate: string; // YYYY-MM-DD for input
    action: 'keep' | 'update_progress' | 'reschedule' | 'complete';
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

            const start = startOfDay(task.start);
            const end = startOfDay(task.end);
            const progress = task.progress || 0;

            // 1. COMPLETED? Skip
            if (progress === 100) return;

            // 2. CHECK: DELAYED (End Date passed)
            if (isBefore(end, today)) {
                detectedIssues.push({
                    taskId: task.id,
                    taskName: task.name,
                    type: 'delayed',
                    description: `Deveria ter terminado em ${format(end, 'dd/MM')}.`,
                    currentProgress: progress,
                    currentEnd: task.end,
                    newProgress: progress,
                    newEndDate: format(new Date(), 'yyyy-MM-dd'), // Default reschedule to today
                    action: 'keep' // User decides
                });
                return;
            }

            // 3. CHECK: NOT STARTED (Start Date passed, Progress 0)
            if (isBefore(start, today) && progress === 0) {
                detectedIssues.push({
                    taskId: task.id,
                    taskName: task.name,
                    type: 'not_started',
                    description: `Deveria ter iniciado em ${format(start, 'dd/MM')}.`,
                    currentProgress: 0,
                    currentEnd: task.end,
                    newProgress: 0,
                    newEndDate: format(task.end, 'yyyy-MM-dd'),
                    action: 'keep'
                });
                return;
            }

            // 4. CHECK: LAGGING (Start < Today < End, but Progress mismatch)
            // If we are 50% through the timeline, expected progress should be arguably > 25%?
            // Simple heuristic: If > 5 days passed and still 0%?
            // Let's stick to the user request: "pra tras toda evolucao pendente".
            // If today > start, enable updating progress.
            if (isBefore(start, today)) {
                // Calculate expected linear progress
                const totalDays = Math.max(1, differenceInBusinessDays(end, start));
                const elapsed = Math.max(0, differenceInBusinessDays(today, start));
                const expected = Math.min(100, Math.round((elapsed / totalDays) * 100));

                // If actual is significantly behind expected (e.g. > 20% diff)
                if (expected - progress > 20) {
                    detectedIssues.push({
                        taskId: task.id,
                        taskName: task.name,
                        type: 'lagging',
                        description: `Ritmo lento. Esperado ~${expected}% (Decorridos ${elapsed}/${totalDays} dias).`,
                        currentProgress: progress,
                        currentEnd: task.end,
                        newProgress: progress, // Let user set it
                        newEndDate: format(task.end, 'yyyy-MM-dd'),
                        action: 'keep'
                    });
                }
            }
        });

        setIssues(detectedIssues);
    }, [isOpen, tasks]);

    const handleActionChange = (index: number, action: Issue['action']) => {
        const copy = [...issues];
        copy[index].action = action;

        // Defaults when switching actions
        if (action === 'complete') {
            copy[index].newProgress = 100;
        } else if (action === 'reschedule') {
            // Suggest extending by pending duration? 
            // Default is set to Today in init, which acts as "move remainder to start today" logic effectively if using gantt logic, 
            // but here we are just changing End Date.
            // Let's set it to Today + Remaining Duration
            const taskStart = tasks.find(t => t.id === copy[index].taskId)?.start || new Date();
            // Actually, if delayed, we usually want to extend FROM TODAY.
            // Let's just default to Today for "finish now" or let them pick.
            // Init already sets it to today.
        }

        setIssues(copy);
    };

    const updateIssue = (index: number, field: keyof Issue, value: any) => {
        const copy = [...issues];
        (copy[index] as any)[field] = value;
        // If editing values, auto-select appropriate action
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

            if (issue.action === 'complete') {
                change.progress = 100;
                // Optional: Set End Date to Today if it was delayed? 
                // No, just mark done.
            }
            else if (issue.action === 'update_progress') {
                change.progress = Math.min(100, Math.max(0, issue.newProgress));
            }
            else if (issue.action === 'reschedule') {
                // Parse new date
                const [y, m, d] = issue.newEndDate.split('-').map(Number);
                const newEnd = new Date(y, m - 1, d, 18, 0, 0); // End of day
                if (isValid(newEnd)) {
                    change.end = newEnd;
                    // If rescheduling a delayed task, we might want to check start date? 
                    // Assuming Gantt chart logic (push) isn't running automatically here, just updating dates.
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
                                                <h4 className="font-bold text-gray-900">{issue.taskName}</h4>
                                            </div>
                                            <p className="text-sm text-gray-500">{issue.description}</p>
                                            <div className="text-xs text-gray-400 mt-2 flex gap-4">
                                                <span>Progress Atual: <b>{issue.currentProgress}%</b></span>
                                                <span>Fim Previsto: <b>{format(issue.currentEnd, 'dd/MM/yyyy')}</b></span>
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
                                                    <button
                                                        onClick={() => handleActionChange(idx, 'keep')}
                                                        className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${issue.action === 'keep' ? 'bg-gray-200 text-gray-700 border-gray-300' : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600'}`}
                                                    >
                                                        Ignorar
                                                    </button>
                                                    <button
                                                        onClick={() => handleActionChange(idx, 'complete')}
                                                        className={`w-full px-3 py-1.5 text-xs font-medium rounded border transition-colors ${issue.action === 'complete' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}
                                                    >
                                                        Concluir
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Dynamic Inputs */}
                                            <div className="w-[180px] border-l border-gray-200 pl-6 flex flex-col justify-center">
                                                {issue.action === 'complete' && (
                                                    <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
                                                        <CheckCircle size={16} /> Será 100%
                                                    </div>
                                                )}

                                                {issue.action === 'keep' && (
                                                    <div className="text-xs text-gray-400 italic text-center">
                                                        Nenhuma alteração
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
