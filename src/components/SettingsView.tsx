import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff } from 'lucide-react';

export const SettingsView = () => {
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const storedKey = localStorage.getItem('GEMINI_API_KEY');
        if (storedKey) setApiKey(storedKey);
    }, []);

    const handleSave = () => {
        localStorage.setItem('GEMINI_API_KEY', apiKey);
        setMessage('Configurações salvas com sucesso!');
        setTimeout(() => setMessage(''), 3000);
    };

    return (
        <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Configurações</h2>

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
