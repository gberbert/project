import { Task, Resource, ProjectTeamMember } from '../types';
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
    projectTeam?: ProjectTeamMember[]; // Team structure from AI
    allTasks: Task[];
    onSave: (task: Task) => void;
    onCancel: () => void;
    onSplit?: (task: Task, factor: number) => void;
    forceLandscape?: boolean;
}

export const TaskForm = ({ task, resources, projectTeam, allTasks, onSave, onCancel, onSplit, forceLandscape = false }: TaskFormProps) => {
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

    const HOLIDAYS_BR = [
        '0-1', '3-21', '4-1', '8-7', '9-12', '10-2', '10-15', '11-25'
    ];
    const isHoliday = (date: Date) => {
        const key = `${date.getMonth()}-${date.getDate()}`;
        return HOLIDAYS_BR.includes(key);
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
            if (!isWeekend(current) && !isHoliday(current)) count++;
            current = addDays(current, 1);
        }
        return count;
    };

    const effortMetrics = useMemo(() => {
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
            totalRealCost: data.realCost,
            realHours: data.realHours
        };
    }, [formData, allTasks]);

    const [isPhysicalLandscape, setIsPhysicalLandscape] = useState(false);

    useEffect(() => {
        const checkLandscape = () => {
            // Mais robusto: Media Query para orientação E altura máxima (para não pegar desktops/tablets grandes)
            // max-height: 900px cobre a maioria dos celulares em landscape
            const mq = window.matchMedia("(orientation: landscape) and (max-height: 900px) and (max-width: 1024px)");
            setIsPhysicalLandscape(mq.matches);
        };

        checkLandscape();

        const mqListener = window.matchMedia("(orientation: landscape) and (max-height: 900px) and (max-width: 1024px)");
        // Modern browsers suggest addEventListener on MediaQueryList, but for safety with older React constructs:
        const handler = (e: MediaQueryListEvent) => setIsPhysicalLandscape(e.matches);

        if (mqListener.addEventListener) {
            mqListener.addEventListener("change", handler);
        } else {
            // Fallback for older browsers
            mqListener.addListener(handler);
        }

        window.addEventListener('resize', checkLandscape); // Fallback extra

        return () => {
            if (mqListener.removeEventListener) {
                mqListener.removeEventListener("change", handler);
            } else {
                mqListener.removeListener(handler);
            }
            window.removeEventListener('resize', checkLandscape);
        };
    }, []);

    const isLandscapeMobile = isPhysicalLandscape || forceLandscape;
    const shouldRotate = forceLandscape && !isPhysicalLandscape;

    const handleSubmit = (e?: React.FormEvent | React.MouseEvent) => {
        if (e) e.preventDefault();
        if (!formData.name || !formData.start || !formData.end) {
            alert('Por favor preencha todos os campos obrigatórios (Nome, Início, Fim).');
            return;
        }
        const uniqueDependencies = [...new Set(formData.dependencies || [])];
        const validDependencies = uniqueDependencies.filter(depId =>
            depId !== task?.id && allTasks.some(t => t.id === depId)
        );
        onSave({ ...formData, dependencies: validDependencies } as Task);
    };

    // --- RENDERIZACAO ---

    const renderCalendarDays = (isReal: boolean) => {
        const days = isReal ? realCalendarDays : calendarDays;
        const currentMonth = isReal ? viewRealDate : viewDate;
        const startProp = isReal ? 'realStart' : 'start';
        const endProp = isReal ? 'realEnd' : 'end';

        return days.map((day, idx) => {
            const isStart = formData[startProp] ? isSameDay(day, formData[startProp] as Date) : false;
            const isEnd = formData[endProp] ? isSameDay(day, formData[endProp] as Date) : false;
            const inRange = formData[startProp] && formData[endProp] ? isWithinInterval(day, { start: formData[startProp] as Date, end: formData[endProp] as Date }) : false;
            const isCurrentMonth = isSameMonth(day, currentMonth);

            return (
                <button
                    key={idx}
                    type="button"
                    onClick={() => isReal ? handleRealDateClick(day) : handleDateClick(day)}
                    className={`
                         h-9 w-9 flex items-center justify-center text-sm transition-all relative rounded-full
                         ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700 hover:bg-indigo-50'}
                         ${inRange && !isStart && !isEnd ? 'bg-indigo-50 text-indigo-700 rounded-none' : ''}
                         ${(isStart || isEnd) ? 'bg-indigo-600 text-white shadow-md z-10 font-bold' : ''}
                         ${isStart && formData[endProp] && formData[startProp] && !isSameDay(formData[startProp] as Date, formData[endProp] as Date) ? 'rounded-r-none' : ''}
                         ${isEnd && formData[startProp] && formData[endProp] && !isSameDay(formData[startProp] as Date, formData[endProp] as Date) ? 'rounded-l-none' : ''}
                     `}
                >
                    {format(day, 'd')}
                </button>
            );
        });
    };

    const containerClasses = isLandscapeMobile
        ? "fixed inset-0 z-[99999] flex justify-start pointer-events-auto" // Fundo transparente, mas bloqueia cliques no gráfico para evitar conflitos, ou permite? "Ver" = Transparente.
        : "fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4";

    // Nota: Removido bg-black/30 para transparência total conforme pedido.

    const cardClasses = isLandscapeMobile
        ? "w-2/5 h-full bg-white shadow-2xl flex flex-col rounded-r-xl border-r border-gray-200"
        : "bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col";

    const headerClasses = isLandscapeMobile
        ? "px-4 py-2 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0"
        : "p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0";

    const bodyClasses = isLandscapeMobile
        ? "flex-1 p-4 space-y-4 overflow-y-auto"
        : "flex-1 overflow-y-auto p-6 space-y-6";

    const inputClasses = isLandscapeMobile
        ? "w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border py-1 px-2 text-xs"
        : "w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2.5";

    const labelClasses = isLandscapeMobile
        ? "block text-[10px] font-bold text-gray-700 mb-0.5"
        : "block text-sm font-medium text-gray-700 mb-1";

    const sectionTitleClasses = isLandscapeMobile
        ? "font-bold text-gray-900 border-b pb-1 mb-2 text-xs flex items-center gap-2"
        : "font-semibold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2";

    const containerStyle: React.CSSProperties = shouldRotate ? {
        position: 'fixed',
        top: 0,
        left: '100vw',
        width: '100vh',
        height: '100vw',
        transform: 'rotate(90deg)',
        transformOrigin: 'top left',
        zIndex: 99999
    } : { zIndex: isLandscapeMobile ? 99999 : 9999 };

    return (
        <div className={containerClasses} style={containerStyle}>
            <div className={cardClasses}>
                <div className={headerClasses}>
                    <h2 className={`font-bold text-gray-800 ${isLandscapeMobile ? 'text-sm flex items-center gap-2' : 'text-xl'}`}>
                        {task ? 'Editar Tarefa' : 'Nova Tarefa'}
                        {isLandscapeMobile && <span className="text-[10px] font-normal text-gray-400 bg-gray-50 px-1 rounded border">Modo Horizontal</span>}
                    </h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                        <X size={isLandscapeMobile ? 20 : 24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={bodyClasses}>
                    {/* Basic Info */}
                    <div className={isLandscapeMobile ? "space-y-2" : "space-y-4"}>
                        <h3 className={sectionTitleClasses}>Informações Gerais</h3>
                        <div className={`grid gap-4 ${isLandscapeMobile ? 'grid-cols-2 gap-2' : 'grid-cols-1 md:grid-cols-2'}`}>
                            <div className={isLandscapeMobile ? 'col-span-1' : 'md:col-span-2'}>
                                <label className={labelClasses}>Nome da Tarefa</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className={inputClasses}
                                    required
                                    placeholder="ex: Design da Homepage"
                                />
                            </div>

                            <div className="relative" ref={calendarRef}>
                                <label className={labelClasses}>Estimativa (Planejado)</label>
                                <div
                                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                    className={`${inputClasses} flex items-center justify-between cursor-pointer hover:bg-gray-50 bg-white`}
                                >
                                    <div className="flex items-center gap-2 text-gray-700">
                                        <CalendarIcon size={isLandscapeMobile ? 14 : 18} className="text-gray-400" />
                                        <span className="font-medium">
                                            {formData.start ? format(formData.start, 'dd/MM/yyyy') : '__/__/____'}
                                            {'  -  '}
                                            {formData.end ? format(formData.end, 'dd/MM/yyyy') : '__/__/____'}
                                        </span>
                                    </div>
                                    <div className={`text-gray-400 bg-gray-100 rounded ${isLandscapeMobile ? 'text-[10px] px-1' : 'text-xs px-2 py-1'}`}>
                                        {formData.start && formData.end
                                            ? `${countBusinessDays(formData.start, formData.end)} dias úteis`
                                            : 'Selecione'}
                                    </div>
                                </div>

                                {isCalendarOpen && (
                                    <div className="absolute top-full left-0 z-50 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-[320px] animate-in fade-in zoom-in-95 duration-150">
                                        <div className="flex justify-between items-center mb-4">
                                            <button type="button" onClick={() => handleMonthChange(-1, false)} className="p-1 hover:bg-gray-100 rounded-full text-gray-600"><ChevronLeft size={20} /></button>
                                            <span className="font-bold text-gray-900 capitalize">
                                                {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
                                            </span>
                                            <button type="button" onClick={() => handleMonthChange(1, false)} className="p-1 hover:bg-gray-100 rounded-full text-gray-600"><ChevronRight size={20} /></button>
                                        </div>
                                        <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-gray-400">
                                            <div>D</div><div>S</div><div>T</div><div>Q</div><div>Q</div><div>S</div><div>S</div>
                                        </div>
                                        <div className="grid grid-cols-7 gap-1">
                                            {renderCalendarDays(false)}
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-xs">
                                            <div className="flex gap-2">
                                                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-indigo-600"></div> Início</div>
                                                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-gray-900"></div> Fim</div>
                                            </div>
                                            <div className="font-medium text-gray-500">
                                                {selectionStep === 'start' ? 'Selecione o Início' : 'Selecione o Fim'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Status and Progress */}
                            <div className={`grid ${isLandscapeMobile ? 'grid-cols-2 gap-2' : 'grid-cols-2 gap-4'}`}>
                                <div>
                                    <label className={labelClasses}>Status (Progresso)</label>
                                    <select
                                        value={
                                            (formData.progress || 0) === 0 ? 'todo' :
                                                (formData.progress || 0) >= 100 ? 'done' : 'doing'
                                        }
                                        onChange={(e) => {
                                            const status = e.target.value;
                                            if (status === 'todo') setFormData(prev => ({ ...prev, progress: 0 }));
                                            if (status === 'done') setFormData(prev => ({ ...prev, progress: 100 }));
                                            if (status === 'doing' && (formData.progress === 0 || formData.progress === 100)) {
                                                setFormData(prev => ({ ...prev, progress: 50 }));
                                            }
                                        }}
                                        className={inputClasses}
                                    >
                                        <option value="todo">A Fazer</option>
                                        <option value="doing">Em Andamento</option>
                                        <option value="done">Concluído</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClasses}>Percentual</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={formData.progress || 0}
                                            onChange={(e) => {
                                                const valStr = e.target.value;
                                                if (valStr === '') {
                                                    setFormData(prev => ({ ...prev, progress: 0 }));
                                                    return;
                                                }
                                                let val = parseInt(valStr);
                                                if (isNaN(val)) val = 0;
                                                if (val < 0) val = 0;
                                                if (val > 100) val = 100;
                                                setFormData(prev => ({ ...prev, progress: val }));
                                            }}
                                            className={`${inputClasses} text-center`}
                                        />
                                        <span className="text-gray-500 font-medium text-xs">%</span>
                                    </div>
                                </div>
                                {task?.type === 'project' && (
                                    <p className="text-[10px] text-amber-600 mt-1 col-span-2">
                                        * Progresso de projetos é calculado automaticamente.
                                    </p>
                                )}
                            </div>

                            <div className={isLandscapeMobile ? 'col-span-1' : 'md:col-span-2'}>
                                <label className={labelClasses}>Tarefa Pai (Hierarquia)</label>
                                <select
                                    value={formData.parent || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, parent: e.target.value }))}
                                    className={inputClasses}
                                >
                                    <option value="auto-id-1">-- Nenhuma (Raiz) --</option>
                                    {allTasks
                                        .filter(t => t.id !== task?.id) // Prevent selecting self
                                        .map(t => {
                                            return (
                                                <option key={t.id} value={t.id}>
                                                    {t.name}
                                                </option>
                                            );
                                        })}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Finance Info */}
                    <div className={isLandscapeMobile ? "space-y-2 opacity-90 scale-95 origin-top-left w-[105%]" : "space-y-4"}>
                        {/* Scale down finance section slightly in landscape as it's dense */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-gray-100 pb-2 mb-4">
                            <h3 className={sectionTitleClasses}>Execução e Financeiro</h3>
                        </div>

                        {/* New Role Selector */}
                        {projectTeam && projectTeam.length > 0 && (
                            <div className="mb-4">
                                <label className={labelClasses}>Profissional / Papel Sugerido</label>
                                <select
                                    value={formData.assignedResource || ''}
                                    onChange={e => {
                                        const roleName = e.target.value;
                                        // Robust find with trimming
                                        const role = projectTeam.find(r => r.role.trim() === roleName.trim());

                                        setFormData(prev => ({
                                            ...prev,
                                            assignedResource: roleName,
                                            // Explicitly set rate if role found (even if 0), otherwise keep manual
                                            hourlyRate: (role && role.hourlyRate !== undefined && role.hourlyRate !== null) ? role.hourlyRate : prev.hourlyRate
                                        }));
                                    }}
                                    className={`${inputClasses} bg-indigo-50 border-indigo-200 text-indigo-900 font-medium`}
                                >
                                    <option value="">-- Selecionar Papel da Equipe --</option>
                                    {projectTeam.map((m, idx) => (
                                        <option key={idx} value={m.role}>
                                            {m.role} ({m.hourlyRate ? `R$ ${m.hourlyRate}/h` : 'Sem Taxa definida'})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-500 mt-1">Ao selecionar um papel, a taxa/hora será atualizada automaticamente (se definida na aba Equipe).</p>
                            </div>
                        )}

                        {/* Execução Real and Hourly Rate */}
                        <div className={`grid gap-4 ${isLandscapeMobile ? 'grid-cols-2 gap-2 text-xs' : 'grid-cols-1 md:grid-cols-2'}`}>
                            {/* Data Real */}
                            <div className="relative" ref={realCalendarRef}>
                                <label className={labelClasses}>Execução Real</label>
                                <div
                                    onClick={() => setIsRealCalendarOpen(!isRealCalendarOpen)}
                                    className={`${inputClasses} flex items-center justify-between cursor-pointer hover:bg-gray-50 bg-white`}
                                >
                                    <div className="flex items-center gap-2 text-gray-700">
                                        <CalendarIcon size={isLandscapeMobile ? 14 : 18} className="text-emerald-500" />
                                        <span className="font-medium">
                                            {formData.realStart ? format(formData.realStart, 'dd/MM/yyyy') : '__/__/____'}
                                            {'  -  '}
                                            {formData.realEnd ? format(formData.realEnd, 'dd/MM/yyyy') : '__/__/____'}
                                        </span>
                                    </div>
                                </div>
                                {isRealCalendarOpen && (
                                    <div className="absolute top-full left-0 z-50 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-[320px] animate-in fade-in zoom-in-95 duration-150">
                                        <div className="flex justify-between items-center mb-4">
                                            <button type="button" onClick={() => handleMonthChange(-1, true)} className="p-1 hover:bg-gray-100 rounded-full text-gray-600"><ChevronLeft size={20} /></button>
                                            <span className="font-bold text-gray-900 capitalize">
                                                {format(viewRealDate, 'MMMM yyyy', { locale: ptBR })}
                                            </span>
                                            <button type="button" onClick={() => handleMonthChange(1, true)} className="p-1 hover:bg-gray-100 rounded-full text-gray-600"><ChevronRight size={20} /></button>
                                        </div>
                                        <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-gray-400">
                                            <div>D</div><div>S</div><div>T</div><div>Q</div><div>Q</div><div>S</div><div>S</div>
                                        </div>
                                        <div className="grid grid-cols-7 gap-1">
                                            {renderCalendarDays(true)}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Hourly Rate */}
                            <div>
                                <label className={labelClasses}>Valor Hora (R$)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs pointer-events-none">R$</span>
                                    <input
                                        type="number"
                                        value={formData.hourlyRate || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) }))}
                                        className={`${inputClasses} pl-8`}
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Calculated Totals */}
                        <div className={`bg-gray-50 rounded-lg border border-gray-200 ${isLandscapeMobile ? 'p-2' : 'p-4'}`}>
                            <h4 className={`font-bold text-gray-700 mb-2 ${isLandscapeMobile ? 'text-[10px]' : 'text-xs uppercase tracking-wider'}`}>Totais Calculados</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-[10px] text-gray-500">Horas Plan.</p>
                                    <p className={`font-bold text-gray-900 ${isLandscapeMobile ? 'text-xs' : 'text-lg'}`}>{Math.round(effortMetrics.hours)}h</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500">Custo Plan.</p>
                                    <p className={`font-bold text-gray-900 ${isLandscapeMobile ? 'text-xs' : 'text-lg'}`}>R$ {effortMetrics.totalCost.toLocaleString('pt-BR', { notation: 'compact' })}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-emerald-600">Horas Reais</p>
                                    <p className={`font-bold text-emerald-700 ${isLandscapeMobile ? 'text-xs' : 'text-lg'}`}>{Math.round(effortMetrics.realHours)}h</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-emerald-600">Custo Real</p>
                                    <p className={`font-bold text-emerald-700 ${isLandscapeMobile ? 'text-xs' : 'text-lg'}`}>R$ {effortMetrics.totalRealCost.toLocaleString('pt-BR', { notation: 'compact' })}</p>
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Dependencies Section */}
                    <div className={isLandscapeMobile ? "space-y-2" : "space-y-4"}>
                        <h3 className={sectionTitleClasses}>
                            <Link2 size={isLandscapeMobile ? 14 : 18} />
                            Dependências
                        </h3>

                        <div className={`grid ${isLandscapeMobile ? 'grid-cols-2 gap-2' : 'grid-cols-1 md:grid-cols-2 gap-6'}`}>
                            {/* Predecessors (Upstream) */}
                            <div className={`bg-gray-50 p-2 rounded-lg border border-gray-200 ${isLandscapeMobile ? 'text-xs' : ''}`}>
                                <h4 className={`font-bold text-gray-700 mb-2 flex items-center gap-2 ${isLandscapeMobile ? 'text-[10px]' : 'text-sm'}`}>
                                    <ArrowLeftCircle size={14} className="text-amber-600" />
                                    Predecessoras
                                </h4>
                                <div className="space-y-2 mb-2 max-h-20 overflow-y-auto">
                                    {(formData.dependencies || []).length === 0 && <p className="text-[10px] text-gray-400 italic">Nenhuma.</p>}
                                    {(formData.dependencies || []).map(depId => {
                                        const depTask = allTasks.find(t => t.id === depId);
                                        return (
                                            <div key={depId} className="flex justify-between items-center bg-white p-1 rounded shadow-sm border border-gray-100">
                                                <span className="truncate flex-1" title={depTask ? depTask.name : depId}>
                                                    {depTask ? depTask.name : depId}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveDependency(depId)}
                                                    className="text-red-400 hover:text-red-600 p-1"
                                                >
                                                    <X size={12} />
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
                                            placeholder="Add Dep..."
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddDependency}
                                        disabled={!newDependencyId}
                                        className="bg-indigo-600 text-white px-2 py-1 rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Successors */}
                            <div className={`bg-gray-50 p-2 rounded-lg border border-gray-200 opacity-80 ${isLandscapeMobile ? 'text-xs' : ''}`}>
                                <h4 className={`font-bold text-gray-700 mb-2 flex items-center gap-2 ${isLandscapeMobile ? 'text-[10px]' : 'text-sm'}`}>
                                    <ArrowRightCircle size={14} className="text-blue-600" />
                                    Sucessoras
                                </h4>
                                <div className="space-y-1 max-h-20 overflow-y-auto">
                                    {successors.length === 0 && <p className="text-[10px] text-gray-400 italic">Nenhuma.</p>}
                                    {successors.map(succ => (
                                        <div key={succ.id} className="bg-white p-1 rounded shadow-sm border border-gray-100 text-gray-600 truncate">
                                            {succ.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Advanced Tools: Parallelism */}
                    {task && onSplit && (
                        <div className={`pt-2 border-t border-gray-100 ${isLandscapeMobile ? 'mt-3' : 'mt-6'}`}>
                            <h3 className={sectionTitleClasses}>
                                <Columns size={isLandscapeMobile ? 14 : 16} className="text-orange-600" />
                                Ferramentas Avançadas
                            </h3>
                            <div className={`bg-orange-50 rounded-lg border border-orange-100 ${isLandscapeMobile ? 'p-2' : 'p-4'}`}>
                                <div className="flex items-end gap-3">
                                    <div className="w-24">
                                        <label className={labelClasses}>Fator de Quebra</label>
                                        <input
                                            type="number"
                                            min="2"
                                            max="10"
                                            value={parallelFactor}
                                            onChange={(e) => setParallelFactor(Math.max(2, parseInt(e.target.value) || 2))}
                                            className={inputClasses}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (parallelFactor < 2) return;
                                            if (window.confirm(`Confirmar paralelismo em ${parallelFactor}?`)) {
                                                onSplit(formData as Task, parallelFactor);
                                            }
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors shadow-sm ${isLandscapeMobile ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'}`}
                                    >
                                        <Copy size={16} />
                                        Aplicar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </form >

                <div className={`border-t border-gray-100 flex justify-end gap-3 bg-gray-50 flex-shrink-0 ${isLandscapeMobile ? 'p-2' : 'p-4'}`}>
                    <button
                        type="button"
                        onClick={onCancel}
                        className={`font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm ${isLandscapeMobile ? 'px-4 py-1.5 text-xs' : 'px-5 py-2.5 text-sm'}`}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className={`font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md ${isLandscapeMobile ? 'px-4 py-1.5 text-xs' : 'px-5 py-2.5 text-sm'}`}
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div >
        </div >
    );
};
