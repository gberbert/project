import { useState, useCallback, useEffect } from 'react';
import { Task, Resource } from '../types';
import { recalculateGantt, hasCycle } from '../lib/projectLogic';
import { calculateBusinessDays } from '../lib/utils';
import { differenceInMilliseconds, addMilliseconds, isWeekend, addDays, isAfter, differenceInDays } from 'date-fns';

export const useProjectLogic = (initialTasks: Task[]) => {
    const [tasks, setTasks] = useState<Task[]>(initialTasks);

    // Initial load recalc
    useEffect(() => {
        setTasks(prev => recalculateGantt(prev));
    }, []);

    // Sync with DB updates while PRESERVING local sort order
    useEffect(() => {
        if (initialTasks.length > 0) {
            setTasks(prevTasks => {
                // If prevTasks is empty (first load), just use initial
                if (prevTasks.length === 0) return recalculateGantt(initialTasks);

                const incomingMap = new Map(initialTasks.map(t => [t.id, t]));
                const currentIdsInDB = new Set(initialTasks.map(t => t.id));
                const prevIds = new Set(prevTasks.map(t => t.id));

                // 1. Update existing tasks in their CURRENT order (Process Updates)
                let merged = prevTasks
                    .filter(t => currentIdsInDB.has(t.id)) // 2. Handle Deletions
                    .map(t => {
                        return { ...t, ...incomingMap.get(t.id)! }; // Update data
                    });

                // 3. Handle Additions (Append new tasks)
                const newTasks = initialTasks.filter(t => !prevIds.has(t.id));
                merged = [...merged, ...newTasks];
                merged.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

                return recalculateGantt(merged);
            });
        }
    }, [initialTasks]);

    const enforceRules = (newTasks: Task[]) => {
        return recalculateGantt(newTasks);
    };

    const addTask = (newTask: Task, afterTaskId?: string) => {
        setTasks(prev => {
            const tasksCopy = [...prev];
            let insertIndex = tasksCopy.length;
            let parentId = newTask.parent;

            if (afterTaskId) {
                const siblingIdx = tasksCopy.findIndex(t => t.id === afterTaskId);
                if (siblingIdx !== -1) {
                    insertIndex = siblingIdx + 1;
                    // Strict rule: inherit parent from immediate sibling above
                    parentId = tasksCopy[siblingIdx].parent;
                }
            }

            // Validate End >= Start
            if (newTask.end < newTask.start) {
                newTask.end = newTask.start;
            }

            const taskToAdd = { ...newTask, parent: parentId || null };
            tasksCopy.splice(insertIndex, 0, taskToAdd);

            return enforceRules(tasksCopy);
        });
    };

    const updateTask = (updated: Task) => {
        setTasks(prev => {
            let tasksCopy = [...prev];
            const oldTask = prev.find(t => t.id === updated.id);

            // Handle Move on Parent Change (Strict Hierarchy Order)
            // If parent changed, we must move the task visually to be inside the new parent group.
            if (oldTask && updated.parent !== oldTask.parent) {
                // 1. Remove from old position
                const currentIdx = tasksCopy.findIndex(t => t.id === updated.id);
                if (currentIdx !== -1) tasksCopy.splice(currentIdx, 1);

                // 2. Find new insertion index
                let insertIndex = tasksCopy.length; // Default to end
                if (updated.parent) {
                    const parentIdx = tasksCopy.findIndex(t => t.id === updated.parent);
                    if (parentIdx !== -1) {
                        // Find index to insert AFTER hierarchy of parent
                        // We want to be the LAST child provided we don't disrupt specific ordering?
                        // Or just after the parent?
                        // If parent has children, we usually append.
                        // Helper to find end of subtree
                        let i = parentIdx + 1;
                        while (i < tasksCopy.length && isDescendant(tasksCopy, i, updated.parent)) {
                            i++;
                        }
                        insertIndex = i;
                    }
                    // If parent not found (shouldn't happen), push to end
                } else {
                    // If becoming root, where do we put it?
                    // "Orphan" -> Maybe keep relative position or move to end?
                    // User didn't specify, but usually moving to root stays near where it was or end.
                    // For now, let's append to end to be safe/clear, or insert at currentIdx if possible?
                    // Re-inserting at old index might be weird if old index was inside a group.
                    // Let's insert at the end to be safe, or just leave it to sort?
                    // Better UX: Insert at the end of the list.
                    insertIndex = tasksCopy.length;
                }

                tasksCopy.splice(insertIndex, 0, updated);
            } else {
                // Just update in place, but with Cascade Logic for Dates
                const old = prev.find(t => t.id === updated.id);
                if (old) {
                    const oldEnd = old.end.getTime();
                    const newEnd = updated.end.getTime();
                    const delta = newEnd - oldEnd;

                    let newTasks = tasksCopy.map(t => t.id === updated.id ? updated : t);

                    // Cascade Delta if dates changed (Same logic as handleMoveTask)
                    if (delta !== 0) {
                        const successorMap = new Map<string, string[]>();
                        newTasks.forEach(t => {
                            t.dependencies?.forEach(dep => {
                                const list = successorMap.get(dep) || [];
                                list.push(t.id);
                                successorMap.set(dep, list);
                            });
                        });

                        const queue = [updated.id];
                        const affectedIds = new Set<string>();

                        while (queue.length > 0) {
                            const curr = queue.shift()!;
                            const succs = successorMap.get(curr) || [];
                            succs.forEach(s => {
                                if (!affectedIds.has(s)) {
                                    affectedIds.add(s);
                                    queue.push(s);
                                }
                            });
                        }

                        newTasks = newTasks.map(t => {
                            if (affectedIds.has(t.id)) {
                                return {
                                    ...t,
                                    start: new Date(t.start.getTime() + delta),
                                    end: new Date(t.end.getTime() + delta)
                                };
                            }
                            return t;
                        });
                    }
                    tasksCopy = newTasks;
                } else {
                    // Fail safe
                    tasksCopy = tasksCopy.map(t => t.id === updated.id ? updated : t);
                }
            }

            // Cycle check (Logic same as before)
            if (updated.dependencies) {
                const old = prev.find(t => t.id === updated.id);
                for (const dep of updated.dependencies) {
                    if (hasCycle(tasksCopy, dep, updated.id)) {
                        console.error(`Cyclic dependency detected: ${dep} -> ${updated.id}`);
                        const reverted = { ...updated, dependencies: old?.dependencies || [] };
                        tasksCopy = tasksCopy.map(t => t.id === updated.id ? reverted : t);
                        // alert("Ciclo infinito detectado! A dependência foi rejeitada."); // Removed alert for cleaner code, log is enough
                        break;
                    }
                }
            }

            return enforceRules(tasksCopy);
        });
    };

    // Helper to check lineage
    const isDescendant = (list: Task[], index: number, ancestorId: string): boolean => {
        let curr = list[index];
        while (curr.parent) {
            if (curr.parent === ancestorId) return true;
            const p = list.find(t => t.id === curr.parent);
            if (!p) break;
            curr = p;
        }
        return false;
    };

    const reorderTasks = (newTasks: Task[], movedTaskId?: string) => {
        // Enforce "Child must be below Parent" Rule (Orphan Check)
        // If a task is moved to an index LESS than its parent's index, it must lose the parent.

        let processedTasks = [...newTasks];

        // Check for specific moved task validation or specific full scan?
        // Full scan is safer for consistency.
        processedTasks = processedTasks.map((task, index) => {
            if (!task.parent) return task;

            const parentIndex = processedTasks.findIndex(t => t.id === task.parent);

            // If parent is NOT found (deleted?) or Parent is BELOW Child (Index > index)
            // (Note: findIndex returns -1 if not found. index > -1 is true always. 
            // If parentIndex > index => Parent is below child => Violation)
            if (parentIndex === -1 || parentIndex > index) {
                // Rule: "Automatically cleans relationship making it an orphan"
                return { ...task, parent: null };
            }
            return task;
        });

        setTasks(enforceRules(processedTasks));
    };

    const deleteTask = (taskId: string) => {
        setTasks(prev => {
            // Strategy: Delete sub-tree (Option 2 from prompt as default for simplicity in hook)
            // To implement "Promote children", we'd need a prompt or extra arg.
            // Let's default to: If group, delete all children.

            const idsToDelete = new Set<string>();
            const collect = (id: string) => {
                idsToDelete.add(id);
                prev.filter(t => t.parent === id).forEach(c => collect(c.id));
            };
            collect(taskId);

            const remaining = prev.filter(t => !idsToDelete.has(t.id));

            // Cleanup dependencies on deleted tasks
            const cleaned = remaining.map(t => ({
                ...t,
                dependencies: t.dependencies?.filter(d => !idsToDelete.has(d)) || []
            }));

            return enforceRules(cleaned);
        });
    };

    /**
     * Handles Move Task (D&D Time Shift)
     */
    const handleMoveTask = (taskId: string, newStart: Date, newEnd: Date) => {
        setTasks(prev => {
            const task = prev.find(t => t.id === taskId);
            if (!task) return prev;

            // If Project, we might block move or move all children?
            // Prompt: "Se um filho for movido, pai recalcula".
            // Does strictly implying Projects are NOT movable manually? 
            // "Tarefas Pai (Grupos): NÃO devem ter datas editáveis manualmente." -> YES.
            if (task.type === 'project') return prev; // Locked

            const oldEnd = task.end.getTime();
            const newEndMs = newEnd.getTime();
            const delta = newEndMs - oldEnd;

            const updated = { ...task, start: newStart, end: newEnd };
            let newTasks = prev.map(t => t.id === taskId ? updated : t);

            // Cascade Delta to Successors (Auto-Schedule / "Mesmo Ajuste")
            if (delta !== 0) {
                // Build Successor Map (Predecessor -> [Successors])
                const successorMap = new Map<string, string[]>();
                newTasks.forEach(t => {
                    t.dependencies?.forEach(dep => {
                        const list = successorMap.get(dep) || [];
                        list.push(t.id);
                        successorMap.set(dep, list);
                    });
                });

                // BFS to find all downstream tasks
                const queue = [taskId];
                const affectedIds = new Set<string>();
                // We don't add taskId to affectedIds because it's already updated manually

                while (queue.length > 0) {
                    const curr = queue.shift()!;
                    const succs = successorMap.get(curr) || [];
                    succs.forEach(s => {
                        if (!affectedIds.has(s)) {
                            affectedIds.add(s);
                            queue.push(s);
                        }
                    });
                }

                // Apply Delta to all affected tasks
                newTasks = newTasks.map(t => {
                    if (affectedIds.has(t.id)) {
                        return {
                            ...t,
                            start: new Date(t.start.getTime() + delta),
                            end: new Date(t.end.getTime() + delta)
                        };
                    }
                    return t;
                });
            }

            return enforceRules(newTasks);
        });
    };

    /**
     * WBS Hierarchy Manipulation
     */
    const indentTask = (taskId: string): Task | undefined => {
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx <= 0) return undefined;

        const task = tasks[idx];
        const siblingAbove = tasks[idx - 1];
        const updated = { ...task, parent: siblingAbove.id };

        setTasks(prev => {
            // Re-calculate safely on latest state
            const pIdx = prev.findIndex(t => t.id === taskId);
            if (pIdx <= 0) return prev;

            const pTask = prev[pIdx];
            const pSibling = prev[pIdx - 1];
            const pUpdated = { ...pTask, parent: pSibling.id };

            const newTasks = [...prev];
            newTasks[pIdx] = pUpdated;

            return enforceRules(newTasks);
        });

        return updated;
    };

    const outdentTask = (taskId: string): Task | undefined => {
        const task = tasks.find(t => t.id === taskId);
        if (!task || !task.parent) return undefined;

        const currentParent = tasks.find(t => t.id === task.parent);
        const grandParentId = currentParent?.parent || null;
        const updated = { ...task, parent: grandParentId };

        setTasks(prev => {
            const pTask = prev.find(t => t.id === taskId);
            if (!pTask || !pTask.parent) return prev;

            const pParent = prev.find(t => t.id === pTask.parent);
            const pGrandParentId = pParent?.parent || null; // Logic needs to match "ancestor" lookup? No, just immediate parent's parent.

            const pUpdated = { ...pTask, parent: pGrandParentId };
            const newTasks = prev.map(t => t.id === taskId ? pUpdated : t);

            return enforceRules(newTasks);
        });

        return updated;
    };



    return {
        tasks,
        addTask,
        updateTask,
        deleteTask,
        handleMoveTask,
        indentTask,
        outdentTask,
        reorderTasks,
        // Compat
        handleTaskChange: updateTask,
        getProjectStats: (resources: Resource[] = []) => {
            if (tasks.length === 0) return { totalCost: 0, totalRealCost: 0, progress: 0, totalDuration: 0, totalRealDuration: 0 };

            // countBusinessDays function removed, using imported calculateBusinessDays
            const countBusinessDays = (startDate: Date | undefined, endDate: Date | undefined) => {
                if (!startDate || !endDate) return 0;
                return calculateBusinessDays(startDate, endDate);
            };

            let minStart = new Date(8640000000000000);
            let maxEnd = new Date(-8640000000000000);
            let minRealStart = new Date(8640000000000000);
            let maxRealEnd = new Date(-8640000000000000);

            let totalWeightedProgress = 0;
            let totalDurationMs = 0;
            let totalCost = 0;
            let totalRealCost = 0;

            // Calculate based on LEAF tasks (type === 'task' or 'milestone')
            // Ignore groups to avoid double counting
            const leafTasks = tasks.filter(t => t.type !== 'project');

            if (leafTasks.length === 0) {
                // Fallback if only groups exist
                return { totalCost: 0, totalRealCost: 0, progress: 0, totalDuration: 0 };
            }

            leafTasks.forEach(task => {
                const startMs = task.start.getTime();
                const endMs = task.end.getTime();

                if (startMs < minStart.getTime()) minStart = task.start;
                if (endMs > maxEnd.getTime()) maxEnd = task.end;

                if (task.realStart) {
                    if (task.realStart.getTime() < minRealStart.getTime()) minRealStart = task.realStart;
                }
                if (task.realEnd) {
                    if (task.realEnd.getTime() > maxRealEnd.getTime()) maxRealEnd = task.realEnd;
                }

                // Duration in milliseconds
                const durationMs = endMs - startMs;

                totalWeightedProgress += (task.progress || 0) * durationMs;
                totalDurationMs += durationMs;

                if (task.resourceId && resources.length > 0) {
                    const res = resources.find(r => r.id === task.resourceId);
                    if (res) {
                        // Estimated Cost


                        const days = Math.max(1, countBusinessDays(task.start, task.end));
                        totalCost += days * 8 * res.hourlyRate;

                        if (task.realStart && task.realEnd) {
                            const rDays = Math.max(1, countBusinessDays(task.realStart, task.realEnd));
                            totalRealCost += rDays * 8 * res.hourlyRate;
                        }
                    }
                }
            });

            // Overall Progress (Based on Roots to match Gantt WBS logic)
            const roots = tasks.filter(t => !t.parent || !tasks.find(p => p.id === t.parent));
            let rootWeightedProgress = 0;
            let rootTotalDuration = 0;

            roots.forEach(r => {
                let duration = Math.max(1, differenceInDays(r.end, r.start));
                rootWeightedProgress += (r.progress || 0) * duration;
                rootTotalDuration += duration;
            });

            const overallProgress = rootTotalDuration > 0 ? Math.round(rootWeightedProgress / rootTotalDuration) : 0;

            const totalDurationBusinessDays = countBusinessDays(minStart, maxEnd);
            let totalRealDurationBusinessDays = 0;
            if (maxRealEnd.getTime() > -8640000000000000 && minRealStart.getTime() < 8640000000000000) {
                totalRealDurationBusinessDays = countBusinessDays(minRealStart, maxRealEnd);
            }

            // Planned Progress
            const today = new Date();
            today.setHours(12, 0, 0, 0);
            let plannedProgress = 0;

            if (minStart.getTime() < 8640000000000000 && totalDurationBusinessDays > 0) {
                if (isAfter(minStart, today)) {
                    plannedProgress = 0;
                } else if (isAfter(today, maxEnd)) {
                    plannedProgress = 100;
                } else {
                    const elapsedDays = countBusinessDays(minStart, today);
                    plannedProgress = Math.round((elapsedDays / totalDurationBusinessDays) * 100);
                }
            }
            plannedProgress = Math.min(100, Math.max(0, plannedProgress));

            // Indicators
            let spi = plannedProgress > 0 ? overallProgress / plannedProgress : (overallProgress > 0 ? 1 : 1);
            let cpi = totalRealCost > 0 ? totalCost / totalRealCost : (totalCost > 0 ? 1 : 1);

            return {
                totalCost,
                totalRealCost,
                progress: overallProgress,
                plannedProgress,
                totalDuration: Math.max(0, totalDurationBusinessDays),
                totalRealDuration: Math.max(0, totalRealDurationBusinessDays),
                spi,
                cpi
            };
        },
    };
};
