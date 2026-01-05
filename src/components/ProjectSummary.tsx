import { DollarSign, Clock, Users, Target, Activity, TrendingUp, Calculator, Sparkles, Calendar, AlertTriangle, Lock, Unlock } from 'lucide-react';
import { useState } from 'react';
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
    startDate?: Date;
    endDate?: Date;
    plannedDurationToDate?: number;
    realDurationToDate?: number;
    plannedCostToDate?: number;
    realCostToDate?: number;
    totalClientBlockageCost?: number;
    totalClientBlockageHours?: number;
}

interface ProjectSummaryProps {
    stats: Stats;
    project?: Project;
    onUpdateProject?: (project: Project) => void;
    onShowClientBlockages?: () => void;
}

export const ProjectSummary = ({ stats, project, onUpdateProject, onShowClientBlockages }: ProjectSummaryProps) => {

    const isSold = !!project?.fixedSnapshot;

    const calculateInvestment = () => {
        if (!project) return 0;
        if (project.fixedSnapshot) return project.fixedSnapshot.price;

        const c = stats.totalCost;
        const m = (project.margin || 0) / 100;
        const d = (project.deliveryDeviation || 0) / 100;
        const t = (project.taxRate || 0) / 100;

        // Calculate Markups
        const costWithMargin = (1 - m) > 0.001 ? (c / (1 - m)) : c;
        const marginDelta = costWithMargin - c;

        const costWithDeviation = (1 - d) > 0.001 ? (c / (1 - d)) : c;
        const deviationDelta = costWithDeviation - c;

        // Total Price = (Base Cost + Margin Markup + Deviation Markup) / (1 - Tax)
        const numerator = c + marginDelta + deviationDelta;
        const denominator = 1 - t;

        if (denominator <= 0.001) return 0;
        return numerator / denominator;
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

    const handleUpdateFixedPrice = (value: string) => {
        if (!project || !onUpdateProject || !project.fixedSnapshot) return;
        const numValue = parseFloat(value);
        onUpdateProject({
            ...project,
            fixedSnapshot: {
                ...project.fixedSnapshot,
                price: isNaN(numValue) ? 0 : numValue
            }
        });
    }

    const toggleSoldStatus = () => {
        if (!project || !onUpdateProject) return;
        if (isSold) {
            // Already sold. Maybe allow un-sell?
            // "Ao ser clicado o botão passa a se chamar editar"
            // We just keep it as is.
        } else {
            // Snapshot everything
            onUpdateProject({
                ...project,
                fixedSnapshot: {
                    cost: stats.totalCost,
                    duration: stats.totalDuration,
                    startDate: stats.startDate,
                    endDate: stats.endDate,
                    margin: project.margin || 0,
                    taxRate: project.taxRate || 0,
                    deliveryDeviation: project.deliveryDeviation || 0,
                    price: investment
                }
            });
        }
    };

    // Helper for compact metric
    const CompactMetric = ({ label, value, subValue, icon: Icon, colorClass, subColorClass }: any) => (
        <div className="flex flex-col min-w-[80px]">
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

    const getMetricStatus = (value: number | undefined, isCost: boolean) => {
        if (value === undefined) return { label: '-', color: 'text-gray-400', subColor: 'text-gray-400' };

        if (value < 0.95) {
            return {
                label: isCost ? 'Estourado' : 'Atrasado',
                color: 'text-red-600',
                subColor: 'text-red-500'
            };
        }
        if (value > 1.05) {
            return {
                label: 'Analisar',
                color: 'text-orange-600',
                subColor: 'text-orange-500'
            };
        }
        return {
            label: 'Ok',
            color: 'text-emerald-600',
            subColor: 'text-emerald-600'
        };
    };

    const spiStatus = getMetricStatus(stats.spi, false);
    const cpiStatus = getMetricStatus(stats.cpi, true);

    const formatDate = (date: any) => {
        if (!date) return '-';
        const d = new Date(date.seconds ? date.seconds * 1000 : date);
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Derived Sales Data (Plan or Fixed)
    const salesData = project?.fixedSnapshot || {
        cost: stats.totalCost,
        duration: stats.totalDuration,
        startDate: stats.startDate,
        endDate: stats.endDate,
        margin: project?.margin || 0,
        taxRate: project?.taxRate || 0,
        deliveryDeviation: project?.deliveryDeviation || 0,
        price: investment
    };

    // Calculate individual monetary values for display
    const mDec = (salesData.margin || 0) / 100;
    const dDec = (salesData.deliveryDeviation || 0) / 100;
    const marginValue = (1 - mDec) > 0.001 ? ((salesData.cost / (1 - mDec)) - salesData.cost) : 0;
    const deviationValue = (1 - dDec) > 0.001 ? ((salesData.cost / (1 - dDec)) - salesData.cost) : 0;

    // Derived Operational Data
    // User requested "Custo Real" to be exactly the sum of Monthly Costs + Other Costs tabs.
    const currentTotalCost = (() => {
        if (!project) return stats.totalCost;
        let total = 0;
        if (project.monthlyCosts) {
            total += project.monthlyCosts.reduce((acc, item) => acc + (item.cost || 0), 0);
        }
        if (project.otherCosts) {
            project.otherCosts.forEach(oc => {
                if (oc.values) {
                    total += Object.values(oc.values).reduce((acc: number, val: number) => acc + (val || 0), 0);
                }
            });
        }
        return total > 0 ? total : stats.totalCost;
    })();
    const currentTotalDuration = stats.totalDuration;
    const currentDeviation = project?.deliveryDeviation || 0;

    // Field 5: Receita NET = Investimento * (1 - Imposto)
    const netRevenue = salesData.price * (1 - (salesData.taxRate / 100));

    // Field 3: Margem Real = ((Receita NET - Custo) / Receita NET) * 100 - Desvio
    // Field 3: Margem Real
    // Formula: ([RECEITA NET] - ([% DESVIO] * ([VALOR $ DESVIO DE VENDA]/[% DESVIO VENDA])) - [CUSTO REAL]) / ([RECEITA NET] - [VALOR $ DESVIO DE VENDA])
    const salesDevPercent = salesData.deliveryDeviation || 1;
    const currentDevPercent = project?.deliveryDeviation || 0;
    const currentDeviationCost = currentDevPercent * (deviationValue / salesDevPercent);

    const realMarginDenominator = netRevenue - deviationValue;
    const realMarginNumerator = netRevenue - currentDeviationCost - currentTotalCost;

    const realMargin = realMarginDenominator > 0.001
        ? (realMarginNumerator / realMarginDenominator) * 100
        : 0;

    const [isEditingPrice, setIsEditingPrice] = useState(false);

    return (
        <div className="-mt-8 -mx-8 bg-white border-b border-gray-200 px-8 py-6 mb-6 shadow-sm z-20 relative">
            <div className="flex flex-col gap-6">

                {/* ROW 1: INDICADORES DE VENDA (Unified) */}
                <div className={`relative p-5 rounded-xl border transition-all ${isSold ? 'bg-indigo-50/30 border-indigo-200' : 'bg-white border-gray-200'}`}>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                        <div className="flex items-center gap-2">
                            {/* ... Header content ... */}
                            <div className={`p-1.5 rounded-lg ${isSold ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                <Sparkles size={16} />
                            </div>
                            <div>
                                <h3 className={`text-sm font-bold uppercase tracking-wider ${isSold ? 'text-indigo-900' : 'text-emerald-900'}`}>Indicadores de Venda</h3>
                                <p className="text-xs text-gray-500">{isSold ? 'Valores congelados conforme contrato vendido.' : 'Estimativas baseadas no planejamento atual.'}</p>
                            </div>
                        </div>
                        {project && (
                            <button
                                onClick={toggleSoldStatus}
                                className={`text-[10px] uppercase font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors border ${isSold
                                    ? 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    }`}
                            >
                                {isSold ? <Lock size={10} /> : <Unlock size={10} />}
                                {isSold ? 'Editar (Vendido)' : 'Marcar como Vendido'}
                            </button>
                        )}
                    </div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6">
                        {/* 1. Estimado */}
                        <CompactMetric
                            label="Estimado"
                            value={`R$ ${salesData.cost.toLocaleString('pt-BR', { notation: 'compact' })}`}
                            icon={DollarSign}
                            colorClass="text-gray-600"
                        />
                        {/* 2. Prazo */}
                        <CompactMetric
                            label="Prazo"
                            value={`${salesData.duration}d`}
                            icon={Clock}
                            colorClass="text-gray-600"
                        />
                        {/* 3. Início */}
                        <CompactMetric
                            label="Início"
                            value={formatDate(salesData.startDate)}
                            icon={Calendar}
                            colorClass="text-gray-600"
                        />
                        {/* 4. Fim */}
                        <CompactMetric
                            label="Fim"
                            value={formatDate(salesData.endDate)}
                            icon={Calendar}
                            colorClass="text-gray-600"
                        />

                        {/* 5. Margem */}
                        <div>
                            <span className="text-[10px] text-gray-400 font-bold block mb-0.5 uppercase">MARGEM</span>
                            <span className="text-sm font-bold text-gray-800">{salesData.margin}%</span>
                            <span className="text-[10px] text-gray-400 font-medium block">
                                R$ {marginValue.toLocaleString('pt-BR', { notation: 'compact' })}
                            </span>
                        </div>
                        {/* 6. Desvio */}
                        <div>
                            <span className="text-[10px] text-gray-400 font-bold block mb-0.5 uppercase">DESVIO</span>
                            <span className="text-sm font-bold text-gray-800">{salesData.deliveryDeviation}%</span>
                            <span className="text-[10px] text-gray-400 font-medium block">
                                R$ {deviationValue.toLocaleString('pt-BR', { notation: 'compact' })}
                            </span>
                        </div>
                        {/* 7. Imposto */}
                        <div>
                            <span className="text-[10px] text-gray-400 font-bold block mb-0.5 uppercase">IMPOSTO</span>
                            <span className="text-sm font-bold text-gray-800">{salesData.taxRate}%</span>
                        </div>
                        {/* 8. Investimento (Editable if sold) */}
                        <div className={`border-l pl-4 ${isSold ? 'border-indigo-200' : 'border-gray-200'}`}>
                            <span className={`text-[10px] font-bold block mb-0.5 uppercase ${isSold ? 'text-indigo-600' : 'text-emerald-600'}`}>Investimento</span>
                            {isSold ? (
                                isEditingPrice ? (
                                    <div className="flex items-center gap-1 border-b border-indigo-300 border-dashed">
                                        <span className="text-sm font-bold text-indigo-700 leading-none">R$</span>
                                        <input
                                            type="number"
                                            autoFocus
                                            value={salesData.price}
                                            onChange={(e) => handleUpdateFixedPrice(e.target.value)}
                                            onBlur={() => setIsEditingPrice(false)}
                                            onKeyDown={(e) => e.key === 'Enter' && setIsEditingPrice(false)}
                                            className="w-full bg-transparent text-sm font-bold text-indigo-700 leading-none focus:outline-none"
                                        />
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => setIsEditingPrice(true)}
                                        className="cursor-pointer hover:bg-indigo-50 rounded px-1 -ml-1 transition-colors group"
                                        title="Clique para editar"
                                    >
                                        <span className="text-sm font-bold text-indigo-700 leading-none group-hover:underline decoration-dashed underline-offset-4">
                                            R$ {salesData.price.toLocaleString('pt-BR', { notation: 'compact' })}
                                        </span>
                                    </div>
                                )
                            ) : (
                                <span className="text-sm font-bold text-emerald-700 leading-none">
                                    R$ {salesData.price.toLocaleString('pt-BR', { notation: 'compact' })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ROW 2: INDICADORES DA OPERAÇÃO (Mirrored) */}
                {isSold && (
                    <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                        <div className="flex items-center gap-2 mb-6">
                            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
                                <Activity size={16} />
                            </div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-900">Indicadores da Operação</h3>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6">
                            {/* 1. Custo Real */}
                            <CompactMetric
                                label="Custo Real"
                                value={`R$ ${currentTotalCost.toLocaleString('pt-BR', { notation: 'compact' })}`}
                                subValue={currentTotalCost > salesData.cost ? 'Estourado' : undefined}
                                subColorClass="text-red-500"
                                icon={DollarSign}
                                colorClass="text-blue-600"
                            />

                            {/* 2. Prazo Real */}
                            <CompactMetric
                                label="Prazo Real"
                                value={`${currentTotalDuration}d`}
                                subValue={currentTotalDuration > salesData.duration ? 'Atrasado' : undefined}
                                subColorClass="text-red-500"
                                icon={Clock}
                                colorClass="text-blue-600"
                            />

                            {/* 3. Início Real */}
                            <CompactMetric
                                label="Início Atual"
                                value={formatDate(stats.startDate)}
                                icon={Calendar}
                                colorClass="text-blue-600"
                            />

                            {/* 4. Fim Real */}
                            <CompactMetric
                                label="Fim Atual"
                                value={formatDate(stats.endDate)}
                                icon={Calendar}
                                colorClass="text-blue-600"
                            />

                            {/* 5. Margem Real */}
                            <div>
                                <span className="text-[10px] text-blue-400 font-bold block mb-0.5 uppercase">MARGEM REAL</span>
                                <span className={`text-sm font-bold ${realMargin < salesData.margin ? 'text-red-600' : 'text-blue-900'}`}>
                                    {realMargin.toFixed(1)}%
                                </span>
                            </div>

                            {/* 6. Desvio Real (Editable) */}
                            <div>
                                <span className="text-[10px] text-blue-400 font-bold block mb-0.5 uppercase">DESVIO REAL</span>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        value={project?.deliveryDeviation || 0}
                                        onChange={(e) => handleUpdate('deliveryDeviation', e.target.value)}
                                        className="w-12 bg-transparent text-sm font-bold text-blue-900 border-b border-blue-200 focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                    <span className="text-xs text-blue-400 font-bold">%</span>
                                </div>
                            </div>

                            {/* 7. Imposto (Mirrored) */}
                            <div>
                                <span className="text-[10px] text-gray-300 font-bold block mb-0.5 uppercase">IMPOSTO</span>
                                <span className="text-sm font-bold text-gray-400">{salesData.taxRate}%</span>
                            </div>

                            {/* 8. Receita NET */}
                            <div className="border-l border-blue-100 pl-4">
                                <span className="text-[10px] font-bold block mb-0.5 uppercase text-blue-600">Receita NET</span>
                                <span className="text-base font-black leading-none text-blue-700">
                                    {netRevenue.toLocaleString('pt-BR', { notation: 'compact' })}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6 pt-6 border-t border-blue-100/50">

                            {/* Col 1: Time Execution */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    <Activity size={12} className="text-blue-500" /> Execução (Prazo)
                                </span>
                                <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100 shadow-sm h-full">
                                    <div>
                                        <span className="text-[10px] text-gray-400 block uppercase font-semibold">% Planejado</span>
                                        <span className="text-lg font-bold text-gray-800">{(stats.plannedProgress || 0).toFixed(1)}<span className="text-xs text-gray-500 ml-0.5">%</span></span>
                                    </div>
                                    <div className="w-px h-8 bg-gray-100"></div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-gray-400 block uppercase font-semibold">% Executado</span>
                                        <span className={`text-lg font-bold ${(stats.progress || 0) < (stats.plannedProgress || 0) ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {(stats.progress || 0).toFixed(1)}<span className="text-xs ml-0.5">%</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Col 2: Cost Execution */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    <DollarSign size={12} className="text-emerald-500" /> Execução (Custo)
                                </span>
                                <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100 shadow-sm h-full">
                                    <div>
                                        <span className="text-[10px] text-gray-400 block uppercase font-semibold">PV (Plan)</span>
                                        <span className="text-lg font-bold text-gray-800">
                                            {(stats.plannedCostToDate || 0).toLocaleString('pt-BR', { notation: 'compact' })}
                                        </span>
                                    </div>
                                    <div className="w-px h-8 bg-gray-100"></div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-gray-400 block uppercase font-semibold">AC (Real)</span>
                                        <span className={`text-lg font-bold ${(stats.realCostToDate || 0) > (stats.plannedCostToDate || 0) ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {(stats.realCostToDate || 0).toLocaleString('pt-BR', { notation: 'compact' })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Col 3: Performance (SPI/CPI) */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    <TrendingUp size={12} className="text-purple-500" /> Performance
                                </span>
                                <div className="flex items-center justify-around gap-4 bg-white p-3 rounded-lg border border-gray-100 shadow-sm h-full">
                                    <CompactMetric
                                        label="SPI (Prazo)"
                                        value={stats.spi?.toFixed(2) || '0.00'}
                                        subValue={spiStatus.label}
                                        subColorClass={spiStatus.subColor}
                                        icon={TrendingUp}
                                        colorClass={spiStatus.color}
                                    />
                                    <div className="w-px h-8 bg-gray-100"></div>
                                    <CompactMetric
                                        label="CPI (Custo)"
                                        value={stats.cpi?.toFixed(2) || '1.00'}
                                        subValue={cpiStatus.label}
                                        subColorClass={cpiStatus.subColor}
                                        icon={Target}
                                        colorClass={cpiStatus.color}
                                    />
                                </div>
                            </div>

                            {/* Col 4: Execution Controls (Impacto) */}
                            {project && onUpdateProject && (
                                <div className="flex flex-col gap-2">
                                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1">
                                        <AlertTriangle size={12} /> Impacto & Alertas
                                    </span>
                                    <div
                                        onClick={onShowClientBlockages}
                                        className="flex items-center justify-between px-4 py-3 bg-red-50 rounded-lg border border-red-100 shadow-sm h-full cursor-pointer hover:bg-red-100 transition-all group"
                                        title="Clique para ver detalhes do bloqueio"
                                    >
                                        <div>
                                            <span className="text-[10px] font-bold text-red-400 uppercase block mb-1 group-hover:text-red-500">Bloqueio Cliente</span>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1 bg-red-200 rounded text-red-700">
                                                    <AlertTriangle size={12} />
                                                </div>
                                                <span className="text-xs text-red-400 italic">Ver detalhes</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-lg font-black text-red-700 block leading-none">
                                                {Math.round(stats.totalClientBlockageHours || 0)}<span className="text-xs font-medium ml-0.5">h</span>
                                            </span>
                                            <span className="text-xs font-bold text-red-400 block mt-1">
                                                R$ {(stats.totalClientBlockageCost || 0).toLocaleString('pt-BR', { notation: 'compact' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
