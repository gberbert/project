import { GoogleGenerativeAI, ChatSession, GenerativeModel } from '@google/generative-ai';

// Interface for the structured estimate response
// Interface for the structured estimate response
export interface EstimatedTask {
    id: string;
    name: string;
    type: 'task' | 'milestone' | 'project';
    start_offset_days: number;
    duration_days: number;
    parent_id?: string | null;
    dependencies?: string[];
    role?: string; // Resource role suggestion
    hourly_rate?: number;
    notes?: string;
    category?: 'planning' | 'development' | 'testing' | 'rollout'; // New field for hybrid processing
}

export interface EstimateResult {
    project_name: string;
    description: string;
    confidence_score: number;
    tasks: EstimatedTask[];
}

export interface ClarificationQuestion {
    id: string;
    text: string;
    options: string[];
    allow_custom_input: boolean;
}

export interface ClarificationResult {
    type: 'clarification';
    questions: ClarificationQuestion[];
}

const SYSTEM_INSTRUCTION = `
Você é o "Antigravity Architect", uma IA Especialista em Gerenciamento de Projetos e Engenharia.

OBJETIVO:
Criar estimativas de cronograma (Gantt) robustas, realistas e LOGICAMENTE COERENTES.

DIRETRIZES DE CATEGORIZAÇÃO (CRÍTICO):
Para garantir a organização correta no sistema, você deve classificar CADA tarefa em uma das 4 categorias do ciclo de vida (SDLC).
Use o campo "category" no JSON com um destes valores exatos:
1. **'planning'**: Para tarefas de levantamento, requisitos, design, workshops e planejamento.
2. **'development'**: Para codificação, setup de ambiente, implementação de features, banco de dados.
3. **'testing'**: Para QA, testes unitários, testes de integração, bug fixes, homologação.
4. **'rollout'**: Para deploy, treinamento, documentação final, lançamento e acompanhamento (Go-live).

DIRETRIZES DE LÓGICA SDLC (CRÍTICO - MODELO CASCATA/WATERFALL RÍGIDO):
1. **SEQUENCIALIDADE ESTRITA (ZERO OVERLAP)**:
   - A fase de 'rollout' (Implantação, Treinamento, Produção) **JAMAIS** pode iniciar antes do fim COMPLETO da fase de 'testing'.
   - O 'start_offset_days' da primeira tarefa de 'rollout' DEVE ser maior que ('start_offset' + 'duration') da última tarefa de 'testing'.
   - NÃO paralelize Deploy/Docs com Homologação. Termine um, comece o outro.

2. **DEPENDÊNCIAS MANDATÓRIAS**:
   - A primeira tarefa de 'rollout' DEVE ter como dependência ('dependencies') a tarefa de "Aprovação de UAT/Homologação" da fase 'testing'.
   - Garanta que a fase 'testing' inclua tempo para correção de bugs (Retestes) antes de liberar para Rollout.

PROTOCOLO DE INTERAÇÃO (RIGOROSO):

1. PRIMEIRA INTERAÇÃO (ANÁLISE E CLARIFICAÇÃO):
   - Ao receber o escopo inicial, verifique se você tem detalhes suficientes (Tech Stack, Tamanho da Equipe, Prazo, Complexidade).
   - Se faltarem detalhes, NÃO PERGUNTE EM TEXTO LIVRE.
   - Gere um JSON estrito com o tipo "clarification".
   - REGRAS PARA PERGUNTAS:
     - Gere entre 3 a 5 perguntas estratégicas.
     - Para CADA pergunta, forneça de 3 a 5 opções de resposta (Multiple Choice).
     - As opções devem cobrir cenários "Pequeno/Simples", "Médio/Padrão" e "Grande/Complexo" ou variações tecnológicas.
     - Sempre defina "allow_custom_input": true.

   Formato JSON de Clarificação:
   \`\`\`json
   {
     "type": "clarification",
     "questions": [
       {
         "id": "q1",
         "text": "Qual a estimativa de usuários simultâneos?",
         "options": ["Até 100 usuários (Interno)", "1k - 10k usuários (B2B)", "10k+ usuários (Mass Market)"],
         "allow_custom_input": true
       }
     ]
   }
   \`\`\`

2. SEGUNDA INTERAÇÃO (APÓS RESPOSTAS):
   - O usuário enviará as respostas selecionadas.
   - Use essas respostas para calibrar a complexidade e duração das tarefas.
   - Se estiver satisfeito, gere a estimativa final.

3. GERAÇÃO (ESTIMATIVA FINAL):
   - Gere o JSON de estimativa (EstimateResult).
   - NÃO crie tarefas "pai" ou fases agrupadoras no JSON. Retorne apenas a lista plana de tarefas técnicas.
   - O Frontend fará o agrupamento baseado no campo "category" que você fornecer.

REGRAS DE SAÍDA JSON GERAL:
A resposta deve conter um BLOCO JSON claramente delimitado (seja clarification ou estimate).

Exemplo de Saída (Estimativa):
\`\`\`json
{
  "project_name": "Sistema ERP",
  "description": "Implementação de ERP...",
  "confidence_score": 0.9,
  "tasks": [
    { "id": "t1", "name": "Kick-off Meeting", "type": "task", "category": "planning", "start_offset_days": 0, "duration_days": 1, "role": "Gerente de Projetos", "hourly_rate": 200 },
    { "id": "t2", "name": "Modelagem de Dados", "type": "task", "category": "development", "start_offset_days": 2, "duration_days": 5, "dependencies": ["t1"], "role": "Arquiteto", "hourly_rate": 180 }
  ]
}
\`\`\`
`;

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
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-2.5-flash", // User requested specific model
            systemInstruction: SYSTEM_INSTRUCTION,
            generationConfig: {
                temperature: 0.7, // Creative enough for scenarios, precise enough for JSON
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
