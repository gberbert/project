export interface ClientBudget {
    fiscalYear: string;
    revenue: number;
    margin: number;
    strategy?: string;
}

export interface Client {
    id: string;
    name: string;
    strategy: string;
    context?: string; // AI Context
    budgets: ClientBudget[];
    createdAt?: Date;
    excludedYears?: string[];
    ownerId?: string;
}
