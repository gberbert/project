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

// Strategic / AI Planning Types
export interface ClientResponsibility {
    action_item: string;
    deadline_description: string;
    impact: 'BLOCKER' | 'HIGH' | 'LOW';
}

export interface RaciItem {
    activity_group: string;
    responsible: string;
    accountable: string;
    consulted: string;
    informed: string;
}

export interface ProjectTeamMember {
    role: string;
    quantity: number;
    responsibilities: string[];
    hourlyRate?: number; // Sugestão de custo por hora
}

// Helper for AI Documentation Structure
export interface AIDocumentation {
    context_overview: string;      // Markdown
    technical_solution: string;    // Markdown
    implementation_steps: string;  // Markdown
    testing_strategy: string;      // Markdown
    [key: string]: string;         // Allow dynamic keys from custom prompts
}

export interface ScopeChange {
    item: string;
    type: 'added' | 'removed' | 'modified';
    justification: string;
}

export interface ScopeDelta {
    original_scope_summary: string;
    final_scope_summary: string;
    changes: ScopeChange[];
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    startDate: Date;
    endDate?: Date;
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

    // Comprehensive Planning Data
    documentation?: AIDocumentation;
    technicalPremises?: string[];
    clientResponsibilities?: ClientResponsibility[];
    raciMatrix?: RaciItem[];
    teamStructure?: ProjectTeamMember[];
    scopeDelta?: ScopeDelta;
}

// Helper for UI view
export interface TaskWithCost extends Task {
    cost: number;
}

export * from './client';
