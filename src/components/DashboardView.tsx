import { Task, Resource } from '../types';
import { differenceInDays, isPast, isToday, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, TrendingUp, AlertCircle, CheckCircle2, DollarSign, Clock } from 'lucide-react';

interface DashboardViewProps {
    tasks: Task[];
    resources: Resource[];
}

export const DashboardView = ({ tasks, resources }: DashboardViewProps) => {
    // 1. Calculate Statistics
    const totalTasks = tasks.filter(t => t.type !== 'project').length;
    const completedTasks = tasks.filter(t => t.type !== 'project' && t.progress === 100).length;
    const inProgressTasks = tasks.filter(t => t.type !== 'project' && t.progress > 0 && t.progress < 100).length;
    const todoTasks = tasks.filter(t => t.type !== 'project' && t.progress === 0).length;

    const delayedTasks = tasks.filter(t =>
        t.type !== 'project' && t.progress < 100 && isPast(t.end)
    ).length;

    const upcomingTasks = tasks
        .filter(t => t.type !== 'project' && t.progress < 100 && !isPast(t.end))
        .sort((a, b) => a.end.getTime() - b.end.getTime())
        .slice(0, 5);

    // Weighted Progress Calculation (Duration * Progress)
    const realTasks = tasks.filter(t => t.type !== 'project');
    let totalWeighted = 0;
    let totalDur = 0;

    realTasks.forEach(t => {
        const dur = t.end.getTime() - t.start.getTime();
        totalWeighted += (t.progress || 0) * dur;
        totalDur += dur;
    });

    const weightedProgress = totalDur > 0 ? Math.round(totalWeighted / totalDur) :
        (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);

    // Cost Calculation
    const calculateCost = (t: Task) => {
        if (!t.resourceId) return 0;
        const res = resources.find(r => r.id === t.resourceId);
        if (!res) return 0;
        const days = Math.max(1, differenceInDays(t.end, t.start) + 1);
        return days * 8 * res.hourlyRate;
    };

    const totalCost = tasks.reduce((sum, t) => sum + calculateCost(t), 0);

    // Resource Workload
    const resourceStats = resources.map(res => {
        const assignedTasks = tasks.filter(t => t.resourceId === res.id);
        const hours = assignedTasks.reduce((sum, t) => sum + (Math.max(1, differenceInDays(t.end, t.start) + 1) * 8), 0);
        return { ...res, taskCount: assignedTasks.length, hours };
    }).sort((a, b) => b.hours - a.hours);

    // Chart Data (Simple CSS Conic Gradient)
    const todoPct = totalTasks ? (todoTasks / totalTasks) * 100 : 0;
    const inProgressPct = totalTasks ? (inProgressTasks / totalTasks) * 100 : 0;
    const donePct = totalTasks ? (completedTasks / totalTasks) * 100 : 0;

    const donutStyle = {
        background: `conic-gradient(
            #3b82f6 0% ${todoPct}%, 
            #f59e0b ${todoPct}% ${todoPct + inProgressPct}%, 
            #22c55e ${todoPct + inProgressPct}% 100%
        )`
    };

    return (
        <div className="space-y-6 lg:p-4 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Dashboard do Projeto</h2>
                <p className="text-gray-500">Insights e métricas em tempo real.</p>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Progresso Total</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-1">
                            {weightedProgress}%
                        </h3>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <TrendingUp size={20} />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Custo Total</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-1">
                            R$ {totalCost.toLocaleString('pt-BR')}
                        </h3>
                    </div>
                    <div className="p-2 bg-green-50 rounded-lg text-green-600">
                        <DollarSign size={20} />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Tarefas Pendentes</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-1">{todoTasks + inProgressTasks}</h3>
                    </div>
                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                        <Clock size={20} />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Atrasadas</p>
                        <h3 className={`text-2xl font-bold mt-1 ${delayedTasks > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {delayedTasks}
                        </h3>
                    </div>
                    <div className={`p-2 rounded-lg ${delayedTasks > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
                        <AlertCircle size={20} />
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">

                {/* Task Status Chart */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm lg:col-span-1 flex flex-col items-center justify-center">
                    <h3 className="text-lg font-bold text-gray-800 self-start mb-6">Status das Tarefas</h3>
                    <div className="relative w-48 h-48 rounded-full shadow-inner" style={donutStyle}>
                        <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center flex-col">
                            <span className="text-3xl font-bold text-gray-800">{totalTasks}</span>
                            <span className="text-xs text-gray-400 uppercase font-semibold">Tarefas</span>
                        </div>
                    </div>
                    <div className="w-full mt-8 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                <span className="text-gray-600">A Fazer</span>
                            </div>
                            <span className="font-bold text-gray-800">{todoTasks}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                                <span className="text-gray-600">Em Andamento</span>
                            </div>
                            <span className="font-bold text-gray-800">{inProgressTasks}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                <span className="text-gray-600">Concluídas</span>
                            </div>
                            <span className="font-bold text-gray-800">{completedTasks}</span>
                        </div>
                    </div>
                </div>

                {/* Resource & Deadlines */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm lg:col-span-2 flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-gray-50">
                        <h3 className="text-lg font-bold text-gray-800">Alocação de Recursos</h3>
                    </div>
                    <div className="p-6 overflow-y-auto max-h-80">
                        {resourceStats.map(stat => (
                            <div key={stat.id} className="mb-4">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-gray-700">{stat.name}</span>
                                    <span className="text-gray-500">{stat.hours}h ({stat.taskCount} tarefas)</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div
                                        className="bg-indigo-500 h-2 rounded-full transition-all duration-1000"
                                        style={{ width: `${Math.min(100, (stat.hours / 160) * 100)}%` }} // Assuming 160h month benchmark
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {resourceStats.length === 0 && <p className="text-gray-400 text-sm">Nenhum recurso atribuído.</p>}
                    </div>

                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex-1">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Próximos Prazos</h3>
                        <div className="space-y-3">
                            {upcomingTasks.map(task => (
                                <div key={task.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-10 bg-indigo-500 rounded-full"></div>
                                        <div>
                                            <h4 className="font-bold text-sm text-gray-800">{task.name}</h4>
                                            <p className="text-xs text-gray-500">{format(task.end, 'dd MMM yyyy', { locale: ptBR })}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-medium px-2 py-1 bg-amber-50 text-amber-700 rounded-full">
                                        {differenceInDays(task.end, new Date())} dias restantes
                                    </span>
                                </div>
                            ))}
                            {upcomingTasks.length === 0 && <p className="text-gray-400 text-sm italic">Sem prazos próximos.</p>}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
