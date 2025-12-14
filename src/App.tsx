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
import { useProjectLogic } from './hooks/useProjectLogic';

import { Task, Resource, Project } from './types';
import { Plus, Search, Bell, Database, CloudOff, Menu } from 'lucide-react';
import { ProjectService } from './services/projectService';

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

    // Projects State
    const [projects, setProjects] = useState<Project[]>([
        { id: '1', name: 'Plataforma SaaS MVP', description: 'Desenvolvimento do MVP da plataforma principal.', startDate: new Date('2024-01-01'), createdAt: new Date() },
        { id: '2', name: 'Refatoração Backend', description: 'Atualização da arquitetura de microsserviços.', startDate: new Date('2024-03-15'), createdAt: new Date() }
    ]);

    const handleCreateProject = (projectData: Omit<Project, 'id' | 'createdAt'>) => {
        const newProject: Project = {
            ...projectData,
            id: `proj-${Date.now()}`,
            createdAt: new Date()
        };
        setProjects([...projects, newProject]);
    };

    // We start with empty, relying on subscription or fallback to mock if needed
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

    // Subscribe to Firestore (Logic remains same)
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

    const stats = useMemo(() => getProjectStats(resources), [tasks, getProjectStats, resources]);

    // Override local logic handlers to also save to DB
    const onTaskChangeWrapper = (updatedTask: Task) => {
        // Detect if it is a Move operation (Dates changed) vs Progress/Name update
        const oldTask = tasks.find(t => t.id === updatedTask.id);
        if (oldTask && (oldTask.start.getTime() !== updatedTask.start.getTime() || oldTask.end.getTime() !== updatedTask.end.getTime())) {
            handleMoveTask(updatedTask.id, updatedTask.start, updatedTask.end);
        } else {
            updateTask(updatedTask);
        }

        // Push to DB
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
            parent: updatedTask.parent // ensure parent is saved
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

        if (!isConnected) return;

        try {
            await ProjectService.deleteTask(taskId);
        } catch (e) {
            console.error("Failed to delete task in DB", e);
        }
    }

    const handleCreateClick = (afterTaskId?: string) => {
        if (typeof afterTaskId === 'object') afterTaskId = undefined;
        setInsertAfterTaskId(afterTaskId);

        // Inherit parent from sibling for form default
        let defaultParent = undefined;
        if (afterTaskId) {
            const siblingTask = tasks.find(t => t.id === afterTaskId);
            if (siblingTask) {
                // If the sibling is a group (project)?
                // UX: If I click add on a group, do I assume inside or after?
                // Use strict sibling logic: same parent.
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

    const handleSeed = () => {
        ProjectService.seedInitialData();
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

    const handleProjectDelete = (projectId: string) => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        // Optional: Also delete tasks for this project if we were doing a full cleanup
        // But for now just removing the project card is sufficient for the UI view
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
            <Sidebar activeView={currentView} onNavigate={setCurrentView} className="hidden lg:flex" />
            <MobileMenu
                activeView={currentView}
                onNavigate={setCurrentView}
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
            />

            <div className="flex-1 flex flex-col min-w-0">
                {/* Top Header */}
                <header className="bg-white border-b border-gray-200 h-16 px-8 flex items-center justify-between z-10">
                    <div className="flex items-center gap-4">
                        <button
                            className="lg:hidden p-2 -ml-2 text-gray-600"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu size={24} />
                        </button>
                        <h2 className="text-xl font-bold text-gray-800">SaaS Platform MVP</h2>
                        {connectionError ? (
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1" title={connectionError}>
                                <CloudOff size={12} /> Erro: {connectionError.substring(0, 20)}...
                            </span>
                        ) : isConnected ? (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
                                <Database size={12} /> Info: Sinc. Ao Vivo
                            </span>
                        ) : (
                            <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-semibold flex items-center gap-1">
                                <CloudOff size={12} /> Info: Modo Demo
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar tarefas..."
                                className="pl-10 pr-4 py-2 bg-gray-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-64"
                            />
                        </div>
                        <button className="text-gray-500 hover:text-gray-700 relative">
                            <Bell size={20} />
                            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">A</div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 p-8 overflow-y-auto">
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {currentView === 'team' ? 'Gestão da Equipe' :
                                    currentView === 'my_projects' ? 'Portfólio de Projetos' :
                                        (projects.find(p => p.id === selectedProjectId)?.name || 'Visão Geral do Projeto')}
                            </h1>
                            <p className="text-gray-500 mt-1">
                                {currentView === 'team' ? 'Sincronizar membros da equipe e funções.' : 'Gerenciar cronograma, recursos e orçamento.'}
                            </p>
                        </div>
                        <div className="flex items-center">
                            {/* Actions removed as per request */}
                        </div>
                    </div>

                    {currentView === 'gantt' && (
                        <>
                            <ProjectSummary stats={stats} />

                            <div className="flex border-b border-gray-200 mb-6">
                                <button
                                    onClick={() => setGanttTab('schedule')}
                                    className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${ganttTab === 'schedule'
                                        ? 'border-indigo-600 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Cronograma do projeto
                                </button>
                                <button
                                    onClick={() => setGanttTab('tasks')}
                                    className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${ganttTab === 'tasks'
                                        ? 'border-indigo-600 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Tarefas
                                </button>
                            </div>

                            {ganttTab === 'schedule' && (
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[650px] flex flex-col mt-8">
                                    <div className="flex-1 overflow-hidden relative">
                                        <GanttChart
                                            tasks={tasks}
                                            onTaskChange={onTaskChangeWrapper}
                                            onEditTask={(task) => {
                                                setEditingTask(task);
                                                setIsTaskModalOpen(true);
                                            }}
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
                                    tasks={tasks}
                                    resources={resources}
                                    onEditTask={(task) => {
                                        setEditingTask(task);
                                        setIsTaskModalOpen(true);
                                    }}
                                    isConnected={isConnected}
                                />
                            )}
                        </>
                    )}

                    {currentView === 'team' && (
                        <TeamView resources={resources} isConnected={isConnected} />
                    )}

                    {currentView === 'dashboard' && (
                        <DashboardView tasks={tasks} resources={resources} />
                    )}



                    {currentView === 'reports' && (
                        <ReportsView tasks={tasks} resources={resources} />
                    )}

                    {currentView === 'my_projects' && (
                        <MyProjectsView
                            projects={projects}
                            onCreateProject={handleCreateProject}
                            onDeleteProject={handleProjectDelete}
                            onSelectProject={(id) => {
                                setSelectedProjectId(id);
                                setCurrentView('gantt');
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
