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
import { useProjectLogic } from './hooks/useProjectLogic';
import { isAfter, isWeekend, addDays, differenceInDays } from 'date-fns';

import { Task, Resource, Project } from './types';
import { Database, CloudOff, Menu } from 'lucide-react';
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
    const [currentView, setCurrentView] = useState('gantt');
    const [ganttTab, setGanttTab] = useState<'schedule' | 'tasks'>('schedule');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const [selectedProjectId, setSelectedProjectId] = useState<string>('1');
    const [clientTasks, setClientTasks] = useState<Task[]>([]);

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
            const newTask = {
                ...task,
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

    const [currentFiscalYear, setCurrentFiscalYear] = useState('2024');
    const [clients, setClients] = useState<any[]>([]); // Start empty as requested
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

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
            await ProjectService.updateClient(id, data);
        } catch (error) {
            console.error("Error updating client:", error);
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
    const clientProjects = selectedClientId
        ? projects.filter(p => p.clientId === selectedClientId)
        : [];

    // When creating a project in "My Projects" of a client, attach that client ID
    const handleCreateProjectWrapper = (data: any) => {
        handleCreateProject({ ...data, clientId: selectedClientId });
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
                        {connectionError ? (
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
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {parsedViewType === 'team' ? 'Gestão da Equipe' :
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
                        </div>
                    </div>

                    {/* CLIENTS MANAGEMENT VIEW */}
                    {parsedViewType === 'clients_manage' && (
                        <ClientsView
                            clients={clients}
                            onCreateClient={handleCreateClient}
                            onUpdateClient={handleUpdateClient}
                            onDeleteClient={handleDeleteClient}
                            currentFiscalYear={currentFiscalYear}
                            onFiscalYearChange={setCurrentFiscalYear}
                        />
                    )}

                    {/* GANTT / TÁTICO VIEW */}
                    {parsedViewType === 'gantt' && (
                        <>
                            <ProjectSummary stats={stats} />
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
                        <ReportsView tasks={clientTasks} resources={resources} projects={clientProjects} />
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
                                setCurrentView(`client_${selectedClientId}_gantt`);
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
        </div>
    );
}

export default App;
