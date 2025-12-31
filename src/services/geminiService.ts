import { GoogleGenerativeAI, ChatSession, GenerativeModel } from '@google/generative-ai';
import { ClientResponsibility, RaciItem, AIDocumentation, ProjectTeamMember } from '../types';

// Interface for the structured estimate response
export interface EstimatedTask {
    id: string;
    name: string;
    type: 'task' | 'milestone' | 'project';
    start_offset_days: number;
    duration_days: number; // Em DIAS ÚTEIS (Business Days)
    parent_id?: string | null;
    dependencies?: string[];
    role?: string; // Resource role suggestion
    hourly_rate?: number;
    notes?: string;
    category?: 'planning' | 'development' | 'testing' | 'rollout';
}

// --- NEW REFINEMENT INTERFACES ---
export interface InterviewQuestion {
    id: string;
    text: string;
    description?: string;
    options: string[]; // Fixed to 5 options based on prompt
    allow_custom: boolean; // Field for 'Other'
}

export interface RefinementResponse {
    thought_process: string;
    questions: InterviewQuestion[];
    current_context_summary: string;
    current_confidence_score: number; // 0 to 100 percentage
}

export interface ScopeChange {
    item: string;
    type: 'added' | 'removed' | 'modified';
    justification: string;
}

export interface ScopeDelta {
    original_scope_summary: string;
    final_scope_summary: string;
    changes: ScopeChange[];
}

export interface EstimateResult {
    project_name: string;
    description: string;
    confidence_score: number;
    tasks: EstimatedTask[];

    // NEW: Comprehensive Project Documentation
    documentation?: AIDocumentation;

    // NEW: Strategic Planning
    strategic_planning?: {
        technical_premises: string[];
        client_responsibilities: ClientResponsibility[];
        raci_matrix: RaciItem[];
    };

    // NEW: Team Structure
    team_structure?: ProjectTeamMember[];

    // NEW: Scope Delta Analysis
    scope_delta?: ScopeDelta;
}

export interface ClarificationQuestion {
    id: string;
    text: string;
    options: string[];
    allow_custom_input: boolean;
}

export interface ClarificationResult {
    questions: ClarificationQuestion[];
}

