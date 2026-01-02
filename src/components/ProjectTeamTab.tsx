import React, { useState, useEffect } from 'react';
import { Project, ProjectTeamMember, Task } from '../types';
import { Users, DollarSign, Save, Clock, Calculator, Plus, Trash2 } from 'lucide-react';
import { calculateBusinessDays } from '../lib/utils';

interface ProjectTeamTabProps {
    project: Project;
    tasks: Task[];
    onUpdateTeam: (newStructure: ProjectTeamMember[]) => void;
}

export const ProjectTeamTab: React.FC<ProjectTeamTabProps> = ({ project, tasks, onUpdateTeam }) => {
    const [team, setTeam] = useState<ProjectTeamMember[]>([]);

    // Resize Logic
    const [colWidths, setColWidths] = useState<number[]>([250, 100, 400, 150, 150, 60]);
    const [resizingCol, setResizingCol] = useState<number | null>(null);
    const startX = React.useRef(0);
    const startWidth = React.useRef(0);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizingCol !== null) {
                const diff = e.clientX - startX.current;
                setColWidths(prev => {
                    const next = [...prev];
                    next[resizingCol] = Math.max(50, startWidth.current + diff);
                    return next;
                });
            }
        };
        const handleMouseUp = () => {
            setResizingCol(null);
            document.body.style.cursor = 'default';
        };

        if (resizingCol !== null) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
        };
    }, [resizingCol]);

    const startResize = (idx: number, e: React.MouseEvent) => {
        e.preventDefault();
        setResizingCol(idx);
        startX.current = e.clientX;
        startWidth.current = colWidths[idx];
    };

    useEffect(() => {
        if (project.teamStructure) {
            setTeam(project.teamStructure);
        } else {
            setTeam([]);
        }
    }, [project.teamStructure]);

    const handleRateChange = (index: number, newRate: string) => {
        const rate = parseFloat(newRate);
        const newTeam = [...team];
        newTeam[index] = { ...newTeam[index], hourlyRate: isNaN(rate) ? 0 : rate };
        setTeam(newTeam);
    };

    const handleRoleChange = (index: number, newName: string) => {
        const newTeam = [...team];
        newTeam[index] = { ...newTeam[index], role: newName };
        setTeam(newTeam);
    };

    const handleResponsibilityChange = (index: number, val: string) => {
        const newTeam = [...team];
        newTeam[index] = { ...newTeam[index], responsibilities: val.split(',') };
        setTeam(newTeam);
    };

    const handleAddRole = () => {
        setTeam([...team, { role: 'Novo Papel', responsibilities: [], hourlyRate: 0, quantity: 1 }]);
    };

    const handleDeleteRole = (index: number) => {
        if (confirm('Remover este papel da equipe?')) {
            const newTeam = [...team];
            newTeam.splice(index, 1);
            setTeam(newTeam);
        }
    };

    const handleSave = () => {
        const cleanTeam = team.map(t => ({
            ...t,
            responsibilities: t.responsibilities.map(r => r.trim()).filter(Boolean)
        }));
        setTeam(cleanTeam);
        onUpdateTeam(cleanTeam);
        alert(`Dados salvos! (${cleanTeam.length} papéis). Agora os valores serão aplicados ao selecionar o papel na tarefa.`);
    };

    const getRoleMetrics = (role: string) => {
        const roleTasks = tasks.filter(t => t.assignedResource === role);
        let totalHours = 0;
        roleTasks.forEach(t => {
            const days = calculateBusinessDays(t.start, t.end);
            totalHours += days * 8;
        });
        return { totalHours, count: roleTasks.length };
    };

    // Calculate Grand Totals
    const grandTotalCost = team.length > 0 ? team.reduce((acc, member) => {
        const { totalHours } = getRoleMetrics(member.role);
        return acc + (totalHours * (member.hourlyRate || 0));
    }, 0) : 0;

    const grandTotalHours = team.length > 0 ? team.reduce((acc, member) => {
        return acc + getRoleMetrics(member.role).totalHours;
    }, 0) : 0;


    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in duration-300">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Users className="text-indigo-600" size={20} />
                        Estrutura de Equipe & Custos
                    </h3>
                    <p className="text-sm text-gray-500 flex gap-4 mt-1">
                        <span className="flex items-center gap-1"><Clock size={12} /> {grandTotalHours}h Totais</span>
                        <span className="flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded"><DollarSign size={12} /> Custo Estimado: R$ {grandTotalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                    <Save size={16} />
                    Salvar Alterações
                </button>
            </div>

            {/* Empty State Handled via Table Empty Row or just conditional logic? 
                User wants to ADD roles, so empty state blocking view is bad. 
                I will show table even if empty, or show empty state if truly empty but allow ADD.
            */}

            {team.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                    <Users size={48} className="mb-4 text-gray-300" />
                    <p>Nenhuma estrutura de equipe definida.</p>
                    <button onClick={handleAddRole} className="mt-4 flex items-center gap-2 text-indigo-600 font-medium hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors">
                        <Plus size={16} /> Adicionar Primeiro Papel manualmente
                    </button>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                                {['Profissional / Papel', 'Horas Totais', 'Responsabilidades (separar por vírgula)', 'Taxa / Hora', 'Custo Total', ''].map((header, idx) => (
                                    <th
                                        key={idx}
                                        className="p-4 font-semibold relative group select-none"
                                        style={{ width: colWidths[idx] }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>{header}</span>
                                            {idx < 5 && (
                                                <div
                                                    className="w-1 h-4 bg-gray-300 cursor-col-resize hover:bg-indigo-500 rounded opacity-0 group-hover:opacity-100 transition-opacity absolute right-0"
                                                    onMouseDown={(e) => startResize(idx, e)}
                                                />
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {team.map((member, idx) => {
                                const { totalHours } = getRoleMetrics(member.role);
                                const totalCost = totalHours * (member.hourlyRate || 0);

                                return (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                                        <td className="p-4 font-medium text-indigo-900">
                                            <input
                                                type="text"
                                                value={member.role}
                                                onChange={(e) => handleRoleChange(idx, e.target.value)}
                                                className="w-full border-none bg-transparent hover:bg-white focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1 transition-all outline-none"
                                            />
                                        </td>
                                        <td className="p-4 text-center text-gray-700 font-mono text-sm">
                                            <div className="bg-gray-100 py-1 px-2 rounded">
                                                {totalHours}h
                                            </div>
                                        </td>
                                        <td className="p-4 border-r border-transparent hover:border-gray-100 overflow-hidden">
                                            <input
                                                type="text"
                                                value={member.responsibilities.join(',')}
                                                onChange={(e) => handleResponsibilityChange(idx, e.target.value)}
                                                className="w-full border-none bg-transparent hover:bg-white focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1 transition-all outline-none text-xs text-gray-600 truncate focus:overflow-visible focus:z-10 focus:absolute focus:w-auto focus:min-w-full focus:shadow-md"
                                                placeholder="Adicionar responsabilidades (separar por vírgula)..."
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="relative group min-w-[120px]">
                                                <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
                                                <input
                                                    type="number"
                                                    value={member.hourlyRate || ''}
                                                    onChange={(e) => handleRateChange(idx, e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none bg-white hover:border-gray-300"
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-medium text-gray-900">
                                            R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => handleDeleteRole(idx)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                title="Remover Papel"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                        <button
                            onClick={handleAddRole}
                            className="flex items-center gap-2 text-indigo-600 font-medium hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors text-sm"
                        >
                            <Plus size={16} />
                            Adicionar Novo Papel
                        </button>
                    </div>
                </div>
            )}

            <div className="p-4 bg-gray-50 border-t border-gray-100 text-xs text-center text-gray-500 flex items-center justify-center gap-2">
                <Calculator size={12} />
                Cálculo baseado em: (Dias Úteis das Tarefas x 8h) x Taxa Horária.
            </div>
        </div>
    );
};
