import { useState, useMemo, useEffect } from 'react';
import { GanttChart } from './components/GanttChart';
import { Sidebar, MobileMenu } from './components/Sidebar';
import { ProjectSummary } from './components/ProjectSummary';
import { TaskForm } from './components/TaskForm';
import { TeamView } from './components/TeamView';
import { DashboardView } from './components/DashboardView';
import { TaskListView } from './components/TaskListView';
import { ReportsView } from './components/ReportsView';
import { MyProjectsView } from './components/MyProjectsView';
import { ClientsView } from './components/ClientsView';
import { SettingsView } from './components/SettingsView';
import { EstimateModal } from './components/EstimateModal';
import { EstimateResult } from './services/geminiService';
import { useProjectLogic } from './hooks/useProjectLogic';
import { isAfter, isWeekend, addDays, differenceInDays } from 'date-fns';

import { Task, Resource, Project } from './types';
import { Database, CloudOff, Menu, Sparkles, CheckCircle } from 'lucide-react';
import { ProjectService } from './services/projectService';

// --- Stats Helper ---
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

const calculateProjectStats = (tasks: Task[], resources: Resource[]) => {
    if (tasks.length === 0) return { totalCost: 0, totalRealCost: 0, progress: 0, plannedProgress: 0, totalDuration: 0, totalRealDuration: 0, spi: 0, cpi: 0 };

    let minStart = new Date(8640000000000000);
    let maxEnd = new Date(-8640000000000000);
    let minRealStart = new Date(8640000000000000);
    let maxRealEnd = new Date(-8640000000000000);

    let totalWeightedProgress = 0;
    let totalDurationMs = 0;
    let totalCost = 0;
    let totalRealCost = 0;

    // Filter to LEAF tasks
    const leafTasks = tasks.filter(t => t.type !== 'project');

    if (leafTasks.length === 0) return { totalCost: 0, totalRealCost: 0, progress: 0, plannedProgress: 0, totalDuration: 0, totalRealDuration: 0, spi: 0, cpi: 0 };

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

        const durationMs = endMs - startMs;
        totalWeightedProgress += (task.progress || 0) * durationMs;
        totalDurationMs += durationMs;

        if (task.resourceId && resources.length > 0) {
            const res = resources.find(r => r.id === task.resourceId);
            if (res) {
                const days = Math.max(1, countBusinessDays(task.start, task.end));
                totalCost += days * 8 * res.hourlyRate;
                if (task.realStart && task.realEnd) {
                    const rDays = Math.max(1, countBusinessDays(task.realStart, task.realEnd));
                    totalRealCost += rDays * 8 * res.hourlyRate;
                }
            }
        }
    });

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

    const today = new Date();
    today.setHours(12, 0, 0, 0);
    let plannedProgress = 0;
    if (minStart.getTime() < 8640000000000000 && totalDurationBusinessDays > 0) {
        if (isAfter(minStart, today)) plannedProgress = 0;
        else if (isAfter(today, maxEnd)) plannedProgress = 100;
        else {
            const elapsedDays = countBusinessDays(minStart, today);
            plannedProgress = Math.round((elapsedDays / totalDurationBusinessDays) * 100);
        }
    }
    plannedProgress = Math.min(100, Math.max(0, plannedProgress));

    let spi = plannedProgress > 0 ? overallProgress / plannedProgress : 1;
    let cpi = totalRealCost > 0 ? totalCost / totalRealCost : 1;

    // Format for display scaling/rounding if needed
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
};
// --------------------

// Mock Resources for Demo/Calculation in case DB is empty or error
const MOCK_RESOURCES: Resource[] = [
    { id: 'res-1', name: 'Andre Senior', role: 'Architect', hourlyRate: 150, avatarUrl: '' },
    { id: 'res-2', name: 'Beatriz Dev', role: 'Frontend', hourlyRate: 90, avatarUrl: '' },
    { id: 'res-3', name: 'Carlos UX', role: 'Designer', hourlyRate: 85, avatarUrl: '' },
];

