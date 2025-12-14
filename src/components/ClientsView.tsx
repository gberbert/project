import { useState } from 'react';
import { Client, ClientBudget } from '../types/client';
import { Plus, Search, Building2, TrendingUp, Wallet, Target, ChevronDown, ChevronRight } from 'lucide-react';

interface ClientsViewProps {
    clients: Client[];
    onCreateClient: (client: Client) => void;
    onUpdateClient: (client: Client) => void;
    onDeleteClient: (clientId: string) => void;
    currentFiscalYear: string;
    onFiscalYearChange: (fy: string) => void;
}

export const ClientsView = ({ clients, onCreateClient, onUpdateClient, onDeleteClient, currentFiscalYear, onFiscalYearChange }: ClientsViewProps) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [name, setName] = useState('');
    const [strategy, setStrategy] = useState('');
    const [budgetRevenue, setBudgetRevenue] = useState('');
    const [budgetMargin, setBudgetMargin] = useState('');

    const openModal = (client?: Client) => {
        if (client) {
            setEditingClient(client);
            setName(client.name);
            setStrategy(client.strategy);
            const budget = client.budgets.find(b => b.fiscalYear === currentFiscalYear);
            setBudgetRevenue(budget?.revenue.toString() || '');
            setBudgetMargin(budget?.margin.toString() || '');
        } else {
            setEditingClient(null);
            setName('');
            setStrategy('');
            setBudgetRevenue('');
            setBudgetMargin('');
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const budget: ClientBudget = {
            fiscalYear: currentFiscalYear,
            revenue: parseFloat(budgetRevenue) || 0,
            margin: parseFloat(budgetMargin) || 0
        };

        if (editingClient) {
            // Update existing client
            const updatedBudgets = [...editingClient.budgets];
            const budgetIndex = updatedBudgets.findIndex(b => b.fiscalYear === currentFiscalYear);

            if (budgetIndex >= 0) {
                updatedBudgets[budgetIndex] = budget;
            } else {
                updatedBudgets.push(budget);
            }

            onUpdateClient({
                ...editingClient,
                name,
                strategy,
                budgets: updatedBudgets
            });
        } else {
            // New Client
            onCreateClient({
                id: `client-${Date.now()}`,
                name,
                strategy,
                budgets: [budget]
            });
        }
        setIsModalOpen(false);
    };

    const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestão de Clientes</h1>
                    <p className="text-gray-500 mt-2">Configure contas, orçamentos e estratégias por ano fiscal.</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 font-medium"
                >
                    <Plus size={20} />
                    Novo Cliente
                </button>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
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
                    <select
                        value={currentFiscalYear}
                        onChange={(e) => onFiscalYearChange(e.target.value)}
                        className="bg-transparent font-bold text-indigo-600 focus:outline-none cursor-pointer"
                    >
                        <option value="2024">2024</option>
                        <option value="2025">2025</option>
                        <option value="2026">2026</option>
                    </select>
                </div>
            </div>

            {/* Clients Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClients.map(client => {
                    const budget = client.budgets.find(b => b.fiscalYear === currentFiscalYear);

                    return (
                        <div key={client.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all p-6 group relative">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-indigo-50 rounded-xl">
                                    <Building2 className="text-indigo-600" size={24} />
                                </div>
                                <button
                                    onClick={() => openModal(client)}
                                    className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    Editar
                                </button>
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 mb-2">{client.name}</h3>
                            <div className="h-16 overflow-hidden">
                                <p className="text-sm text-gray-500 line-clamp-2">{client.strategy || 'Sem estratégia definida.'}</p>
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
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</h2>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Estratégia {currentFiscalYear}</label>
                                <textarea
                                    value={strategy}
                                    onChange={e => setStrategy(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                                    placeholder="Objetivos estratégicos para este cliente..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Receita Prevista (FY {currentFiscalYear})</label>
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
