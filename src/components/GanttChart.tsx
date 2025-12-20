import { Gantt, Task as GanttLibTask, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { Task } from '../types';
import React, { useMemo, useState, useEffect } from 'react';
import { checkIsHoliday, calculateBusinessDays } from '../lib/utils';
import { Plus, Minus, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, GripVertical, Trash2, Smartphone, Minimize2, ZoomOut, ZoomIn, PanelLeftClose, PanelLeftOpen, FolderOpen, FolderClosed, BarChart3, MoreHorizontal } from 'lucide-react';
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
    isModalOpen?: boolean;
    onLandscapeModeChange?: (isLandscape: boolean) => void;
    onViewModeChange?: (view: ViewMode) => void;
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
    isCollapsed,
    hasChildren
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
    hasChildren?: boolean;

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
        touchAction: 'pan-x pan-y',
    };

    // Calculate Depth dynamically
    let depth = 0;
    if (originalTask) {
        if (originalTask.parent) {
            // Default to 1 if has parent but parent not found in list (fallback for visual nesting)
            depth = 1;

            let current = originalTask;
            let computedDepth = 0;
            const maxDepth = 10;

            while (current.parent && computedDepth < maxDepth) {
                const parent = allTasks.find(t => t.id === current.parent);
                if (!parent) break;
                computedDepth++;
                current = parent;
            }
            if (computedDepth > 0) depth = computedDepth;
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
                className={`px-2 truncate font-medium text-gray-700 flex-1 border-r border-gray-100 h-full flex items-center gap-2 ${isCompact ? 'text-[11px]' : ''}`}
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
                    {(task.type === 'project' || hasChildren) ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onToggleCollapse) onToggleCollapse(task.id);
                            }}
                            className="mr-2 p-0.5 rounded-sm flex items-center justify-center transition-colors shadow-sm bg-white hover:bg-indigo-50 text-indigo-600 ring-1 ring-indigo-600"
                            style={{ width: isCompact ? 14 : 18, height: isCompact ? 14 : 18 }} // Smaller button in compact
                            title={isCollapsed ? "Expandir" : "Recolher"}
                        >
                            {isCollapsed ? <Plus size={isCompact ? 10 : 12} strokeWidth={3} /> : <Minus size={isCompact ? 10 : 12} strokeWidth={3} />}
                        </button>
                    ) : null}
                </div>

                {/* Name (Click to Edit) */}
                <div
                    className={`flex-1 cursor-pointer truncate ${(task.type === 'project' || hasChildren) ? 'font-bold text-blue-600' : ''} text-[11px] flex items-center h-full`}
                    onClick={(e) => { e.stopPropagation(); originalTask && onEdit(originalTask); }}
                    title={originalTask ? originalTask.name : task.name}
                >
                    {originalTask ? originalTask.name : task.name}
                </div>

                {/* Indent/Outdent Buttons (Always Visible) */}
                <div className="flex items-center gap-0.5 mr-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); originalTask && onOutdent(originalTask); }}
                        className="p-0.5 hover:bg-gray-200 rounded text-gray-400 hover:text-indigo-600"
                        title="Diminuir Recuo"
                    >
                        <ChevronLeft size={12} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); originalTask && onIndent(originalTask); }}
                        className="p-0.5 hover:bg-gray-200 rounded text-gray-400 hover:text-indigo-600"
                        title="Aumentar Recuo"
                    >
                        <ChevronRight size={12} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (originalTask && onDeleteTask && confirm('Tem certeza que deseja excluir esta tarefa?')) {
                                onDeleteTask(originalTask.id);
                            }
                        }}
                        className="p-0.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                        title="Excluir"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            <div
                className={`px-4 truncate text-gray-500 border-r border-gray-100 h-full flex items-center justify-center cursor-pointer text-[11px]`}
                style={{ width: isCompact ? '80px' : '100px', minWidth: isCompact ? '80px' : '100px' }}
                onClick={(e) => { e.stopPropagation(); originalTask && onEdit(originalTask); }}
            >
                {task.start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
            <div
                className={`px-4 truncate text-gray-500 h-full flex items-center justify-center cursor-pointer text-[11px]`}
                style={{ width: isCompact ? '80px' : '100px', minWidth: isCompact ? '80px' : '100px' }}
                onClick={(e) => { e.stopPropagation(); originalTask && onEdit(originalTask); }}
            >
                {task.end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
            <div
                className={`px-4 truncate text-gray-500 h-full flex items-center justify-center cursor-pointer text-[11px] bg-gray-50/50`}
                style={{ width: isCompact ? '60px' : '80px', minWidth: isCompact ? '60px' : '80px' }}
                title="Duração em Dias Úteis"
            >
                {calculateBusinessDays(task.start, task.end)}d
            </div>
        </div>
    );
};

