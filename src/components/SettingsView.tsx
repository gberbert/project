import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Check, Shield, ShieldAlert, Settings as SettingsIcon, FileText, RotateCcw, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppUser } from '../types/auth';
import { DEFAULT_CONTEXT_RULES, geminiService } from '../services/geminiService';

export const SettingsView = () => {
    const { user, isAdmin, approveUser, toggleAI } = useAuth();
    const [activeTab, setActiveTab] = useState<'general' | 'prompts'>('general');

    // Config State
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [message, setMessage] = useState('');

    // Prompts State
    const [customContextRules, setCustomContextRules] = useState('');

    // User Management State
    const [users, setUsers] = useState<AppUser[]>([]);

    useEffect(() => {
        const storedKey = localStorage.getItem('GEMINI_API_KEY');
        if (storedKey) setApiKey(storedKey);

        const storedRules = localStorage.getItem('GEMINI_CUSTOM_CONTEXT_RULES');
        setCustomContextRules(storedRules || DEFAULT_CONTEXT_RULES);
    }, []);

    // Subscribe to users if Admin
    useEffect(() => {
        if (!isAdmin) return;

        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => d.data() as AppUser);
            setUsers(list);
        });
        return () => unsubscribe();
    }, [isAdmin]);

    const handleSave = () => {
        localStorage.setItem('GEMINI_API_KEY', apiKey);

        // Save Custom Rules
        if (customContextRules !== DEFAULT_CONTEXT_RULES) {
            localStorage.setItem('GEMINI_CUSTOM_CONTEXT_RULES', customContextRules);
        } else {
            localStorage.removeItem('GEMINI_CUSTOM_CONTEXT_RULES');
        }

        // Re-initialize service with new config
        if (apiKey) {
            geminiService.initialize(apiKey);
        }

        setMessage('Configurações salvas com sucesso!');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleResetPrompt = () => {
        if (window.confirm("Tem certeza que deseja restaurar as regras originais?")) {
            setCustomContextRules(DEFAULT_CONTEXT_RULES);
        }
    };

    const handleToggleAccess = async (targetUid: string, currentStatus: boolean) => {
        try {
            await approveUser(targetUid, !currentStatus);
        } catch (e) {
            console.error(e);
            alert("Erro ao atualizar status.");
        }
    };

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${activeTab === id
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
                }`}
        >
            <Icon size={16} />
            {label}
        </button>
    );

    return (
        <div className="w-full h-full flex flex-col bg-gray-50/30">
            {/* Header Sticky */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 md:p-6 border-b border-gray-100 bg-white shadow-sm z-10 shrink-0">
                <div className="mb-4 sm:mb-0">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">Configurações</h2>
                    <p className="text-sm text-gray-500">Gerencie acessos, integrações e comportamento da IA</p>
                </div>

                {/* Tabs Header */}
                <div className="flex gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200 overflow-x-auto max-w-full">
                    <TabButton id="general" label="Geral" icon={SettingsIcon} />
                    <TabButton id="prompts" label="Prompt - Documentação Técnica" icon={FileText} />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'general' && (
                    <div className="h-full overflow-y-auto p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="max-w-7xl mx-auto space-y-6">
                            {/* Access Management (Master Only) */}
                            {isAdmin && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6 border-b pb-4">
                                        <div className="p-2 bg-indigo-50 rounded-lg">
                                            <ShieldAlert className="text-indigo-600" size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">Gestão de Acessos</h3>
                                            <p className="text-sm text-gray-500">Aprovação de logins e controle de permissões</p>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                                <tr>
                                                    <th className="px-6 py-4 font-semibold">Usuário</th>
                                                    <th className="px-6 py-4 font-semibold">Email</th>
                                                    <th className="px-6 py-4 text-center font-semibold">Perfil</th>
                                                    <th className="px-6 py-4 text-center font-semibold">Acesso IA</th>
                                                    <th className="px-6 py-4 text-center font-semibold">Status</th>
                                                    <th className="px-6 py-4 text-right font-semibold">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {users.map(u => (
                                                    <tr key={u.uid} className="bg-white hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-gray-900">
                                                            <div className="flex items-center gap-2">
                                                                {u.displayName || 'Sem Nome'}
                                                                {u.uid === user?.uid && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">VOCÊ</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-500">{u.email}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold ${u.role === 'master' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                {u.role.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {u.role !== 'master' && (
                                                                <div className="flex justify-center">
                                                                    <label className="relative inline-flex items-center cursor-pointer group" title="Permitir uso de IA">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="sr-only peer"
                                                                            checked={u.canUseAI}
                                                                            onChange={() => toggleAI && toggleAI(u.uid, !u.canUseAI)}
                                                                        />
                                                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                                    </label>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {u.isApproved ? (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-bold text-xs border border-green-100">
                                                                    <Check size={12} /> Ativo
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-xs border border-amber-100 animate-pulse">
                                                                    <Shield size={12} /> Pendente
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {u.role !== 'master' && (
                                                                u.isApproved ? (
                                                                    <button
                                                                        onClick={() => handleToggleAccess(u.uid, true)}
                                                                        className="text-red-500 hover:text-red-700 font-medium text-xs border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded transition-colors"
                                                                    >
                                                                        Bloquear
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleToggleAccess(u.uid, false)}
                                                                        className="bg-green-600 text-white hover:bg-green-700 font-medium text-xs px-4 py-1.5 rounded shadow-sm shadow-green-200 transition-all transform active:scale-95"
                                                                    >
                                                                        Aprovar Acesso
                                                                    </button>
                                                                )
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* API Key Section */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <div className="p-1.5 bg-gray-100 rounded text-gray-600">
                                        <SettingsIcon size={20} />
                                    </div>
                                    Integrações & Chaves
                                </h3>

                                <div className="max-w-2xl">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Google Gemini API Key</label>
                                    <div className="relative group">
                                        <input
                                            type={showKey ? "text" : "password"}
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="Cole sua API Key do Google AI Studio aqui"
                                            className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono text-sm bg-gray-50 focus:bg-white"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                        Necessário para utilizar as funcionalidades de Estimativa Inteligente.
                                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline inline-flex items-center gap-0.5 ml-1">
                                            Obter chave <span className="text-[10px]">↗</span>
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'prompts' && (
                    <div className="h-full flex flex-col p-4 md:p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* Prompt Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-gray-100 bg-gray-50/50 gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <FileText size={20} className="text-indigo-600" />
                                        Configuração de Contexto & Documentação
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Edite apenas as regras de geração da Documentação Técnica (Contexto) e Planejamento Estratégico (Premissas & RACI).
                                    </p>
                                </div>
                                <button
                                    onClick={handleResetPrompt}
                                    className="flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 px-3 py-2 rounded-lg transition-all shadow-sm"
                                    title="Restaurar regra padrão"
                                >
                                    <RotateCcw size={14} />
                                    Restaurar Padrão
                                </button>
                            </div>

                            {/* Prompt Editor */}
                            <div className="flex-1 relative group bg-indigo-50/10 flex flex-col">
                                {/* Top "Locked" Context hint */}
                                <div className="px-6 py-2 bg-gray-100 border-b border-gray-200 text-xs text-gray-400 font-mono select-none flex items-center gap-2">
                                    <Info size={12} />
                                    [SISTEMA: Identidade, Regras SDLC e Formato JSON] (Não editável)
                                </div>
                                <div className="px-6 py-2 bg-indigo-100/50 border-b border-indigo-100 text-xs text-indigo-700 font-bold font-mono select-none uppercase tracking-wide">
                                    ↓ Suas regras de geração (Injetadas no prompt)
                                </div>

                                <textarea
                                    value={customContextRules}
                                    onChange={(e) => setCustomContextRules(e.target.value)}
                                    className="flex-1 w-full p-4 md:p-6 font-mono text-sm leading-relaxed text-indigo-900 bg-white outline-none resize-none selection:bg-indigo-100"
                                    placeholder="Digite as instruções para Contexto e Planejamento aqui..."
                                    spellCheck={false}
                                />

                                {/* Bottom "Locked" Context hint */}
                                <div className="px-6 py-2 bg-gray-100 border-t border-gray-200 text-xs text-gray-400 font-mono select-none flex items-center gap-2">
                                    <Info size={12} />
                                    [SISTEMA: Exemplo de Saída JSON] (Não editável)
                                </div>

                                {/* Optional: Stats or overlay */}
                                <div className="absolute top-10 right-6 pointer-events-none opacity-50 text-[10px] text-gray-400 bg-white/80 px-2 py-1 rounded border border-gray-100">
                                    {customContextRules.length} caracteres
                                </div>
                            </div>

                            {/* Prompt Footer/Meta */}
                            <div className="p-3 bg-blue-50 border-t border-blue-100 text-xs text-blue-800 flex items-start gap-2">
                                <Info size={14} className="mt-0.5 shrink-0" />
                                <span className="opacity-90 leading-relaxed">
                                    O texto acima será inserido no centro do Prompt do Sistema, entre as regras rígidas do sistema (SDLC) e o formato de saída JSON.
                                    Use isso para personalizar o estilo da documentação ou adicionar novas seções ao relatório.
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Global Actions Footer - Always visible */}
            <div className="p-4 md:p-6 border-t border-gray-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 shrink-0 flex justify-between items-center">
                <div className="flex-1">
                    {message && (
                        <span className="inline-flex items-center gap-2 text-green-700 bg-green-50 px-3 py-1.5 rounded-lg text-sm font-medium animate-in slide-in-from-left-2 fade-in">
                            <Check size={16} /> {message}
                        </span>
                    )}
                </div>

                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 transition-all font-bold transform active:scale-95"
                >
                    <Save size={18} />
                    Salvar Alterações
                </button>
            </div>
        </div>
    );
};
