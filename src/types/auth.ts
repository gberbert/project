export interface AppUser {
    uid: string;
    email: string;
    displayName?: string;
    role: 'master' | 'user';
    isApproved: boolean;
    canUseAI?: boolean;
    photoURL?: string;
    createdAt: Date;
}

export interface FiscalYear {
    id: string;
    name: string; // e.g. "Ciclo 2024", "Ano Fiscal 2025"
    year: number;
    ownerId: string; // Linked to AppUser
    createdAt: Date;
}
