import React, { useState } from 'react';
import { Plus, Search, Calendar, MoreVertical, Folder, ArrowRight, Clock, Trash2 } from 'lucide-react';
import { Project } from '../types';

interface MyProjectsViewProps {
    projects: Project[];
    onCreateProject: (project: Omit<Project, 'id' | 'createdAt'>) => void;
    onSelectProject: (projectId: string) => void;
    onDeleteProject: (projectId: string) => void;
}

export const MyProjectsView = ({ projects = [], onCreateProject, onSelectProject, onDeleteProject }: MyProjectsViewProps) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDesc, setNewProjectDesc] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCreateProject({
            name: newProjectName,
            description: newProjectDesc,
            startDate: new Date(),
        });
        setIsModalOpen(false);
        setNewProjectName('');
        setNewProjectDesc('');
    };

    return (
        <div className="p-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Meus Projetos</h1>
                    <p className="text-gray-500 mt-2">Gerencie seu portfólio e crie novos empreendimentos.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 font-medium"
                >
                    <Plus size={20} />
                    Novo Projeto
                </button>
            </div>

            {/* Filters / Search Bar */}
            <div className="mb-8 flex items-center gap-4 bg-white p-2 rounded-xl border border-gray-100 shadow-sm max-w-2xl">
                <Search className="text-gray-400 ml-3" size={20} />
                <input
                    type="text"
                    placeholder="Buscar projetos..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-gray-700 placeholder-gray-400"
                />
            </div>

            {/* Grid of Projects */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                    <div
                        key={project.id}
                        onClick={() => onSelectProject(project.id)}
                        className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 cursor-pointer relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Tem certeza que deseja excluir este projeto?')) {
                                        onDeleteProject(project.id);
                                    }
                                }}
                                className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                                title="Excluir Projeto"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>

                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors duration-300">
                            <Folder size={24} className="text-indigo-600 group-hover:text-white transition-colors duration-300" />
                        </div>

                        <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">{project.name}</h3>
                        <p className="text-gray-500 text-sm mb-6 line-clamp-2">{project.description || 'Sem descrição.'}</p>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                            <div className="flex items-center text-sm text-gray-500">
                                <Calendar size={16} className="mr-2" />
                                {new Date(project.startDate).toLocaleDateString()}
                            </div>
                            <div className="flex items-center text-indigo-600 font-medium text-sm opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">
                                Abrir <ArrowRight size={16} className="ml-1" />
                            </div>
                        </div>
                    </div>
                ))}

                {/* Empty State / Add Placeholder */}
                {projects.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Clock className="text-gray-400" size={32} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Nenhum projeto encontrado</h3>
                        <p className="text-gray-500 mt-2 text-center max-w-sm">Comece criando seu primeiro projeto para gerenciar tarefas e cronogramas.</p>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Novo Projeto</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Projeto</label>
                                    <input
                                        type="text"
                                        required
                                        value={newProjectName}
                                        onChange={e => setNewProjectName(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                        placeholder="Ex: Redesign Website"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                    <textarea
                                        value={newProjectDesc}
                                        onChange={e => setNewProjectDesc(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all h-32 resize-none"
                                        placeholder="Breve descrição dos objetivos..."
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                >
                                    Criar Projeto
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