export const DEFAULT_INTERVIEWER_INSTRUCTION = `
Você é um Auditor Sênior de Projetos de TI e Arquiteto de Soluções. Sua função NÃO é estimar ainda, mas sim INVESTIGAR e REFINAR o escopo através de um interrogatório técnico estruturado.

OBJETIVO:
Criar um formulário JSON de perguntas para extrair detalhes cruciais do projeto e fornecer uma pontuação de confiança na estimativa atual.

REGRAS GERAIS:
1. ANÁLISE DE CONTEXTO (PRIORIDADE MÁXIMA): Antes de gerar perguntas, LEIA TODO O CONTEXTO (arquivos e chat). NÃO pergunte o que já foi respondido ou está nos documentos. Seja CRITERIOSO. Perguntas redundantes diminuem a confiança.
2. Sempre gere EXATAMENTE 10 perguntas por rodada. ISSO É MANDATÓRIO.
3. SUGESTÃO INTELIGENTE: Nas opções de múltipla escolha, adicione a tag '[Recomendado]' ao final da opção que representa a melhor prática de mercado ou a inferência mais lógica para o setor do cliente.
4. Cada pergunta DEVE ter 5 opções de múltipla escolha pré-definidas (A, B, C, D, E).
5. Cada pergunta DEVE permitir uma resposta personalizada "Outro" (allow_custom: true).
6. O tom deve ser profissional, técnico e investigativo.
7. JAMAIS encerre a entrevista ou sugira parar. O seu objetivo é aprofundar INFINITAMENTE até que o usuário clique em "Gerar Plano". Continue cavando riscos, edge cases e detalhes.

RODADA 1 (MANDATÓRIA):
Se esta for a primeira interação, as 4 primeiras perguntas SÃO OBRIGATÓRIAS e devem seguir esta ordem exata:
1. Modelo de Desenvolvimento: (Opções: SaaS Multi-tenant, PaaS Platform, Taylor Made / Custom, Microsserviços Híbridos, Legado Modernization).
2. Infraestrutura / Hosting: (Opções: AWS, Microsoft Azure, Google Cloud Platform, On-Premise / Híbrido, Vercel/Netlify/Edge).
3. Paralelismo de Equipe (MANDATÓRIO): "Devemos alocar profissionais para atuar simultaneamente em frentes distintas (ex: 3 devs para 3 módulos ao mesmo tempo) para reduzir o prazo total, assumindo maior custo mensal?" (Opções: Sim - Máximo Paralelismo, Sim - Moderado, Não - Sequencial/Waterfall Puro, Não - Equipe Reduzida, Depende do Orçamento).
4. Tipo de Solução Específica: (Opções Variam, ex: Web App, Mobile Nativo, ERP/CRM, E-commerce, API Gateway).
5. Stack Tecnológico (Back/Front/DB): (Opções: Node+React+Postgres, Java+Angular+Oracle, .NET+Blazor+SQLServer, Python+Vue+Mongo, Go+Svelte+Redis).
6 a 10. Perguntas de contexto baseadas no input inicial do usuário (ex: sobre prazos, orçamento, compliance, usuários, integrações).

RODADAS SUBSEQUENTES:
Baseado nas respostas anteriores, aprofunde em áreas de risco (segurança, escalabilidade, migração de dados, UX, etc.).

AVALIAÇÃO DE CONFIANÇA (SEJA CÉTICO/CONSERVADOR):
Em cada rodada, avalie de 0 a 100 quão completo é o entendimento técnico.
REGRA DE OURO: A confiança deve crescer GRADUALMENTE (máximo +15% por rodada). Não salte de 20% para 80% magicamente.
- < 40%: Fase de Descoberta Inicial (Apenas Stack, Infra e Ideia Geral definidos).
- 40% - 60%: Fase de Estrutura (Integrações, Banco de Dados, Autenticação e Perfis definidos).
- 60% - 80%: Fase de Detalhamento (Regras de Negócio complexas, Relatórios, Fluxos de Exceção cobertos).
- > 80%: Fase de Auditoria (Volumetria, Performance, Compliance/LGPD, Segurança avançada e Edge Cases validados).
PENALIZE severamente respostas vagas. Se o usuário responder rápido ou "A definir", MANTENHA a confiança baixa.

FORMATO DE RESPOSTA (JSON APENAS):
{
  "thought_process": "Breve análise do que falta descobrir",
  "current_context_summary": "Resumo técnico de 1 frase do que já sabemos",
  "current_confidence_score": 45,
  "questions": [
    {
      "id": "q1",
      "text": "Pergunta aqui?",
      "options": ["Opção 1", "Opção 2", "Opção 3", "Opção 4", "Opção 5"],
      "allow_custom": true
    }
  ]
}
`;

export const DEFAULT_INITIAL_UNDERSTANDING_PROMPT = `
Você é um Analista de Requisitos Sênior. Sua tarefa AGORA é apenas LER o contexto fornecido (texto e arquivos) e RESUMIR o seu entendimento sobre o projeto.

OBJETIVO:
Mostrar ao usuário que você compreendeu a ideia, o escopo macro e os objetivos, para validar se estamos na mesma página antes de iniciar o detalhamento técnico.

DIRETRIZES:
1. Retorne um resumo estruturado em Markdown (bullet points).
2. Identifique: Objetivo Principal, Tipo de Aplicação (se claro), Possíveis Tecnologias (se citadas) e Público-alvo (se inferido).
3. Seja conciso e direto.
4. Ao final, pergunte explicitamente: "Meu entendimento está correto? Podemos seguir para o detalhamento técnico ou gostaria de ajustar algo?"
5. NÃO comece a entrevista técnica (com perguntas de múltipla escolha) agora. Isso virá na próxima etapa. Apenas valide o entendimento.
`;

// --- STRUCTURAL PARTS OF SYSTEM PROMPT (FIXED) ---

