import { useState } from 'react';
import { Resource } from '../types';
import { ProjectService } from '../services/projectService';
import { Trash2, Plus, User, DollarSign, Briefcase, Users, Pencil, Save, X } from 'lucide-react';

interface TeamViewProps {
    resources: Resource[];
    isConnected: boolean;
}

export const TeamView = ({ resources, isConnected }: TeamViewProps) => {
    const [newResource, setNewResource] = useState({ name: '', role: '', hourlyRate: 0 });
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', role: '', hourlyRate: 0 });

    const handleStartEdit = (res: Resource) => {
        setEditingId(res.id);
        setEditForm({ name: res.name, role: res.role, hourlyRate: res.hourlyRate });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditForm({ name: '', role: '', hourlyRate: 0 });
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;
        try {
            await ProjectService.updateResource(editingId, editForm);
            setEditingId(null);
        } catch (error) {
            console.error("Error updating resource:", error);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isConnected) {
            alert("Conecte-se ao Firebase para gerenciar membros da equipe.");
            return;
        }
        if (newResource.name) {
            try {
                await ProjectService.addResource(newResource);
                setNewResource({ name: '', role: '', hourlyRate: 0 });
                setIsAdding(false);
            } catch (error) {
                console.error("Error adding resource:", error);
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (!isConnected) return;
        if (confirm('Excluir este membro da equipe? As tarefas atribuídas a ele permanecerão, mas perderão o vínculo de atribuição.')) {
            await ProjectService.deleteResource(id);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <Users className="text-indigo-600" size={28} />
                        Gestão da Equipe
                    </h1>
                    <p className="text-gray-500 mt-1">Adicione ou remova membros do projeto e gerencie seus custos.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                {/* Header */}
                <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-5 pl-2">Membro</div>
                    <div className="col-span-4">Função</div>
                    <div className="col-span-2">Taxa/Hora</div>
                    <div className="col-span-1 text-right">Ações</div>
                </div>

                {/* List */}
                <div className="divide-y divide-gray-100">
                    {resources.map(res => (
                        <div key={res.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 transition-colors group">
                            {editingId === res.id ? (
                                <>
                                    <div className="col-span-5 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                            <User size={20} className="text-gray-400" />
                                        </div>
                                        <input
                                            autoFocus
                                            className="w-full px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={editForm.name}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-4">
                                        <input
                                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                            value={editForm.role}
                                            onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                                            placeholder="Função"
                                        />
                                    </div>
                                    <div className="col-span-2 relative">
                                        <DollarSign size={14} className="absolute left-2 top-2 text-gray-400" />
                                        <input
                                            type="number"
                                            className="w-full pl-6 pr-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                            value={editForm.hourlyRate}
                                            onChange={e => setEditForm({ ...editForm, hourlyRate: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div className="col-span-1 text-right flex items-center justify-end gap-1">
                                        <button onClick={handleSaveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save size={18} /></button>
                                        <button onClick={handleCancelEdit} className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={18} /></button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="col-span-5 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                                            {res.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-medium text-gray-900">{res.name}</span>
                                    </div>
                                    <div className="col-span-4 text-gray-600 flex items-center gap-2">
                                        <Briefcase size={14} className="text-gray-400" />
                                        {res.role}
                                    </div>
                                    <div className="col-span-2 text-green-600 font-medium flex items-center gap-1">
                                        <DollarSign size={14} />
                                        {res.hourlyRate}/h
                                    </div>
                                    <div className="col-span-1 text-right flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleStartEdit(res)}
                                            className="text-gray-400 hover:text-indigo-600 p-2 transition-colors"
                                            title="Editar"
                                            disabled={!isConnected}
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(res.id)}
                                            className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                                            title="Remover"
                                            disabled={!isConnected}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}

                    {resources.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                            Nenhum membro da equipe encontrado.
                        </div>
                    )}
                </div>
            </div>

            {/* Add Section */}
            <div className="mt-8">
                {isAdding ? (
                    <form onSubmit={handleAdd} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-top-2">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Plus className="text-indigo-600" size={20} />
                            Adicionar Novo Membro
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Nome</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Nome do Membro"
                                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        value={newResource.name}
                                        onChange={e => setNewResource({ ...newResource, name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Função</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="ex: Desenvolvedor Sênior"
                                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                                        value={newResource.role}
                                        onChange={e => setNewResource({ ...newResource, role: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Taxa/Hora</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                                        value={newResource.hourlyRate}
                                        onChange={e => setNewResource({ ...newResource, hourlyRate: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6 border-t border-gray-100 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsAdding(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md transform hover:scale-105 transition-all font-medium"
                            >
                                Adicionar Membro
                            </button>
                        </div>
                    </form>
                ) : (
                    <button
                        onClick={() => setIsAdding(true)}
                        disabled={!isConnected}
                        className="group w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                    >
                        <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                            <Plus size={18} />
                        </div>
                        {isConnected ? "Adicionar Novo Membro da Equipe" : "Conecte ao Banco para Adicionar"}
                    </button>
                )}
            </div>
        </div>
    );
};
