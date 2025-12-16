import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Paperclip, Bot, User, Loader2, Sparkles, AlertCircle, LayoutDashboard } from 'lucide-react';
import { geminiService, EstimateResult, ClarificationResult } from '../services/geminiService';


interface EstimateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyEstimate: (estimate: EstimateResult) => Promise<void>;
    clientContext?: string;
    knowledgeBase?: string[];
}

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    attachments?: string[];
    isError?: boolean;
    estimateData?: EstimateResult;
    clarificationData?: ClarificationResult;
}

export const EstimateModal = ({ isOpen, onClose, onApplyEstimate, clientContext, knowledgeBase }: EstimateModalProps) => {
    const [input, setInput] = useState('');
    const [isApplying, setIsApplying] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [messages, setMessages] = useState<Message[]>([
        { id: 'welcome', role: 'model', text: 'Olá! Sou seu Arquiteto de Projetos. Descreva o que você quer construir (software, engenharia, evento...) e anexe arquivos se tiver. Vou te ajudar a estimar o cronograma.' }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [isConfigured, setIsConfigured] = useState(geminiService.isConfigured());
    const [pendingFiles, setPendingFiles] = useState<{ name: string, type: string, data: string }[]>([]);

    // State for managing questionnaire answers: { [messageId]: { [questionId]: answer } }
    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, Record<string, string>>>({});

    // Auto-scroll ref
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Reset state for new session
            setMessages([
                { id: 'welcome', role: 'model', text: 'Olá! Sou seu Arquiteto de Projetos. Descreva o que você quer construir (software, engenharia, evento...) e anexe arquivos se tiver. Vou te ajudar a estimar o cronograma.' }
            ]);
            setInput('');
            setPendingFiles([]);
            setQuestionnaireAnswers({});
            setIsConfigured(geminiService.isConfigured());

            if (geminiService.isConfigured()) {
                geminiService.startChat().catch(console.error);
            }
        }
    }, [isOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!isOpen) return null;

    const handleSend = async (overrideText?: string) => {
        const textToSendRaw = overrideText || input;

        if (!textToSendRaw.trim() && pendingFiles.length === 0) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: textToSendRaw,
            attachments: pendingFiles.map(f => f.name)
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        const filesToSend = [...pendingFiles]; // Snapshot
        setPendingFiles([]);
        setIsLoading(true);

        try {
            // Prepend context if it's the first user message
            let textToSend = userMsg.text;
            const userHistoryCount = messages.filter(m => m.role === 'user').length;

            if (userHistoryCount === 0) {
                let contextBlock = "";

                if (clientContext) {
                    contextBlock += `[CONTEXTO DO CLIENTE / BACKGROUND]:\n${clientContext}\n\n`;
                }

                if (knowledgeBase && knowledgeBase.length > 0) {
                    contextBlock += `[MEMÓRIA DE PROJETOS ANTERIORES (RAG) - APRENDA COM ISSO]:\n${knowledgeBase.map(k => `- ${k}`).join('\n')}\n\n`;
                }

                if (contextBlock) {
                    textToSend = `${contextBlock}[SOLICITAÇÃO ATUAL]:\n${textToSend}`;
                }
            }

            const responseText = await geminiService.sendMessage(
                textToSend,
                filesToSend.map(f => ({ mimeType: f.type, data: f.data.split(',')[1] })) // Remove data:xxx/xxx;base64, prefix
            );

            // 1. Check for Estimate JSON
            const estimate = geminiService.parseEstimate(responseText);
            if (estimate && estimate.tasks && estimate.tasks.length > 0) {
                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'model',
                    text: `📐 Estimativa gerada com sucesso!\n\n**Projeto:** ${estimate.project_name}\n**Confiança:** ${(estimate.confidence_score * 100).toFixed(0)}%\n**Tarefas:** ${estimate.tasks.length}\n\nClique em "Gerar Gantt" para aplicar.`,
                    estimateData: estimate
                };
                setMessages(prev => [...prev, aiMsg]);
                setIsLoading(false);
                return;
            }

            // 2. Check for Clarification JSON
            const clarification = geminiService.parseClarification(responseText);
            if (clarification && clarification.questions && clarification.questions.length > 0) {
                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'model',
                    text: "🔍 Preciso de alguns detalhes para ser mais preciso. Por favor, responda abaixo:",
                    clarificationData: clarification
                };
                setMessages(prev => [...prev, aiMsg]);
                setIsLoading(false);
                return;
            }

            // 3. Fallback to normal text
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: responseText
            }]);

        } catch (error: any) {
            console.error(error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'model',
                text: `Erro técnico: ${error.message || "Falha desconhecida"}. \n\nDica: Por enquanto, a API aceita melhor Imagens e PDFs. Arquivos .DOCX podem não ser suportados diretamente.`,
                isError: true
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const submitQuestionnaire = (msgId: string) => {
        const answers = questionnaireAnswers[msgId];
        if (!answers) return;

        // Format answers as a user message
        const formattedAnswers = Object.entries(answers).map(([qId, answer]) => {
            const question = messages.find(m => m.id === msgId)?.clarificationData?.questions.find(q => q.id === qId);
            return `P: ${question?.text || qId}\nR: ${answer}`;
        }).join('\n\n');

        const finalMessage = `[RESPOSTAS DO USUÁRIO AO QUESTIONÁRIO]:\n${formattedAnswers}\n\n[INSTRUÇÃO]: Com base nisso, gere a estimativa JSON final agora.`;

        // Send as if user typed it, but maybe show a cleaner UI bubble? 
        // For simplicity, we show the structured text or a summary.
        // Let's just trigger handleSend with this hidden text context, but display "Respondi o questionário" to UI.

        handleSend(finalMessage);
    };

    const handleApplyClick = async (estimate: EstimateResult) => {
        if (isApplying) return;
        setIsApplying(true);
        try {
            await onApplyEstimate(estimate);
        } catch (e) {
            console.error(e);
            setIsApplying(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            const processed = await Promise.all(files.map(file => new Promise<{ name: string, type: string, data: string }>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve({
                    name: file.name,
                    type: file.type,
                    data: reader.result as string
                });
                reader.readAsDataURL(file);
            })));
            setPendingFiles(prev => [...prev, ...processed]);
        }
    };

    const renderMessage = (msg: Message) => {
        const estimate = msg.estimateData;
        const clarification = msg.clarificationData;
        const isEstimate = !!estimate && estimate.tasks && estimate.tasks.length > 0;
        const isClarification = !!clarification && clarification.questions.length > 0;

        return (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'model' ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-700'}`}>
                    {msg.role === 'model' ? <Bot size={18} /> : <User size={18} />}
                </div>
                <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : msg.isError
                        ? 'bg-red-50 text-red-800 border border-red-200 rounded-tl-none'
                        : 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-tl-none'
                    }`}>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {isEstimate ? (
                            <div>
                                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                    <Sparkles size={16} className="text-yellow-500" />
                                    Estimativa Pronta
                                </h3>
                                {/* ... estimate details rendering ... */}
                                <p className="mb-2">{estimate!.description || "Cronograma gerado."}</p>
                                <div className="bg-gray-50 p-3 rounded border border-gray-200 text-xs mb-4">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-semibold text-gray-600">Projeto:</span>
                                        <span>{estimate!.project_name}</span>
                                    </div>
                                    <div className="flex justify-between mb-1">
                                        <span className="font-semibold text-gray-600">Total Tarefas:</span>
                                        <span>{estimate!.tasks.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-600">Confiança IA:</span>
                                        <span className={estimate!.confidence_score > 0.7 ? 'text-green-600' : 'text-orange-500'}>
                                            {(estimate!.confidence_score * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleApplyClick(estimate!)}
                                    disabled={isApplying}
                                    className={`w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${isApplying
                                        ? 'bg-green-700 text-white/80 cursor-wait'
                                        : 'bg-green-600 hover:bg-green-700 text-white'
                                        }`}
                                >
                                    {isApplying ? (
                                        <><Loader2 size={16} className="animate-spin" /> Gerando Tarefas...</>
                                    ) : (
                                        <><LayoutDashboard size={16} /> Gerar Gráfico de Gantt</>
                                    )}
                                </button>
                            </div>
                        ) : isClarification ? (
                            <div className="space-y-4">
                                <p className="font-medium text-gray-900 mb-2">{msg.text}</p>
                                <div className="space-y-4">
                                    {clarification!.questions.map((q) => {
                                        const currentAnswer = questionnaireAnswers[msg.id]?.[q.id] || '';
                                        // Check if current answer matches one of the options (otherwise it's custom)
                                        const isCustom = currentAnswer && !q.options.includes(currentAnswer);

                                        return (
                                            <div key={q.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                                <p className="text-xs font-bold text-gray-700 mb-2">{q.text}</p>
                                                <div className="space-y-2">
                                                    {q.options.map((opt, idx) => (
                                                        <label key={idx} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                            <input
                                                                type="radio"
                                                                name={`radio-${msg.id}-${q.id}`}
                                                                value={opt}
                                                                checked={currentAnswer === opt}
                                                                onChange={() => setQuestionnaireAnswers(prev => ({
                                                                    ...prev,
                                                                    [msg.id]: { ...prev[msg.id], [q.id]: opt }
                                                                }))}
                                                                className="text-indigo-600 focus:ring-indigo-500"
                                                            />
                                                            <span className="text-xs text-gray-600">{opt}</span>
                                                        </label>
                                                    ))}
                                                    {q.allow_custom_input && (
                                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                                            <label className="flex items-center gap-2 mb-1">
                                                                <input
                                                                    type="radio"
                                                                    name={`radio-${msg.id}-${q.id}`}
                                                                    checked={isCustom || (currentAnswer !== '' && !q.options.includes(currentAnswer))}
                                                                    onChange={() => {
                                                                        // Just select radio, let input handle value
                                                                        setQuestionnaireAnswers(prev => ({
                                                                            ...prev,
                                                                            [msg.id]: { ...prev[msg.id], [q.id]: "" } // Clear to empty string to focus input
                                                                        }))
                                                                    }}
                                                                    className="text-indigo-600 focus:ring-indigo-500"
                                                                />
                                                                <span className="text-xs text-gray-600 font-medium">Outro / Específico:</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="Digite sua resposta..."
                                                                value={isCustom ? currentAnswer : ''}
                                                                onChange={(e) => setQuestionnaireAnswers(prev => ({
                                                                    ...prev,
                                                                    [msg.id]: { ...prev[msg.id], [q.id]: e.target.value }
                                                                }))}
                                                                onFocus={(e) => {
                                                                    // Ensure "Other" radio is selected when typing
                                                                    if (!isCustom) {
                                                                        setQuestionnaireAnswers(prev => ({
                                                                            ...prev,
                                                                            [msg.id]: { ...prev[msg.id], [q.id]: e.target.value }
                                                                        }))
                                                                    }
                                                                }}
                                                                className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => submitQuestionnaire(msg.id)}
                                    className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors mt-2"
                                >
                                    Enviar Respostas
                                </button>
                            </div>
                        ) : (
                            msg.text
                        )}
                    </div>
                    {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 text-xs opacity-70 flex gap-2 flex-wrap">
                            {msg.attachments.map((f, i) => (
                                <span key={i} className="bg-black/10 px-2 py-1 rounded flex items-center gap-1">
                                    <Paperclip size={10} /> {f}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-50 w-full max-w-3xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Estimar Projeto</h2>
                            <p className="text-xs text-gray-500">Powered by Gemini AI</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100">
                        <X size={20} />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {!isConfigured ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
                            <AlertCircle size={48} className="text-orange-400 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-800">API Key não configurada</h3>
                            <p className="text-sm text-gray-600 max-w-md mt-2">
                                Para usar a IA, você precisa adicionar sua chave do Google Gemini nas configurações do sistema.
                            </p>
                        </div>
                    ) : (
                        messages.map(renderMessage)
                    )}
                    {isLoading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                                <Bot size={18} />
                            </div>
                            <div className="bg-white border border-gray-100 shadow-sm p-4 rounded-2xl rounded-tl-none flex items-center gap-2 text-gray-500 text-sm">
                                <Loader2 size={16} className="animate-spin" />
                                <span>Analisando e escrevendo...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="bg-white p-4 border-t border-gray-200">
                    {pendingFiles.length > 0 && (
                        <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                            {pendingFiles.map((f, i) => (
                                <div key={i} className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 whitespace-nowrap">
                                    <Paperclip size={12} />
                                    <span className="max-w-[150px] truncate">{f.name}</span>
                                    <button onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500">
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2 items-end">
                        <button
                            className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!isConfigured || isLoading}
                            title="Anexar arquivo (PDF, Imagem, Texto)"
                        >
                            <Paperclip size={20} />
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                multiple
                                onChange={handleFileSelect}
                            />
                        </button>
                        <div className="flex-1 relative">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder={isConfigured ? "Descreva seu projeto aqui..." : "Configure a API Key primeiro"}
                                className="w-full bg-gray-100 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none max-h-32 min-h-[50px]"
                                disabled={!isConfigured || isLoading}
                                rows={1}
                                style={{ height: 'auto', minHeight: '52px' }}
                            />
                        </div>
                        <button
                            onClick={() => handleSend()}
                            disabled={(!input.trim() && pendingFiles.length === 0) || !isConfigured || isLoading}
                            className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg shadow-indigo-200"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
