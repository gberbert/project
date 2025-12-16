export interface Resource {
    id: string;
    name: string;
    role: string;
    avatarUrl?: string;
    hourlyRate: number;
}

export type TaskType = 'task' | 'milestone' | 'project';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';

export interface Task {
    id: string;
    parent: string | null; // Strict Nullable
    type: TaskType;
    name: string;
    start: Date;
    end: Date;
    progress: number;
    realStart?: Date;
    realEnd?: Date;
    order?: number;
    dependencies: string[]; // Strict array
    status?: TaskStatus;
    isExpanded?: boolean;

    // Legacy/UI props
    resourceId?: string;
    assignedResource?: string; // Nome direto (ex: AI suggested role) sem criar Resource
    hourlyRate?: number; // Valor/Hora específico da tarefa
    projectId?: string;
    isDisabled?: boolean;
    styles?: {
        backgroundColor?: string;
        backgroundSelectedColor?: string;
        progressColor?: string;
    };
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    startDate: Date;
    createdAt: Date;
    ownerId: string; // User UID
    clientId?: string; // Link to Client
    // Financial Fields
    grossValue?: number; // Valor Bruto de Venda
    taxRate?: number; // Imposto aplicado (%)
    margin?: number; // Contract Margem (%)
    deliveryDeviation?: number; // Desvio de Deleivery (%)
    netValue?: number; // Valor Líquido
    aiConfidence?: number; // 0-1 Score
    aiSummary?: string; // Breve descrição da IA
}

// Helper for UI view
export interface TaskWithCost extends Task {
    cost: number;
}

export * from './client';