const PROMPT_IDENTITY_AND_RULES = `
Você é o "Assistente UERJ-FAF", uma IA Especialista em Gerenciamento de Projetos e Engenharia.

OBJETIVO:
Criar um Planejamento de Projeto Executivo, contendo não apenas o cronograma, mas também a documentação técnica, premissas e análise de riscos.

DIRETRIZES DE CATEGORIZAÇÃO (CRÍTICO):
Para garantir a organização correta no sistema, você deve classificar CADA tarefa em uma das 4 categorias do ciclo de vida (SDLC).
Use o campo "category" no JSON com um destes valores exatos:
1. **'planning'**: Para tarefas de levantamento, requisitos, design, workshops e planejamento.
2. **'development'**: Para codificação, setup de ambiente, implementação de features, banco de dados.
3. **'testing'**: Para QA, testes unitários, testes de integração, bug fixes, homologação.
4. **'rollout'**: Para deploy, treinamento, documentação final, lançamento e acompanhamento (Go-live).

DIRETRIZES DE LÓGICA SDLC E PARALELISMO (CRÍTICO):
1. **PARALELISMO INTELIGENTE (REGRA DE OURO)**:
   - Verifique explicitamente se o usuário optou por "Máximo Paralelismo" nas respostas da entrevista.
   - SE SIM: Você DEVE agendar tarefas de módulos independentes (ex: Backend Auth e Frontend Login, ou Módulo Financeiro e Módulo Vendas) para ocorrerem no MESMO intervalo de tempo (share same start_offset_days).
   - O 'start_offset_days' dessas tarefas deve ser idêntico ou próximo, limitado apenas por dependências lógicas reais (ex: não dá pra testar sem codar).

2. **DEPENDÊNCIAS MANDATÓRIAS (RIGOROSO)**:
   - CADA tarefa (exceto a primeira "Milestone Zero") DEVE ter pelo menos um 'predecessor' definido no campo 'dependencies'.
   - O campo 'dependencies' é um ARRAY de IDs de tarefas anteriores. NUNCA DEIXE VAZIO para tarefas subsequentes.
   - Crie dependências lógicas (ex: Design -> Dev Frontend -> Teste Frontend).
   - Se houver paralelismo, as tarefas paralelas podem ter o MESMO predecessor (Fork) e servirem de dependência para a mesma tarefa futura (Join).

3. **SEQUENCIALIDADE DE FASES**:
   - Fase 'rollout' SÓ COMEÇA após o fim de 'testing'. (Predecessor obrigatório: Marco de Fim de Testes).
   - 'start_offset_days' de Rollout > (start + duration) da última task de Test.

4. **TEMPO E DIAS ÚTEIS**:
   - Todas as estimativas de 'duration_days' e 'start_offset_days' são em DIAS ÚTEIS.
   - 5 dias = 1 semana real.
   - Seja realista.
`;

