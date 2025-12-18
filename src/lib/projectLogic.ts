import { Task, TaskStatus } from '../types';
import { addDays, differenceInDays, isBefore, max, min, startOfDay } from 'date-fns';

// --- Pure Helper Functions ---

/**
 * Validates if adding a dependency would create a cycle.
 */
export const hasCycle = (tasks: Task[], sourceId: string, targetId: string): boolean => {
    const adj = new Map<string, string[]>();
    tasks.forEach(t => adj.set(t.id, t.dependencies || []));

    // Temporarily add the proposed edge
    const existing = adj.get(targetId) || [];
    adj.set(targetId, [...existing, sourceId]); // target depends on source? No, targetId depends on sourceId usually means target waits for source.
    // If we add dep: "Task B depends on Task A" (A -> B).
    // If we add "A depends on B" (B -> A), we have a cycle.
    // So if we are adding "Target depends on Source", we check if Source is already reachable from Target.

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
        if (recursionStack.has(nodeId)) return true;
        if (visited.has(nodeId)) return false;

        visited.add(nodeId);
        recursionStack.add(nodeId);

        const neighbors = adj.get(nodeId) || [];
        for (const neighbor of neighbors) {
            if (dfs(neighbor)) return true;
        }

        recursionStack.delete(nodeId);
        return false;
    };

    // Check strict cycle
    // If dependency is: Target waits for Source. Edge is Source -> Target.
    // We want to add Source -> Target. Check if Target -> ... -> Source exists.
    // "Target depends on Source" means edge Source -> Target.
    // So we check if Source is reachable from Target in the EXISTING graph.

    // Let's rebuild graph just to be sure.
    // standard: A depends on B means B finishes, then A starts. Edge B -> A.
    // Proposed: targetId depends on sourceId. Edge: sourceId -> targetId.
    // Cycle if: path targetId -> ... -> sourceId exists.

    const buildGraph = () => {
        const g = new Map<string, string[]>();
        tasks.forEach(t => {
            t.dependencies.forEach(dep => {
                const list = g.get(dep) || [];
                list.push(t.id);
                g.set(dep, list);
            });
        });
        return g;
    };

    const graph = buildGraph();

    // BFS from targetId to see if we hit sourceId
    const range = [targetId];
    const seen = new Set<string>([targetId]);

    while (range.length > 0) {
        const curr = range.shift()!;
        if (curr === sourceId) return true;

        const nexts = graph.get(curr) || [];
        for (const n of nexts) {
            if (!seen.has(n)) {
                seen.add(n);
                range.push(n);
            }
        }
    }

    return false;
};

// --- Core Engine ---