const INITIAL_TASKS: Task[] = [
    {
        id: 'project-1',
        type: 'project',
        name: 'Plataforma SaaS MVP',
        start: new Date(),
        end: new Date(),
        progress: 0,
        isDisabled: false,
        parent: null,
        dependencies: [],
        styles: { progressColor: '#ffbb54', backgroundColor: '#ffbb54' }
    },
    {
        id: 'step-1',
        type: 'task',
        name: 'Requisitos e Planejamento',
        start: new Date(Date.now()),
        end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        progress: 100,
        parent: 'project-1',
        dependencies: [],
        resourceId: 'res-1'
    },
    {
        id: 'step-2',
        type: 'task',
        name: 'Sistema de Design UI',
        start: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        progress: 40,
        dependencies: ['step-1'],
        parent: 'project-1',
        resourceId: 'res-3'
    },
    {
        id: 'step-3',
        type: 'task',
        name: 'Núcleo Frontend',
        start: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        progress: 10,
        dependencies: ['step-2'],
        parent: 'project-1',
        resourceId: 'res-2'
    },
    {
        id: 'milestone-alpha',
        type: 'milestone',
        name: 'Lançamento Alpha',
        start: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        progress: 0,
        dependencies: ['step-3'],
        parent: 'project-1',
        styles: { backgroundColor: '#ef4444', backgroundSelectedColor: '#ef4444' }
    }
];

