import { DollarSign, Clock, Users, Target, Activity, TrendingUp } from 'lucide-react';

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

export const ProjectSummary = ({ stats }: { stats: Stats }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Card 1: Costs */}
            <div className="bg-white px-5 py-4 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="flex items-center justify-between h-full">
                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
                                <DollarSign size={14} strokeWidth={2.5} />
                            </div>
                            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Estimado</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900 tracking-tight">
                            R$ {stats.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>

                    <div className="w-px h-10 bg-gray-100 mx-1"></div>

                    <div className="flex flex-col items-end justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Realizado</span>
                            <div className={`p-1.5 rounded-md ${stats.totalRealCost && stats.totalRealCost > stats.totalCost
                                ? 'bg-red-50 text-red-500'
                                : 'bg-gray-50 text-gray-400'
                                }`}>
                                <DollarSign size={14} strokeWidth={2.5} />
                            </div>
                        </div>
                        <span className={`text-lg font-bold tracking-tight ${stats.totalRealCost && stats.totalRealCost > stats.totalCost
                            ? 'text-red-600'
                            : 'text-gray-600'
                            }`}>
                            R$ {(stats.totalRealCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Card 2: Duration */}
            <div className="bg-white px-5 py-4 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="flex items-center justify-between h-full">
                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                                <Clock size={14} strokeWidth={2.5} />
                            </div>
                            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Estimado</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900 tracking-tight">
                            {stats.totalDuration} <span className="text-xs font-medium text-gray-400">dias</span>
                        </span>
                    </div>

                    <div className="w-px h-10 bg-gray-100 mx-1"></div>

                    <div className="flex flex-col items-end justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Realizado</span>
                            <div className={`p-1.5 rounded-md ${stats.totalRealDuration && stats.totalRealDuration > stats.totalDuration
                                ? 'bg-red-50 text-red-500'
                                : 'bg-gray-50 text-gray-400'
                                }`}>
                                <Clock size={14} strokeWidth={2.5} />
                            </div>
                        </div>
                        <span className={`text-lg font-bold tracking-tight ${stats.totalRealDuration && stats.totalRealDuration > stats.totalDuration
                            ? 'text-red-600'
                            : 'text-gray-600'
                            }`}>
                            {stats.totalRealDuration || 0} <span className="text-xs font-medium text-gray-400">dias</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Card 3: Progress */}
            <div className="bg-white px-5 py-4 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="flex items-center justify-between h-full">
                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
                                <Target size={14} strokeWidth={2.5} />
                            </div>
                            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Planejado</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900 tracking-tight">
                            {stats.plannedProgress ?? 0}%
                        </span>
                    </div>

                    <div className="w-px h-10 bg-gray-100 mx-1"></div>

                    <div className="flex flex-col items-end justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Realizado</span>
                            <div className={`p-1.5 rounded-md ${(stats.progress || 0) < (stats.plannedProgress || 0)
                                ? 'bg-red-50 text-red-500'
                                : 'bg-emerald-50 text-emerald-600'
                                }`}>
                                <Activity size={14} strokeWidth={2.5} />
                            </div>
                        </div>
                        <span className={`text-lg font-bold tracking-tight ${(stats.progress || 0) < (stats.plannedProgress || 0)
                            ? 'text-red-600'
                            : 'text-gray-600'
                            }`}>
                            {stats.progress}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Card 4: Performance Indicators */}
            <div className="bg-white px-5 py-4 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="flex items-center justify-between h-full">
                    {/* SPI */}
                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-1.5 bg-orange-50 text-orange-600 rounded-md">
                                <TrendingUp size={14} strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 leading-none">SPI</span>
                                <span className="text-[8px] text-gray-300 font-medium leading-none mt-0.5">Prazo</span>
                            </div>
                        </div>
                        <span className={`text-lg font-bold tracking-tight ${(stats.spi || 0) < 1 ? 'text-red-500' : 'text-emerald-600'
                            }`}>
                            {(stats.spi || 0).toFixed(2)}
                        </span>
                    </div>

                    <div className="w-px h-10 bg-gray-100 mx-1"></div>

                    {/* CPI */}
                    <div className="flex flex-col items-end justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 leading-none">CPI</span>
                                <span className="text-[8px] text-gray-300 font-medium leading-none mt-0.5">Custo</span>
                            </div>
                            <div className="p-1.5 bg-teal-50 text-teal-600 rounded-md">
                                <TrendingUp size={14} strokeWidth={2.5} />
                            </div>
                        </div>
                        <span className={`text-lg font-bold tracking-tight ${(stats.cpi || 0) < 1 ? 'text-red-500' : 'text-emerald-600'
                            }`}>
                            {(stats.cpi || 0).toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
