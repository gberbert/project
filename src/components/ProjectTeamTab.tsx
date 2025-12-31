import React, { useState, useEffect } from 'react';
import { Project, ProjectTeamMember, Task } from '../types';
import { Users, DollarSign, Save, Clock, Calculator } from 'lucide-react';

interface ProjectTeamTabProps {
    project: Project;
    tasks: Task[];
    onUpdateTeam: (newStructure: ProjectTeamMember[]) => void;
}

const countBusinessDays = (startDate: Date, endDate: Date): number => {
    let count = 0;
    const curDate = new Date(startDate);
    const end = new Date(endDate);

    curDate.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    while (curDate <= end) {
        const day = curDate.getDay();
        if (day !== 0 && day !== 6) {
            count++;
        }
        curDate.setDate(curDate.getDate() + 1);
    }
    return count > 0 ? count : 1;
};

export const ProjectTeamTab: React.FC<ProjectTeamTabProps> = ({ project, tasks, onUpdateTeam }) => {
    const [team, setTeam] = useState<ProjectTeamMember[]>([]);

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

    const handleSave = () => {
        onUpdateTeam(team);
        alert(`Dados salvos! (${team.length} papéis). Agora os valores serão aplicados ao selecionar o papel na tarefa.`);
    };

    const getRoleMetrics = (role: string) => {
        const roleTasks = tasks.filter(t => t.assignedResource === role);
        let totalHours = 0;
        roleTasks.forEach(t => {
            const days = countBusinessDays(t.start, t.end);
            totalHours += days * 8;
        });
        return { totalHours, count: roleTasks.length };
    };

    if (team.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] text-gray-500 bg-white rounded-xl border border-gray-100">
                <Users size={48} className="mb-4 text-gray-300" />
                <p>Nenhuma estrutura de equipe definida para este projeto.</p>
                <p className="text-sm">Gere uma estimativa com IA para obter sugestões.</p>
            </div>
        );
    }

    // Calculate Grand Totals
    const grandTotalCost = team.reduce((acc, member) => {
        const { totalHours } = getRoleMetrics(member.role);
        return acc + (totalHours * (member.hourlyRate || 0));
    }, 0);

    const grandTotalHours = team.reduce((acc, member) => {
        return acc + getRoleMetrics(member.role).totalHours;
    }, 0);


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

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                            <th className="p-4 font-semibold">Profissional / Papel</th>
                            <th className="p-4 font-semibold text-center w-28">Horas Totais</th>
                            <th className="p-4 font-semibold w-full">Responsabilidades Chave</th>
                            <th className="p-4 font-semibold w-32">Taxa / Hora</th>
                            <th className="p-4 font-semibold w-32 text-right">Custo Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {team.map((member, idx) => {
                            const { totalHours } = getRoleMetrics(member.role);
                            const totalCost = totalHours * (member.hourlyRate || 0);

                            return (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-medium text-indigo-900">
                                        {member.role}
                                    </td>
                                    <td className="p-4 text-center text-gray-700 font-mono text-sm">
                                        <div className="bg-gray-100 py-1 px-2 rounded">
                                            {totalHours}h
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            {member.responsibilities.map((resp, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs border border-indigo-100">
                                                    {resp}
                                                </span>
                                            ))}
                                        </div>
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
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 text-xs text-center text-gray-500 flex items-center justify-center gap-2">
                <Calculator size={12} />
                Cálculo baseado em: (Dias Úteis das Tarefas x 8h) x Taxa Horária.
            </div>
        </div>
    );
};
