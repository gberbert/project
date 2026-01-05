import React, { useState, useMemo, useEffect } from 'react';
import { GanttChart } from './components/GanttChart';
import { ViewMode } from 'gantt-task-react';
import { Sidebar, MobileMenu } from './components/Sidebar';
import { ProjectSummary } from './components/ProjectSummary';
import { TaskForm } from './components/TaskForm';
import { TeamView } from './components/TeamView';
import { ProjectTeamTab } from './components/ProjectTeamTab';
import { ProjectMonthlyCostsTab } from './components/ProjectMonthlyCostsTab';
import { ProjectOtherCostsTab } from './components/ProjectOtherCostsTab';
import { DashboardView } from './components/DashboardView';
import { TaskListView } from './components/TaskListView';
import { ReportsView } from './components/ReportsView';
import { MyProjectsView } from './components/MyProjectsView';
import { ClientsView } from './components/ClientsView';
import { SettingsView } from './components/SettingsView';
import { EstimateModal } from './components/EstimateModal';
import { EstimateResult, geminiService } from './services/geminiService';
import { useProjectLogic } from './hooks/useProjectLogic';
import { isAfter, isWeekend, addDays, differenceInDays, addBusinessDays } from 'date-fns';

import { Task, Resource, Project, ProjectTeamMember } from './types';
import { Database, CloudOff, Menu, Sparkles, CheckCircle, Activity, Lock, LogOut, ChevronDown, FileText, CheckSquare, Target, Pencil, Trash2, Users, DollarSign, Tag, Image as ImageIcon, Loader2 } from 'lucide-react';
import { ProjectService, getNextWorkingDay } from './services/projectService';
import { StabilizationModal } from './components/StabilizationModal';
import { useAuth } from './contexts/AuthContext';
import { LoginView } from './components/LoginView';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { MarkdownEditor } from './components/MarkdownEditor';
import { TopMenuBar } from './components/TopMenuBar';
import { parseProjectXML } from './services/ProjectImportService';
import { exportProjectToXML } from './services/ProjectExportService';
import { calculateBusinessDays } from './lib/utils';
import { generateProposalPpt } from './services/proposalGenerator';
import { ClientBlockageListModal } from './components/ClientBlockageListModal';

// --- Stats Helper ---
const countBusinessDays = (startDate: Date | undefined, endDate: Date | undefined) => {
    if (!startDate || !endDate) return 0;
    return calculateBusinessDays(startDate, endDate);
};

