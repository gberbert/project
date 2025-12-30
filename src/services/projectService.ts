import {
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    getDocs,
    writeBatch,
    setDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Project, Task, Resource } from '../types';
import { Client } from '../types/client';

// Collection References
const PROJECTS_COL = 'projects';
const TASKS_COL = 'tasks';
const RESOURCES_COL = 'resources';
const CLIENTS_COL = 'clients';

const sanitizeData = (data: any) => {
    if (!data || typeof data !== 'object') return data;
    const clean = { ...data };
    Object.keys(clean).forEach(key => {
        if (clean[key] === undefined) delete clean[key];
    });
    return clean;
};

import { checkIsHoliday } from '../lib/utils';
// ... imports ...

export const getNextWorkingDay = (date: Date) => {
    const d = new Date(date);
    // Iterate until we find a working day (Not Weekend AND Not Holiday)
    while (true) {
        const day = d.getDay();
        const isWeekend = day === 6 || day === 0;
        if (!isWeekend && !checkIsHoliday(d)) {
            break;
        }
        d.setDate(d.getDate() + 1);
    }
    return d;
};

export const addBusinessDays = (startDate: Date, durationMs: number) => {
    // Approximate duration in days
    const days = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    let d = new Date(startDate);
    let count = 0;
    while (count < days) {
        d.setDate(d.getDate() + 1);
        const day = d.getDay();
        const isWeekend = day === 0 || day === 6;
        if (!isWeekend && !checkIsHoliday(d)) count++;
    }
    // Handle case where startDate itself might be invalid in some contexts, 
    // but usually we add from a valid start. 
    // If strict duration matches days=0 but time > 0, we just return d (which is start + 0 days).
    if (days === 0 && durationMs > 0) return d;
    return d;
};

// Duplicates removed. Only clean code remains.