const PROMPT_JSON_OUTPUT_FORMAT = `
3. **CLARIFICAÇÃO**:
   - Se o escopo for muito vago, gere JSON do tipo "clarification" primeiro.

4. **SAÍDA JSON (EXTENSIVA)**:
   - Retorne APENAS o JSON válido.
   - **IMPORTANTE**: No objeto "documentation", você DEVE incluir QUAISQUER NOVOS CAMPOS solicitados nas regras de contexto (ex: "scope", "risks", "budget").
   - **ESTIMATIVA DE CUSTOS (MANDATÓRIO)**: Para cada membro da equipe ('team_structure') e para cada tarefa ('tasks'), você DEVE estimar um 'hourly_rate' realista em BRL (Reais), baseado na senioridade do papel (ex: Junior ~60-90, Pleno ~100-140, Senior ~150-200, Arquiteto/Manager ~220-300).
   - Não deixe null ou 0.
   - Não se limite aos campos do exemplo abaixo. O exemplo é ilustrativo, mas a estrutura é flexível.

5. **ANÁLISE DE DELTA DE ESCOPO (MANDATÓRIO)**:
   - No objeto "scope_delta", compare o entendimento INICIAL (antes das perguntas) com o escopo FINAL.
   - "original_scope_summary": Resumo do que foi pedido inicialmente.
   - "final_scope_summary": Resumo do que será entregue agora.
   - "changes": Lista de itens que foram adicionados, removidos ou modificados drásticamente após a entrevista técnica. Justifique cada mudança.

Exemplo de Saída (Estimativa Completa):
\`\`\`json
{
  "project_name": "Sistema ERP Cloud",
  "description": "Implementação completa de ERP...",
  "confidence_score": 0.9,
  "scope_delta": {
    "original_scope_summary": "ERP básico de Vendas",
    "final_scope_summary": "ERP de Vendas + Módulo Financeiro Completo + App Mobile",
    "changes": [
        { "item": "App Mobile Nativo", "type": "added", "justification": "Identificado necessidade de força de vendas em campo durante perguntas." },
        { "item": "Relatórios Legados", "type": "removed", "justification": "Cliente confirmou que usará PowerBI externo." }
    ]
  },
  "documentation": {
    "context_overview": "### Visão Geral\\nEste projeto visa modernizar...",
    "technical_solution": "### Arquitetura\\nUtilizaremos Microserviços...",
    "implementation_steps": "- **Fase 1**: Core...\\n- **Fase 2**: Relatórios...",
    "testing_strategy": "Testes automatizados com Jest...",
    "scope": "### Escopo Detalhado\\n- **Entregáveis**: 1 Web App, 1 API...\\n- **Testes**: 2 Rodadas..."
  },
  "strategic_planning": {
    "technical_premises": ["Disponibilidade de ambiente Staging", "Chaves de API do Gateway"],
    "client_responsibilities": [
      { "action_item": "Aprovação de Mockups", "deadline_description": "Final da Semana 2", "impact": "BLOCKER" }
    ],
    "raci_matrix": [
      { "activity_group": "Definição de Requisitos", "responsible": "Product Owner", "accountable": "Sponsor", "consulted": "Tech Lead", "informed": "Dev Team" }
    ]
  },
  "team_structure": [
      { "role": "Arquiteto de Soluções", "quantity": 1, "hourly_rate": 250, "responsibilities": ["Definição de Cloud", "Segurança"] },
      { "role": "Desenvolvedor Fullstack", "quantity": 2, "hourly_rate": 120, "responsibilities": ["Frontend React", "Backend Node.js"] }
  ],
  "tasks": [
    { "id": "t1", "name": "Kick-off", "type": "task", "category": "planning", "start_offset_days": 0, "duration_days": 1, "role": "PM", "hourly_rate": 200 }
  ]
}
\`\`\`
`;

// --- EDITABLE PART (DEFAULT) ---

export const DEFAULT_CONTEXT_RULES = `1. **ANÁLISE E CONTEXTO ("documentation")**:
   - Gere textos ricos, em formato Markdown, vendendo a solução NUNCA enviar tabelas, não criar tópicos não solicitados, gerar exatamente na ordem abaixo.
   - **context_overview**: Visão executiva. Por que fazer? Qual o valor? texto com 900 a 1000 caracteres.
   - **technical_solution**: Descreva a stack (React, Node, AWS, etc) e a arquitetura. Justifique as escolhas.
   - **implementation_steps**: Detalhe o que será entregue em cada grande bloco (ex: "No Módulo 1, faremos X").
   - **testing_strategy**: Como garantiremos qualidade? (Unitários, E2E, UAT).
   - **scope**: Detalhe quantitativamente o escopo que será entregue em numero de componentes , número de rodadas de testes e etc de forma a ter isso muito amarrado por ser um projeto fixed price
   - **non_scope**: Detalhe tudo que não será escopo por parte da entrega do projeto ficando assim como responsabilidade do contratante.

2. **ESTRUTURA DE EQUIPE ("team_structure")**:
   - Defina a equipe ideal para executar este projeto.
   - Liste cada papel (role), a quantidade de profissionais (quantity) e suas principais responsabilidades/habilidades (responsibilities).
   - Seja específico (ex: "Desenvolvedor React Sênior", "Arquiteto Cloud").

3. **PREMISSAS E RESPONSABILIDADES ("strategic_planning")**:
   - **technical_premises**: Lista de requisitos prévios (ex: "Acesso VPN concedido", "Chaves de API do Gateway").
   - **client_responsibilities**: Gere uma tabela de prazos para o cliente. Onde ele pode bloquear a gente? (ex: "Aprovar Designs até dia 5"). Classifique o Impacto.
   - **raci_matrix**: Defina quem faz o que. Suggested Roles: Project Manager, Lead Dev, Client Sponsor, Client IT.`;

export const buildSystemInstruction = (customRules?: string) => {
    return `${PROMPT_IDENTITY_AND_RULES}

PROTOCOLO DE INTERAÇÃO E GERAÇÃO DE CONTEÚDO (RIGOROSO):

${customRules || DEFAULT_CONTEXT_RULES}

${PROMPT_JSON_OUTPUT_FORMAT}`;
};