export const GanttChart = ({ tasks, onTaskChange, onEditTask, onAddTask, onDeleteTask, onIndent, onOutdent, onReorderTasks, isModalOpen = false, onLandscapeModeChange, onViewModeChange }: GanttChartProps) => {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    const handleManualScroll = (direction: 'left' | 'right' | 'up' | 'down') => {
        const scrollAmountX = window.innerWidth * 0.05;
        const scrollAmountY = window.innerWidth * 0.05;

        const isHorizontal = direction === 'left' || direction === 'right';
        const isVertical = direction === 'up' || direction === 'down';

        // 1. Try finding internal scrollables (library generated)
        if (containerRef.current) {
            const allDivs = containerRef.current.querySelectorAll('div');
            let foundInternal = false;

            allDivs.forEach(el => {
                const style = window.getComputedStyle(el);

                // Horizontal Check
                if (isHorizontal && (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
                    el.scrollBy({
                        left: direction === 'right' ? scrollAmountX : -scrollAmountX,
                        behavior: 'auto'
                    });
                    foundInternal = true;
                }

                // Vertical Check
                if (isVertical && (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
                    el.scrollBy({
                        top: direction === 'down' ? scrollAmountY : -scrollAmountY,
                        behavior: 'auto'
                    });
                    foundInternal = true;
                }
            });

            if (foundInternal) return;
        }

        // 2. Fallback to our wrapper
        if (scrollContainerRef.current) {
            if (isHorizontal) {
                scrollContainerRef.current.scrollBy({
                    left: direction === 'right' ? scrollAmountX : -scrollAmountX,
                    behavior: 'auto'
                });
            } else {
                scrollContainerRef.current.scrollBy({
                    top: direction === 'down' ? scrollAmountY : -scrollAmountY,
                    behavior: 'auto'
                });
            }
        }
    };

    const scrollFrameRef = React.useRef<number | null>(null);

    const stopScrolling = () => {
        if (scrollFrameRef.current) {
            cancelAnimationFrame(scrollFrameRef.current);
            scrollFrameRef.current = null;
        }
    };

    const startScrolling = (direction: 'left' | 'right' | 'up' | 'down') => {
        stopScrolling();

        const scrollStep = () => {
            handleManualScroll(direction);
            // Recursively call for next frame to achieve maximum smooth speed
            scrollFrameRef.current = requestAnimationFrame(scrollStep);
        };

        scrollStep(); // Start immediately
    };
    const [isLandscapeMode, setIsLandscapeMode] = useState(false);

    useEffect(() => {
        onLandscapeModeChange?.(isLandscapeMode);
    }, [isLandscapeMode, onLandscapeModeChange]);

    // Zoom control for landscape (compact mode)
    const [isCompact, setIsCompact] = useState(false);
    const [view, setView] = useState<ViewMode>(ViewMode.Year);

    // Notify parent of view mode changes
    useEffect(() => {
        onViewModeChange?.(view);
    }, [view, onViewModeChange]);

    const [collapsedTaskIds, setCollapsedTaskIds] = useState<string[]>([]);
    const [showTaskList, setShowTaskList] = useState(true);
    const [isSuperCompact, setIsSuperCompact] = useState(false);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
    const [showMobileActions, setShowMobileActions] = useState(false);
    const initialScrollDone = React.useRef(false);

    const collapsedInitialized = React.useRef(false);

    useEffect(() => {
        if (tasks.length > 0 && !collapsedInitialized.current) {
            // Default: Auto-collapse all parent tasks on load
            const parentIds = Array.from(new Set(tasks.filter(t => tasks.some(sub => sub.parent === t.id)).map(t => t.id)));
            setCollapsedTaskIds(parentIds);
            collapsedInitialized.current = true;
        }
    }, [tasks]);

    // Auto-scroll to start when switching to Year view to show the first task
    useEffect(() => {
        if (view === ViewMode.Year) {
            // Tiny timeout to ensure the grid has rendered
            const timer = setTimeout(() => {
                if (containerRef.current) {
                    // Find the horizontal scroll container within the Gantt component
                    const scrollables = containerRef.current.querySelectorAll('div');
                    scrollables.forEach(el => {
                        const style = window.getComputedStyle(el);
                        if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
                            el.scrollLeft = 0;
                        }
                    });
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [view]);

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
            setIsMobile(window.innerWidth < 1024);
            if (window.innerWidth >= 1024 && isLandscapeMode) {
                setIsLandscapeMode(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isLandscapeMode]);

    // --- DOM Manipulation Logic (Holiday Styling + Date Text Replacement + Delayed Task Icons + Auto Scroll) ---
    useEffect(() => {
        initialScrollDone.current = false;
        const container = containerRef.current;
        if (!container) return;

        let observer: MutationObserver | undefined;

        const applyStyles = () => {
            // Logic restored to original sync execution for simplicity as requested, 
            // but wrapped in requestAnimationFrame to define a baseline for future attempts if needed, 
            // OR strictly identical to original:

            if (observer) observer.disconnect();

            const svgs = Array.from(container.querySelectorAll('svg')).filter(svg => !svg.closest('button') && !svg.closest('.icon-wrapper'));
            let todayScrollTarget: { x: number; element: Element } | null = null;

            // Determine View Start (Earliest of Tasks or Today)
            let viewStart = new Date();
            viewStart.setHours(0, 0, 0, 0);
            if (tasks.length > 0) {
                const minTask = tasks.reduce((min, t) => new Date(t.start) < min ? new Date(t.start) : min, new Date(8640000000000000));
                if (minTask < viewStart) viewStart = minTask;
            }

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

            // Anchor for Fallback Scroll
            let anchorDate: Date | null = null;
            let anchorX = 0;

            for (const svg of svgs) {
                const textElements = Array.from(svg.querySelectorAll('text'));

                // Initial Month/Year for this SVG (Defaults to View Start)
                let currentMonth = viewStart.getMonth();
                let currentYear = viewStart.getFullYear();

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

                    // --- Abbreviate Month Names in Annual View ---
                    if (view === ViewMode.Month) {
                        const lowerTxt = txt.toLowerCase();
                        const monthReplacements: Record<string, string> = {
                            'janeiro': 'Jan', 'fevereiro': 'Fev', 'março': 'Mar', 'abril': 'Abr', 'maio': 'Mai', 'junho': 'Jun',
                            'julho': 'Jul', 'agosto': 'Ago', 'setembro': 'Set', 'outubro': 'Out', 'novembro': 'Nov', 'dezembro': 'Dez'
                        };

                        for (const [full, abbr] of Object.entries(monthReplacements)) {
                            if (lowerTxt.includes(full)) {
                                const newText = txt.replace(new RegExp(full, 'i'), abbr);
                                if (el.textContent !== newText) {
                                    el.textContent = newText;
                                    txt = newText;
                                }
                            }
                        }
                    }

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
                    if (isCompact || isSuperCompact) el.style.fontSize = '8px';
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

                            if (!anchorDate) {
                                anchorDate = testDate;
                                anchorX = textX;
                            }

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

                                if (type === 'today' && !todayScrollTarget) {
                                    todayScrollTarget = { x: textX, element: svg };
                                }
                            }
                        }
                    }
                });
            }

            // Phase 2: Render Highlights (All SVGs)
            for (const svg of svgs) {
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
                            text.setAttribute('font-weight', 'bold');
                            text.setAttribute('font-size', '10px'); // Explicit font size fix
                            rulerGroup.appendChild(text);
                        }

                    } else {
                        // Holiday/Weekend
                        rect.setAttribute('fill', h.type === 'holiday' ? '#fef2f2' : '#f3f4f6');
                        bgGroup.appendChild(rect);
                    }
                });
            }

            // Fix Text Vertical Alignment in Grid Rows
            const taskTextElements = container.querySelectorAll('.barLabel');
            taskTextElements.forEach((el) => {
                if (el instanceof SVGTextElement) {
                    el.setAttribute('dy', '0'); // Remove library's default centering offset if it interferes
                }
            });

            // Auto-Scroll Logic
            if (!initialScrollDone.current) {
                // Find robust scroll container
                let scrollContainer: Element | null = null;
                for (const svg of svgs) {
                    const p = svg.parentElement;
                    if (p && (p.scrollWidth > p.clientWidth || getComputedStyle(p).overflowX === 'auto' || getComputedStyle(p).overflowX === 'scroll')) {
                        scrollContainer = p;
                        break;
                    }
                }
                if (!scrollContainer && svgs.length > 0) scrollContainer = svgs[svgs.length - 1].parentElement;

                if (scrollContainer) {
                    if (view === ViewMode.Week) {
                        scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
                        initialScrollDone.current = true;
                    } else if (todayScrollTarget) {
                        const center = (todayScrollTarget as any).x - (scrollContainer.clientWidth / 2);
                        if (Math.abs(scrollContainer.scrollLeft - center) > 10) {
                            scrollContainer.scrollTo({ left: Math.max(0, center), behavior: 'smooth' });
                        }
                        initialScrollDone.current = true;
                    } else if (anchorDate && (view as any) !== ViewMode.Week) {
                        let offset = 0;
                        // Use non-null assertion or local variable to satisfy TS
                        const ad = anchorDate as Date;
                        if (view === ViewMode.Month) {
                            const months = (today.getFullYear() - ad.getFullYear()) * 12 + (today.getMonth() - ad.getMonth());
                            offset = months * columnWidth;
                        } else {
                            const days = Math.floor((today.getTime() - ad.getTime()) / (1000 * 60 * 60 * 24));
                            offset = days * columnWidth;
                        }
                        const targetX = anchorX + offset;
                        const center = targetX - (scrollContainer.clientWidth / 2);
                        if (Math.abs(scrollContainer.scrollLeft - center) > 10) {
                            scrollContainer.scrollTo({ left: Math.max(0, center), behavior: 'smooth' });
                        }
                        initialScrollDone.current = true;
                    }
                }
            }

            // Re-connect after work is done
            if (observer) {
                observer.observe(container, { childList: true, subtree: true, attributes: true });
            }
        };

        let debounceTimer: ReturnType<typeof setTimeout>;

        observer = new MutationObserver((mutations) => {
            const relevantMutation = mutations.some(m =>
                m.type === 'childList' ||
                (m.type === 'attributes' && m.attributeName !== 'style' && m.attributeName !== 'class')
            );

            if (relevantMutation) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(applyStyles, 100);
            }
        });

        // Run immediately (initial) and on mutation
        // Initial run also slightly delayed to let React settle
        const timer = setTimeout(applyStyles, 200);
        observer.observe(container, { childList: true, subtree: true, attributes: true });

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [tasks, selectedTaskId, isCompact, isLandscapeMode, view, isSuperCompact]);

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
                    styles = { progressColor: '#dc2626', backgroundColor: '#fca5a5', backgroundSelectedColor: '#fecaca' };
                } else if (t.progress === 100) {
                    styles = { progressColor: '#10b981', backgroundColor: '#dcfce7', backgroundSelectedColor: '#bbf7d0' };
                } else if (t.type === 'project') {
                    styles = { progressColor: '#4f46e5', backgroundColor: '#e0e7ff', backgroundSelectedColor: '#c7d2fe' };
                } else {
                    styles = { progressColor: '#3b82f6', backgroundColor: '#eef2ff', backgroundSelectedColor: '#dbeafe' };
                }
            }

            return {
                start: new Date(t.start),
                end: new Date(t.end),
                name: t.name,
                id: t.id,
                type: displayType,
                progress: t.progress,
                isDisabled: false,
                styles: styles,
                project: t.parent || undefined,
                dependencies: t.dependencies || [],
                hideChildren: collapsedTaskIds.includes(t.id)
            };
        });

        // Add Dummy Task to extend view
        // In Day view, we MUST NOT extend 5 years or it crashes the DOM (thousands of columns)
        // In Year/Month view, 5 years is fine.
        const targetYear = today.getFullYear() + 5;
        let dummyEnd = new Date(`${targetYear}-12-31`);

        if (view === ViewMode.Day) {
            // For Day view, find max task end date and add a small buffer (e.g. 2 months)
            // Just enough to allow scrolling a bit into future, but not years.
            const maxTaskEnd = tasks.length > 0
                ? tasks.reduce((max, t) => t.end > max ? t.end : max, new Date())
                : new Date();

            dummyEnd = new Date(maxTaskEnd);
            dummyEnd.setDate(dummyEnd.getDate() + 60); // +60 days buffer
        }

        mappedTasks.push({
            start: dummyEnd, // Start = End to be invisible/point
            end: dummyEnd,
            name: "",
            id: `dummy-extender-${dummyEnd.getTime()}`,
            type: 'task',
            progress: 0,
            isDisabled: true,
            styles: { backgroundColor: 'transparent', backgroundSelectedColor: 'transparent', progressColor: 'transparent' },
            hideChildren: false,
            project: undefined,
            dependencies: []
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

        // 4. Add Spacer for View Range - REMOVED to prevent extra blank row
        // If date extension is needed, rely on dummy-extender or ensure logic doesn't add visible row.

        return visibleTasks;
    }, [tasks, collapsedTaskIds, view]);

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
    const effectiveCompact = isCompact || isSuperCompact; // Logic helper
    const rowHeight = isSuperCompact ? 24 : (isCompact ? 28 : 34); // Adjusted for 13px font base
    const columnWidth = view === ViewMode.Year ? 130 : (isSuperCompact ? 30 : (isCompact ? 40 : 65));
    const listCellWidth = effectiveCompact ? "180px" : "280px";

    // Landscape specific CSS to ensure scroll works and fonts are small
    const landscapeCss = `
        .gantt-landscape-container svg text {
            font-size: 10px !important;
        }
        .gantt-landscape-container .grid-header {
            height: 26px !important; 
        }
        /* Landscape Container Overrides */
        .gantt-landscape-container .grid-header > text {
             font-size: 9px !important; 
             transform: translateY(-14px); /* Pull text up to center it visually */
             dominant-baseline: auto; /* Reset to let transform handle it */
        }
        /* Vertical Align Text and Reduce Task List Font */
        .gantt-landscape-container .taskListWrapper svg text {
             dominant-baseline: middle;
             alignment-baseline: middle;
             font-size: 9px !important;
             transform: translateY(1px); /* Fine-tune optical center */
        }
        
        /* Ensure the gantt internal container allows scrolling */
        .gantt-landscape-container > div {
            overflow: auto !important;
            -webkit-overflow-scrolling: touch !important;
        }
    `;

    const mobileScrollCss = `
        .mobile-gantt-fix div[style*="overflow-x: auto"],
        .mobile-gantt-fix div[style*="overflow-x: scroll"] {
            transform: rotateX(180deg);
        }
        .mobile-gantt-fix div[style*="overflow-x: auto"] > *,
        .mobile-gantt-fix div[style*="overflow-x: scroll"] > * {
            transform: rotateX(180deg);
        }
        .mobile-gantt-fix ::-webkit-scrollbar {
            -webkit-appearance: none;
            height: 6px; 
            width: 6px;
        }
        .mobile-gantt-fix ::-webkit-scrollbar-thumb {
            background-color: rgba(0,0,0,0.3);
            border-radius: 4px;
        }
        .mobile-gantt-fix ::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.05);
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
            <div className={`flex items-center justify-between p-2 border-b border-gray-100 bg-gray-50 flex-shrink-0 ${isLandscapeMode ? 'px-8 py-2 h-14' : ''}`}>
                <div className="flex items-center gap-2">
                    <h3 className={`font-bold text-gray-700 whitespace-nowrap ${isCompact || isSuperCompact ? 'text-sm' : ''}`}>Cronograma</h3>

                    {/* Task List Toggle */}
                    <button
                        onClick={() => setShowTaskList(!showTaskList)}
                        className={`hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ml-2 shadow-sm
                            ${!showTaskList
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        title={showTaskList ? "Ocultar Lista" : "Mostrar Lista"}
                    >
                        <BarChart3 size={16} className={showTaskList ? "text-indigo-600" : "text-current"} />
                    </button>

                    {/* Super Compact Mode Toggle */}
                    <button
                        onClick={() => setIsSuperCompact(!isSuperCompact)}
                        className={`hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ml-2 shadow-sm
                            ${isSuperCompact
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        title={isSuperCompact ? "Modo Normal" : "Modo Super Compacto"}
                    >
                        {isSuperCompact ? <ZoomIn size={14} /> : <ZoomOut size={14} />}
                        <span className="hidden xl:inline">{isSuperCompact ? "Normal" : "Compacto"}</span>
                    </button>

                    {/* Expand/Collapse All Buttons */}
                    <div className="flex bg-gray-100 rounded-lg p-1 ml-2">
                        <button
                            onClick={() => setCollapsedTaskIds([])}
                            className="p-1 hover:bg-white rounded transition-colors shadow-sm"
                            title="Expandir Tudo"
                        >
                            <Plus size={16} className="text-green-600" />
                        </button>
                        <button
                            onClick={() => {
                                // Collapse all tasks that are parents
                                const parentIds = Array.from(new Set(tasks.filter(t => tasks.some(sub => sub.parent === t.id)).map(t => t.id)));
                                setCollapsedTaskIds(parentIds);
                            }}
                            className="p-1 hover:bg-white rounded transition-colors shadow-sm ml-1"
                            title="Recolher Tudo"
                        >
                            <Minus size={16} className="text-red-600" />
                        </button>
                    </div>

                    {/* Mobile Landscape Toggle Button */}
                    <button
                        onClick={() => setIsLandscapeMode(!isLandscapeMode)}
                        className={`lg:hidden flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ml-2 shadow-sm
                            ${isLandscapeMode
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                        <BarChart3 size={16} className={isLandscapeMode ? "text-white" : "text-indigo-600"} />
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
                    {/* Desktop Toolbar */}
                    <div className={`${isLandscapeMode ? 'flex' : 'hidden'} lg:flex gap-2`}>
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
                            <button
                                onClick={() => setView(ViewMode.Year)}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${view === ViewMode.Year ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                Ano
                            </button>
                        </div>

                        <button onClick={() => onAddTask(selectedTaskId || undefined)} className={`hidden lg:flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-indigo-700 transition ml-2 whitespace-nowrap ${isCompact ? 'text-xs px-2 py-1' : ''}`}>
                            <span className="text-lg font-bold leading-none" style={{ marginTop: '-2px' }}>+</span>
                            <span className="hidden sm:inline">Nova Tarefa</span>
                        </button>
                    </div>


                    <div className={`${isLandscapeMode ? 'hidden' : ''} lg:hidden relative`}>
                        <button
                            onClick={() => setShowMobileActions(!showMobileActions)}
                            className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm font-medium shadow hover:bg-indigo-700 transition flex items-center gap-2"
                        >
                            <span>Ações</span>
                            <MoreHorizontal size={16} />
                        </button>

                        {showMobileActions && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-2 flex flex-col gap-2 animate-in fade-in zoom-in duration-200">
                                <div className="text-xs font-bold text-gray-400 uppercase px-2 mb-1">Visualização</div>
                                <div className="flex bg-gray-100 rounded-lg p-1">
                                    <button
                                        onClick={() => { setView(ViewMode.Day); setShowMobileActions(false); }}
                                        className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-all ${view === ViewMode.Day ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                                    >
                                        Dia
                                    </button>
                                    <button
                                        onClick={() => { setView(ViewMode.Week); setShowMobileActions(false); }}
                                        className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-all ${view === ViewMode.Week ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                                    >
                                        Sem
                                    </button>
                                    <button
                                        onClick={() => { setView(ViewMode.Month); setShowMobileActions(false); }}
                                        className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-all ${view === ViewMode.Month ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                                    >
                                        Mês
                                    </button>
                                    <button
                                        onClick={() => { setView(ViewMode.Year); setShowMobileActions(false); }}
                                        className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-all ${view === ViewMode.Year ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                                    >
                                        Ano
                                    </button>
                                </div>

                                <div className="h-px bg-gray-100 my-1"></div>

                                <button
                                    onClick={() => { onAddTask(selectedTaskId || undefined); setShowMobileActions(false); }}
                                    className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition justify-center"
                                >
                                    <Plus size={16} />
                                    <span>Nova Tarefa</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div id="gantt-chart-area" ref={scrollContainerRef} className={`flex-1 overflow-x-auto overflow-y-auto bg-white w-full touch-pan-x touch-pan-y ${isMobile ? 'mobile-gantt-fix' : ''}`} style={{ WebkitOverflowScrolling: 'touch' }}>
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
                        listCellWidth={showTaskList ? listCellWidth : ""}
                        columnWidth={columnWidth}
                        rowHeight={rowHeight}
                        barFill={55}
                        ganttHeight={window.innerWidth - (effectiveCompact ? 56 : 65)}
                        TaskListTable={!showTaskList ? () => <></> : (props) => (
                            <div className="font-sans text-sm border-r border-gray-200 bg-white">
                                {props.tasks.filter(t => t.id !== 'gantt-spacer').map(t => {
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
                                            isCompact={effectiveCompact}
                                            onToggleCollapse={toggleTaskCollapse}
                                            isCollapsed={collapsedTaskIds.includes(t.id)}
                                        />
                                    );
                                })}
                            </div>
                        )}
                        TaskListHeader={!showTaskList ? () => <></> : ({ headerHeight }) => (
                            <div
                                className="flex items-center bg-gray-50 border-b border-r border-gray-200 font-bold text-gray-500 uppercase tracking-wider"
                                style={{ height: headerHeight, fontSize: effectiveCompact ? '10px' : '12px' }}
                            >
                                <div className="px-4 flex-1 border-r border-gray-200 h-full flex items-center" style={{ width: listCellWidth, minWidth: listCellWidth }}>
                                    Tarefa
                                </div>
                                <div className="px-4 border-r border-gray-200 h-full flex items-center justify-center" style={{ width: effectiveCompact ? '80px' : '100px', minWidth: effectiveCompact ? '80px' : '100px' }}>
                                    Início
                                </div>
                                <div className="px-4 h-full flex items-center justify-center" style={{ width: effectiveCompact ? '80px' : '100px', minWidth: effectiveCompact ? '80px' : '100px' }}>
                                    Fim
                                </div>
                                <div className="px-4 h-full flex items-center justify-center text-gray-400" style={{ width: effectiveCompact ? '60px' : '80px', minWidth: effectiveCompact ? '60px' : '80px' }}>
                                    Dias
                                </div>
                            </div>
                        )}
                    />
                ) : (
                    <div className="w-full h-full">
                        {isMobile ? (
                            <Gantt
                                tasks={ganttTasks}
                                viewMode={view}
                                locale="pt-BR"
                                onDateChange={undefined}
                                onProgressChange={undefined}
                                onDoubleClick={undefined}
                                onSelect={(task) => {
                                    const original = tasks.find(t => t.id === task.id);
                                    if (original) onEditTask(original);
                                }}
                                listCellWidth={(showTaskList && !isMobile) ? listCellWidth : ""}
                                columnWidth={columnWidth}
                                rowHeight={rowHeight}
                                barFill={55}
                                ganttHeight={500}
                                TaskListTable={() => <></>}
                                TaskListHeader={() => <></>}
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
                                    listCellWidth={(showTaskList && !isMobile) ? listCellWidth : ""}
                                    columnWidth={columnWidth}
                                    rowHeight={rowHeight}
                                    barFill={55}
                                    ganttHeight={500}
                                    TaskListTable={(!showTaskList || isMobile) ? () => <></> : (props) => (
                                        <div className="font-sans text-sm border-r border-gray-200 bg-white touch-pan-x touch-pan-y">
                                            <SortableContext
                                                items={props.tasks.filter(t => t.id !== 'gantt-spacer').map(t => t.id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                {props.tasks.filter(t => t.id !== 'gantt-spacer').map(t => {
                                                    const original = tasks.find(orig => orig.id === t.id);
                                                    const hasChildren = tasks.some(sub => sub.parent === t.id);
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
                                                            isCompact={effectiveCompact}
                                                            onToggleCollapse={toggleTaskCollapse}
                                                            isCollapsed={collapsedTaskIds.includes(t.id)}
                                                            hasChildren={hasChildren}
                                                        />
                                                    );
                                                })}
                                            </SortableContext>
                                        </div>
                                    )}
                                    TaskListHeader={(!showTaskList || isMobile) ? () => <></> : ({ headerHeight }) => (
                                        <div
                                            className="flex items-center bg-gray-50 border-b border-r border-gray-200 font-bold text-gray-500 uppercase tracking-wider"
                                            style={{ height: headerHeight, fontSize: effectiveCompact ? '10px' : '12px' }}
                                        >
                                            <div className="px-4 flex-1 border-r border-gray-200 h-full flex items-center" style={{ width: listCellWidth, minWidth: listCellWidth }}>
                                                Tarefa
                                            </div>
                                            <div className="px-4 border-r border-gray-200 h-full flex items-center justify-center" style={{ width: effectiveCompact ? '80px' : '100px', minWidth: effectiveCompact ? '80px' : '100px' }}>
                                                Início
                                            </div>
                                            <div className="px-4 border-r border-gray-200 h-full flex items-center justify-center" style={{ width: effectiveCompact ? '80px' : '100px', minWidth: effectiveCompact ? '80px' : '100px' }}>
                                                Fim
                                            </div>
                                            <div className="px-4 h-full flex items-center justify-center text-gray-400" style={{ width: effectiveCompact ? '60px' : '80px', minWidth: effectiveCompact ? '60px' : '80px' }}>
                                                Dias
                                            </div>
                                        </div>
                                    )}
                                />
                            </DndContext>
                        )}
                    </div>
                ))}
            </div>
            {isMobile && !isModalOpen && (
                <>
                    <div className="fixed bottom-20 left-4 z-30">
                        <button
                            onClick={() => setShowTaskList(!showTaskList)}
                            className="p-3 bg-white shadow-xl rounded-full text-indigo-600 active:scale-90 transition-all border border-indigo-100"
                        >
                            {showTaskList ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
                        </button>
                    </div>

                    <div className="fixed bottom-20 right-4 z-30 flex flex-col items-center gap-0">
                        {/* Up */}
                        <button
                            onTouchStart={() => startScrolling('up')}
                            onTouchEnd={stopScrolling}
                            onMouseDown={() => startScrolling('up')}
                            onMouseUp={stopScrolling}
                            onMouseLeave={stopScrolling}
                            onContextMenu={(e) => e.preventDefault()}
                            className="p-3 bg-indigo-600 shadow-xl rounded-full text-white active:scale-90 transition-all border-2 border-white/20"
                        >
                            <ChevronUp size={24} />
                        </button>

                        <div className="flex gap-1">
                            {/* Left */}
                            <button
                                onTouchStart={() => startScrolling('left')}
                                onTouchEnd={stopScrolling}
                                onMouseDown={() => startScrolling('left')}
                                onMouseUp={stopScrolling}
                                onMouseLeave={stopScrolling}
                                onContextMenu={(e) => e.preventDefault()}
                                className="p-3 bg-indigo-600 shadow-xl rounded-full text-white active:scale-90 transition-all border-2 border-white/20"
                            >
                                <ChevronLeft size={24} />
                            </button>

                            {/* Right */}
                            <button
                                onTouchStart={() => startScrolling('right')}
                                onTouchEnd={stopScrolling}
                                onMouseDown={() => startScrolling('right')}
                                onMouseUp={stopScrolling}
                                onMouseLeave={stopScrolling}
                                onContextMenu={(e) => e.preventDefault()}
                                className="p-3 bg-indigo-600 shadow-xl rounded-full text-white active:scale-90 transition-all border-2 border-white/20"
                            >
                                <ChevronRight size={24} />
                            </button>
                        </div>

                        {/* Down */}
                        <button
                            onTouchStart={() => startScrolling('down')}
                            onTouchEnd={stopScrolling}
                            onMouseDown={() => startScrolling('down')}
                            onMouseUp={stopScrolling}
                            onMouseLeave={stopScrolling}
                            onContextMenu={(e) => e.preventDefault()}
                            className="p-3 bg-indigo-600 shadow-xl rounded-full text-white active:scale-90 transition-all border-2 border-white/20"
                        >
                            <ChevronDown size={24} />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
