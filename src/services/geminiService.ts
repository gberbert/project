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
    category?: 'planning' | 'development' | 'testing' | 'rollout' | 'management';
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

    // NEW: Suggested Components (Dynamic Learning)
    suggested_components?: {
        name: string;
        technology: string;
        hours: number;
        reasoning: string;
    }[];
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
Você é um Consultor Sênior de Tecnologia e Negócios (CTO/Product Strategist).
Sua tarefa é LER todo o contexto (chat e arquivos) e estruturar um "Diagnóstico Inicial de Entendimento" que impressione pela profundidade e clareza.

OBJETIVO:
Demonstrar que você captou não apenas o "o que" (escopo), mas o "porquê" (estratégia) e o "como" (técnica preliminar).

DIRETRIZES DE RESPOSTA (Markdown):
1. **Resumo Executivo**: Em 1 parágrafo, sintetize a essência do projeto com linguagem corporativa de alto nível.
2. **Pilares do Projeto** (Bullet points):
   - **Objetivo Estratégico**: Qual dor de negócio estamos resolvendo?
   - **Solução Proposta**: O que será construído (App, API, Plataforma)?
   - **Público-Alvo & Impacto**: Quem usa e qual o benefício esperado.
3. **Análise Técnica Preliminar**:
   - Stack Sugerida ou Identificada com base nos requisitos.
   - Principais Desafios/Riscos que você já vislumbra (ex: integração, segurança, prazo).
4. **Próximos Passos**: Valide se podemos avançar para a fase de Detalhamento/Estimativa.

IMPORTANTE:
- Seja confiante e consultivo.
- Não invente requisitos, mas faça inferências lógicas baseadas em padrões de mercado para preencher lacunas óbvias.
- Ao final, pergunte: "Essa visão estratégica está alinhada com sua expectativa? Posso prosseguir para o detalhamento técnico e estimativa?"
`;

// --- STRUCTURAL PARTS OF SYSTEM PROMPT (FIXED) ---


export const DEFAULT_ARCHITECTURE_PROMPT = `
Você é um Arquiteto de Soluções Cloud Sênior e Designer Técnico.
Sua tarefa é criar um PROMPT DETALHADO para um modelo de geração de imagens(como DALL - E 3 ou Imagen), que resultará em um diagrama de arquitetura profissional e moderno.

CONTEXTO TÉCNICO DO PROJETO:
{ technical_solution }

DIRETRIZES VISUAIS PARA A IMAGEM:
1. ** Estilo **: "Isométrico 3D Moderno" ou "Flat Design Executivo"(escolha o que melhor se adapta).Fundo limpo(branco ou cinza muito suave).
2. ** Componentes Mandatórios **:
    *   ** Fronteiras **: Delimite claramente a infraestrutura(ex: Nuvem AWS / GCP vs Cliente On - Premise vs Usuário Final).
    *   ** Camadas **: Frontend(Web / Mobile) -> API Gateway / Load Balancer -> Backend Services -> Dados(DB / Cache).
    *   ** Logos **: Inclua logos estilizados das tecnologias citadas no contexto(ex: React, Node.js, PostgreSQL, Docker, AWS).
3. ** Conexões **: Setas de fluxo de dados claras e elegantes.
4. ** Atmosfera **: Tecnológica, segura e robusta.Cores corporativas(Azul, Roxo, Cinza).

A SAÍDA DEVE SER APENAS O TEXTO DO PROMPT EM INGLÊS, OTIMIZADO PARA IMAGEN / DALL - E.
`;

const PROMPT_IDENTITY_AND_RULES = `
Você é o "Assistente UERJ-FAF", uma IA Especialista em Gerenciamento de Projetos e Engenharia.

    OBJETIVO:
Criar um Planejamento de Projeto Executivo, contendo não apenas o cronograma, mas também a documentação técnica, premissas e análise de riscos.

