import { useState } from 'react';
import { Task, Resource } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Edit2, Trash2, CheckCircle2, Circle, Clock, AlertCircle, Search } from 'lucide-react';
import { ProjectService } from '../services/projectService';

interface TaskListViewProps {
    tasks: Task[];
    resources: Resource[];
    onEditTask: (task: Task) => void;
    isConnected: boolean;
}

export const TaskListView = ({ tasks, resources, onEditTask, isConnected }: TaskListViewProps) => {
    const [filter, setFilter] = useState('');

    const getStatusIcon = (progress: number) => {
        if (progress === 100) return <CheckCircle2 size={16} className="text-green-500" />;
        if (progress > 0) return <Clock size={16} className="text-amber-500" />;
        return <Circle size={16} className="text-gray-400" />;
    };

    const getStatusText = (progress: number) => {
        if (progress === 100) return 'Concluído';
        if (progress > 0) return 'Em Andamento';
        return 'A Fazer';
    };

    const getResource = (id?: string) => resources.find(r => r.id === id);

    const filteredTasks = tasks
        .filter(t => t.type !== 'project')
        .filter(t => t.name.toLowerCase().includes(filter.toLowerCase()));

    const handleDelete = async (e: React.MouseEvent, taskId: string) => {
        e.stopPropagation();
        if (!isConnected) return;
        if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
            await ProjectService.deleteTask(taskId);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Lista de Tarefas</h2>
                    <p className="text-gray-500">Gerencie suas tarefas em uma visualização de lista.</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Filtrar tarefas..."
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none w-64"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 w-1/3">Nome da Tarefa</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Atribuído Para</th>
                            <th className="px-6 py-4">Duração</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredTasks.map(task => (
                            <tr
                                key={task.id}
                                className="group hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={() => onEditTask(task)}
                            >
                                <td className="px-6 py-4">
                                    <div className="font-medium text-gray-900">{task.name}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">
                                        {format(task.start, 'd MMM', { locale: ptBR })} - {format(task.end, 'd MMM, yyyy', { locale: ptBR })}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(task.progress)}
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${task.progress === 100 ? 'bg-green-100 text-green-700' :
                                            task.progress > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {getStatusText(task.progress)}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {task.resourceId ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                                {getResource(task.resourceId)?.name.charAt(0)}
                                            </div>
                                            <span className="text-gray-700">{getResource(task.resourceId)?.name}</span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 italic text-xs">Não Atribuído</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-gray-600">
                                    {Math.ceil((task.end.getTime() - task.start.getTime()) / (1000 * 60 * 60 * 24))} dias
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                            title="Editar Tarefa"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                            title="Excluir Tarefa"
                                            disabled={!isConnected}
                                            onClick={(e) => handleDelete(e, task.id)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredTasks.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                    Nenhuma tarefa encontrada.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