function App() {
    const [dbTasks, setDbTasks] = useState<Task[]>([]);
    const [resources, setResources] = useState<Resource[]>(MOCK_RESOURCES);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [currentView, setCurrentView] = useState('gantt');
    const [ganttTab, setGanttTab] = useState<'schedule' | 'tasks'>('schedule');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);

    const [selectedProjectId, setSelectedProjectId] = useState<string>('1');
    const [clientTasks, setClientTasks] = useState<Task[]>([]);

    useEffect(() => {
        const checkOnlineStatus = async () => {
            if (!navigator.onLine) {
                setIsOnline(false);
                return;
            }
            try {
                // Robust check: Ping external resource to confirm internet access.
                // 'no-cors' allows request to opaque resources (we just care if it doesn't fail network-wise).
                await fetch('https://www.google.com/favicon.ico?' + Date.now(), {
                    mode: 'no-cors',
                    cache: 'no-store'
                });
                setIsOnline(true);
            } catch (error) {
                // If fetch fails (network error), assume offline
                setIsOnline(false);
            }
        };

        // Check immediately and then interval
        checkOnlineStatus();
        const interval = setInterval(checkOnlineStatus, 5000); // Check every 5s for responsiveness

        const handleOnline = () => checkOnlineStatus();
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Projects State
    const [projects, setProjects] = useState<Project[]>([]);

    // Persistence Subscriptions (Projects & Clients)
    useEffect(() => {
        const unsubProjects = ProjectService.subscribeProjects((projs) => {
            setProjects(projs);
        });

        const unsubClients = ProjectService.subscribeClients((cls) => {
            setClients(cls);
        });

        return () => {
            unsubProjects();
            unsubClients();
        };
    }, []);

    // Project Logic & State
    const handleCreateProject = async (projectData: Omit<Project, 'id' | 'createdAt'>) => {
        try {
            await ProjectService.createProject({
                ...projectData,
                createdAt: new Date()
            });
        } catch (error) {
            console.error("Error creating project:", error);
        }
    };

    const handleProjectDelete = async (projectId: string) => {
        try {
            await ProjectService.deleteProject(projectId);
        } catch (error) {
            console.error("Error deleting project:", error);
        }
    };

    const handleUpdateProject = async (updatedProject: Project) => {
        try {
            const { id, ...data } = updatedProject;
            await ProjectService.updateProject(id, data);
        } catch (error) {
            console.error("Error updating project:", error);
        }
    };

    // Task Logic
    const {
        tasks,
        addTask,
        updateTask,
        deleteTask,
        handleMoveTask,
        indentTask,
        outdentTask,
        reorderTasks,
        getProjectStats
    } = useProjectLogic(dbTasks);

    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
    const [insertAfterTaskId, setInsertAfterTaskId] = useState<string | undefined>(undefined);

    // Subscribe to Firestore 
    useEffect(() => {
        const projectId = selectedProjectId || '1';
        let unsubscribeTasks: (() => void) | undefined;
        try {
            unsubscribeTasks = ProjectService.subscribeTasks(projectId, (newTasks) => {
                if (newTasks.length >= 0) {
                    setDbTasks(newTasks);
                    setIsConnected(true);
                    setConnectionError(null);
                }
            });
        } catch (e) {
            console.error("Firebase connection error", e);
            setDbTasks(INITIAL_TASKS.filter(t => t.projectId === projectId));
        }

        const unsubscribeResources = ProjectService.subscribeResources((res) => {
            if (res.length > 0) setResources(res);
        });

        return () => {
            if (unsubscribeTasks) unsubscribeTasks();
            unsubscribeResources();
        };
    }, [selectedProjectId]);



    // Handlers
    const onTaskChangeWrapper = (updatedTask: Task) => {
        const oldTask = tasks.find(t => t.id === updatedTask.id);
        if (oldTask && (oldTask.start.getTime() !== updatedTask.start.getTime() || oldTask.end.getTime() !== updatedTask.end.getTime())) {
            handleMoveTask(updatedTask.id, updatedTask.start, updatedTask.end);
        } else {
            updateTask(updatedTask);
        }

        ProjectService.updateTask(updatedTask.id, {
            start: updatedTask.start,
            end: updatedTask.end,
            realStart: (updatedTask.realStart || null) as any,
            realEnd: (updatedTask.realEnd || null) as any,
            progress: updatedTask.progress || 0,
            name: updatedTask.name || '',
            dependencies: updatedTask.dependencies || [],
            resourceId: updatedTask.resourceId || '',
            type: updatedTask.type || 'task',
            parent: updatedTask.parent
        }).catch(e => console.error("Failed to update task in DB:", e));
    }


    const onAddTaskWrapper = async (newTask: Task) => {
        if (!isConnected) {
            addTask(newTask, insertAfterTaskId);
            return;
        }
        try {
            const { id, ...taskData } = newTask;
            await ProjectService.addTask(taskData);
        } catch (e) {
            console.error("Failed to add task", e);
            addTask(newTask, insertAfterTaskId);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        deleteTask(taskId);
        if (isConnected) {
            try {
                await ProjectService.deleteTask(taskId);
            } catch (e) { console.error("Failed to delete task in DB", e); }
        }
    }

    const handleCreateClick = (afterTaskId?: string) => {
        if (typeof afterTaskId === 'object') afterTaskId = undefined;
        setInsertAfterTaskId(afterTaskId);
        let defaultParent = undefined;
        if (afterTaskId) {
            const siblingTask = tasks.find(t => t.id === afterTaskId);
            if (siblingTask) {
                defaultParent = siblingTask.parent;
            }
        }
        setEditingTask({ parent: defaultParent } as unknown as Task);
        setIsTaskModalOpen(true);
    };

    const handleSaveTask = (task: Task) => {
        if (!task.id) {
            const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order || 0)) : 0;
            const newTask = {
                ...task,
                order: maxOrder + 1,
                type: task.type || 'task',
                projectId: selectedProjectId || '1',
                parent: task.parent || null
            };
            onAddTaskWrapper(newTask as Task);
        } else {
            onTaskChangeWrapper(task);
        }
        setIsTaskModalOpen(false);
    };

    const handleReorderTasks = (newTasks: Task[], movedTaskId?: string) => {
        reorderTasks(newTasks, movedTaskId);
        if (isConnected) {
            const updates = newTasks.map((t, index) => ({
                id: t.id,
                data: { order: index }
            }));
            ProjectService.batchUpdateTasks(updates).catch(console.error);
        }
    };

    const [currentFiscalYear, setCurrentFiscalYear] = useState(new Date().getFullYear().toString());
    const [clients, setClients] = useState<any[]>([]); // Start empty as requested
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [clientKnowledge, setClientKnowledge] = useState<string[]>([]);

    // Fetch knowledge base (RAG) when client changes
    useEffect(() => {
        if (!selectedClientId) {
            setClientKnowledge([]);
            return;
        }

        if (isConnected) {
            ProjectService.getKnowledgeBase(selectedClientId)
                .then(setClientKnowledge)
                .catch(console.error);
        } else {
            setClientKnowledge([]);
        }
    }, [selectedClientId, isConnected]);

    // Initial View & Routing Logic
    useEffect(() => {
        if (currentView === 'clients_manage') {
            setSelectedClientId(null);
            setSelectedProjectId(null as any);
        } else if (currentView.startsWith('client_')) {
            // Context: Client Level (Strategic / Portfolio)

            // Expected: client_{id}_{view}

            // Heuristic parser since ID might have underscores (though we used Date.now())
            // Safe assumption: view is last part.
            let viewType = '';
            let clientId = '';

            if (currentView.endsWith('_reports')) {
                viewType = 'reports';
                clientId = currentView.replace('client_', '').replace('_reports', '');
            } else if (currentView.endsWith('_my_projects')) {
                viewType = 'my_projects';
                clientId = currentView.replace('client_', '').replace('_my_projects', '');
            }

            if (clientId) {
                setSelectedClientId(clientId);
                setSelectedProjectId(null as any); // Clear project selection when at client level
            }

        } else if (currentView.startsWith('project_')) {
            // Context: Project Level (Operational / Tactical)
            let projectId = '';

            if (currentView.endsWith('_dashboard')) {
                projectId = currentView.replace('project_', '').replace('_dashboard', '');
            } else if (currentView.endsWith('_gantt')) {
                projectId = currentView.replace('project_', '').replace('_gantt', '');
            }

            if (projectId) {
                setSelectedProjectId(projectId);
                // Also set client context for breadcrumbs/consistency
                const proj = projects.find(p => p.id === projectId);
                if (proj && proj.clientId) {
                    setSelectedClientId(proj.clientId);
                }
            }
        }
    }, [currentView, projects]); // Added projects dependency to find clientId from project

    const handleCreateClient = async (newClient: any) => {
        try {
            await ProjectService.createClient(newClient);
        } catch (error) {
            console.error("Error creating client:", error);
        }
    };

    const handleUpdateClient = async (updatedClient: any) => {
        try {
            const { id, ...data } = updatedClient;

            // Sanitize data: remove undefined fields to avoid Firestore errors
            Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

            if (!id) {
                alert("Erro: ID do cliente não encontrado.");
                return;
            }
            await ProjectService.updateClient(id, data);
        } catch (error: any) {
            console.error("Error updating client:", error);
            alert("Erro ao salvar: " + (error.message || "Erro desconhecido"));
        }
    };

    const handleDeleteClient = async (clientId: string) => {
        try {
            await ProjectService.deleteClient(clientId);
        } catch (error) {
            console.error("Error deleting client:", error);
        }
    };

    // Derived State for Rendering
    const getParsedViewType = () => {
        if (currentView === 'clients_manage') return 'clients_manage';
        if (currentView === 'team') return 'team';
        if (currentView === 'settings') return 'settings';

        if (currentView.startsWith('client_')) {
            if (currentView.endsWith('_reports')) return 'reports';
            if (currentView.endsWith('_my_projects')) return 'my_projects';
        }

        if (currentView.startsWith('project_')) {
            if (currentView.endsWith('_dashboard')) return 'dashboard';
            if (currentView.endsWith('_gantt')) return 'gantt';
        }

        return 'unknown';
    };

    const parsedViewType = getParsedViewType();

    // Aggregation Logic for Client Reports (Consolidated & Dynamic)
    useEffect(() => {
        if (parsedViewType !== 'reports' || !selectedClientId) return;

        const targetProjects = projects.filter(p => p.clientId === selectedClientId);

        // If no projects, empty tasks
        if (targetProjects.length === 0) {
            setClientTasks([]);
            return;
        }

        const unsubs: (() => void)[] = [];
        const taskMap = new Map<string, Task[]>();

        targetProjects.forEach(proj => {
            try {
                // Subscribe to each project's tasks
                const unsub = ProjectService.subscribeTasks(proj.id, (projTasks) => {
                    taskMap.set(proj.id, projTasks);
                    const allTasks = Array.from(taskMap.values()).flat();
                    setClientTasks(allTasks);
                });
                unsubs.push(unsub);
            } catch (e) {
                console.error("Error aggregating project", proj.id, e);
                // Fallback Mock
                const mock = INITIAL_TASKS.filter(t => t.projectId === proj.id);
                if (mock.length > 0) {
                    taskMap.set(proj.id, mock);
                    setClientTasks(Array.from(taskMap.values()).flat());
                }
            }
        });

        return () => {
            unsubs.forEach(u => u());
        };
    }, [parsedViewType, selectedClientId, projects]);


    // Filter tasks for the selected project (Operational/Tactical)
    const projectTasks = selectedProjectId
        ? tasks.filter(t => t.projectId === selectedProjectId || (t.projectId === '1' && selectedProjectId === '1')) // Compat with mock '1'
        : [];

    const stats = useMemo(() => {
        return calculateProjectStats(projectTasks, resources);
    }, [projectTasks, resources]);

    // Filter projects for the selected client (Strategic)
    // Filter projects for the selected client (Strategic)
    const clientProjects = selectedClientId
        ? projects.filter(p => {
            if (p.clientId !== selectedClientId) return false;
            // Strict Hierarchy: Project Year must match Selected Fiscal Year
            const pYear = new Date(p.startDate).getFullYear().toString();
            return pYear === currentFiscalYear;
        })
        : [];

    // When creating a project in "My Projects" of a client, attach that client ID
    const handleCreateProjectWrapper = (data: any) => {
        // Ensure the project is created in the currently viewed Fiscal Year
        let startDate = new Date();
        const selectedYear = parseInt(currentFiscalYear);
        if (startDate.getFullYear() !== selectedYear) {
            startDate = new Date(selectedYear, 0, 1); // Jan 1st of selected Year
        }

        handleCreateProject({ ...data, clientId: selectedClientId, startDate });
    };

    const handleIndentTask = (task: Task) => {
        const updated = indentTask(task.id);
        if (updated && isConnected) {
            ProjectService.updateTask(updated.id, {
                parent: updated.parent,
                type: updated.type
            }).catch(console.error);

            if (updated.parent) {
                const parent = tasks.find(t => t.id === updated.parent);
                if (parent && parent.type !== 'project') {
                    ProjectService.updateTask(parent.id, { type: 'project' }).catch(console.error);
                }
            }
        }
    };

    const handleOutdentTask = (task: Task) => {
        const updated = outdentTask(task.id);
        if (updated && isConnected) {
            ProjectService.updateTask(updated.id, {
                parent: updated.parent
            }).catch(console.error);
        }
    };


    const handleApplyEstimate = async (estimate: EstimateResult) => {
        if (!selectedProjectId) return;

        const projectStart = new Date();
        const prefix = `ai-${Date.now()}-`;
        const idMap: Record<string, string> = {};
        const roleMap: Record<string, string> = {};

        // 0. Prepare Hybrid Phases
        const phaseIds = {
            planning: `${prefix}phase-plan`,
            development: `${prefix}phase-dev`,
            testing: `${prefix}phase-test`,
            rollout: `${prefix}phase-rollout`
        };

        const phases: Task[] = [
            {
                id: phaseIds.planning,
                projectId: selectedProjectId,
                name: "Planejamento e Análise",
                type: "project",
                start: projectStart,
                end: addDays(projectStart, 5), // Initial placement, will auto-expand
                progress: 0,
                parent: null,
                dependencies: [],
                styles: { backgroundColor: '#60a5fa', progressColor: '#93c5fd' }, // Blue
                order: 0
            },
            {
                id: phaseIds.development,
                projectId: selectedProjectId,
                name: "Desenvolvimento",
                type: "project",
                start: addDays(projectStart, 6),
                end: addDays(projectStart, 15),
                progress: 0,
                parent: null,
                dependencies: [phaseIds.planning],
                styles: { backgroundColor: '#f59e0b', progressColor: '#fcd34d' }, // Amber
                order: 100 // Spaced out order
            },
            {
                id: phaseIds.testing,
                projectId: selectedProjectId,
                name: "Testes",
                type: "project",
                start: addDays(projectStart, 16),
                end: addDays(projectStart, 20),
                progress: 0,
                parent: null,
                dependencies: [phaseIds.development],
                styles: { backgroundColor: '#ef4444', progressColor: '#fca5a5' }, // Red
                order: 200
            },
            {
                id: phaseIds.rollout,
                projectId: selectedProjectId,
                name: "Preparação, Rollout e Acompanhamento",
                type: "project",
                start: addDays(projectStart, 21),
                end: addDays(projectStart, 25),
                progress: 0,
                parent: null,
                dependencies: [phaseIds.testing],
                styles: { backgroundColor: '#10b981', progressColor: '#6ee7b7' }, // Green
                order: 300
            }
        ];

        // 1. Generate ID Map & Resource Logic
        estimate.tasks.forEach(t => { idMap[t.id] = prefix + t.id; });

        for (const t of estimate.tasks) {
            if (t.role) {
                const normalizedRole = t.role.trim();
                if (!roleMap[normalizedRole]) {
                    const existingRes = resources.find(r => r.role.toLowerCase() === normalizedRole.toLowerCase() || r.name.toLowerCase() === normalizedRole.toLowerCase());
                    if (existingRes) {
                        roleMap[normalizedRole] = existingRes.id;
                    } else {
                        const newResData = {
                            name: `AI: ${normalizedRole}`,
                            role: normalizedRole,
                            hourlyRate: t.hourly_rate || 100,
                            avatarUrl: ''
                        };
                        let newId = `res-ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        if (isConnected) {
                            try {
                                const docRef = await ProjectService.addResource(newResData);
                                newId = docRef.id;
                            } catch (e) {
                                console.error("Failed to auto-create resource", e);
                            }
                        } else {
                            setResources(prev => [...prev, { ...newResData, id: newId }]);
                        }
                        roleMap[normalizedRole] = newId;
                    }
                }
            }
        }

        // 2. Build AI Tasks (Children)
        const aiTasks: Task[] = estimate.tasks.map((t, index) => {
            const start = addDays(projectStart, t.start_offset_days || 0);
            const duration = Math.max(1, t.duration_days || 1);
            const end = addDays(start, duration);

            let parentId = null;
            if (t.category && phaseIds[t.category]) {
                parentId = phaseIds[t.category];
            } else if (t.parent_id && idMap[t.parent_id]) {
                parentId = idMap[t.parent_id];
            }

            // Fallback: If no category and no parent, put in Planning or leave root?
            // Let's leave root if completely undefined, but AI instructions say strict category.

            return {
                id: idMap[t.id],
                projectId: selectedProjectId,
                name: t.name,
                type: t.type === 'project' ? 'project' : t.type === 'milestone' ? 'milestone' : 'task',
                start: start,
                end: end,
                progress: 0,
                parent: parentId,
                dependencies: t.dependencies ? t.dependencies.map(d => idMap[d] || d) : [],
                resourceId: t.role ? roleMap[t.role.trim()] : undefined,
                styles: { progressColor: '#8b5cf6', backgroundColor: '#8b5cf6' },
                order: index + 500 // Start after phases
            } as Task;
        });

        // 3. Merge & Add (Phases first)
        const allNewTasks = [...phases, ...aiTasks];

        for (const task of allNewTasks) {
            await onAddTaskWrapper(task);
        }

        // 4. Update Project Metadata
        if (selectedProjectId) {
            const updates = {
                aiConfidence: estimate.confidence_score,
                aiSummary: estimate.description
            };
            if (isConnected) {
                await ProjectService.updateProject(selectedProjectId, updates);
            } else {
                setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, ...updates } : p));
            }
        }

        setIsEstimateModalOpen(false);
    };

    const handleEstimateClick = async () => {
        if (projectTasks.length > 0) {
            if (window.confirm("Já existem tarefas criadas para este projeto. Deseja excluir todo planejamento atual e gerar um novo?")) {
                if (isConnected) {
                    try {
                        await ProjectService.deleteAllTasksForProject(selectedProjectId);
                    } catch (e) {
                        console.error("Error clearing tasks", e);
                        alert("Erro ao limpar tarefas antigas. Verifique a conexão.");
                        return;
                    }
                } else {
                    setDbTasks(prev => prev.filter(t => t.projectId !== selectedProjectId));
                }
                setIsEstimateModalOpen(true);
            }
        } else {
            setIsEstimateModalOpen(true);
        }
    };

    const handleApproveProject = async () => {
        if (!selectedProjectId || !selectedClientId) return;
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project) return;

        const summary = `[MEMÓRIA DE PROJETO APROVADO]
Nome: ${project.name}
Descrição: ${project.aiSummary || project.description || 'N/A'}
Total Tarefas: ${projectTasks.length}
Confiança da IA na época: ${project.aiConfidence ? (project.aiConfidence * 100).toFixed(0) + '%' : 'N/A'}
Estrutura sugerida: ${projectTasks.slice(0, 5).map(t => t.name).join(', ')}... (e mais ${Math.max(0, projectTasks.length - 5)} tarefas)`;

        if (window.confirm("Deseja aprovar este planejamento e ensinar o padrão à IA?")) {
            if (isConnected) {
                await ProjectService.addKnowledgeEntry(selectedClientId, summary);
                setClientKnowledge(prev => [...prev, summary]); // Optimistic update
                alert("Planejamento aprovado e memorizado!");
            } else {
                alert("Necessário estar online para salvar aprendizado.");
            }
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
            <Sidebar
                activeView={currentView}
                onNavigate={setCurrentView}
                className="hidden lg:flex"
                clients={clients}
                projects={projects}
            />
            <MobileMenu
                activeView={currentView}
                onNavigate={setCurrentView}
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
            />

            <div className="flex-1 flex flex-col min-w-0">
                {!isOnline && (
                    <div className="bg-red-600 text-white px-4 py-3 text-center text-sm font-bold flex justify-center items-center gap-2 shadow-md animate-in slide-in-from-top-2 z-50 transition-all">
                        <CloudOff size={20} />
                        <span>MODO OFFLINE: Você está trabalhando sem internet. Suas alterações foram salvas localmente e serão enviadas ao servidor automaticamente assim que a conexão retornar.</span>
                    </div>
                )}
                {/* Header */}
                <header className="bg-white border-b border-gray-200 h-16 px-8 flex items-center justify-between z-10">
                    <div className="flex items-center gap-4">
                        <button
                            className="lg:hidden p-2 -ml-2 text-gray-600"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu size={24} />
                        </button>
                        <h2 className="text-xl font-bold text-gray-800">
                            {selectedClientId
                                ? clients.find(c => c.id === selectedClientId)?.name
                                : 'Gestão de Projetos'}
                        </h2>
                        {!isOnline ? (
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold flex items-center gap-1" title="Sem conexão com a internet">
                                <CloudOff size={12} /> Offline
                            </span>
                        ) : connectionError ? (
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1" title={connectionError}>
                                <CloudOff size={12} /> Erro
                            </span>
                        ) : isConnected ? (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
                                <Database size={12} /> Live
                            </span>
                        ) : (
                            <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-semibold flex items-center gap-1">
                                <CloudOff size={12} /> Demo
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">A</div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 p-8 overflow-y-auto">

                    {/* View Title Header */}
                    <div className="flex justify-between items-end mb-6">
                        <div className="flex-1 mr-6">
                            <h1 className="text-2xl font-bold text-gray-900">
                                {parsedViewType === 'team' ? 'Gestão da Equipe' :
                                    parsedViewType === 'settings' ? 'Configurações do Sistema' :
                                        parsedViewType === 'clients_manage' ? 'Gestão de Clientes' :
                                            parsedViewType === 'my_projects' ? 'Portfólio de Projetos' :
                                                parsedViewType === 'dashboard' ? 'Relatório Operacional (Execução Diária)' :
                                                    parsedViewType === 'reports' ? 'Relatório Estratégico (Visão Executiva)' :
                                                        parsedViewType === 'gantt' ? 'Relatório Tático-Gerencial' :
                                                            (projects.find(p => p.id === selectedProjectId)?.name || 'Visão Geral')}
                            </h1>
                            <p className="text-gray-500 mt-1">
                                {parsedViewType === 'dashboard' ? 'Foco em tarefas, eficiência e rotina do dia a dia.' :
                                    parsedViewType === 'reports' ? 'Visão de longo prazo, KPIs de portfólio e alinhamento de negócio.' :
                                        ''}
                            </p>

                            {parsedViewType === 'gantt' && selectedProjectId && (() => {
                                const activeProject = projects.find(p => p.id === selectedProjectId);
                                if (!activeProject) return null;
                                return (
                                    <div className="mt-3 w-full animate-in fade-in slide-in-from-top-2">
                                        <div className="relative group">
                                            <textarea
                                                value={activeProject.aiSummary || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, aiSummary: val } : p));
                                                }}
                                                onBlur={(e) => {
                                                    if (isConnected) {
                                                        ProjectService.updateProject(selectedProjectId, { aiSummary: e.target.value }).catch(console.error);
                                                    }
                                                }}
                                                className="w-full bg-transparent border-0 text-gray-600 text-sm p-0 focus:ring-0 resize-none hover:bg-gray-50 rounded px-2 -ml-2 transition-colors"
                                                rows={2}
                                                placeholder="Adicione um resumo executivo..."
                                            />
                                            <Sparkles size={12} className="absolute -left-5 top-1 text-purple-400 opacity-50" />
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="flex items-center gap-3 shrink-0 mb-1">
                            {parsedViewType === 'gantt' && selectedProjectId && (() => {
                                const proj = projects.find(p => p.id === selectedProjectId);
                                return (
                                    <>
                                        {proj?.aiConfidence && (
                                            <div className={`px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-2 ${proj.aiConfidence > 0.8
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : 'bg-orange-50 text-orange-700 border-orange-200'
                                                }`}>
                                                <Sparkles size={14} />
                                                {(proj.aiConfidence * 100).toFixed(0)}% Confiança
                                            </div>
                                        )}
                                        <button
                                            onClick={handleApproveProject}
                                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-green-100 transition-all hover:scale-105 active:scale-95 text-xs lg:text-sm"
                                            title="Aprovar e Ensinar à IA"
                                        >
                                            <CheckCircle size={16} />
                                            Aprovar
                                        </button>
                                        <button
                                            onClick={handleEstimateClick}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-indigo-100 transition-all hover:scale-105 active:scale-95"
                                        >
                                            <Sparkles size={18} />
                                            Estimar com IA
                                        </button>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* SETTINGS VIEW */}
                    {parsedViewType === 'settings' && (
                        <SettingsView />
                    )}

                    {/* CLIENTS MANAGEMENT VIEW */}
                    {parsedViewType === 'clients_manage' && (
                        <ClientsView
                            clients={clients}
                            onCreateClient={handleCreateClient}
                            onUpdateClient={handleUpdateClient}
                            onDeleteClient={handleDeleteClient}
                            currentFiscalYear={currentFiscalYear}
                            onFiscalYearChange={setCurrentFiscalYear}
                            onSelectClient={(clientId) => {
                                setCurrentView(`client_${clientId}_reports`);
                            }}
                        />
                    )}

                    {/* GANTT / TÁTICO VIEW */}
                    {parsedViewType === 'gantt' && (
                        <>
                            <ProjectSummary
                                stats={stats}
                                project={projects.find(p => p.id === selectedProjectId)}
                                onUpdateProject={(updated) => {
                                    if (isConnected) {
                                        ProjectService.updateProject(updated.id, updated).catch(console.error);
                                    } else {
                                        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
                                    }
                                }}
                            />
                            <div className="flex border-b border-gray-200 mb-6">
                                <button
                                    onClick={() => setGanttTab('schedule')}
                                    className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${ganttTab === 'schedule' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    Cronograma
                                </button>
                                <button
                                    onClick={() => setGanttTab('tasks')}
                                    className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${ganttTab === 'tasks' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    Tarefas
                                </button>
                                {/* Button removed */}
                            </div>
                            {ganttTab === 'schedule' && (
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[650px] flex flex-col mt-8">
                                    <div className="flex-1 overflow-hidden relative">
                                        <GanttChart
                                            tasks={projectTasks}
                                            onTaskChange={onTaskChangeWrapper}
                                            onEditTask={(task) => { setEditingTask(task); setIsTaskModalOpen(true); }}
                                            onAddTask={handleCreateClick}
                                            onDeleteTask={handleDeleteTask}
                                            onReorderTasks={handleReorderTasks}
                                            onIndent={handleIndentTask}
                                            onOutdent={handleOutdentTask}
                                        />
                                    </div>
                                </div>
                            )}
                            {ganttTab === 'tasks' && (
                                <TaskListView
                                    tasks={projectTasks}
                                    resources={resources}
                                    onEditTask={(task) => { setEditingTask(task); setIsTaskModalOpen(true); }}
                                    isConnected={isConnected}
                                />
                            )}
                        </>
                    )}

                    {/* TEAM VIEW */}
                    {parsedViewType === 'team' && (
                        <TeamView resources={resources} isConnected={isConnected} />
                    )}

                    {/* DASHBOARD / OPERACIONAL VIEW */}
                    {parsedViewType === 'dashboard' && (
                        <DashboardView tasks={projectTasks} resources={resources} />
                    )}

                    {/* REPORTS / ESTRATÉGICO VIEW */}
                    {parsedViewType === 'reports' && (
                        <ReportsView
                            tasks={clientTasks}
                            resources={resources}
                            projects={clientProjects}
                            client={clients.find(c => c.id === selectedClientId)}
                            fiscalYear={currentFiscalYear}
                        />
                    )}

                    {/* MY PROJECTS VIEW */}
                    {parsedViewType === 'my_projects' && (
                        <MyProjectsView
                            projects={clientProjects}
                            onCreateProject={handleCreateProjectWrapper}
                            onUpdateProject={handleUpdateProject}
                            onDeleteProject={handleProjectDelete}
                            onSelectProject={(id) => {
                                setSelectedProjectId(id);
                                setCurrentView(`project_${id}_gantt`);
                            }}
                        />
                    )}
                </main>
            </div>

            {isTaskModalOpen && (
                <TaskForm
                    task={editingTask}
                    allTasks={tasks}
                    resources={resources}
                    onSave={handleSaveTask}
                    onCancel={() => setIsTaskModalOpen(false)}
                />
            )}
            <EstimateModal
                isOpen={isEstimateModalOpen}
                onClose={() => setIsEstimateModalOpen(false)}
                onApplyEstimate={handleApplyEstimate}
                clientContext={clients.find(c => c.id === selectedClientId)?.context}
                knowledgeBase={clientKnowledge}
            />
        </div>
    );
}

export default App;
