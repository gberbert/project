import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Check, Shield, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppUser } from '../types/auth';

export const SettingsView = () => {
    const { user, isAdmin, approveUser, toggleAI } = useAuth();
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [message, setMessage] = useState('');

    // User Management State
    const [users, setUsers] = useState<AppUser[]>([]);

    useEffect(() => {
        const storedKey = localStorage.getItem('GEMINI_API_KEY');
        if (storedKey) setApiKey(storedKey);
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
        setMessage('Configurações salvas com sucesso!');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleToggleAccess = async (targetUid: string, currentStatus: boolean) => {
        try {
            await approveUser(targetUid, !currentStatus);
        } catch (e) {
            console.error(e);
            alert("Erro ao atualizar status.");
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto animate-in fade-in duration-300">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Configurações</h2>

            {/* Access Management (Master Only) */}
            {isAdmin && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <div className="flex items-center gap-3 mb-4 border-b pb-4">
                        <ShieldAlert className="text-indigo-600" />
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Gestão de Acessos</h3>
                            <p className="text-sm text-gray-500">Aprovação de logins pendentes</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto bg-gray-50 rounded-lg border border-gray-200">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-100 border-b">
                                <tr>
                                    <th className="px-6 py-3">Usuário</th>
                                    <th className="px-6 py-3">Email</th>
                                    <th className="px-6 py-3 text-center">Perfil</th>
                                    <th className="px-6 py-3 text-center">IA</th>
                                    <th className="px-6 py-3 text-center">Status</th>
                                    <th className="px-6 py-3 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {users.map(u => (
                                    <tr key={u.uid} className="bg-white">
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {u.displayName || 'Sem Nome'}
                                            {u.uid === user?.uid && <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Você</span>}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 max-w-[200px] truncate" title={u.email}>{u.email}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'master' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {u.role.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {u.role !== 'master' && (
                                                <label className="relative inline-flex items-center cursor-pointer" title="Permitir uso de IA">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={u.canUseAI}
                                                        onChange={() => toggleAI && toggleAI(u.uid, !u.canUseAI)}
                                                    />
                                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                                                </label>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {u.isApproved ? (
                                                <span className="flex items-center justify-center gap-1 text-green-600 font-bold text-xs">
                                                    <Check size={14} /> Ativo
                                                </span>
                                            ) : (
                                                <span className="flex items-center justify-center gap-1 text-amber-600 font-bold text-xs animate-pulse">
                                                    <Shield size={14} /> Pendente
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
                                                        className="bg-green-600 text-white hover:bg-green-700 font-medium text-xs px-4 py-1.5 rounded shadow-sm transition-all transform active:scale-95"
                                                    >
                                                        Aprovar
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
                <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Integrações</h3>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Google Gemini API Key</label>
                    <div className="relative">
                        <input
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Cole sua API Key aqui (AI Studio)"
                            className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        Necessário para utilizar as funcionalidades de Estimativa Inteligente.
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline ml-1">
                            Obter chave
                        </a>
                    </p>
                </div>

                <div className="flex items-center justify-between mt-6">
                    {message && <span className="text-green-600 text-sm font-medium animate-fade-in">{message}</span>}
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors ml-auto"
                    >
                        <Save size={18} />
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
};