export const ProjectService = {
    // --- Clients ---
    subscribeClients: (callback: (clients: Client[]) => void, userId?: string, role?: string) => {
        let q: any = collection(db, CLIENTS_COL);

        // If not master and userId exists, filter by ownerId
        if (role !== 'master' && userId) {
            q = query(collection(db, CLIENTS_COL), where('ownerId', '==', userId));
        }

        return onSnapshot(q, (snapshot: any) => {
            const clients = snapshot.docs.map((doc: any) => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined)
                } as Client;
            });
            callback(clients);
        });
    },

    createClient: async (client: any) => {
        return addDoc(collection(db, CLIENTS_COL), sanitizeData(client));
    },

    updateClient: async (clientId: string, updates: any) => {
        const ref = doc(db, CLIENTS_COL, clientId);
        return updateDoc(ref, sanitizeData(updates));
    },

    deleteClient: async (clientId: string) => {
        return deleteDoc(doc(db, CLIENTS_COL, clientId));
    },

    // --- Projects ---
    subscribeProjects: (callback: (projects: Project[]) => void, userId?: string, role?: string) => {
        let q: any = collection(db, PROJECTS_COL);

        // If not master and userId exists, filter by ownerId
        if (role !== 'master' && userId) {
            q = query(collection(db, PROJECTS_COL), where('ownerId', '==', userId));
        }

        return onSnapshot(q, (snapshot: any) => {
            const projects = snapshot.docs.map((doc: any) => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : new Date()),
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date())
                } as Project;
            });
            callback(projects);
        });
    },

    createProject: async (project: Omit<Project, 'id'>) => {
        return addDoc(collection(db, PROJECTS_COL), sanitizeData(project));
    },

    updateProject: async (projectId: string, updates: Partial<Project>) => {
        const ref = doc(db, PROJECTS_COL, projectId);
        return updateDoc(ref, sanitizeData(updates));
    },

    deleteProject: async (projectId: string) => {
        return deleteDoc(doc(db, PROJECTS_COL, projectId));
    },

    // --- Tasks ---
    subscribeTasks: (projectId: string, callback: (tasks: Task[]) => void) => {
        const q = query(collection(db, TASKS_COL), where('projectId', '==', projectId));
        return onSnapshot(q, (snapshot) => {
            const tasks = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    start: data.start?.toDate ? data.start.toDate() : new Date(data.start),
                    end: data.end?.toDate ? data.end.toDate() : new Date(data.end),
                    realStart: data.realStart ? (data.realStart.toDate ? data.realStart.toDate() : new Date(data.realStart)) : undefined,
                    realEnd: data.realEnd ? (data.realEnd.toDate ? data.realEnd.toDate() : new Date(data.realEnd)) : undefined,
                } as Task;
            });
            tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            callback(tasks);
        });
    },

    addTask: async (task: Partial<Task>) => {
        const cleanTask = sanitizeData(task);
        if (cleanTask.id) {
            const taskRef = doc(db, TASKS_COL, cleanTask.id);
            await setDoc(taskRef, cleanTask);
            return taskRef;
        } else {
            return addDoc(collection(db, TASKS_COL), cleanTask);
        }
    },

    updateTask: async (taskId: string, updates: Partial<Task>) => {
        const taskRef = doc(db, TASKS_COL, taskId);
        return updateDoc(taskRef, sanitizeData(updates));
    },

    deleteTask: async (taskId: string) => {
        return deleteDoc(doc(db, TASKS_COL, taskId));
    },

    deleteAllTasksForProject: async (projectId: string) => {
        const q = query(collection(db, TASKS_COL), where('projectId', '==', projectId));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        return batch.commit();
    },

    batchUpdateTasks: async (updates: { id: string, data: Partial<Task> }[]) => {
        const batch = writeBatch(db);
        updates.forEach(({ id, data }) => {
            const ref = doc(db, TASKS_COL, id);
            batch.update(ref, sanitizeData(data));
        });
        return batch.commit();
    },

    replaceProjectTasks: async (projectId: string, newTasks: Task[]) => {
        const q = query(collection(db, TASKS_COL), where('projectId', '==', projectId));
        const snapshot = await getDocs(q);

        const deleteChunks = [];
        for (let i = 0; i < snapshot.docs.length; i += 400) {
            const batch = writeBatch(db);
            snapshot.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
            deleteChunks.push(batch.commit());
        }
        await Promise.all(deleteChunks);

        const createChunks = [];
        for (let i = 0; i < newTasks.length; i += 400) {
            createChunks.push(newTasks.slice(i, i + 400));
        }

        let minStart: Date | null = null;
        let maxEnd: Date | null = null;

        for (const chunk of createChunks) {
            const batch = writeBatch(db);
            chunk.forEach(task => {
                const taskRef = doc(db, TASKS_COL, task.id);
                const data = {
                    ...task,
                    projectId // Limit to project
                };
                batch.set(taskRef, sanitizeData(data));

                if (task.type !== 'project' && task.start && task.end) {
                    const tStart = new Date(task.start);
                    const tEnd = new Date(task.end);
                    if (!minStart || tStart < minStart) minStart = tStart;
                    if (!maxEnd || tEnd > maxEnd) maxEnd = tEnd;
                }
            });
            await batch.commit();
        }

        if (minStart && maxEnd) {
            const projRef = doc(db, PROJECTS_COL, projectId);
            // @ts-ignore
            await updateDoc(projRef, { startDate: minStart, endDate: maxEnd });
        }
    },

    // --- Scheduling Helper with Business Days ---
    recalculateProjectSchedule: async (projectId: string, tasks: Task[]) => {
        const idMap = new Map<string, Task>();
        tasks.forEach(t => idMap.set(t.id, { ...t }));

        let changed = false;
        const updates: { id: string, data: Partial<Task> }[] = [];

        for (let pass = 0; pass < tasks.length + 2; pass++) {
            let passChanged = false;

            for (const task of tasks) {
                const current = idMap.get(task.id)!;
                if (!current.dependencies || current.dependencies.length === 0) continue;

                let maxDepEnd = 0;
                current.dependencies.forEach(depId => {
                    const dep = idMap.get(depId);
                    if (dep && dep.end) {
                        const depEndTime = new Date(dep.end).getTime();
                        if (depEndTime > maxDepEnd) maxDepEnd = depEndTime;
                    }
                });

                if (maxDepEnd > 0) {
                    const currentStart = new Date(current.start).getTime();
                    const currentEnd = new Date(current.end).getTime();

                    // Helper Logic Inline or Call
                    const constraintStart = new Date(maxDepEnd);
                    const validStart = getNextWorkingDay(constraintStart);

                    // Check violations: Start < ValidStart OR Start is Weekend
                    const currentStartObj = new Date(currentStart);
                    const isWeekendStart = currentStartObj.getDay() === 0 || currentStartObj.getDay() === 6;

                    if (currentStart < validStart.getTime() || isWeekendStart) {

                        const newStart = (currentStart < validStart.getTime()) ? validStart : getNextWorkingDay(currentStartObj);

                        // Recalculate End
                        const durationMs = currentEnd - currentStart;
                        const newEnd = addBusinessDays(newStart, durationMs);

                        current.start = newStart;
                        current.end = newEnd;
                        idMap.set(current.id, current);
                        passChanged = true;
                        changed = true;
                    }
                }
            }
            if (!passChanged) break;
        }

        if (changed) {
            tasks.forEach(original => {
                const final = idMap.get(original.id)!;
                if (new Date(final.start).getTime() !== new Date(original.start).getTime() ||
                    new Date(final.end).getTime() !== new Date(original.end).getTime()) {
                    updates.push({
                        id: final.id,
                        data: {
                            start: final.start,
                            end: final.end
                        }
                    });
                }
            });

            if (updates.length > 0) {
                console.log(`Rescheduling (WorkDays): Updating ${updates.length} tasks.`);
                await ProjectService.batchUpdateTasks(updates);
                return updates;
            }
        }
        return [];
    },

    // --- Resources ---
    subscribeResources: (callback: (resources: Resource[]) => void) => {
        return onSnapshot(collection(db, RESOURCES_COL), (snapshot) => {
            const resources = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource));
            callback(resources);
        });
    },

    addResource: async (resource: Omit<Resource, 'id'>) => {
        return addDoc(collection(db, RESOURCES_COL), sanitizeData(resource));
    },

    updateResource: async (resourceId: string, updates: Partial<Resource>) => {
        const resRef = doc(db, RESOURCES_COL, resourceId);
        return updateDoc(resRef, sanitizeData(updates));
    },

    deleteResource: async (resourceId: string) => {
        return deleteDoc(doc(db, RESOURCES_COL, resourceId));
    },

    seedInitialData: async () => {
        const snap = await getDocs(collection(db, RESOURCES_COL));
        if (!snap.empty) return;

        const resources = [
            { name: 'Ana Silva', role: 'Product Owner', hourlyRate: 150, avatarUrl: '' },
            { name: 'Carlos Dev', role: 'FullStack Dev', hourlyRate: 100, avatarUrl: '' },
            { name: 'Marina UI', role: 'Designer', hourlyRate: 110, avatarUrl: '' }
        ];

        const resIds = [];
        for (const r of resources) {
            const ref = await addDoc(collection(db, RESOURCES_COL), r);
            resIds.push({ ...r, id: ref.id });
        }

        const projRef = await addDoc(collection(db, PROJECTS_COL), {
            name: 'Plataforma SaaS v1',
            description: 'Desenvolvimento do MVP',
            startDate: new Date(),
            createdAt: new Date()
        });

        const tasks = [
            {
                projectId: projRef.id,
                name: 'Planejamento',
                start: new Date(),
                end: new Date(Date.now() + 86400000 * 2),
                type: 'project',
                progress: 0,
                styles: { backgroundColor: '#ffbb54', progressColor: '#ff9e0b' }
            },
            {
                projectId: projRef.id,
                name: 'Design System',
                start: new Date(),
                end: new Date(Date.now() + 86400000 * 5),
                type: 'task',
                progress: 20,
                resourceId: resIds[2].id,
                parent: 'auto-id-1'
            }
        ];
    },

    // --- Knowledge Base (RAG) ---
    addKnowledgeEntry: async (clientId: string, entry: string) => {
        const kbRef = collection(db, CLIENTS_COL, clientId, 'knowledgeBase');
        return addDoc(kbRef, {
            content: entry,
            createdAt: new Date()
        });
    },

    getKnowledgeBase: async (clientId: string) => {
        const kbRef = collection(db, CLIENTS_COL, clientId, 'knowledgeBase');
        const q = query(kbRef);
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data().content as string);
    }
};
