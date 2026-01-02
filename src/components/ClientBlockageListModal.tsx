import React from 'react';
import { Task } from '../types';
import { format } from 'date-fns';
import { AlertTriangle, X, Clock, DollarSign } from 'lucide-react';

interface ClientBlockageListModalProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
    resources: any[]; // Or Resource[]
}

import { calculateBusinessDays } from '../lib/utils';

// Helper to safely parse dates (handles Firestore Timestamps, strings, Dates)
const safeDate = (date: any): Date => {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    // Check for Firestore Timestamp (has toDate method)
    if (date && typeof date === 'object' && typeof date.toDate === 'function') {
        return date.toDate();
    }
    return new Date(date);
};

export const ClientBlockageListModal = ({ isOpen, onClose, tasks, resources }: ClientBlockageListModalProps) => { // Removed onUpdateTasks from here as likely read-only list for now or we won't edit here.
    if (!isOpen) return null;

    // Filter tasks with blockages
    const blockedTasks = tasks.map(t => ({
        ...t,
        clientBlockages: t.clientBlockages || []
    })).filter(t => t.clientBlockages.length > 0);

    // Flatten blockages for list view
    const allBlockages = blockedTasks.flatMap(task => {
        let rate = task.hourlyRate || 0;
        // Fallback rate logic (replicated)
        if (rate === 0 && task.resourceId && resources.length > 0) {
            const res = resources.find(r => r.id === task.resourceId);
            if (res) rate = res.hourlyRate;
        }

        return task.clientBlockages.map(blockage => {
            const start = safeDate(blockage.start);
            const end = blockage.end ? safeDate(blockage.end) : new Date();
            const isOngoing = !blockage.end;

            // Calculate impact
            const daysBlocked = Math.max(0, calculateBusinessDays(start, end));
            const hoursBlocked = daysBlocked * 8;
            const estimatedCost = hoursBlocked * rate;

            return {
                taskId: task.id,
                taskName: task.name,
                ...blockage,
                start,
                end: blockage.end ? end : undefined,
                rate,
                isOngoing,
                hoursBlocked,
                estimatedCost
            };
        });
    }).sort((a, b) => b.start.getTime() - a.start.getTime());

    // ... imports below...

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

                <div className="flex-1 overflow-y-auto p-6">
                    {allBlockages.length === 0 ? (
                        <div className="text-center text-gray-400 py-10">
                            Nenhum bloqueio registrado.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {allBlockages.map((item) => (
                                <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:border-red-200 transition-colors">
                                    <div className="flex flex-col md:flex-row justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${item.isOngoing ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
                                                    {item.isOngoing ? 'Ativo' : 'Finalizado'}
                                                </span>
                                                <h4 className="font-bold text-gray-900">{item.taskName}</h4>
                                            </div>
                                            <p className="text-sm text-gray-600 mb-2">
                                                <span className="font-semibold text-gray-700">Motivo:</span> {item.reason}
                                            </p>
                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} /> Início: {format(item.start, 'dd/MM/yyyy')}
                                                </span>
                                                {item.end && (
                                                    <span className="flex items-center gap-1">
                                                        Fim: {format(item.end, 'dd/MM/yyyy')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Impact Stats */}
                                        <div className="flex flex-col items-end gap-1 border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-4 min-w-[150px] justify-center text-right">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Impacto Gerado</span>
                                            <div className="flex flex-col items-end">
                                                <span className="text-lg font-bold text-red-700">{item.hoursBlocked}h</span>
                                                <span className="text-sm font-medium text-red-500">
                                                    {item.estimatedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
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
