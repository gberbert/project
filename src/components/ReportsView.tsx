import { Task, Resource } from '../types';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Printer, DollarSign, Calendar, TrendingUp } from 'lucide-react';

interface ReportsViewProps {
    tasks: Task[];
    resources: Resource[];
}

export const ReportsView = ({ tasks, resources }: ReportsViewProps) => {

    // Safety check for empty data
    if (!tasks.length) {
        return <div className="p-8 text-center text-gray-500">Não há dados disponíveis para relatórios.</div>;
    }

    // Calculations
    const projectStartDate = new Date(Math.min(...tasks.map(t => t.start.getTime())));
    const projectEndDate = new Date(Math.max(...tasks.map(t => t.end.getTime())));
    const durationDays = differenceInDays(projectEndDate, projectStartDate) + 1;

    const calculateTaskCost = (t: Task) => {
        if (!t.resourceId) return 0;
        const res = resources.find(r => r.id === t.resourceId);
        if (!res) return 0;
        const days = Math.max(1, differenceInDays(t.end, t.start) + 1);
        return days * 8 * res.hourlyRate;
    };

    const totalCost = tasks.reduce((sum, t) => sum + calculateTaskCost(t), 0);

    // Weighted Progress Calculation
    const realTasks = tasks.filter(t => t.type !== 'project');
    const completedTasks = realTasks.filter(t => t.progress === 100).length;
    const totalTaskCount = realTasks.length;

    let totalWeighted = 0;
    let totalDur = 0;

    realTasks.forEach(t => {
        const dur = t.end.getTime() - t.start.getTime();
        totalWeighted += (t.progress || 0) * dur;
        totalDur += dur;
    });

    const progressPct = totalDur > 0 ? Math.round(totalWeighted / totalDur) : (totalTaskCount > 0 ? Math.round((completedTasks / totalTaskCount) * 100) : 0);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300 print:p-0 print:space-y-4">

            {/* Action Header - Hidden on Print */}
            <div className="flex justify-between items-center print:hidden">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Relatórios do Projeto</h2>
                    <p className="text-gray-500">Gere e exporte documentação detalhada do projeto.</p>
                </div>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2.5 rounded-lg hover:bg-slate-700 transition shadow-sm font-medium"
                >
                    <Printer size={18} />
                    Imprimir / Salvar PDF
                </button>
            </div>

            {/* Printable Area Container */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-none print:p-0">

                {/* Report Header */}
                <div className="border-b border-gray-200 pb-6 mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Relatório de Execução do Projeto</h1>
                        <p className="text-gray-500">Gerado em {format(new Date(), 'dd MMMM yyyy', { locale: ptBR })}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-indigo-600 mb-1">Projetos</div>
                        <div className="text-sm text-gray-400">Sistema de Gestão de Projetos</div>
                    </div>
                </div>

                {/* Executive Summary Cards */}
                <div className="grid grid-cols-3 gap-6 mb-8 print:gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                            <Calendar size={16} />
                            <span className="text-xs font-semibold uppercase tracking-wider">Cronograma</span>
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                            {format(projectStartDate, 'd MMM, yyyy', { locale: ptBR })} - {format(projectEndDate, 'd MMM, yyyy', { locale: ptBR })}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">{durationDays} Dias de Duração</div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                            <DollarSign size={16} />
                            <span className="text-xs font-semibold uppercase tracking-wider">Financeiro</span>
                        </div>
                        <div className="text-lg font-bold text-green-700">
                            R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">Custo Total Estimado</div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                            <TrendingUp size={16} />
                            <span className="text-xs font-semibold uppercase tracking-wider">Progresso</span>
                        </div>
                        <div className="text-lg font-bold text-indigo-700">
                            {progressPct}% Concluído
                        </div>
                        <div className="text-sm text-gray-500 mt-1">{completedTasks} / {totalTaskCount} Tarefas Feitas</div>
                    </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-gray-800 border-b border-gray-200 pb-2">Detalhamento de Custos e Recursos</h3>

                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-600 font-bold">
                            <tr>
                                <th className="px-4 py-3 rounded-tl-lg">Tarefa</th>
                                <th className="px-4 py-3">Recurso Atribuído</th>
                                <th className="px-4 py-3 text-right">Duração</th>
                                <th className="px-4 py-3 text-right">Progresso</th>
                                <th className="px-4 py-3 text-right rounded-tr-lg">Custo (Est.)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 border border-gray-100">
                            {tasks.filter(t => t.type !== 'project').map(task => {
                                const cost = calculateTaskCost(task);
                                const resourceName = resources.find(r => r.id === task.resourceId)?.name || '-';

                                return (
                                    <tr key={task.id} className="print:break-inside-avoid">
                                        <td className="px-4 py-3 font-medium text-gray-900">{task.name}</td>
                                        <td className="px-4 py-3 text-gray-600">{resourceName}</td>
                                        <td className="px-4 py-3 text-right text-gray-600">
                                            {Math.ceil((task.end.getTime() - task.start.getTime()) / (1000 * 60 * 60 * 24))}d
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${task.progress === 100 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {task.progress}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-900">
                                            {cost > 0 ? `R$ ${cost.toLocaleString('pt-BR')}` : '-'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold text-gray-800">
                            <tr>
                                <td colSpan={4} className="px-4 py-3 text-right">Total Estimado:</td>
                                <td className="px-4 py-3 text-right text-green-700">R$ {totalCost.toLocaleString('pt-BR')}</td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Signature Area for Print */}
                    <div className="hidden print:flex justify-between mt-12 pt-12">
                        <div className="border-t border-gray-300 w-64 pt-2">
                            <p className="text-sm font-bold text-gray-800">Gerente de Projeto</p>
                            <p className="text-xs text-gray-500">Assinatura / Data</p>
                        </div>
                        <div className="border-t border-gray-300 w-64 pt-2">
                            <p className="text-sm font-bold text-gray-800">Aprovação do Cliente</p>
                            <p className="text-xs text-gray-500">Assinatura / Data</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center text-gray-400 text-xs print:fixed print:bottom-4 print:left-0 print:w-full">
                    Projetos - Gestão Simples de Projetos
                </div>

            </div>
        </div>
    );
};