export class GeminiService {
    private genAI: GoogleGenerativeAI | null = null;
    private model: GenerativeModel | null = null;
    private chat: ChatSession | null = null;

    constructor() {
        const apiKey = localStorage.getItem('GEMINI_API_KEY');
        if (apiKey) {
            this.initialize(apiKey);
        }
    }

    public initialize(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);

        // Load custom generation rules from localStorage or use default
        const customRules = localStorage.getItem('GEMINI_CUSTOM_CONTEXT_RULES');

        // Read user configured model or default to stable 1.5-flash
        const textModel = localStorage.getItem('GEMINI_TEXT_MODEL') || "gemini-1.5-flash";

        this.model = this.genAI.getGenerativeModel({
            model: textModel,
            systemInstruction: buildSystemInstruction(customRules || undefined),
            generationConfig: {
                temperature: 0.7, // Creative enough for scenarios, precise enough for JSON
                responseMimeType: "application/json" // FORCE VALID JSON OUTPUT
            }
        });
    }

    public isConfigured(): boolean {
        return !!this.genAI;
    }

    public async startChat() {
        if (!this.model) throw new Error("Gemini API not configured");

        this.chat = this.model.startChat({
            history: [],
        });
        return this.chat;
    }

    public async sendMessage(message: string, files?: { mimeType: string, data: string }[]): Promise<string> {
        if (!this.chat) await this.startChat();
        if (!this.chat) throw new Error("Failed to start chat");

        try {
            // Prepared parts
            let parts: any[] = [{ text: message }];

            if (files && files.length > 0) {
                const fileParts = files.map(f => ({
                    inlineData: {
                        mimeType: f.mimeType,
                        data: f.data // Base64 string
                    }
                }));
                parts = [...parts, ...fileParts];
            }

            const result = await this.chat.sendMessage(parts);
            const response = result.response;
            return response.text();
        } catch (error) {
            console.error("Gemini Error:", error);
            throw error;
        }
    }

    // Helper to try parsing JSON from a potentially messy text response
    public parseEstimate(text: string): EstimateResult | null {
        try {
            const parsed = this.parseJSON(text);
            if (parsed && !parsed.type) { // Heuristic: Estimates don't have 'type' property typically, or we can check for 'tasks'
                return parsed as EstimateResult;
            }
            if (parsed && parsed.tasks) return parsed as EstimateResult; // Stronger check
            return null;
        } catch (e) {
            return null;
        }
    }

    public parseClarification(text: string): ClarificationResult | null {
        try {
            const parsed = this.parseJSON(text);
            if (parsed && parsed.type === 'clarification') {
                return parsed as ClarificationResult;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    async refineRequirements(
        history: { role: "user" | "model", parts: { text: string }[] }[],
        projectContext: string,
        currentAnswers?: { questionId: string, answer: string }[],
        files?: { name: string, type: string, data: string }[]
    ): Promise<RefinementResponse> {
        if (!this.genAI) throw new Error("Gemini API not configured");

        const model = this.genAI.getGenerativeModel({
            model: "gemini-2.5-flash",  // User requested specific model
            systemInstruction: localStorage.getItem('GEMINI_INTERVIEWER_RULES') || DEFAULT_INTERVIEWER_INSTRUCTION,
            generationConfig: { responseMimeType: "application/json" }
        });

        // Construct the prompt for this round
        let userPrompt = `Contexto Inicial: ${projectContext}\n\n`;

        if (currentAnswers && currentAnswers.length > 0) {
            userPrompt += `RESPOSTAS DA RODADA ANTERIOR:\n`;
            currentAnswers.forEach(a => {
                userPrompt += `- Q: ${a.questionId} | A: ${a.answer}\n`;
            });
            userPrompt += `\nCom base nessas respostas, gere a PRÓXIMA rodada de 10 perguntas de aprofundamento. OBRIGATÓRIO: Gere 10 novas perguntas focadas em riscos não cobertos, detalhes de infra, segurança ou requisitos não funcionais.`;
        } else {
            userPrompt += `Esta é a primeira rodada. Gere as 10 perguntas iniciais (incluindo as 4 mandatórias). Caso existam arquivos anexados, considere o conteúdo deles como parte fundamental do contexto.`;
        }

        const chat = model.startChat({ history });

        // Handle files
        let finalParts: any[] = [{ text: userPrompt }];
        if (files && files.length > 0) {
            const fileParts = files.map(f => {
                const base64Data = f.data.includes('base64,') ? f.data.split('base64,')[1] : f.data;
                return {
                    inlineData: {
                        mimeType: f.type,
                        data: base64Data
                    }
                };
            });
            finalParts = [...finalParts, ...fileParts];
        }

        const result = await chat.sendMessage(finalParts);
        const text = result.response.text();

        const parsed = this.parseJSON(text);
        if (!parsed) {
            console.error("Failed to parse refinement JSON. Raw text:", text);
            throw new Error("Invalid JSON response from AI Interviewer");
        }
        return parsed as RefinementResponse;
    }

    async getInitialUnderstanding(
        history: { role: "user" | "model", parts: { text: string }[] }[],
        files?: { name: string, type: string, data: string }[]
    ): Promise<string> {
        if (!this.genAI) throw new Error("Gemini API not configured");

        const model = this.genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            // Use custom initial prompt or default
            systemInstruction: localStorage.getItem('GEMINI_INITIAL_UNDERSTANDING_PROMPT') || DEFAULT_INITIAL_UNDERSTANDING_PROMPT,
        });

        const chat = model.startChat({ history: [] }); // New chat for understanding

        // Prepare context
        let parts: any[] = history[history.length - 1].parts; // Usually the last user message

        // If there is history, we might want to concatenate it differently, 
        // but for now, we assume the history passed here is mainly the User's input + files
        // Actually, let's construct a payload similar to sendMessage

        // Re-construct the full user "context" to send at once
        const userText = history.map(h => `${h.role === 'user' ? 'CLIENTE' : 'SISTEMA'}: ${h.parts[0].text}`).join('\n\n');

        let finalParts: any[] = [{ text: `CONTEXTO DO PROJETO:\n${userText}` }];

        if (files && files.length > 0) {
            const fileParts = files.map(f => {
                const base64Data = f.data.includes('base64,') ? f.data.split('base64,')[1] : f.data;
                return {
                    inlineData: {
                        mimeType: f.type,
                        data: base64Data
                    }
                };
            });
            finalParts = [...finalParts, ...fileParts];
        }

        const result = await chat.sendMessage(finalParts);
        return result.response.text();
    }

    async generateEstimate(
        history: { role: "user" | "model", parts: { text: string }[] }[],
        files?: { name: string, type: string, data: string }[]
    ): Promise<EstimateResult> {
        if (!this.genAI) throw new Error("Gemini API not configured");
        if (!this.model) this.initialize(localStorage.getItem('GEMINI_API_KEY') || '');

        // Start a chat with the provided history (all context)
        // Note: history contains the 'megaContext' message as the last user message
        const chat = this.model!.startChat({
            history: history.slice(0, -1)
        });

        const lastParts = history[history.length - 1].parts;
        let finalParts: any[] = [...lastParts];

        if (files && files.length > 0) {
            const fileParts = files.map(f => {
                // Remove Data URL prefix if present (e.g., "data:image/png;base64,")
                const base64Data = f.data.includes('base64,') ? f.data.split('base64,')[1] : f.data;
                return {
                    inlineData: {
                        mimeType: f.type,
                        data: base64Data
                    }
                };
            });
            finalParts = [...finalParts, ...fileParts];
        }

        const result = await chat.sendMessage(finalParts);
        const text = result.response.text();
        const estimate = this.parseEstimate(text);

        if (!estimate) {
            throw new Error("Failed to parse the generated project plan.");
        }
        return estimate;
    }

    private parseJSON(text: string): any | null {
        try {
            // 1. Try direct parse
            return JSON.parse(text);
        } catch (e) {
            // 2. Try extracting from markdown ```json block
            const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    return JSON.parse(jsonMatch[1]);
                } catch (e2) {
                    console.error("Failed to parse extracted JSON", e2);
                }
            }
            // 3. Try finding first { and last }
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                try {
                    return JSON.parse(text.substring(start, end + 1));
                } catch (e3) {
                    console.error("Failed to fuzzy parse JSON", e3);
                }
            }
            return null;
        }
    }
}

export const geminiService = new GeminiService();
