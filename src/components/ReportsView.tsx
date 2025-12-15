import { useState } from 'react';
import { Task, Resource, Project, Client } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Printer, Wallet, TrendingUp, Target, CalendarDays, ArrowUpRight, Plus, X, Trash2, Pencil } from 'lucide-react';
import { EditableText } from './EditableText';

interface ReportsViewProps {
    tasks: Task[];
    resources: Resource[];
    projects?: Project[];
    client?: Client;
    fiscalYear?: string;
}

export const ReportsView = ({ tasks, resources, projects = [], client, fiscalYear }: ReportsViewProps) => {

    // Portfolio Calculations (Mocked if projects are empty/old data, but using new fields)
    const totalContratado = projects.reduce((sum, p) => sum + (p.grossValue || 0), 0);
    const totalLiquido = projects.reduce((sum, p) => sum + (p.netValue || 0), 0);
    const totalInvestido = tasks.reduce((sum, t) => {
        if (!t.resourceId) return sum;
        const res = resources.find(r => r.id === t.resourceId);
        if (!res) return sum;

        // Calculate cost based on duration
        const hours = Math.max(0, (t.end.getTime() - t.start.getTime()) / (1000 * 60 * 60));
        return sum + (hours * res.hourlyRate);
    }, 0);

    const margemMedia = projects.length > 0
        ? projects.reduce((sum, p) => sum + (p.margin || 0), 0) / projects.length
        : 0;

    // Get Target Margin from Client Configuration
    const activeBudget = client?.budgets?.find(b => b.fiscalYear === fiscalYear);
    const targetMargin = activeBudget?.margin || 0;

    // Roadmap Logic
    const [milestones, setMilestones] = useState([
        { id: 1, title: 'Lançamento MVP', date: '2024-03-30', description: 'Validação de market-fit.', status: 'completed' },
        { id: 2, title: 'Expansão Latam', date: '2025-08-15', description: 'Escritório no México.', status: 'future' },
    ]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentMilestone, setCurrentMilestone] = useState<{ id?: number, title: string, date: string, description: string }>({ title: '', date: '', description: '' });

    const handleSaveMilestone = () => {
        if (!currentMilestone.title || !currentMilestone.date) return;

        const isFuture = new Date(currentMilestone.date) >= new Date();
        const newItem = {
            id: currentMilestone.id || Date.now(),
            title: currentMilestone.title,
            date: currentMilestone.date,
            description: currentMilestone.description,
            status: isFuture ? 'future' : 'completed'
        };

        let updated;
        if (currentMilestone.id) {
            updated = milestones.map(m => m.id === currentMilestone.id ? newItem : m);
        } else {
            updated = [...milestones, newItem];
        }

        setMilestones(updated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setIsModalOpen(false);
        setCurrentMilestone({ title: '', date: '', description: '' });
    };

    const handleDeleteMilestone = (id: number) => {
        setMilestones(prev => prev.filter(m => m.id !== id));
        setIsModalOpen(false);
    };

    const openNewModal = () => {
        setCurrentMilestone({ title: '', date: '', description: '' });
        setIsModalOpen(true);
    };

    const openEditModal = (item: any) => {
        setCurrentMilestone(item);
        setIsModalOpen(true);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-2 animate-in fade-in duration-300 print:p-0 print:space-y-0">



            {/* Printable Area Container */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-none print:p-0">

                {/* Report Header */}
                <div className="border-b border-gray-200 pb-6 mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Relatório Estratégico (Visão Executiva)</h1>
                        <p className="text-gray-500">Documento Confidencial • Gerado em {format(new Date(), 'dd MMMM yyyy', { locale: ptBR })}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-indigo-900 mb-1">PROJETOS</div>
                        <div className="text-sm text-gray-400 font-medium tracking-widest uppercase">Estratégia & Inovação</div>
                    </div>
                </div>

                {/* Executive Summary Section */}
                <div className="mb-10 bg-slate-50 p-6 rounded-xl border border-slate-100">
                    <EditableText
                        id="exec_summary"
                        label="Sumário Executivo (Análise Mensal)"
                        initialValue=""
                        placeholder="Escreva aqui a análise estratégica do período. (Ex: 'O portfólio apresenta aderência de 90% aos objetivos globais. A expansão asiática demandou 15% a mais de orçamento no projeto Z...')"
                        isRich={true}
                    />
                </div>

                {/* Strategic KPIs Cards */}
                <div className="grid grid-cols-4 gap-6 mb-12 print:gap-4">
                    <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Wallet size={48} className="text-emerald-600" />
                        </div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Valor Contratado (YTD)</p>
                        <div className="text-2xl font-bold text-gray-900">
                            R$ {totalContratado.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-xs text-emerald-600 font-medium mt-2 flex items-center">
                            <ArrowUpRight size={12} className="mr-1" /> +12% vs Ano Anterior
                        </div>
                    </div>

                    <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Target size={48} className="text-blue-600" />
                        </div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Margem Média Contratual</p>
                        <div className="text-2xl font-bold text-gray-900">
                            {margemMedia.toFixed(1)}%
                        </div>
                        <div className="text-xs text-blue-600 font-medium mt-2">
                            Meta da Diretoria: {targetMargin}%
                        </div>
                    </div>

                    <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <TrendingUp size={48} className="text-purple-600" />
                        </div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Valor Líquido Realizado</p>
                        <div className="text-2xl font-bold text-purple-900">
                            R$ {totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-xs text-gray-400 font-medium mt-2">
                            Ajustado por Desvios
                        </div>
                    </div>

                    <div className="p-5 bg-gray-900 rounded-xl border border-gray-800 shadow-sm text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <CalendarDays size={48} className="text-white" />
                        </div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Projetos Ativos</p>
                        <div className="text-3xl font-bold">
                            {projects.length}
                        </div>
                        <div className="text-xs text-gray-400 font-medium mt-2">
                            {projects.length} em Execução / 0 Em Risco
                        </div>
                    </div>
                </div>

                {/* Strategic Roadmap (Horizontal & Dynamic) */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Target size={20} className="text-indigo-600" />
                            Roadmap de Marcos Estratégicos
                        </h3>
                        <button
                            onClick={openNewModal}
                            className="text-sm flex items-center gap-1 text-indigo-600 font-medium hover:bg-indigo-50 px-3 py-1.5 rounded-md transition-colors print:hidden"
                        >
                            <Plus size={16} /> Novo Marco
                        </button>
                    </div>

                    <div className="relative pt-8 pb-4 overflow-x-auto">
                        {/* Timeline Line */}
                        <div className="absolute top-[4.5rem] left-0 right-0 h-1 bg-gray-100 rounded-full"></div>

                        <div className="flex gap-8 min-w-max px-4 pb-4">
                            {milestones.map((item) => {
                                const isCompleted = item.status === 'completed';
                                return (
                                    <div key={item.id} className="relative flex flex-col items-center group min-w-[220px]">
                                        {/* Date Badge */}
                                        <div className={`mb-4 px-3 py-1 rounded-full text-xs font-bold shadow-sm z-10 ${isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-600'}`}>
                                            {format(new Date(item.date), 'MMM yyyy', { locale: ptBR }).toUpperCase()}
                                        </div>

                                        {/* Node Dot */}
                                        <div className={`w-6 h-6 rounded-full border-4 z-10 mb-4 transition-transform group-hover:scale-110 ${isCompleted ? 'bg-emerald-500 border-white shadow-md' : 'bg-white border-blue-400 shadow-sm'}`}></div>

                                        {/* Card */}
                                        <div
                                            onClick={() => openEditModal(item)}
                                            className={`w-full bg-white p-4 rounded-xl border shadow-sm transition-all hover:shadow-md cursor-pointer relative group/card ${isCompleted ? 'border-emerald-100 border-l-4 border-l-emerald-500' : 'border-gray-100 border-l-4 border-l-blue-400 opacity-90'}`}
                                        >
                                            <div className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity flex gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteMilestone(item.id); }}
                                                    className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            <h4 className="font-bold text-gray-900 text-sm mb-1 pr-4">{item.title}</h4>
                                            <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Add Button Placeholder for visual continuity */}
                            <div className="relative flex flex-col items-center min-w-[100px] justify-center pt-12 opacity-50 hover:opacity-100 cursor-pointer print:hidden" onClick={openNewModal}>
                                <div className="w-10 h-10 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-400 transition-colors">
                                    <Plus size={20} />
                                </div>
                                <span className="text-xs font-medium text-gray-400 mt-2">Adicionar</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal for New/Edit Milestone */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden" style={{ margin: 0 }}>
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-bold text-gray-900 text-lg">{currentMilestone.id ? 'Editar Marco' : 'Novo Marco Estratégico'}</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors"><X size={20} /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Ex: Expansão Norte"
                                        value={currentMilestone.title}
                                        onChange={e => setCurrentMilestone({ ...currentMilestone, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Prevista</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={currentMilestone.date}
                                        onChange={e => setCurrentMilestone({ ...currentMilestone, date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                    <textarea
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                                        placeholder="Breve descrição do objetivo..."
                                        value={currentMilestone.description}
                                        onChange={e => setCurrentMilestone({ ...currentMilestone, description: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="bg-gray-50 px-6 py-4 flex justify-between gap-3">
                                {currentMilestone.id ? (
                                    <button
                                        onClick={() => handleDeleteMilestone(currentMilestone.id!)}
                                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors text-sm"
                                    >
                                        Excluir
                                    </button>
                                ) : (
                                    <div></div>
                                )}
                                <div className="flex gap-2">
                                    <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
                                    <button onClick={handleSaveMilestone} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                                        {currentMilestone.id ? 'Salvar Alterações' : 'Criar Marco'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Warning Footer */}
                <div className="mt-16 pt-6 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Documento de Uso Interno - Diretoria</p>
                </div>

            </div>
        </div>
    );
};
