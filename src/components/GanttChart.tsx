import { Gantt, Task as GanttLibTask, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { Task } from '../types';
import React, { useMemo, useState, useEffect } from 'react';
import { checkIsHoliday } from '../lib/utils';
import { Plus, ChevronLeft, ChevronRight, CornerDownRight, GripVertical, Trash2, Smartphone, Minimize2, ZoomOut, ZoomIn } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface GanttChartProps {
    tasks: Task[];
    onTaskChange: (task: Task) => void;
    onEditTask: (task: Task) => void;
    onAddTask: (afterTaskId?: string) => void;
    onDeleteTask?: (taskId: string) => void;
    onIndent: (task: Task) => void;
    onOutdent: (task: Task) => void;
    onReorderTasks: (newTasks: Task[], movedTaskId?: string) => void;
}

// Ensure TaskListTable receives the necessary props for DND
const SortableTaskRow = ({
    task,
    originalTask,
    allTasks,
    rowHeight,
    isSelected,
    onSelect,
    onEdit,
    onIndent,
    onOutdent,
    onDeleteTask,
    isCompact
}: {
    task: GanttLibTask;
    originalTask?: Task;
    allTasks: Task[];
    rowHeight: number;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onEdit: (t: Task) => void;
    onIndent: (t: Task) => void;
    onOutdent: (t: Task) => void;
    onDeleteTask?: (taskId: string) => void;
    isCompact?: boolean;
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: task.id, disabled: isCompact });

    // Display style
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        height: rowHeight,
        zIndex: isDragging ? 2 : 1,
        position: 'relative' as const,
    };

    // Calculate Depth dynamically
    let depth = 0;
    if (originalTask) {
        let current = originalTask;
        const maxDepth = 10; // Safety break
        while (current.parent && depth < maxDepth) {
            const parent = allTasks.find(t => t.id === current.parent);
            if (!parent) break;
            depth++;
            current = parent;
        }
    }

    const paddingLeft = (isCompact ? 8 : 20) + (depth * (isCompact ? 12 : 24));

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={() => onSelect(task.id)}
            className={`flex items-center border-b border-gray-100 transition-colors group ${isSelected ? 'bg-indigo-50 border-indigo-100' : 'hover:bg-gray-50 bg-white'
                } ${isDragging ? 'shadow-lg ring-1 ring-indigo-500 opacity-90' : ''}`}
        >
            <div
                className={`px-2 truncate font-medium text-gray-700 flex-1 border-r border-gray-100 h-full flex items-center gap-2 ${isCompact ? 'text-[10px]' : ''}`}
                style={{ width: isCompact ? '180px' : '280px', minWidth: isCompact ? '180px' : '280px' }}
            >
                {/* Drag Handle - Hide in landscape/compact to avoid touch conflict */}
                {!isCompact && (
                    <div {...attributes} {...listeners} className="cursor-grab hover:text-indigo-600 text-gray-400 p-1 flex-shrink-0">
                        <GripVertical size={14} />
                    </div>
                )}

                {/* Hierarchy Indentation Visual */}
                <div style={{ paddingLeft: `${paddingLeft}px` }} className="flex items-center">
                    {task.type === 'project' ? <CornerDownRight size={isCompact ? 10 : 14} className="text-gray-400 mr-1" /> : null}
                </div>

                {/* Name (Click to Edit) */}
                <div
                    className={`flex-1 cursor-pointer truncate ${task.type === 'project' ? 'font-bold text-blue-600' : ''}`}
                    onClick={(e) => { e.stopPropagation(); originalTask && onEdit(originalTask); }}
                    title={originalTask ? originalTask.name : task.name}
                >
                    {originalTask ? originalTask.name : task.name}
                </div>

                {/* Indent/Outdent Buttons (Visible on Hover) - Hide in compact to save space */}
                {/* Indent/Outdent Buttons (Visible on Hover) - Hide in compact to save space */}
                {!isCompact && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity mr-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); originalTask && onOutdent(originalTask); }}
                            className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-indigo-600"
                            title="Diminuir Recuo"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); originalTask && onIndent(originalTask); }}
                            className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-indigo-600"
                            title="Aumentar Recuo"
                        >
                            <ChevronRight size={14} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (originalTask && onDeleteTask && confirm('Tem certeza que deseja excluir esta tarefa?')) {
                                    onDeleteTask(originalTask.id);
                                }
                            }}
                            className="p-1 hover:bg-red-50 rounded text-gray-500 hover:text-red-500"
                            title="Excluir"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
            </div>

            <div
                className={`px-4 truncate text-gray-500 border-r border-gray-100 h-full flex items-center justify-center cursor-pointer ${isCompact ? 'text-[10px]' : ''}`}
                style={{ width: isCompact ? '80px' : '100px', minWidth: isCompact ? '80px' : '100px' }}
                onClick={(e) => { e.stopPropagation(); originalTask && onEdit(originalTask); }}
            >
                {task.start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </div>
            <div
                className={`px-4 truncate text-gray-500 h-full flex items-center justify-center cursor-pointer ${isCompact ? 'text-[10px]' : ''}`}
                style={{ width: isCompact ? '80px' : '100px', minWidth: isCompact ? '80px' : '100px' }}
                onClick={(e) => { e.stopPropagation(); originalTask && onEdit(originalTask); }}
            >
                {task.end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </div>
        </div>
    );
};