DIRETRIZES DE CATEGORIZAÇÃO(CRÍTICO):
Para garantir a organização correta no sistema, você deve classificar CADA tarefa em uma das 5 categorias do ciclo de vida(SDLC).
Use o campo "category" no JSON com um destes valores exatos:
1. ** 'planning' **: Levantamento, requisitos, design.
2. ** 'development' **: Codificação, setup, feature impl.
3. ** 'testing' **: QA, bug fixes, homologação.
4. ** 'rollout' **: Deploy, treino, go-live.
5. ** 'management' **: Gestão de Projetos, reuniões de status, controle.

DIRETRIZES DE ALOCAÇÃO E GESTÃO (MANDATÓRIO):
1. ** REGRA DO FTE INTEIRO (SATURAÇÃO DIÁRIA) - CRÍTICO **:
   - O nosso modelo de contrato exige ALOCAÇÃO MENSAL FECHADA (Full Time Equivalent).
   - SIGNIFICA QUE: Se um recurso está ativo no projeto em um determinado mês, ele deve ser considerado "Full Time" (8 horas/dia) durante os dias em que estiver no projeto.
   - PODE CONSIDERAR OCIOSIDADE: Se a tarefa técnica levar apenas 4h/dia, você DEVE arredondar a alocação para 8h/dia (bloqueando o recurso).
   - EXEMPLO PRÁTICO:
     * Se trabalha 10 dias úteis em Março: Aloque 80 horas (10 * 8h).
     * Se trabalha o mês inteiro (ex: 21 dias úteis) em Abril: Aloque ~168 horas.
   - NÃO ALOQUE FRAÇÕES (ex: não faça "2h por dia durante 2 meses"). Prefira "8h por dia durante 2 semanas". Concentre o esforço.

2. ** GESTÃO DE PROJETO OBRIGATÓRIA **:
   - É MANDATÓRIO criar uma tarefa/trilha chamada "Gestão do Projeto & Acompanhamento".
   - Categoria: 'management'.
   - Duração: DEVE cobrir TODO o período do projeto (Do Dia 0 até o último dia de Rollout).
   - Recurso: "Gerente de Projetos (GP)".
   - Esforço: Aloque horas suficientes para cobrir o acompanhamento mensal contínuo.

DIRETRIZES DE LÓGICA SDLC E PARALELISMO(CRÍTICO):
1. ** PARALELISMO INTELIGENTE(REGRA DE OURO) **:
- Verifique explicitamente se o usuário optou por "Máximo Paralelismo" nas respostas da entrevista.
   - SE SIM: Você DEVE agendar tarefas de módulos independentes(ex: Backend Auth e Frontend Login, ou Módulo Financeiro e Módulo Vendas) para ocorrerem no MESMO intervalo de tempo(share same start_offset_days).
   - O 'start_offset_days' dessas tarefas deve ser idêntico ou próximo, limitado apenas por dependências lógicas reais(ex: não dá pra testar sem codar).

2. ** DEPENDÊNCIAS MANDATÓRIAS(RIGOROSO) **:
- CADA tarefa(exceto a primeira e a de Gestão) DEVE ter pelo menos um 'predecessor' definido no campo 'dependencies'.
   - O campo 'dependencies' é um ARRAY de IDs de tarefas anteriores.NUNCA DEIXE VAZIO para tarefas subsequentes.
   - Crie dependências lógicas(ex: Design -> Dev Frontend -> Teste Frontend).
   - Se houver paralelismo, as tarefas paralelas podem ter o MESMO predecessor(Fork) e servirem de dependência para a mesma tarefa futura(Join).

3. ** SEQUENCIALIDADE DE FASES **:
- Fase 'rollout' SÓ COMEÇA após o fim de 'testing'. (Predecessor obrigatório: Marco de Fim de Testes).
   - 'start_offset_days' de Rollout > (start + duration) da última task de Test.

4. ** TEMPO E DIAS ÚTEIS **:
- Todas as estimativas de 'duration_days' e 'start_offset_days' são em DIAS ÚTEIS.
   - 5 dias = 1 semana real.
   - Seja realista.
`;

const PROMPT_JSON_OUTPUT_FORMAT = `
3. ** CLARIFICAÇÃO **:
- Se o escopo for muito vago, gere JSON do tipo "clarification" primeiro.