export const recalculateGantt = (tasks: Task[]): Task[] => {
    // 1. Structural/Type Integrity
    // - If a task has children, it MUST be type 'project'.
    // - If a project has no children, it MUST be type 'task' (unless manually forced? Prompt says strict conversion).

    // Build Parent Map
    const parentMap = new Map<string, Task[]>();
    tasks.forEach(t => {
        if (t.parent) {
            const list = parentMap.get(t.parent) || [];
            list.push(t);
            parentMap.set(t.parent, list);
        }
    });

    let processed = tasks.map(t => {
        const hasChildren = (parentMap.get(t.id)?.length || 0) > 0;
        if (hasChildren && t.type !== 'project') return { ...t, type: 'project' as const, progress: 0 }; // Reset progress for calc
        if (!hasChildren && t.type === 'project') return { ...t, type: 'task' as const };
        return t;
    });

    // Re-build map with processed types
    parentMap.clear();
    processed.forEach(t => {
        if (t.parent) {
            const list = parentMap.get(t.parent) || [];
            list.push(t);
            parentMap.set(t.parent, list);
        }
    });


    // 2. Schedule Pass (Forward Pass - Dependencies)
    // Topological sort or Relaxation. 
    // Since we handle cycles on entry, we can assume DAG (Directed Acyclic Graph).
    // However, for simplicity and robustness against user edits, we'll do variable iterations (relaxation).

    // Sort by dependency depth could be optimization, but simple loop works for small N (<1000).
    // "Auto-Scheduling: If Predecessor moves, Successor moves."

    // We iterate X times to propagate.
    // We iterate until stable or safety limit.
    // Deep chains can be as long as N tasks.
    const MAX_ITERATIONS = Math.max(tasks.length, 100);

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        let changed = false;

        const nextProcessed = processed.map(task => {
            if (task.dependencies.length === 0) return task;

            // Find max end of dependencies
            let maxDepEnd = 0;
            task.dependencies.forEach(depId => {
                const dep = processed.find(p => p.id === depId);
                if (dep) {
                    maxDepEnd = Math.max(maxDepEnd, dep.end.getTime());
                }
            });

            if (maxDepEnd > 0) {
                // Strict Auto-Snap: Successor ALWAYS starts after predecessor
                const strictStart = addDays(new Date(maxDepEnd), 1);

                if (strictStart.getTime() !== task.start.getTime()) {
                    changed = true; // Flag change
                    const duration = task.end.getTime() - task.start.getTime();
                    return {
                        ...task,
                        start: strictStart,
                        end: new Date(strictStart.getTime() + duration)
                    };
                }
            }
            return task;
        });

        processed = nextProcessed;
        if (!changed) break; // Stability reached
    }


    // 3. WBS Rollup (Bottom-Up)
    // - Dates: Min/Max of children.
    // - Progress: Weighted average.

    const computeNode = (taskId: string, visited: Set<string>) => {
        if (visited.has(taskId)) return;
        visited.add(taskId);

        const children = parentMap.get(taskId);
        if (!children) return;

        // Process children first
        children.forEach(c => computeNode(c.id, visited));

        // Now children are updated in 'processed' array? 
        // No, 'children' ref might be stale if recursive calls modified 'processed'.
        // We must re-fetch children from 'processed'.

        const freshChildren = processed.filter(p => p.parent === taskId);
        if (freshChildren.length === 0) return;

        const earliest = min(freshChildren.map(c => c.start));
        const latest = max(freshChildren.map(c => c.end));

        // Progress Weighted
        let totalDuration = 0;
        let weightedProg = 0;

        freshChildren.forEach(c => {
            const duration = Math.max(1, differenceInDays(c.end, c.start));
            totalDuration += duration;
            weightedProg += (c.progress * duration);
        });

        const avgProgress = totalDuration === 0 ? 0 : Math.round(weightedProg / totalDuration);

        // Update Parent in 'processed'
        const idx = processed.findIndex(p => p.id === taskId);
        if (idx !== -1) {
            processed[idx] = {
                ...processed[idx],
                start: earliest,
                end: latest,
                progress: avgProgress,
                type: 'project',
                // Project styling consistency
                styles: {
                    ...processed[idx].styles,
                    progressColor: '#ff9e0b',
                    backgroundColor: '#ffbb54'
                }
            };
        }
    };

    const visited = new Set<string>();
    // Identify roots or just iterate all potential parents
    // Better: Iterate strict roots then recursion? Or just iterates keys of parentMap?
    // Keys of parentMap guarantee we visit everyone who has children.
    // But we need Post-Order.
    // Helper: Valid Post-Order via recursion on roots.

    const roots = processed.filter(t => !t.parent || t.parent === 'auto-id-1'); // 'auto-id-1' is legacy root from template

    const visitTree = (node: Task) => {
        // Children
        const children = processed.filter(t => t.parent === node.id);
        children.forEach(visitTree);

        // Post-visit: I am ready to be calculated
        if (children.length > 0) {
            // Re-fetch fresh children state
            const freshChildren = processed.filter(t => t.parent === node.id);

            const earliest = min(freshChildren.map(c => c.start));
            const latest = max(freshChildren.map(c => c.end));

            let totalDuration = 0;
            let weightedProg = 0;
            freshChildren.forEach(c => {
                const duration = Math.max(1, differenceInDays(c.end, c.start));
                totalDuration += duration;
                weightedProg += (c.progress * duration);
            });
            const avgProgress = totalDuration === 0 ? 0 : Math.round(weightedProg / totalDuration);

            const idx = processed.findIndex(p => p.id === node.id);
            if (idx !== -1) {
                processed[idx] = {
                    ...processed[idx],
                    start: earliest,
                    end: latest,
                    progress: avgProgress,
                    type: 'project',
                    styles: {
                        progressColor: '#ff9e0b',
                        backgroundColor: '#ffbb54'
                    }
                };
            }
        }
    };

    roots.forEach(visitTree);

    // Also cover orphans that might have become parents but are not roots (unlikely in tree, but safe)
    // If strict tree, roots traversal covers all.

    return processed.map(t => ({
        ...t,
        // Visual polish for non-projects
        styles: t.type === 'project' ? t.styles : {
            progressColor: '#3b82f6',
            backgroundColor: '#60a5fa'
        }
    }));
};
