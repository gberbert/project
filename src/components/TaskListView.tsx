import { useState, useMemo } from 'react';
import { Task, Resource } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Edit2, Trash2, CheckCircle2, Circle, Clock, Search, ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { ProjectService } from '../services/projectService';
import { AppUser } from '../types/auth';
import { calculateBusinessDays } from '../lib/utils';

interface TaskListViewProps {
    tasks: Task[];
    resources: Resource[];
    onEditTask: (task: Task) => void;
    isConnected: boolean;
    currentUser?: AppUser | null;
}

export const TaskListView = ({ tasks, resources, onEditTask, isConnected, currentUser }: TaskListViewProps) => {
    const [filter, setFilter] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        const newSet = new Set(expandedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedIds(newSet);
    };

    const getStatusIcon = (progress: number, type: string) => {
        if (type === 'project') return <Folder size={16} className="text-indigo-500" />;
        if (progress === 100) return <CheckCircle2 size={16} className="text-green-500" />;
        if (progress > 0) return <Clock size={16} className="text-amber-500" />;
        return <Circle size={16} className="text-gray-400" />;
    };

    const getStatusText = (progress: number, type: string) => {
        if (type === 'project') return 'Grupo';
        if (progress === 100) return 'Concluído';
        if (progress > 0) return 'Em Andamento';
        return 'A Fazer';
    };

    const getResource = (id?: string) => resources.find(r => r.id === id);

    const handleDelete = async (e: React.MouseEvent, taskId: string) => {
        e.stopPropagation();
        if (!isConnected) return;
        if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
            await ProjectService.deleteTask(taskId);
        }
    };

    // Metrics Calculation Logic
    const metricsMap = useMemo(() => {
        const map = new Map<string, { hours: number, cost: number, realCost: number, fte: number, rate: number }>();

        // Helper to get cached or calc
        const calc = (taskId: string): { hours: number, cost: number, realCost: number, fte: number, rate: number } => {
            if (map.has(taskId)) return map.get(taskId)!;

            const task = tasks.find(t => t.id === taskId);
            if (!task) return { hours: 0, cost: 0, realCost: 0, fte: 0, rate: 0 };

            const children = tasks.filter(t => t.parent === taskId);

            if (children.length > 0) {
                let totalHours = 0;
                let totalCost = 0;
                let totalRealCost = 0;

                children.forEach(c => {
                    const m = calc(c.id);
                    totalHours += m.hours;
                    totalCost += m.cost;
                    totalRealCost += m.realCost;
                });

                // For Parent Tasks, duration is span of children or task dates? 
                // Using task dates for FTE calculation background
                const busDays = Math.max(1, calculateBusinessDays(task.start, task.end));

                // FTE: Total Hours effort / (Duration available * 8h)
                const fte = totalHours / (busDays * 8);
                const avgRate = totalHours > 0 ? totalCost / totalHours : 0;

                const result = { hours: totalHours, cost: totalCost, realCost: totalRealCost, fte, rate: avgRate };
                map.set(taskId, result);
                return result;
            } else {
                // Leaf
                const busDays = Math.max(1, calculateBusinessDays(task.start, task.end));
                const hours = busDays * 8; // Standard 8h day

                let rate = task.hourlyRate || 0;
                if (!rate && task.resourceId) {
                    const r = resources.find(res => res.id === task.resourceId);
                    if (r) rate = r.hourlyRate;
                }

                const cost = hours * rate;

                // Real Cost Calculation
                let realCost = 0;
                if (task.realStart && task.realEnd) {
                    const realDays = calculateBusinessDays(task.realStart, task.realEnd);
                    // Using same rate for Real Cost
                    realCost = realDays * 8 * rate;
                }

                const fte = 1; // Assigned full time for duration

                const result = { hours, cost, realCost, fte, rate };
                map.set(taskId, result);
                return result;
            }
        };

        tasks.forEach(t => calc(t.id));
        return map;
    }, [tasks, resources]);

    // Tree Builder Logic
    const { rootTasks, getChildren } = useMemo(() => {
        const getChildren = (parentId: string) => {
            return tasks
                .filter(t => t.parent === parentId)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
        };

        const rootTasks = tasks
            .filter(t => !t.parent || !tasks.find(p => p.id === t.parent))
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        return { rootTasks, getChildren };
    }, [tasks]);

    const formatCurrency = (val: number) => {
        if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `R$ ${(val / 1000).toFixed(1)}k`;
        return `R$ ${val.toFixed(0)}`;
    };

    // Recursive Renderer
    const renderTaskRow = (task: Task, depth: number = 0): JSX.Element | null => {
        const children = getChildren(task.id);
        const hasChildren = children.length > 0 || task.type === 'project';
        const isExpanded = expandedIds.has(task.id);
        const metrics = metricsMap.get(task.id) || { hours: 0, cost: 0, realCost: 0, fte: 0, rate: 0 };

        if (filter) return null;

        return (
            <>
                <tr
                    key={task.id}
                    className={`
                        group transition-colors cursor-pointer border-b border-gray-50
                        ${task.type === 'project' ? 'bg-gray-50 hover:bg-gray-100' : 'hover:bg-gray-50 bg-white'}
                    `}
                    onClick={() => onEditTask(task)}
                >
                    <td className="px-6 py-4 sticky left-0 bg-inherit z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[320px]">
                        <div className="flex items-center" style={{ paddingLeft: `${depth * 24}px` }}>
                            {hasChildren ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpand(task.id);
                                    }}
                                    className="p-1 mr-2 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
                                >
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                            ) : (
                                <span className="w-6 mr-2 inline-block flex-shrink-0"></span>
                            )}

                            <div className="truncate pr-4">
                                <div className={`font-medium truncate ${task.type === 'project' ? 'text-indigo-900 font-bold' : 'text-gray-900'}`} title={task.name}>
                                    {task.name}
                                </div>
                                <div className="text-[10px] text-gray-400">
                                    {format(task.start, 'd MMM', { locale: ptBR })} - {format(task.end, 'd MMM', { locale: ptBR })}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 min-w-[140px]">
                        <div className="flex items-center gap-2">
                            {getStatusIcon(task.progress, task.type)}
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${task.type === 'project' ? 'bg-indigo-100 text-indigo-700' :
                                task.progress === 100 ? 'bg-green-100 text-green-700' :
                                    task.progress > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                {getStatusText(task.progress, task.type)}
                            </span>
                        </div>
                    </td>
                    <td className="px-6 py-4 min-w-[160px]">
                        {task.resourceId ? (
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {getResource(task.resourceId)?.name.charAt(0)}
                                </div>
                                <span className="text-gray-700 text-xs truncate">{getResource(task.resourceId)?.name}</span>
                            </div>
                        ) : (
                            <span className="text-gray-400 italic text-xs">Não Atribuído</span>
                        )}
                    </td>
                    {/* New Metric Columns */}
                    <td className="px-6 py-4 min-w-[100px] text-gray-600 text-xs">
                        <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded">{metrics.hours}h</span>
                    </td>
                    <td className="px-6 py-4 min-w-[100px] text-gray-600 text-xs text-center">
                        <span className="font-mono bg-purple-50 text-purple-700 px-2 py-1 rounded">{metrics.fte.toFixed(1)}</span>
                    </td>
                    <td className="px-6 py-4 min-w-[120px] text-gray-600 text-xs text-right">
                        <span className="font-mono text-emerald-700 font-medium whitespace-nowrap">R$ {metrics.rate.toFixed(0)}</span>
                    </td>
                    <td className="px-6 py-4 min-w-[120px] text-gray-900 text-xs font-bold text-right">
                        <span className="font-mono bg-amber-50 text-amber-800 px-2 py-1 rounded border border-amber-100 whitespace-nowrap">{formatCurrency(metrics.cost)}</span>
                    </td>
                    <td className="px-6 py-4 min-w-[120px] text-gray-900 text-xs font-bold text-right">
                        <span className="font-mono bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-100 whitespace-nowrap">{formatCurrency(metrics.realCost)}</span>
                    </td>

                    <td className="px-6 py-4 min-w-[100px] text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                title="Editar Tarefa"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                title="Excluir Tarefa"
                                disabled={!isConnected}
                                onClick={(e) => handleDelete(e, task.id)}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </td>
                </tr>
                {isExpanded && children.map(child => renderTaskRow(child, depth + 1))}
            </>
        );
    };

    // Flat list for search results
    const renderFlatList = (): React.ReactNode => {
        const filtered = tasks.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()));
        if (filtered.length === 0) {
            return (
                <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                        Nenhuma tarefa encontrada com "{filter}".
                    </td>
                </tr>
            );
        }
        return filtered.map(t => {
            const metrics = metricsMap.get(t.id) || { hours: 0, cost: 0, realCost: 0, fte: 0, rate: 0 };
            return (
                <tr key={t.id} className="group hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 bg-white" onClick={() => onEditTask(t)}>
                    <td className="px-6 py-4 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="font-medium text-gray-900">{t.name}</div>
                        <div className="text-[10px] text-gray-400">
                            {format(t.start, 'd MMM', { locale: ptBR })} - {format(t.end, 'd MMM', { locale: ptBR })}
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                            {getStatusIcon(t.progress, t.type)}
                            <span className="text-xs text-gray-600 whitespace-nowrap">{getStatusText(t.progress, t.type)}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <span className="text-gray-500 text-xs whitespace-nowrap">{getResource(t.resourceId)?.name || '-'}</span>
                    </td>

                    {/* Metrics for Flat List */}
                    <td className="px-6 py-4 text-xs font-mono text-blue-600">{metrics.hours}h</td>
                    <td className="px-6 py-4 text-xs font-mono text-purple-600 text-center">{metrics.fte.toFixed(1)}</td>
                    <td className="px-6 py-4 text-xs font-mono text-right text-emerald-600">R$ {metrics.rate.toFixed(0)}</td>
                    <td className="px-6 py-4 text-xs font-mono text-right font-bold text-amber-700">{formatCurrency(metrics.cost)}</td>
                    <td className="px-6 py-4 text-xs font-mono text-right font-bold text-emerald-700">{formatCurrency(metrics.realCost)}</td>

                    <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 text-gray-400 hover:text-indigo-600"><Edit2 size={16} /></button>
                            <button onClick={(e) => handleDelete(e, t.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                        </div>
                    </td>
                </tr>
            );
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <div className="hidden md:block">
                    <h2 className="text-2xl font-bold text-gray-900">Lista Estruturada</h2>
                    <p className="text-gray-500">Visualização detalhada com métricas financeiras e de esforço.</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Filtrar tarefas..."
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none w-64"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-6 py-3 min-w-[320px] sticky left-0 bg-gray-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Estrutura / Nome</th>
                                <th className="px-6 py-3 min-w-[140px]">Status</th>
                                <th className="px-6 py-3 min-w-[160px]">Responsável</th>
                                <th className="px-6 py-3 min-w-[100px]">Horas Úteis</th>
                                <th className="px-6 py-3 min-w-[100px] text-center">FTEs / Mês</th>
                                <th className="px-6 py-3 min-w-[120px] text-right">Valor / h</th>
                                <th className="px-6 py-3 min-w-[140px] text-right">Custo Est.</th>
                                <th className="px-6 py-3 min-w-[140px] text-right">Custo Exec.</th>
                                <th className="px-6 py-3 min-w-[100px] text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filter ? renderFlatList() : rootTasks.map(t => renderTaskRow(t))}
                            {!filter && rootTasks.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                                        Nenhuma tarefa estruturada encontrada.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
