import { Project, Task, ProjectMonthlyCost, ProjectMonthlyRevenue } from '../types';
import { addMonths, startOfMonth } from 'date-fns';
import { calculateBusinessDays } from './utils';

// Helper to safely parse dates
const toSafeDate = (value: any): Date => {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate(); // Firestore Timestamp
    if (value?.seconds) return new Date(value.seconds * 1000); // Raw Timestamp object
    return new Date(value); // String or Number
};

export const calculateProjectFinancials = (project: Project, tasks: Task[]) => {
    if (!project) return { monthlyCosts: [], revenueDistribution: [] };

    // Determine timeline range: Start of Project -> End of Project + 1 Year
    const validTasks = tasks.filter(t => t.start && t.end);
    let startMonth = startOfMonth(new Date());
    let months: Date[] = [startMonth];

    if (validTasks.length || project.startDate) {
        const dates = validTasks.map(t => [toSafeDate(t.start), toSafeDate(t.end)]).flat();
        if (project.startDate) dates.push(toSafeDate(project.startDate));
        if (project.endDate) dates.push(toSafeDate(project.endDate));

        const minDate = dates.reduce((min, d) => d < min ? d : min, dates[0] || new Date());
        const maxDate = dates.reduce((max, d) => d > max ? d : max, dates[0] || new Date());

        startMonth = startOfMonth(minDate);
        const end = addMonths(maxDate, 12); // +1 Year

        months = [];
        let current = startMonth;
        while (current <= end) {
            months.push(current);
            current = addMonths(current, 1);
        }
    }

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

    // Calculate Totals per month for Revenue Logic
    const monthlyTotalCosts = new Map<string, number>();
    let currentTotalCost = 0;

    const otherCosts = project.otherCosts || [];

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
        const currentDevPercent = project.deliveryDeviation || 0;
        const salesDevPercent = salesData.deliveryDeviation || 1;
        const currentDeviationCost = salesDevPercent !== 0 ? currentDevPercent * (deviationValue / salesDevPercent) : 0;

        const realMarginDenominator = netRevenue - deviationValue;
        const realMarginNumerator = netRevenue - currentDeviationCost - currentTotalCost;

        if (realMarginDenominator > 0.001) {
            targetMargin = (realMarginNumerator / realMarginDenominator) * 100;
        } else {
            targetMargin = 0;
        }
    }

    // Calculate Revenue Distribution based on Target Margin
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

    return {
        monthlyCosts: calculatedCosts,
        revenueDistribution: [newRevenueRow]
    };
};
