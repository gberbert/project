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
    budgets: ClientBudget[];
    createdAt?: Date;
    excludedYears?: string[];
}