const calculateProjectStats = (tasks: Task[], resources: Resource[], project?: Project) => {
    if (tasks.length === 0) return { totalCost: 0, totalRealCost: 0, progress: 0, plannedProgress: 0, totalDuration: 0, totalRealDuration: 0, spi: 0, cpi: 0 };

    let minStart = new Date(8640000000000000);
    let maxEnd = new Date(-8640000000000000);
    let minRealStart = new Date(8640000000000000);
    let maxRealEnd = new Date(-8640000000000000);

    let totalCost = 0;
    let totalRealCost = 0;
    let totalEarnedValue = 0;
    let totalPlannedValue = 0;

    let totalDurationWeight = 0;
    let totalEarnedDuration = 0;
    let totalPlannedDuration = 0;

    const leafTasks = tasks.filter(t => t.type !== 'project' && !tasks.some(child => child.parent === t.id));
    const rootTasks = tasks.filter(t => !t.parent || !tasks.find(p => p.id === t.parent));

    if (leafTasks.length === 0 && rootTasks.length === 0) return { totalCost: 0, totalRealCost: 0, progress: 0, plannedProgress: 0, totalDuration: 0, totalRealDuration: 0, spi: 0, cpi: 0 };

    const today = new Date();
    today.setHours(12, 0, 0, 0);

    // Calculate Total Duration based on ROOTS (Phases/Top Level) to match the "DIAS" column sum in the UI
    const totalRootDuration = rootTasks.reduce((acc, t) => {
        return acc + Math.max(1, countBusinessDays(t.start, t.end));
    }, 0);

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

        // Common Duration Calculation
        const durationDays = Math.max(1, countBusinessDays(task.start, task.end));

        // PV (Planned Value) Percentage - Time Based
        let taskPVPercent = 0;
        const taskStart = new Date(task.start); taskStart.setHours(12, 0, 0, 0);
        const taskEnd = new Date(task.end); taskEnd.setHours(12, 0, 0, 0);

        if (isAfter(taskStart, today)) {
            taskPVPercent = 0; // Future
        } else if (isAfter(today, taskEnd)) {
            taskPVPercent = 1; // Past deadline
        } else {
            // In progress window
            const elapsedTaskDays = countBusinessDays(taskStart, today);
            taskPVPercent = Math.min(1, Math.max(0, elapsedTaskDays / durationDays));
        }

        // Accumulate Duration Stats (Fallback/Non-Financial)
        totalDurationWeight += durationDays;
        totalEarnedDuration += durationDays * ((task.progress || 0) / 100);
        totalPlannedDuration += durationDays * taskPVPercent;

        // Calculate Cost Interest (Financial)
        let rate = task.hourlyRate || 0;

        if (rate > 0) {
            const budget = durationDays * 8 * rate; // BAC
            // If project is NOT defined, we sum up task costs as legacy behavior.
            // If project IS defined, we overwrite totalCost at the end, but we need these for EVM (Earned Value) calculation ratios.
            // Actually, if we use separate tabs for costs, EVM based on tasks might be disconnected.
            // But for now, let's keep calculating task-based EV/AC/PV for SPI/CPI logic,
            // but override the displayed Total Cost if project data is present.
            if (!project) {
                totalCost += budget;
            }

            // EV (Earned Value)
            totalEarnedValue += budget * ((task.progress || 0) / 100);

            // AC (Actual Cost)
            if (task.realStart && task.realEnd) {
                const rDays = countBusinessDays(task.realStart, task.realEnd);
                totalRealCost += rDays * 8 * rate;
            }

            // PV (Planned Value)
            totalPlannedValue += budget * taskPVPercent;
        }
    });

    // Override Total Cost if Project Data is available (Monthly + Other)
    if (project) {
        const monthlyTotal = project.monthlyCosts?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;

        let otherTotal = 0;
        if (project.otherCosts) {
            otherTotal = project.otherCosts.reduce((sum, item) => {
                const rowSum = Object.values(item.values).reduce((a, b) => a + b, 0);
                return sum + rowSum;
            }, 0);
        }

        totalCost = monthlyTotal + otherTotal;
    }

    const totalDurationBusinessDays = countBusinessDays(minStart, maxEnd);
    let totalRealDurationBusinessDays = 0;
    if (maxRealEnd.getTime() > -8640000000000000 && minRealStart.getTime() < 8640000000000000) {
        totalRealDurationBusinessDays = countBusinessDays(minRealStart, maxRealEnd);
    }

    // Consolidated Metrics
    // If Cost exists, use EVM (Weighted by Cost). Else use Duration Weighting.
    let progress = 0;
    let plannedProgress = 0;

    // We use the Task-based Budget accumulation for Progress calculation to keep it linked to Task Completion
    // even if we display a manual Total Cost.
    // However, if we don't have task-based costs, we use duration.
    const taskBasedBudget = leafTasks.reduce((acc, t) => {
        let rate = t.hourlyRate || 0;
        if (!rate && t.resourceId && resources.length > 0) {
            const res = resources.find(r => r.id === t.resourceId);
            if (res) rate = res.hourlyRate;
        }
        return acc + (countBusinessDays(t.start, t.end) * 8 * rate);
    }, 0);


    if (taskBasedBudget > 0) {
        progress = Math.round((totalEarnedValue / taskBasedBudget) * 100);
        plannedProgress = Math.round((totalPlannedValue / taskBasedBudget) * 100);
    } else {
        // Fallback to Duration
        progress = Math.round((totalEarnedDuration / totalDurationWeight) * 100);
        plannedProgress = Math.round((totalPlannedDuration / totalDurationWeight) * 100);
    }



    // User Custom CPI: PV / AC (Spent less than planned = Good (>1))
    const cpi = totalRealCost > 0 ? (totalPlannedValue / totalRealCost) : 1;
    const spi = totalPlannedValue > 0 ? (totalEarnedValue / totalPlannedValue) : 1;


    // Calculate Client Blockage Impact
    let totalBlockageHours = 0;
    let totalBlockageCost = 0;

    tasks.forEach(task => {
        if (task.clientBlockages && task.clientBlockages.length > 0) {
            let rate = task.hourlyRate || 0;
            // Fallback to resource rate if needed
            if (rate === 0 && task.resourceId && resources.length > 0) {
                const res = resources.find(r => r.id === task.resourceId);
                if (res) rate = res.hourlyRate;
            }

            task.clientBlockages.forEach(b => {
                // Safe Date Parsing
                const parseDate = (d: any) => {
                    if (!d) return new Date();
                    if (d instanceof Date) return d;
                    // Generic check for Firestore Timestamp-like objects (duck typing)
                    if (typeof d.toDate === 'function') return d.toDate();
                    return new Date(d);
                };

                const start = parseDate(b.start);
                const end = b.end ? parseDate(b.end) : new Date();

                // Ensure valid dates
                if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

                // Ensure we don't calculate future blockages or invalid ranges
                if (isAfter(start, end)) return;

                const days = countBusinessDays(start, end);
                const hours = days * 8; // Assuming 8h work day

                totalBlockageHours += hours;
                totalBlockageCost += hours * rate;
            });
        }
    });

    return {
        totalCost,
        totalRealCost,
        progress: Math.min(100, progress),
        plannedProgress: Math.min(100, plannedProgress),
        totalDuration: totalRootDuration > 0 ? totalRootDuration : totalDurationBusinessDays,
        totalRealDuration: totalRealDurationBusinessDays,
        spi,
        cpi,
        startDate: minStart.getTime() !== 8640000000000000 ? minStart : undefined,
        endDate: maxEnd.getTime() !== -8640000000000000 ? maxEnd : undefined,

        // New Detailed Metrics
        plannedDurationToDate: Math.round(totalPlannedDuration),
        realDurationToDate: Math.round(totalEarnedDuration),

        plannedCostToDate: totalPlannedValue,
        realCostToDate: totalRealCost,

        totalClientBlockageCost: totalBlockageCost,
        totalClientBlockageHours: totalBlockageHours
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
    const { user, loading: authLoading, logout, isAdmin } = useAuth();
    const [dbTasks, setDbTasks] = useState<Task[]>([]);
    const [resources, setResources] = useState<Resource[]>(MOCK_RESOURCES);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [currentView, setCurrentView] = useState('clients_manage');
    const [ganttTab, setGanttTab] = useState<'schedule' | 'tasks' | 'context' | 'premises' | 'team' | 'monthly_costs' | 'other_costs'>('schedule');
    const [ganttViewMode, setGanttViewMode] = useState<ViewMode>(ViewMode.Year);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isStabilizationModalOpen, setIsStabilizationModalOpen] = useState(false);
    const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isClientBlockageModalOpen, setIsClientBlockageModalOpen] = useState(false);

    const [selectedProjectId, setSelectedProjectId] = useState<string>('1');
    const [clientTasks, setClientTasks] = useState<Task[]>([]);

    // --- Editing State ---
    const [editingDocKey, setEditingDocKey] = useState<string | null>(null);
    const [editingPremises, setEditingPremises] = useState(false);
    const [isGeneratingArchitecture, setIsGeneratingArchitecture] = useState(false);
    const [isGeneratingPPT, setIsGeneratingPPT] = useState(false);
    const [generationStatus, setGenerationStatus] = useState<string>('');

    // --- Editing Handlers ---
    const handleSaveDoc = (key: string, newContent: string) => {
        const activeProject = projects.find(p => p.id === selectedProjectId);
        if (activeProject && activeProject.documentation) {
            const updatedDoc = {
                ...activeProject.documentation,
                [key]: newContent
            };
            const updatedProject = { ...activeProject, documentation: updatedDoc };
            setProjects(prev => prev.map(p => p.id === activeProject.id ? updatedProject : p));
            ProjectService.updateProject(activeProject.id, { documentation: updatedDoc });
            setEditingDocKey(null);
        }
    };

    const handleDeleteDoc = (key: string) => {
        if (!confirm('Tem certeza que deseja remover este bloco de documentação?')) return;
        const activeProject = projects.find(p => p.id === selectedProjectId);
        if (activeProject && activeProject.documentation) {
            const updatedDoc = { ...activeProject.documentation };
            delete updatedDoc[key];
            const updatedProject = { ...activeProject, documentation: updatedDoc };
            setProjects(prev => prev.map(p => p.id === activeProject.id ? updatedProject : p));
            ProjectService.updateProject(activeProject.id, { documentation: updatedDoc });
        }
    };

    const handleSavePremises = (newContent: string) => {
        const activeProject = projects.find(p => p.id === selectedProjectId);
        if (activeProject) {
            // Split by line and remove bullet points
            const lines = newContent.split('\n')
                .map(line => line.replace(/^-\s*/, '').trim())
                .filter(l => l.length > 0);

            const updatedProject = { ...activeProject, technicalPremises: lines };
            setProjects(prev => prev.map(p => p.id === activeProject.id ? updatedProject : p));
            ProjectService.updateProject(activeProject.id, { technicalPremises: lines });
            setEditingPremises(false);
        }
    };

    const handleGenerateArchitecture = async () => {
        const activeProject = projects.find(p => p.id === selectedProjectId);
        if (!activeProject || !activeProject.documentation?.technical_solution) {
            alert("É necessário ter a 'Solução Técnica' preenchida na documentação para gerar a arquitetura.");
            return;
        }

        setIsGeneratingArchitecture(true);
        try {
            console.log("Generating Architecture Prompt...");
            const prompt = await geminiService.generateArchitecturePrompt(activeProject.documentation.technical_solution);
            console.log("Prompt generated:", prompt);

            console.log("Generating Image...");
            const imageUrl = await geminiService.generateImage(prompt);
            console.log("Image generated.");

            const updatedProject = { ...activeProject, architectureImage: imageUrl };
            setProjects(prev => prev.map(p => p.id === activeProject.id ? updatedProject : p));
            await ProjectService.updateProject(activeProject.id, { architectureImage: imageUrl });

        } catch (e: any) {
            console.error(e);
            alert("Erro ao gerar arquitetura: " + e.message);
        } finally {
            setIsGeneratingArchitecture(false);
        }
    };

    useEffect(() => {
        document.title = "UERJ-FAF 2025";
    }, []);



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
        if (!user) {
            setProjects([]);
            setClients([]);
            return;
        }

        const unsubProjects = ProjectService.subscribeProjects((projs) => {
            setProjects(projs);
        }, user.uid, user.role);

        const unsubClients = ProjectService.subscribeClients((cls) => {
            setClients(cls);
        }, user.uid, user.role);

        return () => {
            unsubProjects();
            unsubClients();
        };
    }, [user]);

    // Project Logic & State
    const handleCreateProject = async (projectData: Omit<Project, 'id' | 'createdAt' | 'ownerId'>) => {
        if (!user) return;
        try {
            await ProjectService.createProject({
                ...projectData,
                createdAt: new Date(),
                ownerId: user.uid
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
    } = useProjectLogic(dbTasks);


    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isGanttLandscape, setIsGanttLandscape] = useState(false);
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
        // Enforce Working Days (Snap to Valid Day if Weekend OR Holiday)
        let newStart = new Date(updatedTask.start);
        let newEnd = new Date(updatedTask.end);

        // Check if Start is valid
        const validStart = getNextWorkingDay(newStart);

        // If it changed, apply delta to shift the whole task
        if (validStart.getTime() !== newStart.getTime()) {
            const deltaMs = validStart.getTime() - newStart.getTime();
            newStart = validStart;
            newEnd = new Date(newEnd.getTime() + deltaMs);
        }

        // Apply snapped dates
        const taskToSave = {
            ...updatedTask,
            start: newStart,
            end: newEnd
        };

        const oldTask = tasks.find(t => t.id === taskToSave.id);
        if (oldTask && (oldTask.start.getTime() !== taskToSave.start.getTime() || oldTask.end.getTime() !== taskToSave.end.getTime())) {
            handleMoveTask(taskToSave.id, taskToSave.start, taskToSave.end);
        } else {
            updateTask(taskToSave);
        }

        ProjectService.updateTask(taskToSave.id, {
            start: taskToSave.start,
            end: taskToSave.end,
            realStart: (taskToSave.realStart || null) as any,
            realEnd: (taskToSave.realEnd || null) as any,
            progress: taskToSave.progress || 0,
            name: taskToSave.name || '',
            dependencies: taskToSave.dependencies || [],
            resourceId: taskToSave.resourceId || '',
            type: taskToSave.type || 'task',
            parent: taskToSave.parent
        }).then(() => {
            // Auto-schedule dependencies
            // We need the full list of tasks for this project with the NEW state of the updated task
            if (selectedProjectId) {
                const projectTasks = dbTasks
                    .filter(t => t.projectId === selectedProjectId)
                    .map(t => t.id === taskToSave.id ? taskToSave : t);

                ProjectService.recalculateProjectSchedule(selectedProjectId, projectTasks)
                    .catch(e => console.error("Auto-schedule failed:", e));
            }
        }).catch(e => console.error("Failed to update task in DB:", e));
    }



    const onAddTaskWrapper = async (newTask: Task, insertOverride?: string | null) => {
        const targetId = insertOverride !== undefined ? (insertOverride || undefined) : insertAfterTaskId;

        if (!isConnected) {
            addTask(newTask, targetId);
            return;
        }
        try {
            await ProjectService.addTask(newTask);
        } catch (e) {
            console.error("Failed to add task", e);
            addTask(newTask, targetId);
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
        if (currentView === 'clients_manage' || currentView === 'global_projects') {
            setSelectedClientId(null);
            setSelectedProjectId(null as any);
        } else if (currentView.startsWith('client_')) {
            // Context: Client Level (Strategic / Portfolio)

            // Expected: client_{id}_{view}

            // Heuristic parser since ID might have underscores (though we used Date.now())
            // Safe assumption: view is last part.
            // let viewType = '';
            let clientId = '';

            if (currentView.endsWith('_reports')) {
                // viewType = 'reports'; // Unused
                clientId = currentView.replace('client_', '').replace('_reports', '');
            } else if (currentView.endsWith('_my_projects')) {
                // viewType = 'my_projects'; // Unused
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

    const handleCreateClient = async (clientData: any) => {
        if (!user) return;
        try {
            await ProjectService.createClient({
                ...clientData,
                ownerId: user.uid
            });
        } catch (error) {
            console.error("Error creating client:", error);
        }
    };



    const handleImportProject = async (file: File) => {
        try {
            const importedTasks = await parseProjectXML(file);
            console.log("Tarefas Importadas:", importedTasks);

            if (selectedProjectId) {
                if (confirm(`Importar "${file.name}" substituirá todas as tarefas do projeto atual. Deseja continuar?`)) {
                    const activeProject = projects.find(p => p.id === selectedProjectId);
                    if (activeProject) {
                        await ProjectService.replaceProjectTasks(activeProject.id, importedTasks);
                        alert(`Sucesso! ${importedTasks.length} tarefas importadas.`);
                    }
                }
            } else {
                alert("Por favor, abra um projeto antes de importar um arquivo .XML do MS Project.");
            }

        } catch (e: any) {
            console.error(e);
            alert("Erro ao importar projeto: " + e.message);
        }
    };

    const handleExportProject = () => {
        if (!selectedProjectId) return;
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project) return;

        // Filter tasks for current project. dbTasks is the source of truth from subscription.
        const tasksToExport = dbTasks.filter(t => t.projectId === selectedProjectId);
        exportProjectToXML(project, tasksToExport);
    };

    const handleExportProposal = async () => {
        if (!selectedProjectId) return;
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project) return;

        setIsGeneratingPPT(true); // Start Loading
        setGenerationStatus('Inicializando motor de apresentação...');

        try {
            const projectTasks = dbTasks.filter(t => t.projectId === selectedProjectId);
            let templateConfig = undefined;
            try {
                const storedTemplate = localStorage.getItem('PPT_TEMPLATE_CONFIG');
                if (storedTemplate) {
                    templateConfig = JSON.parse(storedTemplate);
                    console.log("Loaded Template Config:", templateConfig);
                } else {
                    console.warn("No Template Config found in localStorage");
                }
            } catch (e) {
                console.error("Error parsing PPT template config", e);
            }

            const ganttEl = document.getElementById('gantt-chart-area');
            const isSmartDesign = localStorage.getItem('PPT_SMART_DESIGN_ENABLED') === 'true';

            if (!ganttEl) {
                // Even if no visual chart, we can generate the Native Roadmap if we have tasks
                if (confirm("Visualização do Cronograma não encontrada (Necessário estar na aba 'Contronograma' para captura de imagem). Deseja gerar a proposta apenas com o Roadmap Macro nativo?")) {
                    await generateProposalPpt(project, {
                        includeGantt: false,
                        tasks: projectTasks,
                        templateConfig,
                        smartDesign: isSmartDesign,
                        onStatusUpdate: (msg) => setGenerationStatus(msg)
                    });
                }
            } else {
                // Slight delay to ensure render
                await generateProposalPpt(project, {
                    includeGantt: true,
                    ganttElementId: 'gantt-chart-area',
                    tasks: projectTasks,
                    viewMode: ganttViewMode,
                    templateConfig: templateConfig,
                    smartDesign: isSmartDesign,
                    onStatusUpdate: (msg) => setGenerationStatus(msg)
                });
            }

        } catch (e: any) {
            console.error(e);
            alert("Erro ao gerar proposta: " + e.message);
        } finally {
            setIsGeneratingPPT(false); // Stop Loading
        }
    };

    const handleUpdateClient = async (updatedClient: any) => {
        // ...
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
        if (currentView === 'global_projects') return 'my_projects';
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
        // If global projects (no client), we might want to aggregate ALL tasks? 
        // For now, let's keep this focused on Client Reports logic.
        // If parsedViewType is reports and NO client selected, we might be in trouble or it renders empty.
        // But 'reports' is only reachable via client_... currently.

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

    const currentProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

    const stats = useMemo(() => {
        return calculateProjectStats(projectTasks, resources, currentProject);
    }, [projectTasks, resources, currentProject]);

    // Filter projects for the selected client (Strategic)
    // Filter projects for the selected client (Strategic)
    const clientProjects = selectedClientId
        ? projects.filter(p => {
            if (p.clientId !== selectedClientId) return false;
            // Strict Hierarchy: Project Year must match Selected Fiscal Year
            const pYear = new Date(p.startDate).getFullYear().toString();
            return pYear === currentFiscalYear;
        })
        : (parsedViewType === 'my_projects' ? projects.filter(p => new Date(p.startDate).getFullYear().toString() === currentFiscalYear) : []);

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


    const handleApplyEstimate = async (estimate: EstimateResult, onProgress?: (status: string) => void) => {
        if (!selectedProjectId) return;

        onProgress?.('Inicializando cronograma...');
        let projectStart = getNextWorkingDay(new Date());
        const prefix = `ai-${Date.now()}-`;
        const idMap: Record<string, string> = {};
        // const roleMap: Record<string, string> = {};

        onProgress?.('Definindo fases do projeto...');
        // 0. Prepare Hybrid Phases
        const phaseIds = {
            planning: `${prefix}phase-plan`,
            development: `${prefix}phase-dev`,
            testing: `${prefix}phase-test`,
            rollout: `${prefix}phase-rollout`,
            management: `${prefix}phase-mgmt`
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
            },
            {
                id: phaseIds.management,
                projectId: selectedProjectId,
                name: "Gestão do Projeto (GP)",
                type: "project",
                start: projectStart,
                end: addDays(projectStart, 25), // Spans full project usually
                progress: 0,
                parent: null,
                dependencies: [],
                styles: { backgroundColor: '#8b5cf6', progressColor: '#c4b5fd' }, // Purple
                order: -100 // Visual Preference: Top of the list? Or Bottom? User said "outside the 4 parent tasks". Let's put it at the very top (-100) or very bottom (400). Top is usually better for visibility.
            }
        ];

        // ID Mapping (AI ID -> System ID)
        estimate.tasks.forEach(t => {
            idMap[t.id] = prefix + t.id;
        });

        // 2. Build AI Tasks (Children)
        onProgress?.(`Estruturando ${estimate.tasks.length} tarefas inteligentes...`);
        const aiTasks: Task[] = estimate.tasks.map((t, index) => {
            const start = addBusinessDays(projectStart, t.start_offset_days || 0);
            const duration = Math.max(1, t.duration_days || 1);
            const end = addBusinessDays(start, duration);

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
                assignedResource: t.role || '',
                hourlyRate: t.hourly_rate || 0,
                styles: { progressColor: '#8b5cf6', backgroundColor: '#8b5cf6' },
                order: index + 500 // Start after phases
            } as Task;
        });

        // 3. Merge & Sort Logic for Visual Hierarchy
        // Group children by their assigned parent ID
        const childrenByParent: Record<string, Task[]> = {};
        aiTasks.forEach(task => {
            if (task.parent) {
                if (!childrenByParent[task.parent]) childrenByParent[task.parent] = [];
                childrenByParent[task.parent].push(task);
            }
        });

        const orderedTasks: Task[] = [];
        let currentOrder = 0;

        // Iterate through Phases in order
        for (const phase of phases) {

            // 2. Add Phase Children (if any)
            const children = childrenByParent[phase.id] || [];

            // AUTOMATICALLY ADJUST PHASE DATES TO COVER CHILDREN
            if (children.length > 0) {
                let minStart = children[0].start;
                let maxEnd = children[0].end;

                children.forEach(child => {
                    if (child.start < minStart) minStart = child.start;
                    if (child.end > maxEnd) maxEnd = child.end;
                });

                phase.start = minStart;
                phase.end = maxEnd;
            }

            // 1. Add Phase (Updated)
            orderedTasks.push({ ...phase, order: currentOrder++ });

            children.forEach(child => {
                orderedTasks.push({ ...child, order: currentOrder++ });
            });
        }

        // 3. Add any orphans (shouldn't exist with current logic, but safe fallback)
        const orphanTasks = aiTasks.filter(t => !t.parent || !Object.values(phaseIds).includes(t.parent));
        orphanTasks.forEach(orphan => {
            orderedTasks.push({ ...orphan, order: currentOrder++ });
        });

        // 4. Save
        onProgress?.('Salvando tarefas no banco de dados...');
        for (const task of orderedTasks) {
            await onAddTaskWrapper(task);
        }

        // 4. Update Project Metadata with Derived Team Structure
        // SINGLE SOURCE OF TRUTH: The Tasks themselves.
        const derivedTeamMap = new Map<string, ProjectTeamMember>();

        orderedTasks.forEach(t => {
            if (t.type === 'task' && t.assignedResource) {
                const roleName = t.assignedResource.trim();
                if (!roleName) return;

                const rate = t.hourlyRate || 0;

                if (!derivedTeamMap.has(roleName)) {
                    derivedTeamMap.set(roleName, {
                        role: roleName,
                        quantity: 1,
                        hourlyRate: rate,
                        responsibilities: []
                    });
                } else {
                    const member = derivedTeamMap.get(roleName)!;
                    member.quantity += 1;
                    // Trust the task's rate. If we have a non-zero rate, ensure it's captured.
                    if (rate > 0 && (!member.hourlyRate || member.hourlyRate === 0)) {
                        member.hourlyRate = rate;
                    }
                }
            }
        });

        // Try to enrich responsibilities from the AI's structural suggestion if names match
        if (estimate.team_structure) {
            estimate.team_structure.forEach(aiMember => {
                const aiRole = aiMember.role.trim();
                // We only care if this role actually exists in the tasks
                if (derivedTeamMap.has(aiRole)) {
                    const member = derivedTeamMap.get(aiRole)!;
                    if (aiMember.responsibilities && aiMember.responsibilities.length > 0) {
                        member.responsibilities = aiMember.responsibilities;
                    }
                }
            });
        }

        const finalTeamStructure = Array.from(derivedTeamMap.values());

        if (selectedProjectId) {
            onProgress?.('Atualizando documentação e contexto do projeto...');
            const updates = {
                aiConfidence: estimate.confidence_score,
                aiSummary: estimate.description,
                documentation: estimate.documentation,
                technicalPremises: estimate.strategic_planning?.technical_premises,
                clientResponsibilities: estimate.strategic_planning?.client_responsibilities,
                raciMatrix: estimate.strategic_planning?.raci_matrix,
                teamStructure: finalTeamStructure, // NOW DERIVED FROM TASKS
                scopeDelta: estimate.scope_delta,
            };
            if (isConnected) {
                await ProjectService.updateProject(selectedProjectId, updates);
            } else {
                setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, ...updates } : p));
            }
        }
        onProgress?.('Finalizado com sucesso!');


        setIsEstimateModalOpen(false);
    };

    const handleEstimateClick = async () => {
        if (projectTasks.length > 0) {
            if (window.confirm("Já existem tarefas criadas para este projeto. Deseja excluir todo planejamento atual e gerar um novo?")) {
                if (isConnected) {
                    try {
                        await ProjectService.deleteAllTasksForProject(selectedProjectId);
                        // Reset all project fields
                        await ProjectService.updateProject(selectedProjectId, {
                            documentation: undefined,
                            teamStructure: [],
                            monthlyCosts: [],
                            otherCosts: [],
                            technicalPremises: [],
                            clientResponsibilities: [],
                            raciMatrix: [],
                            scopeDelta: undefined,
                            aiSummary: undefined,
                            aiConfidence: undefined,
                            architectureImage: undefined
                        });
                    } catch (e) {
                        console.error("Error clearing tasks", e);
                        alert("Erro ao limpar tarefas antigas. Verifique a conexão.");
                        return;
                    }
                } else {
                    setDbTasks(prev => prev.filter(t => t.projectId !== selectedProjectId));
                    // Reset local project fields
                    setProjects(prev => prev.map(p => p.id === selectedProjectId ? {
                        ...p,
                        documentation: undefined,
                        teamStructure: [],
                        monthlyCosts: [],
                        otherCosts: [],
                        technicalPremises: [],
                        clientResponsibilities: [],
                        raciMatrix: [],
                        scopeDelta: undefined,
                        aiSummary: undefined,
                        aiConfidence: undefined,
                        architectureImage: undefined
                    } : p));
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

    const handleSplitTask = async (originalTask: Task, factor: number) => {
        if (factor < 2) return;

        const totalDuration = countBusinessDays(originalTask.start, originalTask.end);
        const newDurationDays = Math.max(1, Math.floor(totalDuration / factor));
        const newEndDate = addBusinessDays(originalTask.start, newDurationDays);

        // 2. Update Original Task (Part 1)
        const updatedOriginal = {
            ...originalTask,
            name: `${originalTask.name} (Parte 1)`,
            end: newEndDate
        };
        await onTaskChangeWrapper(updatedOriginal);

        // 3. Create Copies
        let previousId = originalTask.id;
        for (let i = 2; i <= factor; i++) {
            const newTask: Task = {
                ...originalTask,
                id: self.crypto.randomUUID(),
                name: `${originalTask.name} (Parte ${i})`,
                start: originalTask.start,
                end: newEndDate,
                progress: 0,
                // Use fractional order to insert immediately after without reordering everything
                // Assuming integer orders are used generally. Max 100 parts is safe with 0.001
                order: (originalTask.order || 0) + (0.01 * (i - 1)),
                dependencies: originalTask.dependencies ? [...originalTask.dependencies] : [],
                styles: { ...originalTask.styles, progressColor: '#f97316', backgroundColor: '#f97316' }
            };

            // Pass previousId to insert specifically after the last part
            // This ensures optimistic UI (offline) works correctly
            await onAddTaskWrapper(newTask, previousId);
            previousId = newTask.id;
        }

        setIsTaskModalOpen(false);
    };

    const handleUpdateTeam = async (newTeam: ProjectTeamMember[]) => {
        if (!selectedProjectId) return;
        const activeProject = projects.find(p => p.id === selectedProjectId);
        if (activeProject) {
            // 1. Update Project Structure locally
            const updatedProject = { ...activeProject, teamStructure: newTeam };
            setProjects(prev => prev.map(p => p.id === selectedProjectId ? updatedProject : p));

            // 2. Cascade Update to Tasks
            // Find tasks that need updating based on role match to ensure consistency
            const updates: { id: string; data: Partial<Task> }[] = [];

            // Map: Role Name -> Hourly Rate
            const roleRateMap = new Map<string, number>();
            newTeam.forEach(m => {
                if (m.hourlyRate !== undefined) roleRateMap.set(m.role, m.hourlyRate);
            });
            // Iterate tasks for this project
            const currentTasks = dbTasks.filter(t => t.projectId === selectedProjectId);

            currentTasks.forEach(task => {
                // Check 'assignedResource' (which holds the role name in our AI flow)
                const roleKey = task.assignedResource;

                if (roleKey && roleRateMap.has(roleKey)) {
                    const newRate = roleRateMap.get(roleKey);
                    // Only update if rate is different to minimize DB writes
                    if (newRate !== undefined && task.hourlyRate !== newRate) {
                        updates.push({
                            id: task.id,
                            data: { hourlyRate: newRate }
                        });
                    }
                }
            });

            if (isConnected) {
                // Persist Team Structure
                await ProjectService.updateProject(selectedProjectId, { teamStructure: newTeam });

                // Persist Task Updates (Batch)
                if (updates.length > 0) {
                    await ProjectService.batchUpdateTasks(updates);
                }
            }

            // 3. Optimistic UI Update for Tasks
            if (updates.length > 0) {
                setDbTasks(prev => {
                    const map = new Map(updates.map(u => [u.id, u.data]));
                    return prev.map(t => map.has(t.id) ? { ...t, ...map.get(t.id) } : t);
                });
            }
        }
    };

    if (authLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!user) return <LoginView />;

    if (!user.isApproved && !isAdmin) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center border border-yellow-200">
                    <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                        <Lock className="text-yellow-600" size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso Pendente</h2>
                    <p className="text-gray-600 mb-6">
                        Sua conta ({user.email}) foi criada, mas aguarda aprovação do administrador Master.
                    </p>
                    <button
                        onClick={logout}
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-sm hover:underline flex items-center justify-center gap-2"
                    >
                        <LogOut size={16} />
                        Sair e tentar outra conta
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
            <Sidebar
                activeView={currentView}
                onNavigate={setCurrentView}
                className="hidden lg:flex"
                clients={clients}
                projects={projects}
                currentUser={user}
            />
            <MobileMenu
                activeView={currentView}
                onNavigate={setCurrentView}
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                currentUser={user}
            />

            <div className="flex-1 flex flex-col min-w-0">
                <TopMenuBar
                    onImport={handleImportProject}
                    onExport={selectedProjectId ? handleExportProject : undefined}
                    onExportProposal={selectedProjectId ? handleExportProposal : undefined}
                />
                {!isOnline && (
                    <div className="bg-red-600 text-white px-4 py-3 text-center text-sm font-bold flex justify-center items-center gap-2 shadow-md animate-in slide-in-from-top-2 z-50 transition-all">
                        <CloudOff size={20} />
                        <span>MODO OFFLINE: Você está trabalhando sem internet. Suas alterações foram salvas localmente e serão enviadas ao servidor automaticamente assim que a conexão retornar.</span>
                    </div>
                )}
                {/* Header */}
                <header className="bg-white border-b border-gray-200 h-12 px-4 flex items-center justify-between z-40">
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

                    <div className="flex items-center gap-6 relative">
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="flex items-center gap-2 hover:bg-gray-100 p-1.5 rounded-lg transition-all outline-none focus:ring-2 focus:ring-indigo-500 group"
                        >
                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm group-hover:shadow-md transition-shadow">
                                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <span className="text-sm font-medium text-gray-700 hidden md:block max-w-[150px] truncate">
                                {user?.displayName || 'Usuário'}
                            </span>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isProfileOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsProfileOpen(false)}
                                ></div>
                                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                                    <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50">
                                        <p className="text-sm font-bold text-gray-900 truncate">{user?.displayName || 'Usuário'}</p>
                                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                                    </div>
                                    <div className="p-2">
                                        <button
                                            onClick={() => {
                                                logout();
                                                setIsProfileOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors font-medium"
                                        >
                                            <LogOut size={16} />
                                            Sair da conta
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 p-2 lg:p-8 overflow-y-auto">

                    {/* View Title Header */}
                    <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-6 gap-4 md:gap-0">
                        <div className="flex-1 md:mr-6 text-center md:text-left">
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
                                    <div className="mt-3 w-full animate-in fade-in slide-in-from-top-2 hidden md:block">
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

                                        <button
                                            onClick={() => setIsStabilizationModalOpen(true)}
                                            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-amber-100 transition-all hover:scale-105 active:scale-95 text-xs lg:text-sm"
                                            title="Estabilizar Cronograma (Atrasos e Pendências)"
                                        >
                                            <Activity size={16} />
                                            Estabilizar
                                        </button>

                                        {(isAdmin || user?.canUseAI) && (
                                            <button
                                                onClick={handleEstimateClick}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-indigo-100 transition-all hover:scale-105 active:scale-95 text-xs lg:text-sm"
                                                title="Estimar com IA"
                                            >
                                                <Sparkles size={16} />
                                                Estimar
                                            </button>
                                        )}
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
                                setCurrentView(`client_${clientId}_my_projects`);
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
                                onShowClientBlockages={() => setIsClientBlockageModalOpen(true)}
                            />
                            <div className="flex items-end mb-0 overflow-x-auto no-scrollbar pl-1">
                                <button
                                    onClick={() => setGanttTab('schedule')}
                                    className={`flex items-center gap-2 px-4 py-2 lg:px-6 lg:py-3 text-xs lg:text-sm font-bold rounded-t-lg transition-all border border-b-0 relative ${ganttTab === 'schedule'
                                        ? 'bg-white text-indigo-600 border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] z-10 scale-105 origin-bottom'
                                        : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100 -mr-2 lg:-mr-0'
                                        }`}
                                >
                                    Cronograma
                                </button>
                                <button
                                    onClick={() => setGanttTab('tasks')}
                                    className={`flex items-center gap-2 px-4 py-2 lg:px-6 lg:py-3 text-xs lg:text-sm font-bold rounded-t-lg transition-all border border-b-0 relative ${ganttTab === 'tasks'
                                        ? 'bg-white text-indigo-600 border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] z-10 scale-105 origin-bottom'
                                        : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100 -mr-2 lg:-mr-0'
                                        }`}
                                >
                                    Lista de Tarefas
                                </button>

                                <button
                                    onClick={() => setGanttTab('context')}
                                    className={`flex items-center gap-2 px-4 py-2 lg:px-6 lg:py-3 text-xs lg:text-sm font-bold rounded-t-lg transition-all border border-b-0 relative ${ganttTab === 'context'
                                        ? 'bg-white text-indigo-600 border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] z-10 scale-105 origin-bottom'
                                        : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                                        }`}
                                >
                                    <Target size={16} />
                                    Contexto
                                </button>

                                <button
                                    onClick={() => setGanttTab('premises')}
                                    className={`flex items-center gap-2 px-4 py-2 lg:px-6 lg:py-3 text-xs lg:text-sm font-bold rounded-t-lg transition-all border border-b-0 relative ${ganttTab === 'premises'
                                        ? 'bg-white text-indigo-600 border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] z-10 scale-105 origin-bottom'
                                        : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                                        }`}
                                >
                                    <CheckSquare size={16} />
                                    Premissas & RACI
                                </button>
                                <button
                                    onClick={() => setGanttTab('team')}
                                    className={`flex items-center gap-2 px-4 py-2 lg:px-6 lg:py-3 text-xs lg:text-sm font-bold rounded-t-lg transition-all border border-b-0 relative ${ganttTab === 'team'
                                        ? 'bg-white text-indigo-600 border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] z-10 scale-105 origin-bottom'
                                        : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                                        }`}
                                >
                                    <Users size={16} />
                                    EQUIPE
                                </button>

                                <button
                                    onClick={() => setGanttTab('monthly_costs')}
                                    className={`flex items-center gap-2 px-4 py-2 lg:px-6 lg:py-3 text-xs lg:text-sm font-bold rounded-t-lg transition-all border border-b-0 relative ${ganttTab === 'monthly_costs'
                                        ? 'bg-white text-indigo-600 border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] z-10 scale-105 origin-bottom'
                                        : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                                        }`}
                                >
                                    <DollarSign size={16} />
                                    Declaração Mensal
                                </button>
                                {/* Bottom border filler */}
                                <div className="flex-1 border-b border-gray-200 h-px"></div>
                            </div>

                            {ganttTab === 'schedule' && (
                                <div className="bg-white p-0 rounded-xl rounded-tl-none shadow-sm border border-gray-100 h-[650px] flex flex-col mt-0 gantt-landscape-container">
                                    <div className="flex-1 overflow-hidden relative">
                                        <GanttChart
                                            tasks={projectTasks}
                                            onTaskChange={onTaskChangeWrapper}
                                            onEditTask={(task) => { setEditingTask(task); setInsertAfterTaskId(undefined); setIsTaskModalOpen(true); }}
                                            onAddTask={handleCreateClick}
                                            onDeleteTask={handleDeleteTask}
                                            onReorderTasks={handleReorderTasks}
                                            onIndent={handleIndentTask}
                                            onOutdent={handleOutdentTask}
                                            onViewModeChange={setGanttViewMode}
                                            isModalOpen={isTaskModalOpen || isStabilizationModalOpen || isEstimateModalOpen}
                                            onLandscapeModeChange={setIsGanttLandscape}
                                            aiConfidence={projects.find(p => p.id === selectedProjectId)?.aiConfidence}
                                        />
                                    </div>
                                </div>
                            )}

                            {ganttTab === 'tasks' && (
                                <TaskListView
                                    tasks={projectTasks}
                                    resources={resources}
                                    onEditTask={(task) => { setEditingTask(task); setInsertAfterTaskId(undefined); setIsTaskModalOpen(true); }}
                                    isConnected={isConnected}
                                />
                            )}

                            {ganttTab === 'context' && (() => {
                                const activeProject = projects.find(p => p.id === selectedProjectId);
                                return (
                                    <div className="bg-gray-50/50 p-6 rounded-xl border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300 h-[650px] overflow-y-auto custom-scrollbar">
                                        {activeProject?.documentation ? (
                                            <div className="max-w-6xl mx-auto space-y-6">

                                                {/* Header Banner */}
                                                <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-lg mb-8">
                                                    <h3 className="text-2xl font-bold flex items-center gap-3">
                                                        <FileText size={28} />
                                                        Documentação do Projeto
                                                    </h3>
                                                    <p className="text-indigo-100 mt-2 max-w-2xl">
                                                        Visão estratégica, arquitetura técnica e plano de qualidade definidos pela Inteligência Artificial.
                                                    </p>
                                                </div>



                                                {/* Dynamic Documentation Grid */}
                                                <div className="grid grid-cols-1 gap-6">


                                                    {(() => {
                                                        const DOC_ORDER = ['context_overview', 'technical_solution', 'implementation_steps', 'testing_strategy', 'scope', 'non_scope'];
                                                        const existingKeys = Object.keys(activeProject.documentation);
                                                        const orderedKeys = DOC_ORDER.filter(key => existingKeys.includes(key));
                                                        const otherKeys = existingKeys.filter(key => !DOC_ORDER.includes(key));
                                                        const finalKeys = [...orderedKeys, ...otherKeys];

                                                        return finalKeys.map((key) => {
                                                            const content = activeProject.documentation ? activeProject.documentation[key] : '';
                                                            const title = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

                                                            let styleClass = "border-gray-100";
                                                            let iconColor = "bg-gray-50 text-gray-600";
                                                            let IconComponent = FileText;

                                                            if (key === 'context_overview') {
                                                                styleClass = "border-indigo-100";
                                                                iconColor = "bg-indigo-50 text-indigo-600";
                                                                IconComponent = Target;
                                                            } else if (key === 'technical_solution') {
                                                                styleClass = "border-blue-100";
                                                                iconColor = "bg-blue-50 text-blue-600";
                                                                IconComponent = Database;
                                                            } else if (key === 'implementation_steps') {
                                                                styleClass = "border-green-100";
                                                                iconColor = "bg-green-50 text-green-600";
                                                                IconComponent = Activity;
                                                            } else if (key === 'testing_strategy') {
                                                                styleClass = "border-teal-100";
                                                                iconColor = "bg-teal-50 text-teal-600";
                                                                IconComponent = CheckCircle;
                                                            }

                                                            if (editingDocKey === key) {
                                                                return (
                                                                    <div key={key} className="col-span-1">
                                                                        <MarkdownEditor
                                                                            label={title}
                                                                            initialValue={content}
                                                                            onSave={(val) => handleSaveDoc(key, val)}
                                                                            onCancel={() => setEditingDocKey(null)}
                                                                        />
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <React.Fragment key={key}>
                                                                    <div className={`bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow ${styleClass} group relative`}>
                                                                        {/* Edit Controls */}
                                                                        <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-lg border border-gray-100 shadow-sm p-1">
                                                                            <button
                                                                                onClick={() => setEditingDocKey(key)}
                                                                                className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                                                                title="Editar Bloco"
                                                                            >
                                                                                <Pencil size={14} />
                                                                            </button>
                                                                            <div className="w-px h-4 bg-gray-200" />
                                                                            <button
                                                                                onClick={() => handleDeleteDoc(key)}
                                                                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                                                title="Remover Bloco"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </div>

                                                                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                                                                            <div className={`p-2 rounded-lg ${iconColor}`}>
                                                                                <IconComponent size={24} />
                                                                            </div>
                                                                            <h4 className="text-lg font-bold text-gray-900">{title}</h4>
                                                                        </div>
                                                                        <MarkdownRenderer content={content} className="text-sm" />
                                                                    </div>

                                                                    {/* Insert Architecture Diagram AFTER Technical Solution */}
                                                                    {key === 'technical_solution' && (
                                                                        <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow relative">
                                                                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                                                                        <ImageIcon size={24} />
                                                                                    </div>
                                                                                    <h4 className="text-lg font-bold text-gray-900">Diagrama de Arquitetura</h4>
                                                                                </div>
                                                                                {activeProject.architectureImage && (
                                                                                    <button
                                                                                        onClick={handleGenerateArchitecture}
                                                                                        disabled={isGeneratingArchitecture}
                                                                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                                        title="Regerar Imagem"
                                                                                    >
                                                                                        {isGeneratingArchitecture ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                                                                    </button>
                                                                                )}
                                                                            </div>

                                                                            <div className="flex flex-col items-center justify-center min-h-[300px] bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-4">
                                                                                {activeProject.architectureImage ? (
                                                                                    <img
                                                                                        src={activeProject.architectureImage}
                                                                                        alt="Architecture Diagram"
                                                                                        className="w-full h-auto rounded-lg shadow-sm object-contain max-h-[500px]"
                                                                                    />
                                                                                ) : (
                                                                                    <div className="text-center max-w-md">
                                                                                        <ImageIcon className="mx-auto text-gray-300 mb-4" size={48} />
                                                                                        <h5 className="text-gray-900 font-bold mb-2">Nenhum diagrama gerado</h5>
                                                                                        <p className="text-gray-500 text-sm mb-6">
                                                                                            Utilize a IA para visualizar a arquitetura técnica baseada na documentação do projeto.
                                                                                        </p>
                                                                                        <button
                                                                                            onClick={handleGenerateArchitecture}
                                                                                            disabled={isGeneratingArchitecture}
                                                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm font-medium"
                                                                                        >
                                                                                            {isGeneratingArchitecture ? (
                                                                                                <>
                                                                                                    <Loader2 className="animate-spin" size={16} /> Gerando Diagrama...
                                                                                                </>
                                                                                            ) : (
                                                                                                <>
                                                                                                    <Sparkles size={16} /> Gerar Arquitetura com IA
                                                                                                </>
                                                                                            )}
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        });
                                                    })()}
                                                </div>

                                                {/* Team Structure Section */}
                                                {activeProject.teamStructure && activeProject.teamStructure.length > 0 && (
                                                    <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm">
                                                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                                                            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                                                                <Users size={24} />
                                                            </div>
                                                            <h4 className="text-lg font-bold text-gray-900">Estrutura de Equipe Sugerida</h4>
                                                        </div>
                                                        <div className="overflow-hidden rounded-lg border border-gray-200">
                                                            <table className="min-w-full divide-y divide-gray-200">
                                                                <thead className="bg-gray-50">
                                                                    <tr>
                                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profissional / Papel</th>
                                                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qtd</th>
                                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsabilidades Chave</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="bg-white divide-y divide-gray-200">
                                                                    {activeProject.teamStructure.map((member, i) => (
                                                                        <tr key={i}>
                                                                            <td className="px-4 py-3 text-sm font-medium text-indigo-900">{member.role}</td>
                                                                            <td className="px-4 py-3 text-sm text-center text-gray-600">
                                                                                <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 rounded-full font-bold text-xs">{member.quantity}</span>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {member.responsibilities.map((resp, j) => (
                                                                                        <span key={j} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                                                                                            {resp}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}

                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-4">
                                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                                                    <FileText size={40} className="text-gray-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xl font-bold text-gray-700">Documentação não disponível</p>
                                                    <p className="text-sm mt-2 max-w-sm mx-auto text-gray-400">
                                                        Este projeto não possui dados de contexto gerados pela IA. Crie uma nova estimativa para gerar este conteúdo automaticamente.
                                                    </p>
                                                </div>
                                                {(isAdmin || user?.canUseAI) && (
                                                    <button
                                                        onClick={handleEstimateClick}
                                                        className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2"
                                                    >
                                                        <Sparkles size={16} />
                                                        Gerar Documentação com IA
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {ganttTab === 'premises' && (() => {
                                const activeProject = projects.find(p => p.id === selectedProjectId);
                                return (
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        {(activeProject?.technicalPremises || activeProject?.clientResponsibilities || activeProject?.raciMatrix) ? (
                                            <div className="space-y-8 max-w-5xl mx-auto">
                                                {/* TECH PREMISES */}
                                                {/* TECH PREMISES */}
                                                {activeProject.technicalPremises && activeProject.technicalPremises.length > 0 && (
                                                    <section className="relative group -mx-2 p-2 rounded-xl transition-colors hover:bg-gray-50/80">
                                                        {editingPremises ? (
                                                            <div className="bg-white rounded-xl shadow-lg ring-1 ring-black/5 p-1">
                                                                <MarkdownEditor
                                                                    label="Editando Premissas Técnicas"
                                                                    initialValue={activeProject.technicalPremises.map(p => `- ${p}`).join('\n')}
                                                                    onSave={handleSavePremises}
                                                                    onCancel={() => setEditingPremises(false)}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <h4 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                                                        Premissas Técnicas
                                                                    </h4>
                                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={() => setEditingPremises(true)}
                                                                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                            title="Editar Premissas"
                                                                        >
                                                                            <Pencil size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    {activeProject.technicalPremises.map((premise, idx) => (
                                                                        <li key={idx} className="bg-amber-50 text-amber-900 p-3 rounded-lg border border-amber-100 flex items-start gap-2 text-sm">
                                                                            <div className="mt-1 min-w-[6px] h-1.5 rounded-full bg-amber-400" />
                                                                            {premise}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </>
                                                        )}
                                                    </section>
                                                )}

                                                {/* CLIENT RESPONSIBILITIES */}
                                                {activeProject.clientResponsibilities && activeProject.clientResponsibilities.length > 0 && (
                                                    <section>
                                                        <h4 className="font-bold text-gray-900 mb-3 text-lg">Responsabilidades do Cliente</h4>
                                                        <div className="overflow-hidden rounded-xl border border-gray-200">
                                                            <table className="w-full text-sm text-left">
                                                                <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                                                                    <tr>
                                                                        <th className="px-4 py-3">Ação Necessária</th>
                                                                        <th className="px-4 py-3">Prazo Limite</th>
                                                                        <th className="px-4 py-3 text-center">Impacto</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100">
                                                                    {activeProject.clientResponsibilities.map((resp, idx) => (
                                                                        <tr key={idx} className="hover:bg-gray-50/50">
                                                                            <td className="px-4 py-3 font-medium text-gray-800">{resp.action_item}</td>
                                                                            <td className="px-4 py-3 text-gray-600">{resp.deadline_description}</td>
                                                                            <td className="px-4 py-3 text-center">
                                                                                <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold border ${resp.impact === 'BLOCKER' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                                    resp.impact === 'HIGH' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                                                        'bg-blue-50 text-blue-700 border-blue-200'
                                                                                    }`}>
                                                                                    {resp.impact}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </section>
                                                )}

                                                {/* RACI */}
                                                {activeProject.raciMatrix && activeProject.raciMatrix.length > 0 && (
                                                    <section>
                                                        <h4 className="font-bold text-gray-900 mb-3 text-lg">Matriz RACI Sugerida</h4>
                                                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                                                            <table className="w-full text-sm text-center">
                                                                <thead className="bg-gray-800 text-white font-medium">
                                                                    <tr>
                                                                        <th className="px-4 py-3 text-left w-1/3">Atividade / Entrega</th>
                                                                        <th className="px-2 py-3 w-[15%] bg-gray-700" title="Responsible (Quem Executa)">R</th>
                                                                        <th className="px-2 py-3 w-[15%] bg-gray-700" title="Accountable (Quem Aprova)">A</th>
                                                                        <th className="px-2 py-3 w-[15%] bg-gray-700" title="Consulted (Quem é Consultado)">C</th>
                                                                        <th className="px-2 py-3 w-[15%] bg-gray-700" title="Informed (Quem é Informado)">I</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-200">
                                                                    {activeProject.raciMatrix.map((row, idx) => (
                                                                        <tr key={idx} className="hover:bg-gray-50">
                                                                            <td className="px-4 py-3 text-left font-medium text-gray-900">{row.activity_group}</td>
                                                                            <td className="px-2 py-3 text-gray-600 bg-blue-50/30">{row.responsible}</td>
                                                                            <td className="px-2 py-3 text-gray-600 font-semibold bg-indigo-50/30">{row.accountable}</td>
                                                                            <td className="px-2 py-3 text-gray-500">{row.consulted}</td>
                                                                            <td className="px-2 py-3 text-gray-400">{row.informed}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </section>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center py-16 text-gray-500">
                                                <CheckSquare size={48} className="mx-auto mb-4 text-gray-300" />
                                                <p className="text-lg font-medium">Planejamento Estratégico não encontrado</p>
                                                <p className="text-sm mt-2">Gere uma nova estimativa com IA para obter a Matriz RACI e Premissas.</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {ganttTab === 'team' && (() => {
                                const activeProject = projects.find(p => p.id === selectedProjectId);
                                if (!activeProject) return null;
                                return (
                                    <ProjectTeamTab
                                        project={activeProject}
                                        tasks={projectTasks}
                                        onUpdateTeam={handleUpdateTeam}
                                    />
                                );
                            })()}

                            {ganttTab === 'monthly_costs' && (() => {
                                const activeProject = projects.find(p => p.id === selectedProjectId);
                                if (!activeProject) return null;
                                return (
                                    <ProjectMonthlyCostsTab
                                        project={activeProject}
                                        tasks={projectTasks}
                                    />
                                );
                            })()}
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

            <StabilizationModal
                isOpen={isStabilizationModalOpen}
                onClose={() => setIsStabilizationModalOpen(false)}
                tasks={projectTasks}
                onUpdateTasks={async (updates) => {
                    const formattedUpdates = updates.map(u => ({ id: u.id, data: u.changes }));

                    if (isConnected) {
                        try {
                            await ProjectService.batchUpdateTasks(formattedUpdates);
                            // Optimistic update locally
                            setDbTasks(prev => {
                                const map = new Map(updates.map(u => [u.id, u.changes]));
                                return prev.map(t => map.has(t.id) ? { ...t, ...map.get(t.id) } : t);
                            });
                        } catch (e) {
                            console.error("Batch update failed", e);
                            alert("Erro ao salvar correções.");
                        }
                    } else {
                        // Offline
                        setDbTasks(prev => {
                            const map = new Map(updates.map(u => [u.id, u.changes]));
                            return prev.map(t => map.has(t.id) ? { ...t, ...map.get(t.id) } : t);
                        });
                    }
                }}
            />

            <ClientBlockageListModal
                isOpen={isClientBlockageModalOpen}
                onClose={() => setIsClientBlockageModalOpen(false)}
                tasks={projectTasks}
                resources={resources}
            />

            {
                isTaskModalOpen && (
                    <TaskForm
                        task={editingTask}
                        forceLandscape={isGanttLandscape}
                        allTasks={tasks}
                        projectTeam={projects.find(p => p.id === selectedProjectId)?.teamStructure}
                        resources={resources}
                        onSave={handleSaveTask}
                        onCancel={() => setIsTaskModalOpen(false)}
                        onSplit={handleSplitTask}
                    />
                )
            }
            <EstimateModal
                isOpen={isEstimateModalOpen}
                onClose={() => setIsEstimateModalOpen(false)}
                onApplyEstimate={handleApplyEstimate}
                clientContext={clients.find(c => c.id === selectedClientId)?.context}
                knowledgeBase={clientKnowledge}
            />

            {/* Smart PPT Generation Loader */}
            {isGeneratingPPT && (
                <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-[100] flex flex-col items-center justify-center">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl border border-indigo-100 flex flex-col items-center max-w-md text-center animate-in fade-in zoom-in duration-300">
                        <div className="relative mb-6">
                            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-indigo-600 animate-pulse" size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Gerando Proposta Inteligente</h3>
                        <p className="text-gray-500 mb-6">
                            A IA está analisando o contexto, criando designs e otimizando o conteúdo dos slides. Isso pode levar alguns instantes.
                        </p>
                        <div className="flex bg-indigo-50 px-4 py-2 rounded-lg text-indigo-700 text-sm font-medium items-center gap-2">
                            <Loader2 size={16} className="animate-spin" />
                            {generationStatus || 'Processando slides...'}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

export default App;
