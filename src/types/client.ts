export interface ClientBudget {
    fiscalYear: string;
    revenue: number;
    margin: number;
}

export interface Client {
    id: string;
    name: string;
    strategy: string;
    budgets: ClientBudget[];
}
