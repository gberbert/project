import { Gantt, Task as GanttLibTask, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { Task } from '../types';
import React, { useMemo, useState, useEffect } from 'react';
import { checkIsHoliday } from '../lib/utils';
import { Plus, Minus, ChevronLeft, ChevronRight, GripVertical, Trash2, Smartphone, Minimize2, ZoomOut, ZoomIn } from 'lucide-react';
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
    isCompact,
    onToggleCollapse,
    isCollapsed
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
    onToggleCollapse?: (taskId: string) => void;
    isCollapsed?: boolean;
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

                {/* Hierarchy Indentation & Expander */}
                <div style={{ paddingLeft: `${paddingLeft}px` }} className="flex items-center">
                    {task.type === 'project' ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onToggleCollapse) onToggleCollapse(task.id);
                            }}
                            className="mr-2 p-0.5 rounded-sm flex items-center justify-center transition-colors shadow-sm bg-white hover:bg-indigo-50 text-indigo-600 ring-1 ring-indigo-600"
                            style={{ width: 18, height: 18 }}
                            title={isCollapsed ? "Expandir" : "Recolher"}
                        >
                            {isCollapsed ? <Plus size={12} strokeWidth={3} /> : <Minus size={12} strokeWidth={3} />}
                        </button>
                    ) : null}
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
    const [collapsedTaskIds, setCollapsedTaskIds] = useState<string[]>([]);

    const toggleTaskCollapse = (taskId: string) => {
        setCollapsedTaskIds(prev => prev.includes(taskId)
            ? prev.filter(id => id !== taskId)
            : [...prev, taskId]
        );
    };

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

        let observer: MutationObserver;

        const applyStyles = () => {
            if (observer) observer.disconnect();

            const svgs = Array.from(container.querySelectorAll('svg'));

            // Constants
            const monthMap: Record<string, number> = {
                'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5,
                'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11,
                'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
                'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
            };
            const dayMap: Record<string, string> = {
                'Seg.,': 'S', 'Ter.,': 'T', 'Qua.,': 'Q', 'Qui.,': 'Q', 'Sex.,': 'S', 'Sáb.,': 'S', 'Dom.,': 'D',
                'seg.,': 's', 'ter.,': 't', 'qua.,': 'q', 'qui.,': 'q', 'sex.,': 's', 'sáb.,': 's', 'dom.,': 'd'
            };

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Phase 1: Identify Highlights (Scan Text)
            type Highlight = { x: number; type: 'today' | 'holiday' | 'weekend'; sourceSvg: SVGSVGElement };
            const highlights: Highlight[] = [];
            const processedXs = new Set<number>();

            svgs.forEach(svg => {
                const textElements = Array.from(svg.querySelectorAll('text'));

                // Initial Month/Year for this SVG
                let currentMonth = new Date().getMonth();
                let currentYear = new Date().getFullYear();

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

                let lastDay = -1;

                textElements.forEach(el => {
                    let txt = el.textContent || '';
                    if (txt === '!') return;

                    const textX = parseFloat(el.getAttribute('x') || '0');
                    if (textX <= 0) return;
                    if (processedXs.has(textX)) return;

                    // Date Text Logic (Keep styling for Text itself here)
                    // --- Text Replacement: W -> S ---
                    const wMatch = txt.match(/^[WS](\d+)$/);
                    if (wMatch && view === ViewMode.Week) {
                        const newText = `S${wMatch[1]}`;
                        if (el.textContent !== newText) {
                            el.textContent = newText;
                            txt = newText;
                        }
                        el.style.fill = '#6b7280';
                        el.style.fontWeight = '600';

                        const currentAnchor = el.getAttribute('text-anchor');
                        if (currentAnchor !== 'middle') {
                            el.setAttribute('x', (textX + (columnWidth / 2)).toString());
                            el.setAttribute('text-anchor', 'middle');
                        }
                        return;
                    }

                    // --- Landscape Date ---
                    if (isLandscapeMode) {
                        const match = txt.match(/([a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ]+\.,)\s*(\d+)/);
                        if (match) {
                            const [_, dayName, dayNum] = match;
                            if (dayMap[dayName]) {
                                const newText = `${dayMap[dayName]}-${dayNum.padStart(2, '0')}`;
                                if (el.textContent !== newText) {
                                    el.textContent = newText;
                                    txt = newText;
                                }
                            }
                        }
                    }

                    // Reset Size
                    if (isCompact) el.style.fontSize = '9px';
                    else el.style.fontSize = '';

                    // Skip Headers
                    if (Object.keys(monthMap).some(m => txt.toLowerCase().includes(m)) && txt.length > 8) return;

                    // Determine Day
                    const dayMatch = txt.match(/(\d+)/);
                    if (dayMatch) {
                        const day = parseInt(dayMatch[0]);

                        // Rollover
                        if (lastDay > 20 && day < 10) {
                            currentMonth++;
                            if (currentMonth > 11) {
                                currentMonth = 0;
                                currentYear++;
                            }
                        }
                        lastDay = day;

                        if (day >= 1 && day <= 31) {
                            const testDate = new Date(currentYear, currentMonth, day);

                            let type: 'today' | 'holiday' | 'weekend' | null = null;
                            let isTarget = false;

                            if (testDate.getDate() === today.getDate() &&
                                testDate.getMonth() === today.getMonth() &&
                                testDate.getFullYear() === today.getFullYear()) {
                                type = 'today';
                                el.style.fill = '#2563eb';
                                el.style.fontWeight = 'bold';
                                isTarget = true;
                            } else if (checkIsHoliday(testDate)) {
                                type = 'holiday';
                                el.style.fill = '#dc2626';
                                el.style.fontWeight = 'bold';
                                isTarget = true;
                            } else if (testDate.getDay() === 0 || testDate.getDay() === 6) {
                                type = 'weekend';
                                el.style.fill = '#d97706';
                                el.style.fontWeight = 'bold';
                                isTarget = true;
                            } else {
                                // Reset
                                el.style.fill = '';
                                el.style.fontWeight = '';
                            }

                            if (type && isTarget) {
                                highlights.push({ x: textX, type: type as any, sourceSvg: svg });
                                processedXs.add(textX);
                            }
                        }
                    }
                });
            });

            // Phase 2: Render Highlights (All SVGs)
            svgs.forEach(svg => {
                // Clear Old Groups
                const oldBg = svg.querySelector('#custom-backgrounds');
                if (oldBg) oldBg.remove();

                // Clear Old Ruler (if any)
                const oldRuler = svg.querySelector('#custom-ruler');
                if (oldRuler) oldRuler.remove();

                if (highlights.length === 0) return;

                // Create Groups
                const bgGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                bgGroup.id = 'custom-backgrounds';

                const rulerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                rulerGroup.id = 'custom-ruler';

                // Insert Layers:
                // 1. Backgrounds go to Bottom
                if (svg.firstChild) svg.insertBefore(bgGroup, svg.firstChild);
                else svg.appendChild(bgGroup);

                // 2. Rulers go to Top (Append to end of SVG to overlay grid lines)
                svg.appendChild(rulerGroup);

                highlights.forEach(h => {
                    // Rect (Background)
                    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    rect.setAttribute('x', Math.max(0, h.x - (columnWidth / 2)).toString());
                    rect.setAttribute('y', '0');
                    rect.setAttribute('width', columnWidth.toString());
                    rect.setAttribute('height', '100%');

                    if (h.type === 'today') {
                        rect.setAttribute('fill', '#eff6ff');
                        rect.setAttribute('fill-opacity', '0.5'); // Subtle blue
                        bgGroup.appendChild(rect);

                        const headerIndex = svgs.indexOf(h.sourceSvg);
                        const currentIndex = svgs.indexOf(svg);

                        // Line (Ruler) - Only in Body (Index > Header)
                        if (currentIndex > headerIndex) {
                            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                            line.setAttribute('x1', h.x.toString());
                            line.setAttribute('x2', h.x.toString());
                            line.setAttribute('y1', '0');
                            line.setAttribute('y2', '100%');
                            line.setAttribute('stroke', '#ef4444');
                            line.setAttribute('stroke-width', '1');
                            rulerGroup.appendChild(line);
                        }

                        // Label "Hoje" (First Body Row - Just below Header)
                        if (currentIndex === headerIndex + 1) {
                            // Background for Text
                            const textBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                            textBg.setAttribute('x', (h.x - 15).toString());
                            textBg.setAttribute('y', '2');
                            textBg.setAttribute('width', '30');
                            textBg.setAttribute('height', '14');
                            textBg.setAttribute('fill', 'white');
                            textBg.setAttribute('rx', '4');
                            rulerGroup.appendChild(textBg);

                            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                            text.textContent = "Hoje";
                            text.setAttribute('x', h.x.toString());
                            text.setAttribute('y', '12');
                            text.setAttribute('text-anchor', 'middle');
                            text.setAttribute('fill', '#ef4444');
                            text.setAttribute('font-size', '10px');
                            text.setAttribute('font-weight', 'bold');
                            rulerGroup.appendChild(text);
                        }

                    } else {
                        // Holiday/Weekend
                        rect.setAttribute('fill', h.type === 'holiday' ? '#fef2f2' : '#f3f4f6');
                        bgGroup.appendChild(rect);
                    }
                });
            });

            if (observer) {
                observer.observe(container, { childList: true, subtree: true, attributes: true });
            }
        };

        // Initialize MutationObserver
        observer = new MutationObserver((mutations) => {
            const relevantMutation = mutations.some(m =>
                m.type === 'childList' ||
                (m.type === 'attributes' && m.attributeName !== 'style' && m.attributeName !== 'class')
            );
            if (relevantMutation) applyStyles();
        });

        // Run immediately and on mutation
        const timer = setTimeout(applyStyles, 50);
        observer.observe(container, { childList: true, subtree: true, attributes: true });

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [tasks, selectedTaskId, isCompact, isLandscapeMode, view]);

    // --- Helper for Gantt Data ---
    // --- Helper for Gantt Data ---
    const ganttTasks: GanttLibTask[] = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. First Map to GanttLibTask format
        const mappedTasks = tasks.map((t) => {
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
                    styles = { progressColor: '#dc2626', backgroundColor: '#fca5a5' };
                } else {
                    styles = {
                        progressColor: displayType === 'project' ? '#f59e0b' : '#3b82f6',
                        backgroundColor: displayType === 'project' ? '#fcd34d' : '#60a5fa'
                    };
                }
            } else if (isDelayed) {
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
                hideChildren: collapsedTaskIds.includes(t.id)
            };
        });

        // 2. Build Parent Map for fast lookup
        const parentMap = new Map<string, string | null>();
        tasks.forEach(t => {
            if (t.parent) parentMap.set(t.id, t.parent);
        });

        // 3. Filter Hidden Tasks (Recursive Check)
        const visibleTasks = mappedTasks.filter(t => {
            let currentId = t.id;
            // Trace up the hierarchy
            let depth = 0;
            while (depth < 20) { // Safety break
                const parentId = parentMap.get(currentId);
                if (!parentId) break; // Reached root

                // If any ancestor is collapsed, hide this task
                if (collapsedTaskIds.includes(parentId)) {
                    return false;
                }
                currentId = parentId;
                depth++;
            }
            return true;
        });

        return visibleTasks;
    }, [tasks, collapsedTaskIds]);

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
                        <span className="text-lg font-bold leading-none" style={{ marginTop: '-2px' }}>+</span>
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
                                            onToggleCollapse={toggleTaskCollapse}
                                            isCollapsed={collapsedTaskIds.includes(t.id)}
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
                                                    onToggleCollapse={toggleTaskCollapse}
                                                    isCollapsed={collapsedTaskIds.includes(t.id)}
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