4. ** SAÍDA JSON(EXTENSIVA) **:
- Retorne APENAS o JSON válido.
   - ** IMPORTANTE **: No objeto "documentation", você DEVE incluir QUAISQUER NOVOS CAMPOS solicitados nas regras de contexto(ex: "scope", "risks", "budget").
   - ** ESTIMATIVA DE CUSTOS(MANDATÓRIO) **: Para cada membro da equipe('team_structure') e para cada tarefa('tasks'), você DEVE estimar um 'hourly_rate' realista em BRL(Reais), baseado na senioridade do papel(ex: Junior ~60 - 90, Pleno ~100 - 140, Senior ~150 - 200, Arquiteto / Manager ~220 - 300).
   - Não deixe null ou 0.
    - Não se limite aos campos do exemplo abaixo.O exemplo é ilustrativo, mas a estrutura é flexível.

5. ** ANÁLISE DE DELTA DE ESCOPO(MANDATÓRIO) **:
- No objeto "scope_delta", compare o entendimento INICIAL(antes das perguntas) com o escopo FINAL.
   - "original_scope_summary": Resumo do que foi pedido inicialmente.
   - "final_scope_summary": Resumo do que será entregue agora.
   - "changes": Lista de itens que foram adicionados, removidos ou modificados drásticamente após a entrevista técnica.Justifique cada mudança.

