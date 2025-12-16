import { DollarSign, Clock, Users, Target, Activity, TrendingUp, Calculator, Sparkles } from 'lucide-react';
import { Project } from '../types';

interface Stats {
    totalCost: number;
    totalRealCost?: number;
    progress: number;
    plannedProgress?: number;
    totalDuration: number;
    totalRealDuration?: number;
    spi?: number;
    cpi?: number;
}

interface ProjectSummaryProps {
    stats: Stats;
    project?: Project;
    onUpdateProject?: (project: Project) => void;
}

export const ProjectSummary = ({ stats, project, onUpdateProject }: ProjectSummaryProps) => {

    const calculateInvestment = () => {
        if (!project) return 0;
        const margin = (project.margin || 0) / 100;
        const deviation = (project.deliveryDeviation || 0) / 100;
        const tax = (project.taxRate || 0) / 100;
        const denominator = (1 - margin) * (1 - deviation) * (1 - tax);
        if (denominator <= 0.01) return 0;
        return stats.totalCost / denominator;
    };

    const investment = calculateInvestment();

    const handleUpdate = (field: keyof Project, value: string) => {
        if (!project || !onUpdateProject) return;
        const numValue = parseFloat(value);
        onUpdateProject({
            ...project,
            [field]: isNaN(numValue) ? 0 : numValue
        });
    };

    // Helper for compact metric
    const CompactMetric = ({ label, value, subValue, icon: Icon, colorClass, subColorClass }: any) => (
        <div className="flex flex-col min-w-[100px]">
            <div className="flex items-center gap-1.5 mb-0.5">
                <div className={`p-1 rounded bg-opacity-10 ${colorClass.replace('text-', 'bg-')}`}>
                    <Icon size={12} className={colorClass} />
                </div>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{label}</span>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-gray-900">{value}</span>
                {subValue && <span className={`text-xs font-medium ${subColorClass}`}>{subValue}</span>}
            </div>
        </div>
    );

    return (
        <div className="-mt-8 -mx-8 bg-white border-b border-gray-200 px-8 py-4 mb-6 shadow-sm z-20 relative">
            <div className="flex flex-col gap-4">

                {/* AI Context moved to Header */}

                {/* Bottom Row: Dense Metrics & Financial Controls */}
                <div className="flex flex-wrap items-center justify-between gap-y-4 gap-x-8">

                    {/* Project Health */}
                    <div className="flex gap-6 border-r border-gray-100 pr-6">
                        <CompactMetric
                            label="Estimado"
                            value={`R$ ${stats.totalCost.toLocaleString('pt-BR', { notation: 'compact' })}`}
                            subValue={stats.totalRealCost ? `R$ ${stats.totalRealCost.toLocaleString('pt-BR', { notation: 'compact' })}` : undefined}
                            subColorClass={stats.totalRealCost && stats.totalRealCost > stats.totalCost ? 'text-red-500' : 'text-gray-400'}
                            icon={DollarSign}
                            colorClass="text-emerald-600"
                        />
                        <CompactMetric
                            label="Prazo"
                            value={`${stats.totalDuration}d`}
                            subValue={stats.totalRealDuration ? `${stats.totalRealDuration}d` : undefined}
                            subColorClass={stats.totalRealDuration && stats.totalRealDuration > stats.totalDuration ? 'text-red-500' : 'text-gray-400'}
                            icon={Clock}
                            colorClass="text-blue-600"
                        />
                        <CompactMetric
                            label="Progresso"
                            value={`${stats.progress}%`}
                            subValue={`Meta: ${stats.plannedProgress}%`}
                            subColorClass={(stats.progress || 0) < (stats.plannedProgress || 0) ? 'text-red-500' : 'text-emerald-600'}
                            icon={Activity}
                            colorClass="text-indigo-600"
                        />
                        <CompactMetric
                            label="SPI (Prazo)"
                            value={stats.spi?.toFixed(2) || '1.00'}
                            subValue={stats.spi && stats.spi < 1 ? 'Atrasado' : 'Ok'}
                            subColorClass={stats.spi && stats.spi < 1 ? 'text-red-500' : 'text-emerald-600'}
                            icon={TrendingUp}
                            colorClass={stats.spi && stats.spi < 1 ? 'text-red-600' : 'text-emerald-600'}
                        />
                        <CompactMetric
                            label="CPI (Custo)"
                            value={stats.cpi?.toFixed(2) || '1.00'}
                            subValue={stats.cpi && stats.cpi < 1 ? 'Estourado' : 'Ok'}
                            subColorClass={stats.cpi && stats.cpi < 1 ? 'text-red-500' : 'text-emerald-600'}
                            icon={Target}
                            colorClass={stats.cpi && stats.cpi < 1 ? 'text-red-600' : 'text-emerald-600'}
                        />
                    </div>

                    {/* Financial Controller (Dense) */}
                    {project && onUpdateProject && (
                        <div className="flex items-center gap-4 flex-1 justify-end">
                            <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                <div className="flex flex-col">
                                    <label className="text-[9px] font-bold text-gray-400 uppercase">Margem</label>
                                    <div className="flex items-center">
                                        <input
                                            type="number"
                                            value={project.margin || 0}
                                            onChange={(e) => handleUpdate('margin', e.target.value)}
                                            className="w-10 bg-transparent text-xs font-bold text-gray-700 focus:outline-none border-b border-gray-300 focus:border-indigo-500 p-0 text-center"
                                        />
                                        <span className="text-xs text-gray-400 ml-0.5">%</span>
                                    </div>
                                </div>
                                <div className="w-px h-6 bg-gray-200"></div>
                                <div className="flex flex-col">
                                    <label className="text-[9px] font-bold text-gray-400 uppercase">Desvio</label>
                                    <div className="flex items-center">
                                        <input
                                            type="number"
                                            value={project.deliveryDeviation || 0}
                                            onChange={(e) => handleUpdate('deliveryDeviation', e.target.value)}
                                            className="w-10 bg-transparent text-xs font-bold text-gray-700 focus:outline-none border-b border-gray-300 focus:border-indigo-500 p-0 text-center"
                                        />
                                        <span className="text-xs text-gray-400 ml-0.5">%</span>
                                    </div>
                                </div>
                                <div className="w-px h-6 bg-gray-200"></div>
                                <div className="flex flex-col">
                                    <label className="text-[9px] font-bold text-gray-400 uppercase">Imposto</label>
                                    <div className="flex items-center">
                                        <input
                                            type="number"
                                            value={project.taxRate || 0}
                                            onChange={(e) => handleUpdate('taxRate', e.target.value)}
                                            className="w-10 bg-transparent text-xs font-bold text-gray-700 focus:outline-none border-b border-gray-300 focus:border-indigo-500 p-0 text-center"
                                        />
                                        <span className="text-xs text-gray-400 ml-0.5">%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Investment Result */}
                            <div className="flex flex-col items-end pl-4 border-l border-indigo-100">
                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                                    <Calculator size={10} /> Investimento
                                </span>
                                <span className="text-lg font-black text-indigo-900 leading-none mt-1">
                                    R$ {investment.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