export const GanttChart = ({ tasks, onTaskChange, onEditTask, onAddTask, onDeleteTask, onIndent, onOutdent, onReorderTasks }: GanttChartProps) => {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [isLandscapeMode, setIsLandscapeMode] = useState(false);

    // Zoom control for landscape (compact mode)
    const [isCompact, setIsCompact] = useState(false);
    const [view, setView] = useState<ViewMode>(ViewMode.Day);

    useEffect(() => {
        if (isLandscapeMode) {
            setIsCompact(true); // Default to compact in landscape
        } else {
            setIsCompact(false); // Reset when exiting landscape
        }
    }, [isLandscapeMode]);

    // DND Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 15,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Auto-exit landscape if screen becomes large
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024 && isLandscapeMode) {
                setIsLandscapeMode(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isLandscapeMode]);

    // --- DOM Manipulation Logic (Holiday Styling + Date Text Replacement + Delayed Task Icons) ---
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let observer: MutationObserver; // Defined locally

        const applyStyles = () => {
            // Suspend observer to prevent infinite loop
            if (observer) observer.disconnect();

            const svgs = Array.from(container.querySelectorAll('svg'));
            const strokeWidth = isCompact ? '32px' : '64px';

            // Constants for Holiday Logic
            const monthMap: Record<string, number> = {
                'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5,
                'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11,
                'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
                'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
            };
            let currentMonth = new Date().getMonth();
            let currentYear = new Date().getFullYear();

            // Date Text Replacement Map (Seg., 09 -> S-09)
            const dayMap: Record<string, string> = {
                'Seg.,': 'S', 'Ter.,': 'T', 'Qua.,': 'Q', 'Qui.,': 'Q', 'Sex.,': 'S', 'Sáb.,': 'S', 'Dom.,': 'D',
                'seg.,': 's', 'ter.,': 't', 'qua.,': 'q', 'qui.,': 'q', 'sex.,': 's', 'sáb.,': 's', 'dom.,': 'd'
            };

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            svgs.forEach(svg => {
                // --- 1. Holiday & Date Text Logic ---
                const textElements = Array.from(svg.querySelectorAll('text'));

                // Identify Month/Year context
                const monthText = textElements.find(el => {
                    const txt = el.textContent?.toLowerCase() || '';
                    return Object.keys(monthMap).some(m => txt.includes(m));
                });
                if (monthText) {
                    const txt = monthText.textContent?.toLowerCase() || '';
                    const foundMonthKey = Object.keys(monthMap).find(m => txt.includes(m));
                    if (foundMonthKey !== undefined) {
                        currentMonth = monthMap[foundMonthKey];
                        const yearMatch = txt.match(/\d{4}/);
                        if (yearMatch) currentYear = parseInt(yearMatch[0]);
                    }
                }

                // Process each text element (Dates and Holidays)
                textElements.forEach(el => {
                    let txt = el.textContent || '';

                    // Skip if this is our custom icon text "!"
                    if (txt === '!') return;

                    // --- Text Replacement: W -> S (Semana) in Week View ---
                    // --- Text Replacement: W -> S (Semana) in Week View ---
                    const wMatch = txt.match(/^[WS](\d+)$/);
                    if (wMatch && view === ViewMode.Week) {
                        const newText = `S${wMatch[1]}`;
                        if (el.textContent !== newText) {
                            el.textContent = newText;
                            txt = newText;
                        }

                        // Reset styling to prevent holiday coloring and ensure clean look
                        el.style.fill = '#6b7280';
                        el.style.fontWeight = '600';

                        // Center text
                        const currentAnchor = el.getAttribute('text-anchor');
                        if (currentAnchor !== 'middle') {
                            const currentX = parseFloat(el.getAttribute('x') || '0');
                            if (currentX > 0) {
                                const width = isCompact ? 80 : 130;
                                el.setAttribute('x', (currentX + (width / 2)).toString());
                                el.setAttribute('text-anchor', 'middle');
                            }
                        }

                        return; // Skip holiday logic
                    }

                    // --- Date Text Replacement (Landscape ONLY) ---
                    if (isLandscapeMode) {
                        // Regex looks for "Seg., 12" pattern
                        const match = txt.match(/([a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ]+\.,)\s*(\d+)/);
                        if (match) {
                            const [fullMatch, dayName, dayNum] = match;
                            if (dayMap[dayName]) {
                                const newText = `${dayMap[dayName]}-${dayNum.padStart(2, '0')}`;
                                if (el.textContent !== newText) {
                                    el.textContent = newText;
                                    txt = newText; // Update local txt for holiday check below
                                }
                            }
                        }
                    }

                    // --- Font Size Reset/Set ---
                    if (isCompact) {
                        el.style.fontSize = '9px';
                    } else {
                        // CRITICAL: Explicitly clear/reset font size when NOT compact to fix regression
                        el.style.fontSize = '';
                    }

                    // --- Holiday/Weekend Highlight Logic ---
                    if (Object.keys(monthMap).some(m => txt.toLowerCase().includes(m)) && txt.length > 8) return;

                    // Check for weekend (adapted for both full text and substituted S-XX text)
                    const isWeekendText =
                        txt.includes('Sáb') || txt.includes('Dom') || txt.includes('Sab') || // Normal
                        (isLandscapeMode && (txt.startsWith('S-') || txt.startsWith('D-'))); // New Format warning: S- could be Seg or Sab/Sex. 

                    // Note: 'S-' is ambiguous (Seg, Sex, Sab). 'D-' is Dom.
                    // To be precise with S-, we need to calculate exact date.

                    const dayMatch = txt.match(/(\d+)/);
                    let isHolidayDay = false;
                    let isWeekendCalculated = false;

                    if (dayMatch) {
                        const day = parseInt(dayMatch[0]);
                        if (day >= 1 && day <= 31) {
                            const testDate = new Date(currentYear, currentMonth, day);
                            if (checkIsHoliday(testDate)) isHolidayDay = true;

                            const dow = testDate.getDay();
                            if (dow === 0 || dow === 6) isWeekendCalculated = true;
                        }
                    }

                    if (isWeekendText || isHolidayDay || isWeekendCalculated) {
                        const targetColor = isHolidayDay ? '#dc2626' : '#d97706';
                        el.style.fill = targetColor;
                        el.style.fontWeight = 'bold';

                        // Line highlight logic
                        const textX = parseFloat(el.getAttribute('x') || '0');
                        if (textX > 0) {
                            const lines = Array.from(svg.querySelectorAll('line'));
                            lines.forEach(line => {
                                const x1 = parseFloat(line.getAttribute('x1') || '0');
                                const y2 = parseFloat(line.getAttribute('y2') || '0');
                                if (Math.abs(x1 - textX) < (isCompact ? 20 : 33) && y2 > 50) {
                                    if (line.style.opacity !== '0.5') {
                                        line.style.stroke = isHolidayDay ? '#fee2e2' : '#fef3c7';
                                        line.style.strokeWidth = strokeWidth;
                                        line.style.opacity = '0.5';
                                    }
                                }
                            });
                        }
                    } else {
                        // Reset colors for non-holiday days (in case date changed but element reused)
                        el.style.fill = '';
                        el.style.fontWeight = '';
                    }
                });


                // --- 2. Delayed Task Icons Logic - REMOVED for better native styling approach ---
            });

            // Resume observer
            if (observer) {
                observer.observe(container, { childList: true, subtree: true, attributes: true });
            }
        };

        // Initialize MutationObserver
        observer = new MutationObserver((mutations) => {
            // Apply styles on ANY relevant change, but the disconnect logic inside applyStyles prevents recursion.
            const relevantMutation = mutations.some(m =>
                m.type === 'childList' ||
                (m.type === 'attributes' && m.attributeName !== 'style' && m.attributeName !== 'class')
            );
            if (relevantMutation) applyStyles();
        });

        // Run immediately and on mutation
        const timer = setTimeout(applyStyles, 50);

        // Start Observing
        observer.observe(container, { childList: true, subtree: true, attributes: true });

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [tasks, selectedTaskId, isCompact, isLandscapeMode, view]); // Re-run when mode changes

    // --- Helper for Gantt Data ---
    const ganttTasks: GanttLibTask[] = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return tasks.map((t) => {
            const duration = (new Date(t.end).getTime() - new Date(t.start).getTime()) / (1000 * 60 * 60 * 24);
            let displayType: 'task' | 'milestone' | 'project' = t.type;
            if (t.type !== 'project') {
                displayType = duration <= 1 ? 'milestone' : 'task';
            }

            // Calculate Delay
            const taskEnd = new Date(t.end);
            taskEnd.setHours(0, 0, 0, 0);
            const isDelayed = taskEnd <= today && t.progress < 100 && t.type !== 'project';

            // Determine Styles
            let styles = t.styles;
            if (!styles) {
                if (isDelayed) {
                    styles = { progressColor: '#dc2626', backgroundColor: '#fca5a5' }; // Red-600 progress, Red-300 bg
                } else {
                    styles = {
                        progressColor: displayType === 'project' ? '#f59e0b' : '#3b82f6',
                        backgroundColor: displayType === 'project' ? '#fcd34d' : '#60a5fa'
                    };
                }
            } else if (isDelayed) {
                // Force red warning even if custom styles exist (unless we want to be subtle, but user asked for evidence)
                // Let's assume if it is delayed, we want to warn.
                styles = { ...styles, progressColor: '#dc2626', backgroundColor: '#fca5a5' };
            }

            return {
                start: new Date(t.start),
                end: new Date(t.end),
                name: `${t.name} (${Math.round(t.progress || 0)}%)`,
                id: t.id,
                type: displayType,
                progress: t.progress,
                isDisabled: t.isDisabled ?? false,
                styles: styles,
                project: t.parent || undefined,
                dependencies: t.dependencies?.filter(depId => tasks.some(task => task.id === depId)),
                hideChildren: false
            };
        });
    }, [tasks]);

    const handleDateChange = (task: GanttLibTask) => {
        if (task.type === 'project') return;
        const original = tasks.find((t) => t.id === task.id);
        if (original) onTaskChange({ ...original, start: task.start, end: task.end });
    };

    const handleProgressChange = (task: GanttLibTask) => {
        if (task.type === 'project') return;
        const original = tasks.find((t) => t.id === task.id);
        if (original) onTaskChange({ ...original, progress: task.progress });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = tasks.findIndex((t) => t.id === active.id);
            const newIndex = tasks.findIndex((t) => t.id === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                const newTasks = arrayMove(tasks, oldIndex, newIndex);
                onReorderTasks(newTasks, active.id as string);
            }
        }
    };

    // --- View Configuration ---
    const rowHeight = isCompact ? 30 : 40;
    const columnWidth = view === ViewMode.Month ? 300 : (view === ViewMode.Week ? (isCompact ? 80 : 130) : (isCompact ? 40 : 65));
    const listCellWidth = isCompact ? "180px" : "280px";

    // Landscape specific CSS to ensure scroll works and fonts are small
    const landscapeCss = `
        .gantt-landscape-container svg text {
            font-size: 10px !important;
        }
        .gantt-landscape-container .grid-header {
            height: 30px !important; 
        }
        /* Ensure the gantt internal container allows scrolling */
        .gantt-landscape-container > div {
            overflow: auto !important;
            -webkit-overflow-scrolling: touch !important;
        }
    `;

    const containerStyle: React.CSSProperties = isLandscapeMode ? {
        position: 'fixed',
        top: 0,
        left: '100vw',
        width: '100vh',
        height: '100vw',
        transform: 'rotate(90deg)',
        transformOrigin: 'top left',
        zIndex: 9999,
        background: 'white',
        // 'touch-action: manipulation' helps browser decide scroll intent vs zoom
        touchAction: 'manipulation'
    } : {};

    const containerClasses = isLandscapeMode
        ? "flex flex-col gantt-landscape-container"
        : "w-full flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative";

    return (
        <div ref={containerRef} className={containerClasses} style={containerStyle}>
            {isLandscapeMode && <style>{landscapeCss}</style>}

            {/* Toolbar Header */}
            <div className={`flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 flex-shrink-0 ${isLandscapeMode ? 'px-8 py-2 h-14' : ''}`}>
                <div className="flex items-center gap-2">
                    <h3 className={`font-bold text-gray-700 whitespace-nowrap ${isCompact ? 'text-sm' : ''}`}>Cronograma</h3>

                    {/* Mobile Landscape Toggle Button */}
                    <button
                        onClick={() => setIsLandscapeMode(!isLandscapeMode)}
                        className={`lg:hidden flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ml-2 shadow-sm
                            ${isLandscapeMode
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                        {isLandscapeMode ? (
                            <>
                                <Minimize2 size={14} />
                                <span className="hidden">Voltar</span>
                            </>
                        ) : (
                            <>
                                <Smartphone size={14} className="rotate-90" />
                                <span className="hidden">Tela Cheia</span>
                            </>
                        )}
                    </button>

                    {/* Manual Zoom Toggle in Landscape */}
                    {isLandscapeMode && (
                        <button
                            onClick={() => setIsCompact(!isCompact)}
                            className="flex items-center justify-center p-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 ml-2"
                            title={isCompact ? "Aumentar Zoom" : "Diminuir Zoom"}
                        >
                            {isCompact ? <ZoomIn size={14} /> : <ZoomOut size={14} />}
                        </button>
                    )}
                </div>

                <div className="flex gap-2">
                    <div className="flex bg-gray-100 rounded-lg p-1 mr-2">
                        <button
                            onClick={() => setView(ViewMode.Day)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${view === ViewMode.Day ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Dia
                        </button>
                        <button
                            onClick={() => setView(ViewMode.Week)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${view === ViewMode.Week ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Semana
                        </button>
                        <button
                            onClick={() => setView(ViewMode.Month)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${view === ViewMode.Month ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Mês
                        </button>
                    </div>


                    <button onClick={() => onAddTask(selectedTaskId || undefined)} className={`flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-indigo-700 transition ml-2 whitespace-nowrap ${isCompact ? 'text-xs px-2 py-1' : ''}`}>
                        <Plus size={isCompact ? 14 : 16} />
                        <span className="hidden sm:inline">Nova Tarefa</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-white w-full">
                {(!tasks || tasks.length === 0) ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 min-h-[200px]">
                        <p>No tasks to display. Click "Nova Tarefa" to start.</p>
                    </div>
                ) : (isLandscapeMode ? (
                    <Gantt
                        tasks={ganttTasks}
                        viewMode={view}
                        locale="pt-BR"
                        onDateChange={handleDateChange}
                        onProgressChange={handleProgressChange}
                        listCellWidth={listCellWidth}
                        columnWidth={columnWidth}
                        rowHeight={rowHeight}
                        barFill={55}
                        ganttHeight={window.innerWidth - (isCompact ? 56 : 65)}
                        TaskListTable={(props) => (
                            <div className="font-sans text-sm border-r border-gray-200 bg-white">
                                {props.tasks.map(t => {
                                    const original = tasks.find(orig => orig.id === t.id);
                                    return (
                                        <SortableTaskRow
                                            key={t.id}
                                            task={t}
                                            originalTask={original}
                                            allTasks={tasks}
                                            rowHeight={props.rowHeight}
                                            isSelected={selectedTaskId === t.id}
                                            onSelect={(id) => setSelectedTaskId(prev => prev === id ? null : id)}
                                            onEdit={onEditTask}
                                            onIndent={onIndent}
                                            onOutdent={onOutdent}
                                            onDeleteTask={onDeleteTask}
                                            isCompact={isCompact}
                                        />
                                    );
                                })}
                            </div>
                        )}
                        TaskListHeader={({ headerHeight }) => (
                            <div
                                className="flex items-center bg-gray-50 border-b border-r border-gray-200 font-bold text-gray-500 uppercase tracking-wider"
                                style={{ height: headerHeight, fontSize: isCompact ? '10px' : '12px' }}
                            >
                                <div className="px-4 flex-1 border-r border-gray-200 h-full flex items-center" style={{ width: listCellWidth, minWidth: listCellWidth }}>
                                    Tarefa
                                </div>
                                <div className="px-4 border-r border-gray-200 h-full flex items-center justify-center" style={{ width: isCompact ? '80px' : '100px', minWidth: isCompact ? '80px' : '100px' }}>
                                    Início
                                </div>
                                <div className="px-4 h-full flex items-center justify-center" style={{ width: isCompact ? '80px' : '100px', minWidth: isCompact ? '80px' : '100px' }}>
                                    Fim
                                </div>
                            </div>
                        )}
                    />
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <Gantt
                            tasks={ganttTasks}
                            viewMode={view}
                            locale="pt-BR"
                            onDateChange={handleDateChange}
                            onProgressChange={handleProgressChange}
                            listCellWidth={listCellWidth}
                            columnWidth={columnWidth}
                            rowHeight={rowHeight}
                            barFill={55}
                            ganttHeight={500}
                            TaskListTable={(props) => (
                                <div className="font-sans text-sm border-r border-gray-200 bg-white">
                                    <SortableContext
                                        items={props.tasks.map(t => t.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {props.tasks.map(t => {
                                            const original = tasks.find(orig => orig.id === t.id);
                                            return (
                                                <SortableTaskRow
                                                    key={t.id}
                                                    task={t}
                                                    originalTask={original}
                                                    allTasks={tasks}
                                                    rowHeight={props.rowHeight}
                                                    isSelected={selectedTaskId === t.id}
                                                    onSelect={(id) => setSelectedTaskId(prev => prev === id ? null : id)}
                                                    onEdit={onEditTask}
                                                    onIndent={onIndent}
                                                    onOutdent={onOutdent}
                                                    onDeleteTask={onDeleteTask}
                                                    isCompact={isCompact}
                                                />
                                            );
                                        })}
                                    </SortableContext>
                                </div>
                            )}
                            TaskListHeader={({ headerHeight }) => (
                                <div
                                    className="flex items-center bg-gray-50 border-b border-r border-gray-200 font-bold text-gray-500 uppercase tracking-wider"
                                    style={{ height: headerHeight, fontSize: isCompact ? '10px' : '12px' }}
                                >
                                    <div className="px-4 flex-1 border-r border-gray-200 h-full flex items-center" style={{ width: listCellWidth, minWidth: listCellWidth }}>
                                        Tarefa
                                    </div>
                                    <div className="px-4 border-r border-gray-200 h-full flex items-center justify-center" style={{ width: isCompact ? '80px' : '100px', minWidth: isCompact ? '80px' : '100px' }}>
                                        Início
                                    </div>
                                    <div className="px-4 h-full flex items-center justify-center" style={{ width: isCompact ? '80px' : '100px', minWidth: isCompact ? '80px' : '100px' }}>
                                        Fim
                                    </div>
                                </div>
                            )}
                        />
                    </DndContext>
                ))}
            </div>
        </div>
    );
};
