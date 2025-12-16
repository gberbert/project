import { Task, Resource } from '../types';
import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Plus, Link2, ArrowRightCircle, ArrowLeftCircle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Columns, Copy } from 'lucide-react';
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval,
    isSameMonth, isSameDay, isWithinInterval, isBefore, isAfter, isWeekend, addDays,
    startOfWeek, endOfWeek, addMonths, subMonths
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SearchableSelect } from './SearchableSelect';

interface TaskFormProps {
    task?: Task;
    resources: Resource[];
    allTasks: Task[];
    onSave: (task: Task) => void;
    onCancel: () => void;
    onSplit?: (task: Task, factor: number) => void;
}

export const TaskForm = ({ task, resources, allTasks, onSave, onCancel, onSplit }: TaskFormProps) => {
    const [formData, setFormData] = useState<Partial<Task>>({
        progress: 0,
        dependencies: [],
        type: 'task',
        ...task
    });

    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [selectionStep, setSelectionStep] = useState<'start' | 'end'>('start');
    const [newDependencyId, setNewDependencyId] = useState<string>('');
    const [viewDate, setViewDate] = useState(new Date());
    const [parallelFactor, setParallelFactor] = useState(2);
    const calendarRef = useRef<HTMLDivElement>(null);

    // Initial Sync Effect
    useEffect(() => {
        if (task) {
            setFormData({ ...task, dependencies: task.dependencies || [] });
        }
    }, [task]);

    const [isRealCalendarOpen, setIsRealCalendarOpen] = useState(false);
    const [viewRealDate, setViewRealDate] = useState(new Date());
    const realCalendarRef = useRef<HTMLDivElement>(null);
    const [realSelectionStep, setRealSelectionStep] = useState<'start' | 'end'>('start');

    // Init view date based on task start
    useEffect(() => {
        if (task) {
            if (formData.start) setViewDate(formData.start);
            if (formData.realStart) setViewRealDate(formData.realStart);
        }
    }, [task]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
                setIsCalendarOpen(false);
            }
            if (realCalendarRef.current && !realCalendarRef.current.contains(event.target as Node)) {
                setIsRealCalendarOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleDateClick = (date: Date) => {
        // Normalize date to noon 
        const newDate = new Date(date);
        newDate.setHours(12, 0, 0, 0);

        if (selectionStep === 'start') {
            setFormData(prev => ({ ...prev, start: newDate, end: newDate }));
            setSelectionStep('end');
        } else {
            const currentStart = formData.start || newDate;
            if (isBefore(newDate, currentStart)) {
                setFormData(prev => ({ ...prev, start: newDate, end: currentStart }));
            } else {
                setFormData(prev => ({ ...prev, end: newDate }));
            }
            setSelectionStep('start');
            setIsCalendarOpen(false);
        }
    };

    const handleRealDateClick = (date: Date) => {
        const newDate = new Date(date);
        newDate.setHours(12, 0, 0, 0);

        if (realSelectionStep === 'start') {
            setFormData(prev => ({ ...prev, realStart: newDate, realEnd: newDate }));
            setRealSelectionStep('end');
        } else {
            const currentStart = formData.realStart || newDate;
            if (isBefore(newDate, currentStart)) {
                setFormData(prev => ({ ...prev, realStart: newDate, realEnd: currentStart }));
            } else {
                setFormData(prev => ({ ...prev, realEnd: newDate }));
            }
            setRealSelectionStep('start');
            setIsRealCalendarOpen(false);
        }
    };

    const handleMonthChange = (amt: number, isReal: boolean = false) => {
        if (isReal) setViewRealDate(prev => addMonths(prev, amt));
        else setViewDate(prev => addMonths(prev, amt));
    };

    // Generate Calendar Days (Est)
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });

    // Generate Calendar Days (Real)
    const realMonthStart = startOfMonth(viewRealDate);
    const realMonthEnd = endOfMonth(realMonthStart);
    const realCalendarDays = eachDayOfInterval({ start: startOfWeek(realMonthStart), end: endOfWeek(realMonthEnd) });

    // Successors: Tasks that have THIS task in THEIR dependency list
    // (Only relevant if editing an existing task with an ID)
    const successors = task?.id
        ? allTasks.filter(t => t.dependencies?.includes(task.id))
        : [];


    const availableTasks = allTasks.filter(t =>
        t.id !== task?.id && // Not self
        !formData.dependencies?.includes(t.id) && // Not already a dependency
        t.type !== 'project' // Usually don't depend on project containers directly, but option exists
    );

    const handleAddDependency = () => {
        if (!newDependencyId) return;
        const currentDeps = formData.dependencies || [];
        setFormData(prev => ({ ...prev, dependencies: [...currentDeps, newDependencyId] }));
        setNewDependencyId('');
    };

    const handleRemoveDependency = (removeId: string) => {
        const currentDeps = formData.dependencies || [];
        setFormData(prev => ({ ...prev, dependencies: currentDeps.filter(id => id !== removeId) }));
    };

    const countBusinessDays = (startDate: Date | undefined, endDate: Date | undefined) => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setHours(12, 0, 0, 0);
        end.setHours(12, 0, 0, 0);

        if (isAfter(start, end)) return 0;

        let count = 0;
        let current = start;
        while (current <= end) {
            if (!isWeekend(current)) count++;
            current = addDays(current, 1);
        }
        return count;
    };

    const effortMetrics = useMemo(() => {
        // Returns { hours, cost, realHours, realCost }
        const recurseCalc = (tasks: Task[]): { hours: number, cost: number, realHours: number, realCost: number } => {
            let totalHours = 0;
            let totalCost = 0;
            let totalRealHours = 0;
            let totalRealCost = 0;

            for (const t of tasks) {
                if (t.type === 'project') {
                    const children = allTasks.filter(c => c.parent === t.id);
                    const sub = recurseCalc(children);
                    totalHours += sub.hours;
                    totalCost += sub.cost;
                    totalRealHours += sub.realHours;
                    totalRealCost += sub.realCost;
                } else {
                    const h = countBusinessDays(t.start, t.end) * 8;
                    const r = t.hourlyRate || 0;
                    totalHours += h;
                    totalCost += h * r;

                    // Real
                    const rh = (t.realStart && t.realEnd) ? countBusinessDays(t.realStart, t.realEnd) * 8 : 0;
                    totalRealHours += rh;
                    totalRealCost += rh * r;
                }
            }
            return { hours: totalHours, cost: totalCost, realHours: totalRealHours, realCost: totalRealCost };
        };

        let data = { hours: 0, cost: 0, realHours: 0, realCost: 0 };

        if (formData.type === 'project') {
            if (formData.id) {
                const directChildren = allTasks.filter(t => t.parent === formData.id);
                data = recurseCalc(directChildren);
            }
        } else {
            const h = countBusinessDays(formData.start, formData.end) * 8;
            const r = formData.hourlyRate || 0;

            const rh = (formData.realStart && formData.realEnd) ? countBusinessDays(formData.realStart, formData.realEnd) * 8 : 0;

            data = { hours: h, cost: h * r, realHours: rh, realCost: rh * r };
        }

        return {
            hours: data.hours,
            ftes: data.hours / 168,
            avgRate: data.hours > 0 ? (data.cost / data.hours) : 0,
            totalCost: data.cost,
            totalRealCost: data.realCost
        };
    }, [formData, allTasks]);

    const handleSubmit = (e?: React.FormEvent | React.MouseEvent) => {
        if (e) e.preventDefault();

        // Basic validation
        if (!formData.name || !formData.start || !formData.end) {
            alert('Por favor preencha todos os campos obrigatórios (Nome, Início, Fim).');
            return;
        }

        // Clean dependencies: Remove duplicates, self-reference, and non-existent IDs
        const uniqueDependencies = [...new Set(formData.dependencies || [])];
        const validDependencies = uniqueDependencies.filter(depId =>
            depId !== task?.id && allTasks.some(t => t.id === depId)
        );

        onSave({
            ...formData,
            dependencies: validDependencies
        } as Task);
    };



    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-800">{task ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900 border-b pb-2 mb-4">Informações Gerais</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Tarefa</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2.5"
                                    required
                                    placeholder="ex: Design da Homepage"
                                />
                            </div>

                            <div className="relative" ref={calendarRef}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Estimativa (Planejado)</label>
                                <div
                                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 bg-white"
                                >
                                    <div className="flex items-center gap-2 text-gray-700">
                                        <CalendarIcon size={18} className="text-gray-400" />
                                        <span className="font-medium">
                                            {formData.start ? format(formData.start, 'dd/MM/yyyy') : '__/__/____'}
                                            {'  -  '}
                                            {formData.end ? format(formData.end, 'dd/MM/yyyy') : '__/__/____'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                        {formData.start && formData.end
                                            ? `${countBusinessDays(formData.start, formData.end)} dias úteis`
                                            : 'Selecione'}
                                    </div>
                                </div>



                                {isCalendarOpen && (
                                    <div className="absolute top-full left-0 z-50 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-[320px] animate-in fade-in zoom-in-95 duration-150">
                                        <div className="flex justify-between items-center mb-4">
                                            <button type="button" onClick={() => handleMonthChange(-1, false)} className="p-1 hover:bg-gray-100 rounded-full text-gray-600"><ChevronLeft size={20} /></button>
                                            <span className="font-semibold text-gray-700 capitalize">
                                                {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
                                            </span>
                                            <button type="button" onClick={() => handleMonthChange(1, false)} className="p-1 hover:bg-gray-100 rounded-full text-gray-600"><ChevronRight size={20} /></button>
                                        </div>
                                        <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-medium text-gray-400">
                                            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
                                        </div>
                                        <div className="grid grid-cols-7 gap-1">
                                            {calendarDays.map((day, idx) => {
                                                const isStart = formData.start ? isSameDay(day, formData.start) : false;
                                                const isEnd = formData.end ? isSameDay(day, formData.end) : false;
                                                const inRange = formData.start && formData.end ? isWithinInterval(day, { start: formData.start!, end: formData.end! }) : false;
                                                const isCurrentMonth = isSameMonth(day, viewDate);

                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => handleDateClick(day)}
                                                        className={`
                                                            h-9 w-9 flex items-center justify-center text-sm transition-all relative rounded-full
                                                            ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700 hover:bg-indigo-50'}
                                                            ${inRange && !isStart && !isEnd ? 'bg-indigo-50 text-indigo-700 rounded-none' : ''}
                                                            ${(isStart || isEnd) ? 'bg-indigo-600 text-white shadow-md z-10 font-bold' : ''}
                                                            ${isStart && formData.end && !isSameDay(formData.start, formData.end) ? 'rounded-r-none' : ''}
                                                            ${isEnd && formData.start && !isSameDay(formData.start, formData.end) ? 'rounded-l-none' : ''}
                                                        `}
                                                    >
                                                        {format(day, 'd')}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-center text-gray-500 bg-gray-50 rounded-b-lg -mb-4 -mx-4 pb-4">
                                            {selectionStep === 'start' ? 'Selecione a data de Início' : 'Selecione a data de Fim'}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="relative" ref={realCalendarRef}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Realizado (Executado)</label>
                                <div
                                    onClick={() => setIsRealCalendarOpen(!isRealCalendarOpen)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 bg-white"
                                >
                                    <div className="flex items-center gap-2 text-gray-700">
                                        <CalendarIcon size={18} className="text-gray-400" />
                                        <span className="font-medium">
                                            {formData.realStart ? format(formData.realStart, 'dd/MM/yyyy') : '__/__/____'}
                                            {'  -  '}
                                            {formData.realEnd ? format(formData.realEnd, 'dd/MM/yyyy') : '__/__/____'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                        {formData.realStart && formData.realEnd
                                            ? `${countBusinessDays(formData.realStart, formData.realEnd)} dias úteis`
                                            : 'Selecione'}
                                    </div>
                                </div>

                                {isRealCalendarOpen && (
                                    <div className="absolute top-full right-0 md:left-auto md:right-0 lg:left-0 lg:right-auto z-50 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-[320px] animate-in fade-in zoom-in-95 duration-150">
                                        <div className="flex justify-between items-center mb-4">
                                            <button type="button" onClick={() => handleMonthChange(-1, true)} className="p-1 hover:bg-gray-100 rounded-full text-gray-600"><ChevronLeft size={20} /></button>
                                            <span className="font-semibold text-gray-700 capitalize">
                                                {format(viewRealDate, 'MMMM yyyy', { locale: ptBR })}
                                            </span>
                                            <button type="button" onClick={() => handleMonthChange(1, true)} className="p-1 hover:bg-gray-100 rounded-full text-gray-600"><ChevronRight size={20} /></button>
                                        </div>
                                        <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-medium text-gray-400">
                                            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
                                        </div>
                                        <div className="grid grid-cols-7 gap-1">
                                            {realCalendarDays.map((day, idx) => {
                                                const isStart = formData.realStart ? isSameDay(day, formData.realStart) : false;
                                                const isEnd = formData.realEnd ? isSameDay(day, formData.realEnd) : false;
                                                const inRange = formData.realStart && formData.realEnd ? isWithinInterval(day, { start: formData.realStart!, end: formData.realEnd! }) : false;
                                                const isCurrentMonth = isSameMonth(day, viewRealDate);

                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => handleRealDateClick(day)}
                                                        className={`
                                                            h-9 w-9 flex items-center justify-center text-sm transition-all relative rounded-full
                                                            ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700 hover:bg-indigo-50'}
                                                            ${inRange && !isStart && !isEnd ? 'bg-indigo-50 text-indigo-700 rounded-none' : ''}
                                                            ${(isStart || isEnd) ? 'bg-indigo-600 text-white shadow-md z-10 font-bold' : ''}
                                                            ${isStart && formData.realEnd && !isSameDay(formData.realStart, formData.realEnd) ? 'rounded-r-none' : ''}
                                                            ${isEnd && formData.realStart && !isSameDay(formData.realStart, formData.realEnd) ? 'rounded-l-none' : ''}
                                                        `}
                                                    >
                                                        {format(day, 'd')}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-center text-gray-500 bg-gray-50 rounded-b-lg -mb-4 -mx-4 pb-4">
                                            {realSelectionStep === 'start' ? 'Selecione a data de Início Real' : 'Selecione a data de Fim Real'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Effort Metrics Display (Moved Here - Full Width) */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-1">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex flex-col justify-center items-center shadow-sm">
                                <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Horas Úteis</span>
                                <span className="text-xl font-bold text-blue-800">{effortMetrics.hours}h</span>
                            </div>
                            <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 flex flex-col justify-center items-center shadow-sm">
                                <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">FTEs / Mês</span>
                                <span className="text-xl font-bold text-purple-800">{effortMetrics.ftes.toFixed(2)}</span>
                            </div>
                            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex flex-col justify-center items-center shadow-sm">
                                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Valor / h Médio</span>
                                <span className="text-xl font-bold text-emerald-800">R$ {effortMetrics.avgRate.toFixed(0)}</span>
                            </div>
                            <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex flex-col justify-center items-center shadow-sm">
                                <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Custo Estimado</span>
                                <span className="text-xl font-bold text-amber-800">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(effortMetrics.totalCost)}
                                </span>
                            </div>
                            <div className="bg-cyan-50 p-3 rounded-lg border border-cyan-100 flex flex-col justify-center items-center shadow-sm">
                                <span className="text-[10px] text-cyan-700 font-bold uppercase tracking-wider">Custo Realizado</span>
                                <span className="text-xl font-bold text-cyan-900">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(effortMetrics.totalRealCost)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Resources & Progress */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status & Percentual</label>
                                <div className="flex gap-2 items-center">
                                    <select
                                        value={(formData.progress ?? 0) >= 100 ? 'DONE' :
                                            (formData.progress ?? 0) >= 75 ? 'REVIEW' :
                                                (formData.progress ?? 0) >= 50 ? 'IN_PROGRESS' :
                                                    (formData.progress ?? 0) >= 25 ? 'STARTING' : 'TODO'}
                                        onChange={(e) => {
                                            const status = e.target.value;
                                            let newProgress = 0;
                                            switch (status) {
                                                case 'DONE': newProgress = 100; break;
                                                case 'REVIEW': newProgress = 75; break;
                                                case 'IN_PROGRESS': newProgress = 50; break;
                                                case 'STARTING': newProgress = 25; break;
                                                default: newProgress = 0;
                                            }
                                            setFormData(prev => ({ ...prev, progress: newProgress }));
                                        }}
                                        className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2.5"
                                    >
                                        <option value="TODO">A Fazer (0-24%)</option>
                                        <option value="STARTING">Iniciando (25-49%)</option>
                                        <option value="IN_PROGRESS">Em Andamento (50-74%)</option>
                                        <option value="REVIEW">Quase Lá (75-99%)</option>
                                        <option value="DONE">Concluído (100%)</option>
                                    </select>

                                    <div className="flex items-center gap-2 w-40 shrink-0">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={formData.progress ?? ''}
                                            onChange={(e) => {
                                                const valStr = e.target.value;
                                                if (valStr === '') {
                                                    setFormData(prev => ({ ...prev, progress: undefined }));
                                                    return;
                                                }
                                                let val = parseInt(valStr);
                                                if (isNaN(val)) val = 0;
                                                if (val < 0) val = 0;
                                                if (val > 100) val = 100;
                                                setFormData(prev => ({ ...prev, progress: val }));
                                            }}
                                            className="w-full text-center rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2.5"
                                        />
                                        <span className="text-gray-500 font-medium">%</span>
                                    </div>
                                </div>
                                {task?.type === 'project' && (
                                    <p className="text-[10px] text-amber-600 mt-1">
                                        * Progresso de projetos é calculado automaticamente pelas sub-tarefas. Alterações manuais podem ser sobrescritas.
                                    </p>
                                )}
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tarefa Pai (Hierarquia)</label>
                                <select
                                    value={formData.parent || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, parent: e.target.value }))}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2.5"
                                >
                                    <option value="auto-id-1">-- Nenhuma (Raiz) --</option>
                                    {allTasks
                                        .filter(t => t.id !== task?.id) // Prevent selecting self
                                        .map(t => {
                                            // Calculate "depth" simplistically or just use visual cues if we knew depth. 
                                            // Since we don't have depth pre-calced in this flat list easily without processing,
                                            // we can accept flat list or try to show existing parents.
                                            // Let's just show the name. To do indented tree here requires sorting/recursion.
                                            // For now, let's keep it simple as requested "indentation tabular" might imply complex tree sort.
                                            // However, user said "setar a tarefa como filha coloque ela em uma identação tabular o nome da tarefa 1X depois da tarefa pai dela."
                                            // This usually refers to the VIEW in the Gantt Chart, not necessarily this dropdown, or does he mean the dropdown too?
                                            // "1X depois da tarefa pai dela" suggests the dropdown needs to show hierarchy.
                                            // To do that, we need to sort `allTasks` by hierarchy order (which `recalculateProject` usually does or returns)
                                            // If `allTasks` is already sorted by display order (it is in `tasks` prop usually), we just need depth.
                                            // We don't have depth property on Task type yet probably.
                                            // Let's check `types.ts`? No tool call allowed now.
                                            // We can hack depth search for now.
                                            let depth = 0;
                                            let p = t.parent;
                                            while (p && p !== 'auto-id-1') {
                                                depth++;
                                                const parent = allTasks.find(pt => pt.id === p);
                                                p = parent ? parent.parent : undefined;
                                            }

                                            return (
                                                <option key={t.id} value={t.id}>
                                                    {Array(depth).fill('\u00A0\u00A0\u00A0\u00A0').join('')} {t.name}
                                                </option>
                                            );
                                        })}
                                </select>
                                <p className="text-xs text-gray-400 mt-1">Defina a qual tarefa esta sub-tarefa pertence.</p>
                            </div>
                            <div className="md:col-span-2 space-y-3">
                                <label className="block text-sm font-medium text-gray-700">Atribuição de Recurso & Custos</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* 1. Select from Team */}
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Selecionar da Equipe</label>
                                        <SearchableSelect
                                            value={formData.resourceId || ''}
                                            onChange={(val) => {
                                                const resId = val;
                                                if (!resId) {
                                                    setFormData(prev => ({ ...prev, resourceId: undefined }));
                                                    return;
                                                }
                                                const res = resources.find(r => r.id === resId);
                                                if (res) {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        resourceId: res.id,
                                                        assignedResource: res.name, // Auto-fill name
                                                        hourlyRate: res.hourlyRate // Auto-fill rate
                                                    }));
                                                }
                                            }}
                                            options={resources.map(r => ({ value: r.id, label: r.name, subLabel: r.role }))}
                                            placeholder="-- Personalizado / Manual --"
                                        />
                                    </div>

                                    {/* 2. Manual Name (Text) */}
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Nome do Recurso (Label)</label>
                                        <input
                                            type="text"
                                            value={formData.assignedResource || ''}
                                            onChange={(e) => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    assignedResource: e.target.value,
                                                    resourceId: undefined // Detach from Team list when editing manually
                                                }));
                                            }}
                                            placeholder="Ex: Dev Senior (IA)"
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2.5 text-sm"
                                        />
                                    </div>

                                    {/* 3. Hourly Rate (Manual) */}
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Valor / Hora (R$)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">R$</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={formData.hourlyRate || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) || 0 }))}
                                                className="w-full pl-9 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2.5 text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dependencies Section */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                            <Link2 size={18} />
                            Dependências
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Predecessors (Upstream) */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                    <ArrowLeftCircle size={16} className="text-amber-600" />
                                    Predecessoras (Depende de)
                                </h4>
                                <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                                    {(formData.dependencies || []).length === 0 && <p className="text-xs text-gray-400 italic">Nenhuma dependência selecionada.</p>}
                                    {(formData.dependencies || []).map(depId => {
                                        const depTask = allTasks.find(t => t.id === depId);
                                        return (
                                            <div key={depId} className="flex justify-between items-center bg-white p-2 rounded shadow-sm border border-gray-100 text-sm">
                                                <span className="truncate flex-1" title={depTask ? depTask.name : depId}>
                                                    {depTask ? depTask.name : <span className="text-red-400 italic">Tarefa Desconhecida ({depId})</span>}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveDependency(depId)}
                                                    className="text-red-400 hover:text-red-600 p-1"
                                                    title="Remover Dependência"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1 w-0 min-w-0">
                                        <SearchableSelect
                                            value={newDependencyId}
                                            onChange={(val) => setNewDependencyId(val)}
                                            options={availableTasks.map(t => ({ value: t.id, label: t.name }))}
                                            placeholder="Selecione uma tarefa..."
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddDependency}
                                        disabled={!newDependencyId}
                                        className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Successors (Downstream) - Read Only essentially */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 opacity-80">
                                <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                    <ArrowRightCircle size={16} className="text-blue-600" />
                                    Sucessoras (Bloqueando)
                                </h4>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {successors.length === 0 && <p className="text-xs text-gray-400 italic">Nenhuma tarefa depende desta.</p>}
                                    {successors.map(succ => (
                                        <div key={succ.id} className="bg-white p-2 rounded shadow-sm border border-gray-100 text-sm text-gray-600">
                                            {succ.name}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2">
                                    * Para modificar sucessoras, edite as predecessoras da tarefa dependente.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Advanced Tools: Parallelism */}
                    {task && onSplit && (
                        <div className="pt-4 border-t border-gray-100 mt-6">
                            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <Columns size={16} className="text-orange-600" />
                                Ferramentas Avançadas
                            </h3>
                            <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                                <p className="text-xs text-orange-700 mb-3 font-medium">
                                    Paralelismo: Quebrar esta tarefa em múltiplas partes iguais executadas simultaneamente.
                                </p>
                                <div className="flex items-end gap-3">
                                    <div className="w-32">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Fator de Quebra</label>
                                        <input
                                            type="number"
                                            min="2"
                                            max="10"
                                            value={parallelFactor}
                                            onChange={(e) => setParallelFactor(Math.max(2, parseInt(e.target.value) || 2))}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 border p-2 text-sm"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (parallelFactor < 2) return;
                                            if (window.confirm(`ATENÇÃO: Isso irá dividir a tarefa atual em ${parallelFactor} tarefas paralelas, dividindo a duração total entre elas.\n\nDeseja continuar?`)) {
                                                onSplit(formData as Task, parallelFactor);
                                            }
                                        }}
                                        className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors mb-[1px] shadow-sm"
                                    >
                                        <Copy size={16} />
                                        Aplicar Paralelismo
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </form >

                <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div >
        </div >
    );
};
