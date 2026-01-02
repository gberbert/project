
import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Project, ProjectMonthlyCost, Task, ProjectTeamMember, ProjectOtherCost, ProjectMonthlyRevenue } from '../types';
import { ProjectService } from '../services/projectService';
import { Save, DollarSign, Clock, Download, RefreshCw, Calculator, Tag, Plus, Trash2, ChevronDown, Search, TrendingUp, Wallet } from 'lucide-react';
import { addMonths, differenceInCalendarMonths, parseISO, isSameMonth, startOfMonth } from 'date-fns';
import { calculateBusinessDays } from '../lib/utils';

interface Props {
    project: Project;
    tasks: Task[];
}

const COST_TYPES = [
    "Licenças",
    "Aereo",
    "Hotel",
    "Alimentação",
    "Gasolina",
    "Horas Extras",
    "Aluguel Notebook"
];

// Helper to safely parse dates from various formats (Firestore Timestamp, String, Date)
const toSafeDate = (value: any): Date => {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate(); // Firestore Timestamp
    if (value?.seconds) return new Date(value.seconds * 1000); // Raw Timestamp object
    return new Date(value); // String or Number
};

export const ProjectMonthlyCostsTab = ({ project, tasks }: Props) => {
    // Determine timeline range: Start of Project -> End of Project + 1 Year
    const { startMonth, months } = useMemo(() => {
        const validTasks = tasks.filter(t => t.start && t.end);

        if (!validTasks.length && !project.start) {
            const now = startOfMonth(new Date());
            return { startMonth: now, months: [now] };
        }

        const dates = validTasks.map(t => [toSafeDate(t.start), toSafeDate(t.end)]).flat();
        if (project.start) dates.push(toSafeDate(project.start));
        if (project.end) dates.push(toSafeDate(project.end));

        const minDate = dates.reduce((min, d) => d < min ? d : min, dates[0] || new Date());
        const maxDate = dates.reduce((max, d) => d > max ? d : max, dates[0] || new Date());

        const start = startOfMonth(minDate);
        const end = addMonths(maxDate, 12); // +1 Year

        const monthList = [];
        let current = start;
        while (current <= end) {
            monthList.push(current);
            current = addMonths(current, 1);
        }

        return { startMonth: start, months: monthList };
    }, [tasks, project.start, project.end]);

    // --- State: Monthly Costs ---
    const [costs, setCosts] = useState<ProjectMonthlyCost[]>(project.monthlyCosts || []);

    // --- State: Other Costs ---
    const [otherCosts, setOtherCosts] = useState<ProjectOtherCost[]>(project.otherCosts || []);

    // --- State: Revenue Distribution ---
    const [revenues, setRevenues] = useState<ProjectMonthlyRevenue[]>(project.revenueDistribution || []);

    const [isEditing, setIsEditing] = useState(false);

    // --- Handlers: Monthly Costs ---
    const calculateBaseCosts = () => {
        // Map roles to hourly rates (Normalized)
        const roleRates = new Map<string, number>();
        project.teamStructure?.forEach(m => {
            if (m.hourlyRate) roleRates.set(m.role.trim(), m.hourlyRate);
        });

        const calculatedCosts: ProjectMonthlyCost[] = [];

        // Identify all unique roles involved in tasks (or team structure)
        const roles = new Set<string>();
        tasks.forEach(t => { if (t.assignedResource) roles.add(t.assignedResource.trim()) });
        project.teamStructure?.forEach(m => roles.add(m.role.trim()));

        // Iterate roles and months to calculate costs
        roles.forEach(role => {
            // Strict match on trimmed role
            const roleTasks = tasks.filter(t => (t.assignedResource || '').trim() === role);

            months.forEach(month => {
                let monthlyHours = 0;
                let monthlyCostAccumulator = 0;

                roleTasks.forEach(task => {
                    if (!task.start || !task.end) return;

                    // Robust Date Parsing
                    let tStart: Date;
                    let tEnd: Date;

                    // If task is DONE (progress === 100), prefer Real Execution dates for baseline calculation
                    // as requested by user ("If task is done... use Real Execution dates")
                    if (task.progress === 100 && task.realStart && task.realEnd) {
                        tStart = toSafeDate(task.realStart);
                        tEnd = toSafeDate(task.realEnd);
                    } else {
                        // Fallback to Planned Dates
                        tStart = toSafeDate(task.start);
                        tEnd = toSafeDate(task.end);
                    }

                    // Month Range
                    const mStart = month;
                    const mEnd = new Date(addMonths(month, 1).getTime() - 1);

                    // Check Intersection
                    if (tStart <= mEnd && tEnd >= mStart) {
                        const overlapStart = tStart > mStart ? tStart : mStart;
                        const overlapEnd = tEnd < mEnd ? tEnd : mEnd;

                        const businessDays = calculateBusinessDays(overlapStart, overlapEnd);

                        if (businessDays > 0) {
                            const hours = businessDays * 8;
                            // Try task specific rate -> then role rate -> then 0
                            const rate = task.hourlyRate || roleRates.get(role) || 0;

                            monthlyHours += hours;
                            monthlyCostAccumulator += hours * rate;
                        }
                    }
                });

                if (monthlyHours > 0) {
                    calculatedCosts.push({
                        id: crypto.randomUUID(),
                        month: month.toISOString().slice(0, 7),
                        role: role,
                        hours: monthlyHours,
                        cost: monthlyCostAccumulator
                    });
                }
            });
        });

        // Full Replace to ensure data consistency
        setCosts(calculatedCosts);

        // Calculate Totals per month
        const monthlyTotalCosts = new Map<string, number>();
        let currentTotalCost = 0;

        months.forEach(m => {
            const mStr = m.toISOString().slice(0, 7);
            const pCost = calculatedCosts.filter(c => c.month === mStr).reduce((a, b) => a + b.cost, 0);
            const oCost = otherCosts.reduce((a, b) => a + (b.values[mStr] || 0), 0);
            const total = pCost + oCost;
            monthlyTotalCosts.set(mStr, total);
            currentTotalCost += total;
        });

        // --- Calculate Target Margin (Real vs Planned) ---
        let targetMargin = project.margin || 0;
        let marginLabel = 'Margem Planejada';

        if (project.fixedSnapshot) {
            marginLabel = 'Margem Real';
            const salesData = project.fixedSnapshot;

            // Replicate ProjectSummary Real Margin Logic
            const investment = salesData.price;
            const netRevenue = investment * (1 - ((salesData.taxRate || 0) / 100));

            // Deviation Value (Baseline)
            const dDec = (salesData.deliveryDeviation || 0) / 100;
            const deviationValue = (1 - dDec) > 0.001 ? ((salesData.cost / (1 - dDec)) - salesData.cost) : 0;

            // Current Deviation Cost
            // We use the current project status for deviations if available, otherwise fallback to sales snapshot
            const currentDevPercent = project.deliveryDeviation || 0;
            const salesDevPercent = salesData.deliveryDeviation || 1; // Avoid div by zero
            const currentDeviationCost = salesDevPercent !== 0 ? currentDevPercent * (deviationValue / salesDevPercent) : 0;

            const realMarginDenominator = netRevenue - deviationValue;
            const realMarginNumerator = netRevenue - currentDeviationCost - currentTotalCost;

            if (realMarginDenominator > 0.001) {
                targetMargin = (realMarginNumerator / realMarginDenominator) * 100;
            } else {
                targetMargin = 0; // Fallback
            }
        }

        // Calculate Revenue Distribution based on Target Margin
        // Formula: NetRevenueRequired = Cost / (1 - Margin%)
        //          GrossRevenueRequired = NetRevenueRequired / (1 - Tax%)
        const marginDec = targetMargin / 100;
        const taxDec = (project.taxRate || 0) / 100;
        const marginDivisor = 1 - marginDec;
        const taxDivisor = 1 - taxDec;

        const newRevenueValues: { [key: string]: number } = {};

        months.forEach(m => {
            const mStr = m.toISOString().slice(0, 7);
            const totalCost = monthlyTotalCosts.get(mStr) || 0;

            if (totalCost > 0 && marginDivisor > 0.001) {
                const reqNet = totalCost / marginDivisor;
                const reqGross = taxDivisor > 0.001 ? reqNet / taxDivisor : reqNet;
                newRevenueValues[mStr] = reqGross;
            }
        });

        const newRevenueRow: ProjectMonthlyRevenue = {
            id: crypto.randomUUID(),
            description: `Receita Sugerida (${marginLabel} ${targetMargin.toFixed(1)}%)`,
            values: newRevenueValues
        };

        setRevenues([newRevenueRow]); // Replace/Reset revenue suggestions
        setIsEditing(true);
    };

    const handleUpdateCell = (role: string, monthStr: string, field: 'hours' | 'cost', value: number) => {
        setCosts(prev => {
            const idx = prev.findIndex(c => c.role === role && c.month === monthStr);
            if (idx >= 0) {
                const newCosts = [...prev];
                newCosts[idx] = { ...newCosts[idx], [field]: value };
                if (field === 'hours') {
                    const member = project.teamStructure?.find(m => m.role === role);
                    if (member?.hourlyRate) {
                        newCosts[idx].cost = value * member.hourlyRate;
                    }
                }
                return newCosts;
            } else {
                const member = project.teamStructure?.find(m => m.role === role);
                const newRecord: ProjectMonthlyCost = {
                    id: crypto.randomUUID(),
                    role,
                    month: monthStr,
                    hours: field === 'hours' ? value : 0,
                    cost: field === 'cost' ? value : 0
                };
                if (field === 'hours' && member?.hourlyRate) {
                    newRecord.cost = value * member.hourlyRate;
                }
                return [...prev, newRecord];
            }
        });
        setIsEditing(true);
    };

    // --- Handlers: Other Costs ---
    const handleAddOtherRow = () => {
        const newCost: ProjectOtherCost = {
            id: crypto.randomUUID(),
            description: 'Novo Custo',
            type: '',
            values: {}
        };
        setOtherCosts([...otherCosts, newCost]);
        setIsEditing(true);
    };

    const handleRemoveOtherRow = (id: string) => {
        setOtherCosts(prev => prev.filter(c => c.id !== id));
        setIsEditing(true);
    };

    const handleUpdateOtherRowMeta = (id: string, field: 'description' | 'type', value: string) => {
        setOtherCosts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
        setIsEditing(true);
    };

    const handleUpdateOtherValue = (id: string, monthStr: string, value: number) => {
        setOtherCosts(prev => prev.map(c => {
            if (c.id === id) {
                return {
                    ...c,
                    values: { ...c.values, [monthStr]: value }
                };
            }
            return c;
        }));
        setIsEditing(true);
    };

    // --- Handlers: Revenue ---
    const handleAddRevenueRow = () => {
        const newRevenue: ProjectMonthlyRevenue = {
            id: crypto.randomUUID(),
            description: 'Nova Receita',
            values: {}
        };
        setRevenues([...revenues, newRevenue]);
        setIsEditing(true);
    };

    const handleRemoveRevenueRow = (id: string) => {
        setRevenues(prev => prev.filter(r => r.id !== id));
        setIsEditing(true);
    };

    const handleUpdateRevenueRowMeta = (id: string, value: string) => {
        setRevenues(prev => prev.map(r => r.id === id ? { ...r, description: value } : r));
        setIsEditing(true);
    };

    const handleUpdateRevenueValue = (id: string, monthStr: string, value: number) => {
        setRevenues(prev => prev.map(r => {
            if (r.id === id) {
                return {
                    ...r,
                    values: { ...r.values, [monthStr]: value }
                };
            }
            return r;
        }));
        setIsEditing(true);
    };


    const saveChanges = async () => {
        await ProjectService.updateProject(project.id, {
            monthlyCosts: costs,
            otherCosts: otherCosts,
            revenueDistribution: revenues
        });
        setIsEditing(false);
        alert("Custos e Receita salvos!");
    };

    // --- Aggregation & Data Prep ---

    // 1. Monthly Costs Matrix Data
    const roles = Array.from(new Set([
        ...(project.teamStructure?.map(m => m.role) || []),
        ...(costs.map(c => c.role))
    ])).sort();

    const monthlyCostTotals = months.map(m => {
        const mStr = m.toISOString().slice(0, 7);
        const monthlyData = costs.filter(c => c.month === mStr);
        return {
            cost: monthlyData.reduce((acc, curr) => acc + (curr.cost || 0), 0),
            hours: monthlyData.reduce((acc, curr) => acc + (curr.hours || 0), 0)
        };
    });

    const totalMonthlyCost = monthlyCostTotals.reduce((a, b) => a + b.cost, 0);

    // 2. Other Costs Matrix Data
    const otherCostTotals = months.map(m => {
        const mStr = m.toISOString().slice(0, 7);
        return otherCosts.reduce((acc, curr) => acc + (curr.values[mStr] || 0), 0);
    });

    const totalOtherCost = otherCostTotals.reduce((a, b) => a + b, 0);

    // 3. Revenue Matrix Data
    const revenueTotals = months.map(m => {
        const mStr = m.toISOString().slice(0, 7);
        return revenues.reduce((acc, curr) => acc + (curr.values[mStr] || 0), 0);
    });
    const totalRevenue = revenueTotals.reduce((a, b) => a + b, 0);


    // 4. Grand Totals (Cost)
    const grandTotals = months.map((m, i) => ({
        month: m,
        total: monthlyCostTotals[i].cost + otherCostTotals[i]
    }));
    const totalGrandCost = totalMonthlyCost + totalOtherCost;


    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <DollarSign className="text-indigo-600" />
                        Declaração Mensal
                    </h3>
                    <p className="text-xs text-gray-500">
                        Consolidado de Custos e Distribuição de Receita.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right mr-4 border-r border-gray-200 pr-6">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Custo Previsto</p>
                        <p className="text-xl font-bold text-red-600">
                            {totalGrandCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                        </p>
                    </div>
                    <div className="text-right mr-4 border-r border-gray-200 pr-6">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Receita Prevista</p>
                        <p className="text-xl font-bold text-emerald-600">
                            {totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                        </p>
                    </div>

                    <button
                        onClick={calculateBaseCosts}
                        className="flex items-center gap-2 text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-transparent hover:border-indigo-100"
                        title="Recalcular Custos e Receita Base"
                    >
                        <Calculator size={16} />
                        Calcular Base
                    </button>
                    {isEditing && (
                        <button
                            onClick={saveChanges}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors"
                        >
                            <Save size={16} />
                            Salvar
                        </button>
                    )}
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-auto bg-white p-4 space-y-8">

                {/* 1. Matriz de Pessoal */}
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><DollarSign size={14} /> Custos de Pessoal</h4>
                        <span className="text-xs font-bold text-gray-500">Total: {(totalMonthlyCost / 1000).toFixed(1)}k</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 border-separate border-spacing-0">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th rowSpan={2} className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-r w-48 align-bottom">
                                        Papel / Recurso
                                    </th>
                                    {months.map(m => (
                                        <th key={m.toISOString()} colSpan={3} className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase border-b border-r min-w-[200px] bg-gray-100">
                                            {m.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                                        </th>
                                    ))}
                                    <th rowSpan={2} className="px-4 py-3 text-right text-xs font-bold text-gray-900 uppercase border-b border-l bg-gray-50 align-bottom">
                                        Total
                                    </th>
                                </tr>
                                <tr>
                                    {months.map(m => (
                                        <ProjectMonthlySubHeaders key={m.toISOString()} />
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {roles.map(role => {
                                    const roleTotal = costs.filter(c => c.role === role).reduce((acc, curr) => acc + curr.cost, 0);
                                    return (
                                        <tr key={role} className="hover:bg-gray-50">
                                            <td className="sticky left-0 bg-white px-4 py-2 text-sm font-medium text-gray-900 border-r border-gray-100 whitespace-nowrap">
                                                {role}
                                            </td>
                                            {months.map(m => {
                                                const mStr = m.toISOString().slice(0, 7);
                                                const record = costs.find(c => c.role === role && c.month === mStr);
                                                const hours = record?.hours || 0;
                                                const cost = record?.cost || 0;
                                                const fte = hours / 168;

                                                return (
                                                    <ProjectMonthlyCells
                                                        key={mStr}
                                                        hours={hours}
                                                        cost={cost}
                                                        fte={fte}
                                                        onUpdateHours={(val) => handleUpdateCell(role, mStr, 'hours', val)}
                                                        onUpdateCost={(val) => handleUpdateCell(role, mStr, 'cost', val)}
                                                    />
                                                );
                                            })}
                                            <td className="px-4 py-2 text-right text-sm font-bold text-indigo-700 bg-gray-50 border-l border-gray-200">
                                                {roleTotal > 0 ? (roleTotal / 1000).toFixed(1) + 'k' : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {/* Subtotal Row */}
                                <tr className="bg-gray-100 font-bold border-t border-gray-300">
                                    <td className="sticky left-0 bg-gray-100 px-4 py-2 text-xs text-gray-800 border-r border-gray-300 text-right uppercase">
                                        Subtotal Pessoal
                                    </td>
                                    {monthlyCostTotals.map((tot, idx) => (
                                        <td key={idx} colSpan={3} className="px-2 py-2 text-right text-xs text-indigo-800 border-r border-gray-200 bg-indigo-50/30">
                                            {tot.cost > 0 ? (tot.cost / 1000).toFixed(1) + 'k' : '-'}
                                        </td>
                                    ))}
                                    <td className="px-4 py-2 text-right text-xs text-indigo-800 border-l border-gray-300 bg-indigo-100">
                                        {(totalMonthlyCost / 1000).toFixed(1) + 'k'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>


                {/* 2. Matriz de Outros Custos */}
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                            <Tag size={14} className="text-pink-600" /> Outros Custos
                        </h4>
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-gray-500">Total: {(totalOtherCost / 1000).toFixed(1)}k</span>
                            <button
                                onClick={handleAddOtherRow}
                                className="flex items-center gap-1 text-pink-600 hover:bg-pink-50 px-2 py-1 rounded text-xs font-bold transition-colors border border-transparent hover:border-pink-100"
                            >
                                <Plus size={12} /> Add Item
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 border-separate border-spacing-0">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-r w-48">
                                        Descrição
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-r w-32">
                                        Tipo
                                    </th>
                                    {months.map(m => (
                                        <th key={m.toISOString()} className="px-2 py-3 text-center text-xs font-bold text-gray-700 uppercase border-b border-r min-w-[100px] bg-gray-100">
                                            {m.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-900 uppercase border-b border-l bg-gray-50 min-w-[100px]">
                                        Total
                                    </th>
                                    <th className="px-2 py-3 border-b bg-gray-50 w-8"></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {otherCosts.length === 0 && (
                                    <tr>
                                        <td colSpan={months.length + 4} className="text-center py-6 text-gray-400 text-xs italic">
                                            Nenhum custo adicional.
                                        </td>
                                    </tr>
                                )}
                                {otherCosts.map((cost) => {
                                    const rowTotal = Object.values(cost.values).reduce((a, b) => a + b, 0);
                                    return (
                                        <tr key={cost.id} className="hover:bg-gray-50 group">
                                            {/* Description (Sticky) */}
                                            <td className="sticky left-0 bg-white group-hover:bg-gray-50 px-2 py-1 border-r border-gray-100 z-10 align-middle">
                                                <input
                                                    type="text"
                                                    value={cost.description}
                                                    onChange={(e) => handleUpdateOtherRowMeta(cost.id, 'description', e.target.value)}
                                                    className="w-full border-none bg-transparent focus:ring-0 text-xs font-medium text-gray-900 placeholder-gray-400"
                                                    placeholder="Descrição..."
                                                />
                                            </td>
                                            {/* Type */}
                                            <td className="px-2 py-1 border-r border-gray-100 align-middle bg-white relative">
                                                <TypeSelector
                                                    value={cost.type}
                                                    onChange={(val) => handleUpdateOtherRowMeta(cost.id, 'type', val)}
                                                />
                                            </td>
                                            {/* Values */}
                                            {months.map(m => {
                                                const mStr = m.toISOString().slice(0, 7);
                                                const val = cost.values[mStr] || 0;
                                                return (
                                                    <td key={mStr} className="px-1 py-1 border-r border-gray-100 text-right align-middle">
                                                        <input
                                                            type="number"
                                                            value={val > 0 ? val : ''}
                                                            onChange={(e) => handleUpdateOtherValue(cost.id, mStr, parseFloat(e.target.value) || 0)}
                                                            className="w-full text-right bg-transparent border-none p-1 text-xs focus:ring-1 focus:ring-pink-300 rounded font-mono text-gray-700"
                                                            placeholder="-"
                                                        />
                                                    </td>
                                                );
                                            })}
                                            {/* Total */}
                                            <td className="px-4 py-2 text-right text-xs font-bold text-pink-700 bg-gray-50 border-l border-gray-200 align-middle">
                                                {rowTotal > 0 ? (rowTotal / 1000).toFixed(1) + 'k' : '-'}
                                            </td>
                                            {/* Actions */}
                                            <td className="px-1 text-center align-middle">
                                                <button
                                                    onClick={() => handleRemoveOtherRow(cost.id)}
                                                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Remover"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {/* Subtotal Row */}
                                <tr className="bg-gray-100 font-bold border-t border-gray-300">
                                    <td colSpan={2} className="sticky left-0 bg-gray-100 px-4 py-2 text-xs text-gray-800 border-r border-gray-300 text-right uppercase">
                                        Subtotal Outros
                                    </td>
                                    {otherCostTotals.map((tot, idx) => (
                                        <td key={idx} className="px-2 py-2 text-right text-xs text-pink-800 border-r border-gray-200 bg-pink-50/30">
                                            {tot > 0 ? (tot / 1000).toFixed(1) + 'k' : '-'}
                                        </td>
                                    ))}
                                    <td className="px-4 py-2 text-right text-xs text-pink-800 border-l border-gray-300 bg-pink-100">
                                        {(totalOtherCost / 1000).toFixed(1) + 'k'}
                                    </td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3. Distribuição de Receita */}
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                            <Wallet size={14} className="text-emerald-600" /> Distribuição de Receita
                        </h4>
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-gray-500">Total: {(totalRevenue / 1000).toFixed(1)}k</span>
                            <button
                                onClick={handleAddRevenueRow}
                                className="flex items-center gap-1 text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded text-xs font-bold transition-colors border border-transparent hover:border-emerald-100"
                            >
                                <Plus size={12} /> Add Item
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 border-separate border-spacing-0">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th colSpan={2} className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-r w-80">
                                        Descrição / Referência
                                    </th>
                                    {months.map(m => (
                                        <th key={m.toISOString()} className="px-2 py-3 text-center text-xs font-bold text-gray-700 uppercase border-b border-r min-w-[100px] bg-gray-100">
                                            {m.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-900 uppercase border-b border-l bg-gray-50 min-w-[100px]">
                                        Total
                                    </th>
                                    <th className="px-2 py-3 border-b bg-gray-50 w-8"></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {revenues.length === 0 && (
                                    <tr>
                                        <td colSpan={months.length + 4} className="text-center py-6 text-gray-400 text-xs italic">
                                            Nenhuma previsão de receita. Clique "Calcular Base" para gerar automaticamente.
                                        </td>
                                    </tr>
                                )}
                                {revenues.map((rev) => {
                                    const rowTotal = Object.values(rev.values).reduce((a, b) => a + b, 0);
                                    return (
                                        <tr key={rev.id} className="hover:bg-gray-50 group">
                                            {/* Description (Sticky) */}
                                            <td colSpan={2} className="sticky left-0 bg-white group-hover:bg-gray-50 px-2 py-1 border-r border-gray-100 z-10 align-middle">
                                                <input
                                                    type="text"
                                                    value={rev.description}
                                                    onChange={(e) => handleUpdateRevenueRowMeta(rev.id, e.target.value)}
                                                    className="w-full border-none bg-transparent focus:ring-0 text-xs font-medium text-gray-900 placeholder-gray-400"
                                                    placeholder="Descrição..."
                                                />
                                            </td>
                                            {/* Values */}
                                            {months.map(m => {
                                                const mStr = m.toISOString().slice(0, 7);
                                                const val = rev.values[mStr] || 0;
                                                return (
                                                    <td key={mStr} className="px-1 py-1 border-r border-gray-100 text-right align-middle">
                                                        <input
                                                            type="number"
                                                            value={val > 0 ? val : ''}
                                                            onChange={(e) => handleUpdateRevenueValue(rev.id, mStr, parseFloat(e.target.value) || 0)}
                                                            className="w-full text-right bg-transparent border-none p-1 text-xs focus:ring-1 focus:ring-emerald-300 rounded font-mono text-gray-700"
                                                            placeholder="-"
                                                        />
                                                    </td>
                                                );
                                            })}
                                            {/* Total */}
                                            <td className="px-4 py-2 text-right text-xs font-bold text-emerald-700 bg-gray-50 border-l border-gray-200 align-middle">
                                                {rowTotal > 0 ? (rowTotal / 1000).toFixed(1) + 'k' : '-'}
                                            </td>
                                            {/* Actions */}
                                            <td className="px-1 text-center align-middle">
                                                <button
                                                    onClick={() => handleRemoveRevenueRow(rev.id)}
                                                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Remover"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {/* Subtotal Row */}
                                <tr className="bg-gray-100 font-bold border-t border-gray-300">
                                    <td colSpan={2} className="sticky left-0 bg-gray-100 px-4 py-2 text-xs text-gray-800 border-r border-gray-300 text-right uppercase">
                                        Total Receita
                                    </td>
                                    {revenueTotals.map((tot, idx) => (
                                        <td key={idx} className="px-2 py-2 text-right text-xs text-emerald-800 border-r border-gray-200 bg-emerald-50/30">
                                            {tot > 0 ? (tot / 1000).toFixed(1) + 'k' : '-'}
                                        </td>
                                    ))}
                                    <td className="px-4 py-2 text-right text-xs text-emerald-800 border-l border-gray-300 bg-emerald-100">
                                        {(totalRevenue / 1000).toFixed(1) + 'k'}
                                    </td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

// Sub-components for cleaner rendering
const ProjectMonthlySubHeaders = () => (
    <>
        <th className="px-1 py-1 text-center text-[10px] font-medium text-gray-500 bg-gray-50 border-b border-r border-t w-16">Horas</th>
        <th className="px-1 py-1 text-center text-[10px] font-medium text-gray-500 bg-gray-50 border-b border-r border-t w-24">Valor</th>
        <th className="px-1 py-1 text-center text-[10px] font-medium text-gray-500 bg-gray-50 border-b border-r border-t w-14">FTE</th>
    </>
);

const ProjectMonthlyCells = ({ hours, cost, fte, onUpdateHours, onUpdateCost }: {
    hours: number,
    cost: number,
    fte: number,
    onUpdateHours: (val: number) => void,
    onUpdateCost: (val: number) => void
}) => (
    <>
        <td className="px-1 py-1 border-r border-gray-100 text-center text-[11px] font-mono text-gray-600 bg-inherit">
            {onUpdateHours.name !== '' ? (
                <input
                    type="number"
                    readOnly={onUpdateHours.name === ''}
                    className="w-full text-center bg-transparent border-none p-0 focus:ring-1 focus:ring-indigo-300 rounded"
                    value={hours > 0 ? Math.round(hours) : ''}
                    placeholder="-"
                    onChange={e => onUpdateHours(parseFloat(e.target.value) || 0)}
                />
            ) : (
                <span>{hours > 0 ? Math.round(hours) : '-'}</span>
            )}
        </td>
        <td className="px-1 py-1 border-r border-gray-100 text-right text-[11px] font-mono text-gray-700 bg-inherit">
            {onUpdateCost.name !== '' ? (
                <input
                    type="number"
                    className="w-full text-right bg-transparent border-none p-0 focus:ring-1 focus:ring-indigo-300 rounded"
                    value={cost > 0 ? Math.round(cost) : ''}
                    placeholder="-"
                    onChange={e => onUpdateCost(parseFloat(e.target.value) || 0)}
                />
            ) : (
                <span>{cost > 0 ? (cost / 1000).toFixed(1) + 'k' : '-'}</span>
            )}
        </td>
        <td className="px-1 py-1 border-r border-gray-200 text-center text-[10px] text-gray-400 bg-inherit font-mono">
            {fte > 0 ? fte.toFixed(1) : '-'}
        </td>
    </>
);

const TypeSelector = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
        }
        setIsOpen(!isOpen);
        setSearch(''); // Reset search on open
    };

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    };

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const filteredOptions = COST_TYPES.filter(t => t.toLowerCase().includes(search.toLowerCase()));

    return (
        <>
            <div
                ref={triggerRef}
                onClick={toggle}
                className={`flex items-center justify-between w-full px-2 py-1.5 text-xs text-gray-700 bg-white border border-transparent hover:border-gray-300 rounded cursor-pointer transition-all ${!value && 'text-gray-400'}`}
            >
                <span className="truncate">{value || "Selecione..."}</span>
                <ChevronDown size={14} className="text-gray-400 flex-shrink-0 ml-1" />
            </div>

            {isOpen && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-start justify-start"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="fixed bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
                        style={{
                            top: coords.top + 4,
                            left: coords.left,
                            width: Math.max(coords.width, 200),
                            maxHeight: '300px'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                            <Search size={14} className="text-gray-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar tipo..."
                                className="w-full bg-transparent border-none p-0 text-xs focus:ring-0 text-gray-700 placeholder-gray-400"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && filteredOptions.length > 0) {
                                        handleSelect(filteredOptions[0]);
                                    }
                                }}
                            />
                        </div>
                        <div className="overflow-y-auto max-h-[200px] p-1">
                            {filteredOptions.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-gray-400 text-center italic">
                                    Nenhuma opção encontrada.
                                </div>
                            ) : (
                                filteredOptions.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => handleSelect(opt)}
                                        className={`w-full text-left px-3 py-2 text-xs rounded hover:bg-pink-50 hover:text-pink-700 transition-colors ${value === opt ? 'bg-pink-50 text-pink-700 font-medium' : 'text-gray-700'}`}
                                    >
                                        {opt}
                                    </button>
                                ))
                            )}
                            {search && !filteredOptions.includes(search) && (
                                <button
                                    onClick={() => handleSelect(search)}
                                    className="w-full text-left px-3 py-2 text-xs rounded hover:bg-gray-50 text-indigo-600 border-t border-gray-100 mt-1 font-medium italic"
                                >
                                    Usar "{search}"
                                </button>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
