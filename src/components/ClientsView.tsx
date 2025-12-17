import { useState } from 'react';
import { Client, ClientBudget } from '../types/client';
import { Plus, Search, Building2, TrendingUp, Wallet, Target, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

import { AppUser } from '../types/auth';

interface ClientsViewProps {
    clients: Client[];
    onCreateClient: (client: Client) => void;
    onUpdateClient: (client: Client) => void;
    onDeleteClient: (clientId: string) => void;
    currentFiscalYear: string;
    onFiscalYearChange: (fy: string) => void;
    onSelectClient: (clientId: string) => void;
    currentUser?: AppUser | null;
}

export const ClientsView = ({ clients, onCreateClient, onUpdateClient, onDeleteClient, currentFiscalYear, onFiscalYearChange, onSelectClient, currentUser }: ClientsViewProps) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [name, setName] = useState('');
    const [strategy, setStrategy] = useState('');
    const [context, setContext] = useState('');
    const [budgetRevenue, setBudgetRevenue] = useState('');
    const [budgetMargin, setBudgetMargin] = useState('');

    // Dynamic Year Range (Current -5 to +5)
    const currentYearInt = new Date().getFullYear();
    const years = Array.from({ length: 11 }, (_, i) => (currentYearInt - 5 + i).toString());

    const openModal = (client?: Client) => {
        if (client) {
            setEditingClient(client);
            setName(client.name);
            const budgets = client.budgets || [];
            // Robust finding: force strings
            const budget = budgets.find(b => String(b.fiscalYear) === String(currentFiscalYear));
            setStrategy(budget?.strategy || '');
            setContext(client.context || '');
            setBudgetRevenue(budget?.revenue?.toString() || '');
            setBudgetMargin(budget?.margin?.toString() || '');
        } else {
            setEditingClient(null);
            setName('');
            setStrategy('');
            setContext('');
            setBudgetRevenue('');
            setBudgetMargin('');
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const budget: ClientBudget = {
            fiscalYear: String(currentFiscalYear),
            revenue: parseFloat(budgetRevenue) || 0,
            margin: parseFloat(budgetMargin) || 0,
            strategy: String(strategy || '')
        };

        if (editingClient) {
            // Update existing client
            let updatedBudgets = Array.isArray(editingClient.budgets) ? [...editingClient.budgets] : [];
            // Clean array of nulls/invalid
            updatedBudgets = updatedBudgets.filter(b => b && b.fiscalYear);

            const budgetIndex = updatedBudgets.findIndex(b => String(b.fiscalYear) === String(currentFiscalYear));

            if (budgetIndex >= 0) {
                updatedBudgets[budgetIndex] = budget;
            } else {
                updatedBudgets.push(budget);
            }

            onUpdateClient({
                ...editingClient,
                name,
                context,
                budgets: updatedBudgets
            });
        } else {
            // New Client
            onCreateClient({
                id: `client-${Date.now()}`,
                name,
                strategy, // Set initial global strategy as fallback for legacy
                context,
                budgets: [budget],
                createdAt: new Date()
            });
        }
        setIsModalOpen(false);
    };

    const handleExcludeYear = (client: Client, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`Remover ${client.name} do ano fiscal ${currentFiscalYear}? O cliente permanecerá nos outros anos.`)) {
            const excluded = client.excludedYears || [];
            const budgets = client.budgets || [];

            onUpdateClient({
                ...client,
                excludedYears: [...excluded, currentFiscalYear],
                budgets: budgets.filter(b => String(b.fiscalYear) !== String(currentFiscalYear))
            });
        }
    };

    const filteredClients = clients.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());

        // Fiscal Year Filter (Temporal Hierarchy - "Registro subsequente")
        // Rule: Client Created Year <= Selected Fiscal Year
        let matchesYear = true;
        if (c.createdAt) {
            const createdYear = c.createdAt.getFullYear();
            const selectedYear = parseInt(currentFiscalYear);
            if (createdYear > selectedYear) {
                matchesYear = false;
            }
        }

        // Excluded Filter
        if (c.excludedYears?.includes(currentFiscalYear)) {
            return false;
        }

        return matchesSearch && matchesYear;
    });

    return (
        <div className="p-2 lg:p-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-4 lg:mb-8">
                <div className="hidden md:block">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestão de Clientes</h1>
                    <p className="text-gray-500 mt-2">Configure contas, orçamentos e estratégias por ano fiscal.</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="w-full md:w-auto justify-center flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 lg:px-6 lg:py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 font-medium"
                >
                    <Plus size={20} />
                    Novo Cliente
                </button>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col md:flex-row gap-4 mb-4 lg:mb-8">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar clientes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 border border-gray-200 rounded-xl">
                    <span className="text-sm font-bold text-gray-500">Ano Fiscal:</span>
                    <div className="relative">
                        <select
                            value={currentFiscalYear}
                            onChange={(e) => onFiscalYearChange(e.target.value)}
                            className="bg-transparent font-bold text-indigo-600 focus:outline-none cursor-pointer appearance-none pr-6"
                        >
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Clients Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClients.map(client => {
                    const budgets = client.budgets || [];
                    const budget = budgets.find(b => String(b.fiscalYear) === String(currentFiscalYear));
                    // Display strategy from specific year, or fallback to "Sem dados" if requested to be clean.
                    const displayStrategy = budget?.strategy || (currentFiscalYear === '2024' ? client.strategy : '');

                    return (
                        <div key={client.id} onClick={() => onSelectClient(client.id)} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all p-6 group relative cursor-pointer">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-indigo-50 rounded-xl">
                                    <Building2 className="text-indigo-600" size={24} />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openModal(client); }}
                                        className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded-full transition-colors"
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={(e) => handleExcludeYear(client, e)}
                                        className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                                        title="Remover deste ano"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 mb-2">{client.name}</h3>
                            <div className="h-16 overflow-hidden">
                                <p className="text-sm text-gray-500 line-clamp-2">
                                    {displayStrategy || 'Sem estratégia definida para este ano.'}
                                </p>
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-50 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <Wallet size={12} /> Orçamento {currentFiscalYear}
                                    </p>
                                    <p className="font-bold text-green-700">
                                        R$ {(budget?.revenue || 0).toLocaleString('pt-BR', { notation: 'compact' })}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <TrendingUp size={12} /> Margem
                                    </p>
                                    <p className="font-bold text-blue-700">
                                        {budget?.margin || 0}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">{editingClient ? 'Editar Cliente' : 'Novo Cliente'} ({currentFiscalYear})</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Ex: ACME Corp"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contexto AI</label>
                                <textarea
                                    value={context}
                                    onChange={e => setContext(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                                    placeholder="Descreva a cultura da empresa, padrões de arquitetura (ex: microsserviços), tecnologias preferidas e restrições..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Estratégia {currentFiscalYear}</label>
                                <textarea
                                    value={strategy}
                                    onChange={e => setStrategy(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                                    placeholder={`Objetivos estratégicos para ${currentFiscalYear}...`}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Receita Prevista</label>
                                    <input
                                        type="number"
                                        value={budgetRevenue}
                                        onChange={e => setBudgetRevenue(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-500"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Margem Alvo (%)</label>
                                    <input
                                        type="number"
                                        value={budgetMargin}
                                        onChange={e => setBudgetMargin(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-500"
                                        placeholder="0%"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 rounded-xl"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 shadow-lg"
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