Exemplo de Saída(Estimativa Completa):
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
  ],
  "suggested_components": [
      { "name": "Integrador de Biometria", "technology": "React Native", "hours": 32, "reasoning": "Componente específico não listado no padrão." }
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

const getPricingConfigContext = () => {
    try {
        const stored = localStorage.getItem('PRICING_CONFIG');
        if (!stored) return "";

        const config = JSON.parse(stored);
        const matrix = config.matrix || {};
        const components = config.components || [];

        if (Object.keys(matrix).length === 0 && components.length === 0) return "";

        let text = "\n\n=== DIRETRIZES DE PRECIFICAÇÃO E ESTIMATIVA (CONFIGURAÇÃO TÉCNICA) ===\n";
        text += "ATENÇÃO: Utilize as tabelas abaixo para calibrar suas estimativas de horas e definição de escopo.\n\n";

        text += "1. MATRIZ DE PESO (Complexidade x Incerteza):\n";
        text += "Use estes fatores para ponderar a dificuldade das tarefas quando houver incerteza:\n";
        text += JSON.stringify(matrix, null, 2) + "\n\n";

        text += "2. CATÁLOGO DE OBJETOS E COMPONENTES PADRÃO:\n";
        text += "Ao descrever o 'scope' e estimar 'tasks', você DEVE quantificar os itens usando estes objetos como referência base (Technology - Name: Avg Hours):\n";

        // Group by tech for better readability for the LLM
        const grouped: Record<string, string[]> = {};
        components.forEach((c: any) => {
            if (!grouped[c.technology]) grouped[c.technology] = [];
            grouped[c.technology].push(`   - [${c.id}] ${c.name}: ~${c.hours}h`);
        });

        Object.entries(grouped).forEach(([tech, lines]) => {
            text += `\n   [${tech}]\n${lines.join('\n')}`;
        });

        text += "\n\nINSTRUÇÕES MANDATÓRIAS DE ESCOPO E COMPONENTES:\n";
        text += "1. No campo 'scope' do JSON, você DEVE quantificar o esforço listando os objetos (ex: 'Serão desenvolvidos 5x Screen Container, 3x API Route Handler...').\n";
        text += "2. COMPONENTES AUSENTES: Se a solução exigir um componente que NÃO existe na lista acima, você DEVE listá-lo no array 'suggested_components' do JSON (ver estrutura abaixo). Crie um nome coerente, defina a tecnologia e estime as horas para um Pleno. NÃO invente IDs, deixe null.\n";

        return text;
    } catch (e) {
        console.error("Error reading pricing config for prompt", e);
        return "";
    }
};

export const buildSystemInstruction = (customRules?: string) => {
    const pricingContext = getPricingConfigContext();
    return `${PROMPT_IDENTITY_AND_RULES}

PROTOCOLO DE INTERAÇÃO E GERAÇÃO DE CONTEÚDO (RIGOROSO):

${customRules || DEFAULT_CONTEXT_RULES}

${pricingContext}

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
    async generateArchitecturePrompt(technicalContext: string): Promise<string> {
        if (!this.genAI) throw new Error("Gemini API not configured");

        const systemPrompt = localStorage.getItem('GEMINI_ARCHITECTURE_PROMPT') || DEFAULT_ARCHITECTURE_PROMPT;
        const finalPrompt = systemPrompt.replace('{technical_solution}', technicalContext);

        const model = this.genAI.getGenerativeModel({
            model: localStorage.getItem('GEMINI_TEXT_MODEL') || "gemini-1.5-flash",
        });

        const result = await model.generateContent(finalPrompt);
        return result.response.text();
    }

    async generateImage(prompt: string): Promise<string> {
        const apiKey = localStorage.getItem('GEMINI_API_KEY');
        if (!apiKey) throw new Error("Gemini API Key not found");

        const imageModel = localStorage.getItem('GEMINI_IMAGE_MODEL') || "gemini-3-pro-image-preview";

        // Ensure model name has 'models/' prefix if not present for the URL construction
        // NOTE: The user example used 'models/NAME:generateContent'
        const actualModel = imageModel.includes('models/') ? imageModel : `models/${imageModel}`;

        // Switch to generateContent endpoint as per user example
        const url = `https://generativelanguage.googleapis.com/v1beta/${actualModel}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.warn(`Image Generation Failed with ${actualModel}: ${err}. Retrying with fallback...`);
            // Fallback to a known stable model for images if available or just return error
            // For now, let's just throw, but clearer.
            throw new Error(`Image Generation Failed (${actualModel}): ${err}`);
        }

        const data = await response.json();

        // Parse "inlineData" from generateContent response (User's Example Format)
        const candidate = data.candidates?.[0];
        const part = candidate?.content?.parts?.[0];

        if (part?.inlineData?.data) {
            // It defaults to image/png usually, but mimeType is often provided
            const mimeType = part.inlineData.mimeType || 'image/png';
            return `data:${mimeType};base64,${part.inlineData.data}`;
        }

        throw new Error("No image data received from API (Unexpected response format)");
    }

    async analyzeSlideLayout(imageBase64: string): Promise<{ safe_area: { x: number, y: number, w: number, h: number }, font_color: string }> {
        if (!this.genAI) throw new Error("Gemini API not configured");

        const model = this.genAI.getGenerativeModel({
            model: localStorage.getItem('GEMINI_TEXT_MODEL') || "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
            Analyze this presentation slide background image. 
            Identify the optimal "safe area" for placing text content. This should be a large, continuous empty or low-contrast space.
            Avoid covering important visual elements (logos, complex graphics).
            
            Return ONLY a JSON object with this structure:
            {
                "safe_area": { 
                    "x": number (percentage 0-100 from left), 
                    "y": number (percentage 0-100 from top), 
                    "w": number (percentage 0-100 width), 
                    "h": number (percentage 0-100 height) 
                },
                "font_color": string (hex color code best for contrast on this area, e.g. "#FFFFFF" or "#000000")
            }
        `;

        // Strip prefix if present
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: cleanBase64,
                    mimeType: imageBase64.match(/data:([^;]+);base64,/)?.[1] || "image/png"
                }
            }
        ]);

        const text = result.response.text();
        return this.parseJSON(text);
    }

    async optimizeContentForSlide(content: string, constraintDescription: string): Promise<string> {
        if (!this.genAI) throw new Error("Gemini API not configured");

        const model = this.genAI.getGenerativeModel({
            model: localStorage.getItem('GEMINI_TEXT_MODEL') || "gemini-1.5-flash",
        });

        const prompt = `
            You are a Presentation Design Expert.
            Refactor the following raw content to fit into a specific slide layout: "${constraintDescription}".
            
            Global Rules:
            1. LANGUAGE: PORTUGUESE (BRAZIL) - MANDATORY.
            2. Maintain ALL critical information and details. Do NOT summarize too aggressively.
            3. Use concise bullet points for readability, but keep the depth of content.
            4. Use strong action verbs.
            5. Output must be in Markdown format (using * or - for bullets, ** for bold).
            6. Do NOT output a JSON, just the Markdown text.
            7. Ensure the text fits the description provided, optimizing line breaks if needed.

            Content to Refactor:
            ${content}
        `;

        const result = await model.generateContent(prompt);
        return result.response.text();
    }

    async distributeContentAcrossSlides(content: string, contentType: string): Promise<{ title_suffix: string, content: string, summary?: string, left_column?: string, right_column?: string, font_size: number, columns: number }[]> {
        if (!this.genAI) throw new Error("Gemini API not configured");

        const model = this.genAI.getGenerativeModel({
            model: localStorage.getItem('GEMINI_TEXT_MODEL') || "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        // --- STRICT CAPACITY LIMITS (User Defined) ---
        const CAPACITY_MAP: Record<string, number> = {
            'context_overview': 1300,
            'technical_solution': 2400,
            'architecture_diagram': 500,
            'implementation_steps': 1750,
            'testing_strategy': 1650,
            'scope': 1580,
            'non_scope': 1580,
            'budget': 1580,
            'risks': 1680,
            'technical_premises': 2500,
            'team_structure': 2000,
            'client_responsibilities': 2000,
            'raci_matrix': 2000
        };

        const capacity = CAPACITY_MAP[contentType] || 1600;

        // --- LAYOUT STRATEGY SELECTOR ---
        const TWO_COLUMN_TYPES = [
            'technical_solution',
            'implementation_steps',
            'testing_strategy',
            'scope',
            'non_scope',
            'budget',
            'risks'
        ];

        const useTwoColLayout = TWO_COLUMN_TYPES.includes(contentType);

        // --- SPATIAL AWARENESS INJECTION ---
        const charCount = content.length;
        const estSlides = Math.max(1, Math.ceil(charCount / capacity));

        let hint = "";
        let prompt = "";

        if (useTwoColLayout) {
            // --- NEW TWO-COLUMN PROMPT ---
            if (estSlides === 1) {
                hint = `Length: ${charCount} chars. Capacity: ${capacity}. FIT: YES. Use 1 slide with Dual Columns.`;
            } else {
                hint = `Length: ${charCount} chars. Capacity: ${capacity}. FIT: NO. Split into approx ${estSlides} slides (Dual Column each).`;
            }

            prompt = `
                You are an Expert Presentation Layout Agent.
                Your goal is to format the provided text into a specialized "Executive Summary + Dual Column" layout.
                
                Technical Data:
                - Content Type: ${contentType}
                - Input Length: ${charCount} chars
                - Limit per Slide: ${capacity} chars
                - Analysis: ${hint}
                
                Layout Requirements per Slide:
                1. **Summary Box (Top)**: Extract a refined, high-impact 1-sentence executive summary/subtitle for the slide.
                2. **Dual Columns (Body)**: Split the remaining detailed content into two semantically balanced columns (Left and Right).
                
                Rules:
                1. Language: Portuguese (Brazil).
                2. Balance the text between Left and Right columns visually (approx same length).
                3. Maintain bullet points and formatting.
                4. Do NOT split slides unless absolutely necessary (> ${capacity} chars).
                5. If splitting, ensure each slide has its own Summary and balanced columns.

                Input Text:
                "${content}"

                Output JSON Schema:
                [
                    {
                        "title_suffix": "", // e.g. "" or "(Cont.)"
                        "summary": "High-level executive summary of this slide's content",
                        "left_column": "Markdown text for left column",
                        "right_column": "Markdown text for right column",
                        "content": "", // Leave empty for this layout
                        "font_size": 10, // Default to 10 for dense 2-col layouts
                        "columns": 2
                    }
                ]
            `;

        } else {
            // --- STANDARD SINGLE COLUMN PROMPT (Previous Logic) ---
            if (estSlides === 1) {
                hint = "Character count: " + charCount + ". Limit: " + capacity + ". FIT: YES. Put ALL this content in 1 slide.";
            } else {
                hint = "Character count: " + charCount + ". Limit: " + capacity + ". FIT: NO. Split into approx " + estSlides + " slides.";
            }

            const layoutConstraint = contentType === 'context_overview'
                ? "Vertical Column (Narrow): Width 4 inches, Height 4 inches."
                : "Standard Slide (Wide): Width 9 inches, Height 4 inches.";

            prompt = `
                You are an Expert Presentation Layout Agent.
                Your task is to distribute the provided text into one or more slides based STRICTLY on the capacity limits provided.
                
                Technical Data:
                - Content Type: ${contentType}
                - Input Length: ${charCount} chars
                - Strict Capacity Limit: ${capacity} chars per slide
                - Analysis: ${hint}
                - Layout: ${layoutConstraint}
                
                Rules:
                1. LANGUAGE: Portuguese (Brazil).
                2. PRIMARY GOAL: Fill each slide up to the capacity limit (${capacity} chars) before creating a new one.
                3. Do NOT match semantic blocks if it wastes significant space. Prioritize filling the slide.
                4. If the text fits in the limit, DO NOT SPLIT, absolutely forbidden.
                5. ALWAYS use a single full-width column (columns: 1).
                6. Return a JSON structure defining the slides.

                Input Text:
                "${content}"

                Output JSON Schema:
                [
                    {
                        "title_suffix": "", // e.g. "" for first slide, "(Cont.)" for others
                        "content": "markdown content for this specific slide",
                        "font_size": 11, // Default 11, reduce to 10 or 9 ONLY if very close to limit overflow
                        "columns": 1
                    }
                ]
            `;
        }

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        return this.parseJSON(text);
    }

    async generateProjectDoubts(
        history: { role: "user" | "model", parts: { text: string }[] }[],
        projectContext: string
    ): Promise<{ category: string, question: string, reason: string }[]> {
        if (!this.genAI) throw new Error("Gemini API not configured");

        const model = this.genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
            Você é um Auditor Técnico Sênior.
            Sua missão é gerar uma LISTA EXAUSTIVA de dúvidas e pontos de atenção que precisam ser esclarecidos para garantir uma estimativa de projeto 100% segura.
            
            CONTEXTO ATUAL DO PROJETO:
            ${projectContext}
            
            INSTRUÇÕES:
            1. Analise o contexto acima e todo o histórico da conversa (que será enviado junto).
            2. Identifique lacunas, riscos, ou definições vagas em:
               - Requisitos Funcionais
               - Requisitos Técnicos (Infra, Segurança, Performance)
               - Modelo de Negócio / Faturamento
               - Integrações
               - Dados (Migração, Volumetria)
            3. Ignore o que JÁ FOI RESPONDIDO. Foque no que FALTA.
            4. VERIFICAÇÃO MANDATÓRIA (Se não estiver claro no material):
               - [STACK]: Pergunte: "Qual a Stack Tecnológica definida ou o contratado tem liberdade para sugerir?"
               - [INFRA]: Pergunte: "Qual provider de Cloud deve ser considerado (AWS/Azure/GCP) ou se a infraestrutura será On-Premise?"
            5. Gere uma lista JSON plana com todas as dúvidas. Não há limite de quantidade, mas evite repetições óbvias.
            
            SAÍDA JSON ESPERADA:
            [
                { 
                    "category": "Infraestrutura", 
                    "question": "Qual a volumetria estimada de acessos simultâneos?", 
                    "reason": "Necessário para dimensionar Cluster Kubernetes." 
                }
            ]
        `;

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(prompt);
        const text = result.response.text();

        const parsed = this.parseJSON(text);
        if (Array.isArray(parsed)) return parsed;
        return [];
    }
}

export const geminiService = new GeminiService();

