# Nova Funcionalidade: Fase de Entendimento Inicial

## Visão Geral
Foi implementada uma nova fase no fluxo de estimativa de projeto, denominada "Entendimento Inicial". Esta fase ocorre logo após o usuário fornecer a descrição inicial do projeto e anexar arquivos, mas **antes** do início do ciclo de perguntas de refinamento (entrevista).

## Fluxo de Interação
1.  **Entrada do Usuário**: O usuário digita o escopo e anexa arquivos.
2.  **Geração de Entendimento**: O sistema envia esses dados para o Gemini usando um prompt especializado (`DEFAULT_INITIAL_UNDERSTANDING_PROMPT`).
3.  **Validação**: O Gemini retorna um resumo do que entendeu. Este resumo é exibido ao usuário.
4.  **Ação do Usuário**:
    *   ** Aceitar**: O usuário confirma o entendimento. O sistema prossegue automaticamente para a fase de refinamento (perguntas), levando consigo todo o contexto validado e os arquivos.
    *   ** Ajustar**: O usuário pode fornecer correções ou mais detalhes. O processo de entendimento se repete até a aprovação.

## Arquivos Modificados/Criados

### 1. `src/services/geminiService.ts`
*   **Novo Método**: `getInitialUnderstanding(history, files)` para gerar o resumo inicial.
*   **Atualização**: `refineRequirements` agora aceita um argumento opcional `files` para incluir anexos no contexto do entrevistador.
*   **Constante**: Adicionada `DEFAULT_INITIAL_UNDERSTANDING_PROMPT`.

### 2. `src/components/EstimateModal.tsx`
*   **Estado**: Novos estados `validationState` ('idle', 'validating', 'reviewing', 'accepted') e `validationData`.
*   **Lógica**: `handleSend` foi reescrito para checar `validationState` antes de iniciar o refinamento.
*   **UI**: Adicionado bloco de renderização condicional para exibir o resumo da IA e os botões de ação (Aceitar/Corrigir).

### 3. `src/components/SettingsView.tsx`
*   **Configuração**: Nova aba "1. Entendimento Inicial" para editar o prompt base desta fase.
*   **Correções**: Limpeza de imports duplicados e reinserção de variáveis de estado que estavam faltando (`templateConfig`, `users`, etc.).

## Como Testar
1.  Abra a aplicação e vá em "Configurações" > "Prompts". Verifique a nova aba "Entendimento Inicial".
2.  Inicie um novo projeto. Digite uma descrição (ex: "App de delivery de pizza").
3.  O sistema deve exibir "Analisando projeto..." e depois mostrar um card com "Confirmação de Entendimento".
4.  Clique em "Correto, Prosseguir" e verifique se o chat inicia as perguntas de refinamento.
