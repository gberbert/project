import { Task, Resource } from '../types';
import { differenceInDays, isPast, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, AlertCircle, CheckCircle2, Clock, Zap, AlertTriangle, Users } from 'lucide-react';
import { EditableText } from './EditableText';

interface DashboardViewProps {
    tasks: Task[];
    resources: Resource[];
}

export const DashboardView = ({ tasks, resources }: DashboardViewProps) => {
    // 1. Calculate Statistics
    const realTasks = tasks.filter(t => t.type !== 'project');
    const completedTasks = realTasks.filter(t => t.progress === 100).length;
    const inProgressTasks = realTasks.filter(t => t.progress > 0 && t.progress < 100).length;
    const todoTasks = realTasks.filter(t => t.progress === 0).length;
    const totalTasks = realTasks.length;

    const blockedTasks = realTasks.filter(t => t.status === 'blocked' || t.name.toLowerCase().includes('[block]'));

    // Simple heuristic for "Tasks due this week"
    const now = new Date();
    const endOfWeek = new Date();
    endOfWeek.setDate(now.getDate() + (5 - now.getDay())); // Until Friday

    const dueThisWeek = realTasks.filter(t =>
        t.progress < 100 &&
        t.end <= endOfWeek &&
        t.end >= now
    );

    const delayedTasks = realTasks.filter(t => t.progress < 100 && isPast(t.end)).length;

    // Resource Workload (Overload detection: > 3 active tasks)
    const resourceStats = resources.map(res => {
        const activeTasks = realTasks.filter(t => t.resourceId === res.id && t.progress < 100 && t.progress > 0);
        return { ...res, activeCount: activeTasks.length, activeTasks };
    }).sort((a, b) => b.activeCount - a.activeCount);

    const overloadedResources = resourceStats.filter(r => r.activeCount > 2);

    // Productivity: Completed tasks (Mock daily velocity if no history, just using Total Completed for now as "Total Deliveries")

    return (
        <div className="space-y-6 lg:p-4 animate-in fade-in duration-500">
            {/* Header with "Diário de Bordo" */}
            <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
                <div className="w-full md:w-1/3">
                    <h2 className="text-2xl font-bold text-gray-900">Sala de Guerra (War Room)</h2>
                    <p className="text-gray-500 text-sm">Painel de execução tática diária e resolução de bloqueios.</p>
                </div>

                <div className="w-full md:w-2/3 bg-blue-50 border border-blue-100 rounded-xl p-4 relative">
                    <div className="absolute top-4 right-4">
                        <Zap size={16} className="text-blue-400" />
                    </div>
                    <EditableText
                        id="daily_log"
                        label="Diário de Bordo (Status do Dia)"
                        initialValue=""
                        placeholder="Escreva aqui o status rápido do dia. Ex: 'Deploy da API instável pela manhã. Equipe focada em hotfix.'"
                        className="bg-transparent border-none p-0"
                    />
                </div>
            </div>

            {/* War Room Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                {/* Blocked Items Alert */}
                <div className={`p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between ${blockedTasks.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                    <div>
                        <p className={`text-sm font-bold uppercase tracking-wider ${blockedTasks.length > 0 ? 'text-red-700' : 'text-gray-500'}`}>Bloqueios Ativos</p>
                        <h3 className={`text-3xl font-bold mt-1 ${blockedTasks.length > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                            {blockedTasks.length}
                        </h3>
                    </div>
                    <div className={`p-3 rounded-full ${blockedTasks.length > 0 ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-400'}`}>
                        <AlertTriangle size={24} />
                    </div>
                </div>

                {/* Sprint/Week Goals */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Metas da Semana</p>
                        <h3 className="text-3xl font-bold text-gray-900 mt-1">
                            {dueThisWeek.length}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">Tarefas para entregar até sexta</p>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
                        <TargetIcon />
                    </div>
                </div>

                {/* Velocity Indicator */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Entregas Totais</p>
                        <h3 className="text-3xl font-bold text-gray-900 mt-1">
                            {completedTasks}
                        </h3>
                    </div>
                    <div className="p-3 bg-green-50 rounded-full text-green-600">
                        <CheckCircle2 size={24} />
                    </div>
                </div>

                {/* Latency/Delay */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Em Atraso</p>
                        <h3 className={`text-3xl font-bold mt-1 ${delayedTasks > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                            {delayedTasks}
                        </h3>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-full text-gray-400">
                        <Clock size={24} />
                    </div>
                </div>
            </div>

            {/* Main Action Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">

                {/* Left Column: Action List */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Blocked or Urgent List */}
                    <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
                        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
                            <h3 className="font-bold text-red-900 flex items-center gap-2">
                                <AlertCircle size={18} />
                                Prioridade Alta: Bloqueios & Atrasos
                            </h3>
                            <span className="text-xs font-bold bg-white text-red-700 px-2 py-1 rounded shadow-sm">
                                {blockedTasks.length + delayedTasks} Itens
                            </span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {[...blockedTasks, ...realTasks.filter(t => isPast(t.end) && t.progress < 100 && !blockedTasks.includes(t))].slice(0, 5).map(task => (
                                <div key={task.id} className="p-4 hover:bg-gray-50 flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${task.status === 'blocked' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}></div>
                                        <div>
                                            <p className="font-semibold text-gray-800 text-sm">{task.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {resources.find(r => r.id === task.resourceId)?.name || 'Sem dono'} •
                                                <span className="ml-1 text-red-500">
                                                    {task.status === 'blocked' ? 'BLOQUEADO' : `${differenceInDays(new Date(), task.end)} dias atrasado`}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <button className="text-xs font-medium text-indigo-600 hover:text-indigo-800 opacity-0 group-hover:opacity-100 transition-opacity">
                                        Resolver
                                    </button>
                                </div>
                            ))}
                            {(blockedTasks.length + delayedTasks) === 0 && (
                                <div className="p-8 text-center text-gray-400 text-sm">
                                    <CheckCircle2 size={32} className="mx-auto mb-2 text-green-300" />
                                    Nenhuma urgência crítica. Bom trabalho!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Week's Playlist */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800">Playlist da Semana (Entregas Curtas)</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {dueThisWeek.length > 0 ? dueThisWeek.map(task => (
                                <div key={task.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-300 text-xs font-bold">
                                            {task.progress}%
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-800 text-sm">{task.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {format(task.end, 'EEEE (dd/MM)', { locale: ptBR })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex -space-x-2">
                                        {/* Avatar placeholder */}
                                        <div className="w-6 h-6 rounded-full bg-gray-200 border border-white flex items-center justify-center text-[10px] text-gray-500 font-bold">
                                            {(resources.find(r => r.id === task.resourceId)?.name || '?').charAt(0)}
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-6 text-center text-gray-400 text-sm italic">
                                    Sem entregas agendadas para o resto da semana.
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Right Column: Team Radar */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Users size={18} />
                        Radar da Equipe
                    </h3>

                    <div className="space-y-6">
                        {overloadedResources.length > 0 && (
                            <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 mb-4">
                                <p className="text-xs font-bold text-amber-800 uppercase mb-1 flex items-center gap-1">
                                    <AlertTriangle size={12} /> Sobrecarga Detectada
                                </p>
                                <p className="text-xs text-amber-700">
                                    {overloadedResources.map(r => r.name.split(' ')[0]).join(', ')} tem mais de 2 tarefas ativas simultâneas.
                                </p>
                            </div>
                        )}

                        {resourceStats.map(res => (
                            <div key={res.id}>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                            {res.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-700">{res.name}</p>
                                            <p className="text-xs text-gray-400">{res.role}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-lg font-bold ${res.activeCount > 2 ? 'text-amber-600' : 'text-gray-900'}`}>{res.activeCount}</span>
                                        <span className="text-xs text-gray-400 block">ativas</span>
                                    </div>
                                </div>
                                {/* Active Tasks Micro-list */}
                                {res.activeTasks.length > 0 && (
                                    <div className="pl-10 space-y-1">
                                        {res.activeTasks.map(t => (
                                            <div key={t.id} className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                {t.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="w-full bg-gray-100 h-1 mt-3 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${res.activeCount > 2 ? 'bg-amber-400' : 'bg-green-400'}`}
                                        style={{ width: `${Math.min(100, (res.activeCount / 5) * 100)}%` }} // Bench 5 max
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>

                </div>

            </div>
        </div>
    );
};

// Helper Icon
const TargetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
);
