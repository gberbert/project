import React, { useState, useRef, useEffect } from 'react';
import { EstimateResult, ClarificationResult, ClarificationQuestion, geminiService, RefinementResponse, InterviewQuestion } from '../services/geminiService';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Bot, User, Paperclip, Send, Loader2, X, AlertCircle, FileText, LayoutDashboard, CheckSquare, Target, Sparkles, Wand2, ArrowRight, Users, ArrowRightLeft } from 'lucide-react';

export interface EstimateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyEstimate: (estimate: EstimateResult, onProgress?: (status: string) => void) => Promise<void>;
    user?: { role: string;[key: string]: any };
    clientContext?: string;
    knowledgeBase?: string[];
}

interface Message {
    id: string;
    role: 'user' | 'model' | 'assistant';
    content: string; // Unified property for text content
    text?: string;   // Legacy support
    attachments?: string[];
    isError?: boolean;
    estimate?: EstimateResult;
    questionnaire?: ClarificationResult;
}

// Sub-component for the rich estimate view with tabs
const EstimateView = ({ estimate, onApply, isApplying, progressLog }: { estimate: EstimateResult, onApply: () => void, isApplying: boolean, progressLog: string[] }) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'context' | 'planning' | 'delta'>('summary');

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === id
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
                } `}
        >
            <Icon size={16} />
            {label}
        </button>
    );

    return (
        <div className="w-full">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-900">
                <Sparkles size={18} className="text-yellow-500" />
                Proposta de Projeto Gerada
            </h3>

            {/* Tabs Header */}
            <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2 overflow-x-auto">
                <TabButton id="summary" label="Resumo & Gantt" icon={LayoutDashboard} />
                <TabButton id="context" label="Contexto do Projeto" icon={FileText} />
                <TabButton id="planning" label="Premissas & RACI" icon={CheckSquare} />
                <TabButton id="delta" label="Escopo (Delta)" icon={ArrowRightLeft} />
            </div>

            {/* Content Areas */}
            <div className="min-h-[300px]">
                {activeTab === 'summary' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <p className="text-sm text-gray-700 leading-relaxed">{estimate.description || "Cronograma gerado com sucesso."}</p>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm space-y-3">
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                <span className="font-semibold text-gray-600">Projeto</span>
                                <span className="font-medium text-gray-900">{estimate.project_name}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                <span className="font-semibold text-gray-600">Total de Tarefas</span>
                                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">{estimate.tasks.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="font-semibold text-gray-600">Confiança da IA</span>
                                <span className={`font-bold ${estimate.confidence_score > 0.7 ? 'text-green-600' : 'text-orange-500'} `}>
                                    {(estimate.confidence_score * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>

                        {/* Progress Overlay / List when Applying */}
                        {isApplying ? (
                            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl space-y-3 animate-in fade-in">
                                <h4 className="font-semibold text-indigo-900 text-sm flex items-center gap-2">
                                    <Loader2 size={16} className="animate-spin text-indigo-600" />
                                    Processando Projeto...
                                </h4>
                                <div className="space-y-2">
                                    {progressLog.map((log, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs text-indigo-800">
                                            <CheckSquare size={14} className="text-green-600" />
                                            {log}
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-2 text-xs text-indigo-400 italic">
                                        <div className="w-3 h-3 rounded-full border-2 border-indigo-300 border-t-transparent animate-spin" />
                                        Trabalhando...
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                                <h4 className="font-semibold text-blue-900 text-sm mb-2">Próximos Passos</h4>
                                <p className="text-blue-700 text-xs">
                                    Revise os detalhes nas abas "Contexto" e "Premissas" antes de gerar o gráfico.
                                    Ao clicar em gerar, as tarefas serão importadas para o cronograma interativo.
                                </p>
                            </div>
                        )}

                        <button
                            onClick={onApply}
                            disabled={isApplying}
                            className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${isApplying
                                ? 'bg-gray-100 text-gray-400 cursor-wait'
                                : 'bg-green-600 hover:bg-green-700 hover:shadow-md text-white'
                                } `}
                        >
                            {isApplying ? (
                                <>Criando Projeto...</>
                            ) : (
                                <><LayoutDashboard size={18} /> Aprovar e Gerar Gantt</>
                            )}
                        </button>
                    </div>
                )}

                {activeTab === 'context' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 text-sm h-[350px] overflow-y-auto custom-scrollbar pr-2">

                        {/* New Team Structure Section */}
                        {estimate.team_structure && estimate.team_structure.length > 0 && (
                            <div className="bg-white p-4 rounded-xl border border-gray-200">
                                <h4 className="font-bold mb-4 flex items-center gap-2 text-indigo-900">
                                    <Users size={18} className="text-indigo-600" />
                                    Time do Projeto (Escopo Geral)
                                </h4>

                                {/* Visual Avatars */}
                                <div className="flex flex-wrap gap-4 mb-6 justify-center sm:justify-start">
                                    {estimate.team_structure.map((member, idx) => (
                                        <div key={idx} className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 min-w-[200px]">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                                                {member.role.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="text-xs">
                                                <div className="font-bold text-gray-800">{member.role}</div>
                                                <div className="text-gray-500">{member.quantity > 1 ? `${member.quantity} Profissionais` : '1 Profissional'}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Detailed Table */}
                                <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-indigo-600 text-white">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Perfil</th>
                                                <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider w-16 text-center">Qtde</th>
                                                <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Responsabilidades / Habilidades</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {estimate.team_structure.map((member, idx) => (
                                                <tr key={idx} className={idx % 2 === 0 ? "bg-indigo-50/50" : "bg-white"}>
                                                    <td className="px-3 py-2 text-gray-800 font-bold text-xs">{member.role}</td>
                                                    <td className="px-3 py-2 text-gray-600 text-xs font-bold text-center">{member.quantity}</td>
                                                    <td className="px-3 py-2 text-gray-600 text-xs text-justify leading-relaxed">
                                                        <ul className="list-disc pl-4 space-y-1">
                                                            {member.responsibilities.map((resp, rIdx) => (
                                                                <li key={rIdx}>{resp}</li>
                                                            ))}
                                                        </ul>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {estimate.documentation ? (
                            <div className="space-y-4">
                                {Object.entries(estimate.documentation).map(([key, content], index) => {
                                    // Helper to format title (e.g. 'context_overview' -> 'Context Overview')
                                    const title = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

                                    // Dynamic styling based on key or default
                                    let styleClass = "bg-gray-50/50 border-gray-100 text-gray-900";
                                    let iconColor = "text-gray-600";
                                    let IconComponent = FileText;

                                    if (key === 'context_overview') {
                                        styleClass = "bg-indigo-50/50 border-indigo-100 text-indigo-900";
                                        iconColor = "text-indigo-600";
                                        IconComponent = Target;
                                    } else if (key === 'technical_solution') {
                                        styleClass = "bg-blue-50/50 border-blue-100 text-blue-900";
                                        iconColor = "text-blue-600";
                                        IconComponent = FileText;
                                    } else if (key === 'implementation_steps') {
                                        styleClass = "bg-green-50/50 border-green-100 text-green-900";
                                        iconColor = "text-green-600";
                                        IconComponent = LayoutDashboard;
                                    } else if (key === 'testing_strategy') {
                                        styleClass = "bg-teal-50/50 border-teal-100 text-teal-900";
                                        iconColor = "text-teal-600";
                                        IconComponent = CheckSquare;
                                    }

                                    return (
                                        <div key={key} className={`${styleClass} p-4 rounded-xl border`}>
                                            <h4 className={`font-bold mb-2 flex items-center gap-2 capitalize`}>
                                                <IconComponent size={16} className={iconColor} />
                                                {title}
                                            </h4>
                                            <MarkdownRenderer content={content} className="text-xs" />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-500 italic">
                                Documentação detalhada não disponível para esta estimativa.
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'planning' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 text-sm">
                        {estimate.strategic_planning ? (
                            <>
                                <section>
                                    <h4 className="font-bold text-gray-900 mb-2">Premissas Técnicas</h4>
                                    <ul className="list-disc pl-5 space-y-1 text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                                        {(estimate.strategic_planning.technical_premises || []).map((p, i) => (
                                            <li key={i}>{p}</li>
                                        ))}
                                    </ul>
                                </section>

                                <section>
                                    <h4 className="font-bold text-gray-900 mb-2">Responsabilidades do Cliente (Prazos Críticos)</h4>
                                    <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ação Necessária</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prazo</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impacto</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {(estimate.strategic_planning.client_responsibilities || []).map((item, i) => (
                                                    <tr key={i}>
                                                        <td className="px-3 py-2 text-gray-800">{item.action_item}</td>
                                                        <td className="px-3 py-2 text-gray-600 italic">{item.deadline_description}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.impact === 'BLOCKER' ? 'bg-red-100 text-red-800' :
                                                                item.impact === 'HIGH' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                                                                }`}>
                                                                {item.impact}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                <section>
                                    <h4 className="font-bold text-gray-900 mb-2">Matriz RACI Sugerida</h4>
                                    <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Atividade</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" title="Responsável (Executor)">R</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" title="Aprovador (Accountable)">A</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" title="Consultado">C</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" title="Informado">I</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {(estimate.strategic_planning.raci_matrix || []).map((item, i) => (
                                                    <tr key={i}>
                                                        <td className="px-3 py-2 text-gray-800 font-medium">{item.activity_group}</td>
                                                        <td className="px-3 py-2 text-gray-600 text-xs">{item.responsible}</td>
                                                        <td className="px-3 py-2 text-gray-600 text-xs">{item.accountable}</td>
                                                        <td className="px-3 py-2 text-gray-600 text-xs">{item.consulted}</td>
                                                        <td className="px-3 py-2 text-gray-600 text-xs">{item.informed}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            </>
                        ) : (
                            <div className="text-center py-10 text-gray-500 italic">
                                Dados de planejamento estratégico não gerados.
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'delta' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 text-sm h-[350px] overflow-y-auto custom-scrollbar pr-2">
                        {!estimate.scope_delta ? (
                            <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                <ArrowRightLeft size={48} className="mx-auto mb-3 opacity-20" />
                                <p className="font-medium">Análise de Delta não disponível.</p>
                                <p className="text-xs mt-1">Gere uma nova estimativa para visualizar.</p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <Target size={16} /> Escopo Inicial
                                        </h4>
                                        <p className="text-gray-600">{estimate.scope_delta.original_scope_summary}</p>
                                    </div>
                                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
                                        <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                                            <Sparkles size={16} /> Escopo Final
                                        </h4>
                                        <p className="text-indigo-800">{estimate.scope_delta.final_scope_summary}</p>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 mb-3 px-1 border-b pb-2">Mudanças e Justificativas</h4>
                                    <div className="space-y-3">
                                        {estimate.scope_delta.changes.map((change, idx) => (
                                            <div key={idx} className={`p-3 rounded-lg border-l-4 shadow-sm bg-white ${change.type === 'added' ? 'border-l-emerald-500' :
                                                change.type === 'removed' ? 'border-l-red-500' : 'border-l-amber-500'
                                                }`}>
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-gray-800">{change.item}</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${change.type === 'added' ? 'bg-emerald-100 text-emerald-700' :
                                                        change.type === 'removed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                        }`}>{change.type === 'added' ? 'Adicionado' : change.type === 'removed' ? 'Removido' : 'Modificado'}</span>
                                                </div>
                                                <p className="text-xs text-gray-600 italic mt-1">"{change.justification}"</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};



export const EstimateModal = ({ isOpen, onClose, onApplyEstimate, user, clientContext = '', knowledgeBase = [] }: EstimateModalProps) => {
    // Component Version: Validation Flow Fixed
    // --- UI/Chat State ---
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [pendingFiles, setPendingFiles] = useState<{ name: string, type: string, data: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationState, setValidationState] = useState<'idle' | 'validating' | 'reviewing' | 'accepted'>('idle');
    const [validationData, setValidationData] = useState<string>('');
    const [validationFiles, setValidationFiles] = useState<{ name: string, type: string, data: string }[]>([]);
    const [isApplying, setIsApplying] = useState(false);
    const [progressLog, setProgressLog] = useState<string[]>([]);

    // Reset progress when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setProgressLog([]);
        }
    }, [isOpen]);

    // --- Config State ---
    const [isConfigured] = useState(geminiService.isConfigured());
    const isAdmin = user?.role === 'admin' || user?.role === 'manager';

    // --- Refinement (Interviewer) State ---
    const [isRefining, setIsRefining] = useState(false);
    const [refinementData, setRefinementData] = useState<RefinementResponse | null>(null);
    const [refinementAnswers, setRefinementAnswers] = useState<Record<string, string>>({}); // Accumulated answers
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({}); // Current round RADIO answers
    const [customInputs, setCustomInputs] = useState<Record<string, string>>({}); // Current round TEXT answers
    const [projectContext, setProjectContext] = useState<string>("");

    // --- Refs ---
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Effects ---
    useEffect(() => {
        if (isOpen) {
            setMessages([
                {
                    id: 'welcome',
                    role: 'assistant',
                    content: 'Olá! Sou o Assistente UERJ-FAF. Posso ajudar você a estruturar e estimar seu projeto de software. Descreva sua ideia ou faça upload de documentos para começarmos.'
                }
            ]);
            // Reset Refinement State
            setRefinementData(null);
            setRefinementAnswers({});
            setSelectedOptions({});
            setCustomInputs({});
            setIsRefining(false);
            setProjectContext("");
            setValidationState('idle');
            setValidationData('');
            setInput("");
            setPendingFiles([]);
            setError(null);
            setIsApplying(false);
        }
    }, [isOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, refinementData]);

    // --- Handlers ---

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
            e.target.value = ''; // Reset input to allow re-selecting the same file
        }
    };

    const handleOptionSelect = (questionId: string, value: string) => {
        setSelectedOptions(prev => ({
            ...prev,
            [questionId]: value
        }));
    };

    const handleCustomInputChange = (questionId: string, value: string) => {
        setCustomInputs(prev => ({
            ...prev,
            [questionId]: value
        }));
    };

    const handleRefinementSubmit = async (finalize: boolean = false) => {
        if (!refinementData) return;
        setIsLoading(true);

        // Merge selected options and custom inputs
        const currentRoundAnswers: Record<string, string> = {};
        refinementData.questions.forEach(q => {
            const opt = selectedOptions[q.id];
            const cust = customInputs[q.id];
            if (opt && cust) {
                currentRoundAnswers[q.id] = `${opt} [Detalhes/Complemento: ${cust}]`;
            } else if (opt) {
                currentRoundAnswers[q.id] = opt;
            } else if (cust) {
                currentRoundAnswers[q.id] = cust;
            }
        });

        const updatedAllAnswers = { ...refinementAnswers, ...currentRoundAnswers };
        setRefinementAnswers(updatedAllAnswers);

        const answersArray = Object.entries(currentRoundAnswers).map(([qId, ans]) => ({
            questionId: qId,
            answer: ans
        }));

        // Show user answers in chat
        const userResponseText = "**Respostas enviadas:**\n" + Object.entries(currentRoundAnswers)
            .map(([qId, ans]) => {
                const q = refinementData.questions.find(q => q.id === qId);
                return `- **${q?.text.substring(0, 40)}${q?.text && q.text.length > 40 ? '...' : ''}**: ${ans}`;
            }).join("\n");

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'user',
            content: userResponseText
        }]);

        try {
            if (finalize) {
                // FINALIZE: Generate Plan
                const finalConfidence = refinementData.current_confidence_score || 0;
                setRefinementData(null);
                setIsRefining(false);

                let megaContext = `CONTEXTO ACUMULADO:\n${projectContext}\n\n`;
                megaContext += `DETALHAMENTO TÉCNICO DOS REQUISITOS (VIA ENTREVISTA):\n`;
                Object.entries(updatedAllAnswers).forEach(([qId, ans]) => {
                    megaContext += `[${qId}]: ${ans}\n`;
                });

                // FORCE THE SCORE
                megaContext += `\n\n=== DIRETRIZ DE CONFIANÇA (MANDATÓRIO) ===\n`;
                megaContext += `A auditoria técnica avaliou a confiança atual em: ${finalConfidence}%.\n`;
                megaContext += `Você DEVE usar um valor próximo a este (entre ${Math.max(0, finalConfidence - 5)}% e ${Math.min(100, finalConfidence + 5)}%) no campo 'confidence_score' do JSON final (formato float 0.0-1.0, ex: ${(finalConfidence / 100).toFixed(2)}).\n`;
                megaContext += `NÃO INFLACIONE A NOTA. Seja coerente com a auditoria.`;

                setMessages(prev => [...prev, {
                    id: Date.now().toString() + 'gen',
                    role: 'assistant',
                    content: 'Entendido. Com base em todo o contexto refinado, estou gerando o planejamento executivo final...'
                }]);

                const estimate = await geminiService.generateEstimate(
                    [{ role: 'user', parts: [{ text: megaContext }] }],
                    pendingFiles // Pass full file objects with data
                );

                setMessages(prev => [
                    ...prev,
                    {
                        id: Date.now().toString(),
                        role: 'assistant',
                        content: estimate.description || 'Estimativa gerada com sucesso.',
                        estimate: estimate
                    }
                ]);

            } else {
                // CONTINUE REFINING
                const nextRefinement = await geminiService.refineRequirements(
                    messages
                        .filter(m => m.id !== 'welcome' && !m.isError)
                        .map(m => ({
                            role: (m.role === 'user' ? 'user' : 'model') as "user" | "model",
                            parts: [{ text: m.content || m.text || '' }]
                        })),
                    projectContext,
                    answersArray
                );

                setRefinementData(nextRefinement);
                setSelectedOptions({});
                setCustomInputs({});
            }
        } catch (err: any) {
            console.error(err);
            setError("Erro ao processar. Tente novamente.");
            setMessages(prev => [...prev, {
                id: Date.now().toString() + 'err',
                role: 'assistant',
                isError: true,
                content: 'Houve um erro ao processar suas respostas. Por favor, tente novamente.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        if ((!input.trim() && pendingFiles.length === 0) || isLoading) return;

        const newUserMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            text: input, // legacy
            attachments: pendingFiles.map(f => f.name)
        };

        setMessages(prev => [...prev, newUserMsg]);
        const currentInput = input;

        // Preserve files for API call
        const currentFiles = [...pendingFiles];

        setInput('');
        setPendingFiles([]);
        setIsLoading(true);
        setError(null);

        try {
            // SAFETY: Force reset on first interaction to avoid skipping validation
            let currentValidationState = validationState;
            let currentIsRefining = isRefining;

            if (messages.length <= 1) {
                currentValidationState = 'idle';
                currentIsRefining = false;
                setValidationState('idle');
                setIsRefining(false);
                setRefinementData(null);
            }

            // STEP 1: INITIAL UNDERSTANDING (If not yet accepted and not currently refining)
            if (currentValidationState !== 'accepted' && !currentIsRefining) {
                // Ensure we don't have leftover refinement data showing up ghost panels
                setRefinementData(null);

                // Preserve existing validation files if new ones aren't provided (for correction flow)
                let filesToProcess = currentFiles;
                if (validationFiles.length > 0) {
                    // Combine existing files with new ones (if any), avoiding duplicates based on name
                    const existingNames = new Set(validationFiles.map(f => f.name));
                    const newUniqueFiles = currentFiles.filter(f => !existingNames.has(f.name));
                    filesToProcess = [...validationFiles, ...newUniqueFiles];
                }

                setValidationFiles(filesToProcess); // Persist the full set of files
                setValidationState('validating');

                // Construct history for understanding including files
                const validationHistory = messages.map(m => ({
                    role: m.role === 'user' ? 'user' : 'model' as "user" | "model",
                    parts: [{ text: m.content || m.text || '' }]
                }));
                // Add current message
                validationHistory.push({ role: 'user', parts: [{ text: currentInput }] });

                const understanding = await geminiService.getInitialUnderstanding(
                    validationHistory,
                    filesToProcess
                );

                setValidationData(understanding);
                setValidationState('reviewing');

                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: "Analisei o contexto atualizado. Por favor, valide meu entendimento revisto antes de prosseguirmos.",
                    isError: false
                };
                setMessages(prev => [...prev, aiMsg]);

            } else if (!isRefining) {
                // Should not happen if flow works, but fallback to direct refinement
                setIsRefining(true);
                setProjectContext(currentInput);

                const refinementResponse = await geminiService.refineRequirements(
                    messages
                        .filter(m => m.id !== 'welcome' && !m.isError)
                        .map(m => ({
                            role: (m.role === 'user' ? 'user' : 'model') as "user" | "model",
                            parts: [{ text: m.content || m.text || '' }]
                        })).concat([{ role: 'user', parts: [{ text: currentInput }] }]),
                    currentInput,
                    undefined,
                    currentFiles
                );
                setRefinementData(refinementResponse);
            } else {
                // CHAT DURING REFINEMENT
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: "Por favor, utilize o formulário acima para responder às perguntas de refinamento, ou clique em 'Gerar Plano' se já estiver satisfeito."
                }]);
            }
        } catch (err: any) {
            console.error(err);
            setError('Erro ao processar solicitação. Verifique sua API Key ou tente novamente.');
            setIsRefining(false);
            setValidationState('idle');
            setMessages(prev => [...prev, {
                id: Date.now().toString() + 'err',
                role: 'assistant',
                isError: true,
                content: `Erro: ${err.message || 'Falha na comunicação com a IA'}`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleValidationAction = async (action: 'approve' | 'adjust', adjustmentText?: string) => {
        if (action === 'approve') {
            setValidationState('accepted');
            setIsRefining(true);
            setIsLoading(true);

            try {
                // Initialize refinement with verified context
                // We should include current validationFiles in the context logic
                const history = messages
                    .filter(m => !m.isError && m.id !== 'welcome')
                    .map(m => ({
                        role: m.role === 'user' ? 'user' : 'model' as "user" | "model",
                        parts: [{ text: m.content || m.text || '' }]
                    }));

                const firstUserMsg = messages.find(m => m.role === 'user');
                const pContext = firstUserMsg ? (firstUserMsg.content || firstUserMsg.text || '') : validationData;
                setProjectContext(pContext);

                const refinementResponse = await geminiService.refineRequirements(
                    history,
                    pContext,
                    undefined,
                    validationFiles // Pass stored files!
                );
                setRefinementData(refinementResponse);

            } catch (err) {
                console.error(err);
                setError("Erro ao iniciar refinamento. Verifique se o conteúdo do projeto é válido.");
                setIsRefining(false); // Reset refining state on error to allow retry
                setValidationState('reviewing'); // Go back to review so user can try again
            } finally {
                setIsLoading(false);
            }
        } else {
            // ACTION: ADJUST / CORRECT
            // Reset state to allow user to provide feedback and strictly re-run Initial Understanding
            setValidationState('idle');
            setValidationData(''); // Clear previous understanding to hide the card

            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: "Entendido. Por favor, descreva em detalhes o que está incorreto ou o que falta considerar. Vou reavaliar o contexto com suas observações."
            }]);

            // Ensure input is focused and ready (if ref exists, though logic is mainly state-based)
        }
    };

    const handleApplyClick = async (estimate: EstimateResult) => {
        if (isApplying) return;
        setIsApplying(true);
        setProgressLog(['Iniciando criação do projeto...']);
        try {
            await onApplyEstimate(estimate, (status) => {
                setProgressLog(prev => [...prev, status]);
            });
            onClose();
        } catch (e) {
            console.error(e);
            setIsApplying(false);
        }
    };

    // --- Renderers ---

    const renderRefinementForm = () => {
        if (!refinementData) return null;

        return (
            <div className="bg-white border border-indigo-100 rounded-xl shadow-lg p-6 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 mb-2 text-indigo-800">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                        <Wand2 size={20} className="text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Refinamento de Escopo</h3>
                        <p className="text-xs text-indigo-600 max-w-xl">{refinementData.thought_process}</p>
                    </div>
                </div>

                {/* Confidence Meter */}
                <div className="mb-6 bg-gray-50 border border-gray-100 p-3 rounded-xl flex items-center gap-4">
                    <div className="flex-1">
                        <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                            <span>Confiabilidade da Estimativa Atual</span>
                            <span className={`${refinementData.current_confidence_score >= 80 ? 'text-green-600' : refinementData.current_confidence_score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                {refinementData.current_confidence_score || 0}%
                            </span>
                        </div>
                        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 rounded-full ${refinementData.current_confidence_score >= 80 ? 'bg-green-500' : refinementData.current_confidence_score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${refinementData.current_confidence_score || 0}%` }}
                            />
                        </div>
                    </div>
                    <div className="text-xs text-gray-400 max-w-[200px] leading-tight hidden sm:block">
                        {refinementData.current_confidence_score >= 80
                            ? "Nível ótimo. Podemos gerar o plano final."
                            : "Ainda há incertezas. Recomenda-se mais uma rodada."}
                    </div>
                </div>

                <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {refinementData.questions.map((q, idx) => (
                        <div key={q.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                            <label className="block text-sm font-semibold text-gray-900 mb-3">
                                <span className="text-indigo-600 mr-2">{idx + 1}.</span>
                                {q.text}
                            </label>

                            <div className="space-y-2">
                                {q.options.map((opt, i) => {
                                    const isRecommended = opt.toLowerCase().includes('[recomendado]') || opt.toLowerCase().includes('(recomendado)');
                                    const cleanOpt = opt.replace(/\[recomendado\]/gi, '').replace(/\(recomendado\)/gi, '').trim();

                                    return (
                                        <label key={i} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedOptions[q.id] === opt
                                            ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300'
                                            : 'bg-white border-gray-200 hover:border-indigo-200'
                                            }`}>
                                            <input
                                                type="radio"
                                                name={q.id}
                                                value={opt} // Keep original value for logic consistency
                                                checked={selectedOptions[q.id] === opt}
                                                onChange={(e) => handleOptionSelect(q.id, e.target.value)}
                                                className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 mt-0.5 self-start"
                                            />
                                            <div className="flex-1">
                                                <span className="text-sm text-gray-700 block">{cleanOpt}</span>
                                                {isRecommended && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 mt-1 uppercase tracking-wider">
                                                        Recomendado
                                                    </span>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })}

                                {q.allow_custom && (
                                    <div className="mt-2 text-xs">
                                        <input
                                            type="text"
                                            placeholder="Complemento ou Resposta Personalizada..."
                                            className={`w-full text-sm p-3 rounded-lg border ${customInputs[q.id]
                                                ? 'border-indigo-300 ring-1 ring-indigo-300 bg-white'
                                                : 'bg-gray-50 border-gray-200 text-gray-700 focus:bg-white'
                                                } focus:ring-2 focus:ring-indigo-500 outline-none transition-all`}
                                            onChange={(e) => handleCustomInputChange(q.id, e.target.value)}
                                            value={customInputs[q.id] || ''}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100 sticky bottom-0 bg-white z-10">
                    <button
                        onClick={() => handleRefinementSubmit(false)}
                        disabled={isLoading || refinementData.questions.some(q => !selectedOptions[q.id] && !customInputs[q.id])}
                        className="flex-1 py-3 px-4 bg-white border-2 border-indigo-600 text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                        <span>{isLoading ? 'Processando...' : 'Responder e Próxima Rodada'}</span>
                        {!isLoading && <ArrowRight size={16} />}
                    </button>

                    <button
                        onClick={() => handleRefinementSubmit(true)}
                        disabled={isLoading || refinementData.questions.some(q => !selectedOptions[q.id] && !customInputs[q.id])}
                        className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        <span>{isLoading ? 'Gerando...' : 'Gerar Plano Agora'}</span>
                    </button>
                </div>
            </div>
        );
    };

    const renderMessage = (msg: Message, index: number) => {
        const isUser = msg.role === 'user';
        return (
            <div key={msg.id || index} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-gray-200 text-gray-600' : 'bg-indigo-600 text-white'}`}>
                    {isUser ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div className={`max-w-[85%] ${isUser ? 'bg-gray-100' : 'bg-white border border-gray-100 shadow-sm'} p-4 rounded-2xl ${isUser ? 'rounded-tr-none' : 'rounded-tl-none'} text-sm text-gray-700`}>
                    {msg.content && <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>}
                    {/* Fallback for legacy text property */}
                    {msg.text && !msg.content && <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>}

                    {msg.estimate && (
                        <div className="mt-4 border-t border-gray-200 pt-3">
                            <EstimateView
                                estimate={msg.estimate}
                                onApply={() => handleApplyClick(msg.estimate!)}
                                isApplying={isApplying}
                                progressLog={progressLog}
                            />
                        </div>
                    )}

                    {msg.isError && (
                        <div className="mt-2 flex items-center gap-2 text-red-600 font-semibold">
                            <AlertCircle size={16} />
                            <span>Erro na geração</span>
                        </div>
                    )}

                    {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {msg.attachments.map((file: string, i: number) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-gray-200/50 px-2 py-1 rounded text-xs text-gray-600 border border-gray-300">
                                    <Paperclip size={10} /> {file}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            <div className={`relative bg-white w-full ${isRefining && refinementData ? 'max-w-7xl' : 'max-w-4xl'} h-[90vh] rounded-2xl shadow-2xl flex overflow-hidden ring-1 ring-gray-900/5 transition-all duration-500`}>

                {/* LEFT SIDE: CHAT */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white z-10">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-50 p-2 rounded-xl">
                                <Sparkles className="text-indigo-600" size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 leading-tight">UERJ-FAF 2025</h2>
                                <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                                    {isConfigured ? (
                                        <>
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                            IA Pronta para planejar
                                        </>
                                    ) : 'Configuração necessária'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50 scroll-smooth relative">
                        {!isConfigured ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
                                <AlertCircle size={48} className="text-orange-400 mb-4" />
                                <h3 className="text-lg font-semibold text-gray-800">API Key não configurada</h3>
                                <p className="text-sm text-gray-600 max-w-md mt-2">
                                    Para usar a IA, você precisa adicionar sua chave do Google Gemini nas configurações do sistema.
                                </p>
                            </div>
                        ) : (
                            <>
                                {messages.map((msg, idx) => renderMessage(msg, idx))}

                                {/* VALIDATION BLOCK */}
                                {validationState === 'reviewing' && validationData && (
                                    <div className="flex w-full justify-start animate-in fade-in slide-in-from-left-2 duration-500 mb-6">
                                        <div className="flex max-w-[90%] md:max-w-[85%] gap-3 flex-row">
                                            <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                                                <Sparkles size={16} />
                                            </div>
                                            <div className="flex flex-col gap-3 w-full">
                                                <div className="bg-white border border-indigo-100 shadow-md rounded-2xl rounded-tl-sm overflow-hidden relative group">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>

                                                    <div className="p-5 bg-indigo-50/10">
                                                        <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-3">
                                                            Confirmação de Entendimento
                                                        </h4>
                                                        <div className="prose prose-sm max-w-none text-gray-600 bg-white p-4 rounded-lg border border-indigo-50 scroll-smooth">
                                                            <MarkdownRenderer content={validationData} />
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 p-3 bg-white border-t border-gray-100">
                                                        <button
                                                            onClick={() => handleValidationAction('adjust')}
                                                            className="flex-1 py-2.5 px-4 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <X size={14} /> Corrigir / Ajustar
                                                        </button>
                                                        <button
                                                            onClick={() => handleValidationAction('approve')}
                                                            className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <CheckSquare size={14} /> Correto, Prosseguir
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Loading State */}
                                {isLoading && (
                                    <div className="flex gap-3 animate-pulse">
                                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                                            <Bot size={18} />
                                        </div>
                                        <div className="bg-white border border-gray-100 shadow-sm p-4 rounded-2xl rounded-tl-none flex items-center gap-2 text-gray-500 text-sm">
                                            <Loader2 size={16} className="animate-spin text-indigo-600" />
                                            <span className="font-medium">
                                                {validationState === 'validating' ? 'Analisando documento e contexto...' :
                                                    isRefining ? 'O Analista está gerando perguntas...' : 'Processando...'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-gray-200 shrink-0">
                        {error && (
                            <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-700 text-xs animate-in slide-in-from-bottom-2">
                                <AlertCircle size={14} />
                                {error}
                                <button onClick={() => setError(null)} className="ml-auto hover:text-red-900"><X size={14} /></button>
                            </div>
                        )}

                        {/* File Preview */}
                        {pendingFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {pendingFiles.map((file, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-medium text-indigo-700 animate-in zoom-in-95">
                                        <Paperclip size={12} />
                                        <span className="max-w-[150px] truncate">{file.name}</span>
                                        <button
                                            onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                                            className="hover:bg-indigo-100 p-0.5 rounded-full transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2 items-end">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100"
                                title="Anexar arquivos"
                                disabled={isLoading || (isRefining && validationState === 'accepted')}
                            >
                                <Paperclip size={20} />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                multiple
                                onChange={handleFileSelect}
                            />

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
                                    placeholder={isRefining ? "Utilize o formulário ao lado..." : "Digite os detalhes do projeto..."}
                                    className="w-full bg-gray-50 border-gray-200 border rounded-xl px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none min-h-[50px] max-h-[120px]"
                                    rows={1}
                                    disabled={isLoading || (isRefining && validationState === 'accepted') || validationState === 'reviewing'}
                                />
                            </div>

                            <button
                                onClick={handleSend}
                                disabled={(!input.trim() && pendingFiles.length === 0) || isLoading || (isRefining && validationState === 'accepted') || validationState === 'reviewing'}
                                className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all transform active:scale-95"
                            >
                                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE: REFINEMENT FORM (Conditional) */}
                {isRefining && refinementData && (
                    <div className="w-full md:w-[450px] bg-slate-50 border-l border-gray-200 flex flex-col h-full animate-in slide-in-from-right-10 duration-500 shadow-2xl z-20">
                        {/* Header */}
                        <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <Target size={18} className="text-indigo-600" />
                                Refinamento Ativo
                            </h3>
                            {/* Option to exit refinement if needed, though usually not recommended during interview */}
                            <button
                                onClick={() => {
                                    if (confirm("Deseja cancelar a entrevista e voltar?")) {
                                        setIsRefining(false);
                                        setRefinementData(null);
                                        setValidationState('reviewing');
                                    }
                                }}
                                className="text-gray-400 hover:text-red-500"
                                title="Cancelar entrevista"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {renderRefinementForm()}
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
};
