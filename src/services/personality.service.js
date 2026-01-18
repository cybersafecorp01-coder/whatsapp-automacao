const atendentePersonality = require('../../personalities/atendente.json');

class PersonalityService {
    constructor() {
        this.personality = atendentePersonality;
        this.conversationContext = new Map(); // userId -> {context, history}
    }

    getSystemPrompt(userId = 'default') {
            const context = this.conversationContext.get(userId) || {
                history: [],
                needsIdentified: [],
                solutionsOffered: [],
                stage: 'greeting'
            };

            return `
        VOCÊ É: ${this.personality.name} - ${this.personality.role}
        EMPRESA: ${this.personality.company}
        
        TRAÇOS DE PERSONALIDADE:
        ${this.personality.traits.map(t => `- ${t}`).join('\n')}
        
        COMPORTAMENTO:
        - Saudação: ${this.personality.behavior.greeting}
        - Despedida: ${this.personality.behavior.farewell}
        - Transferir para humano: ${this.personality.behavior.transfer_human}
        - Indisponível: ${this.personality.behavior.busy}
        - Não entendeu: ${this.personality.behavior.unknown}
        
        SERVIÇOS OFERECIDOS:
        ${this.personality.knowledge_base.services.map(s => `- ${s}`).join('\n')}
        
        CONTEXTO ATUAL DA CONVERSA:
        - Estágio: ${context.stage}
        - Necessidades identificadas: ${context.needsIdentified.join(', ')}
        - Soluções oferecidas: ${context.solutionsOffered.join(', ')}
        
        HISTÓRICO RECENTE (últimas 5 mensagens):
        ${context.history.slice(-5).join('\n')}
        
        ESTILO DE RESPOSTA:
        - Tom: ${this.personality.response_style.tone}
        - Comprimento: ${this.personality.response_style.length}
        - Nível de linguagem: ${this.personality.response_style.language_level}
        - Usar emojis: ${this.personality.response_style.use_emojis ? 'Sim' : 'Não'}
        - Usar formatação: ${this.personality.response_style.use_formatting ? 'Sim' : 'Não'}
        
        FLUXO DA CONVERSA:
        1. ${this.personality.conversation_flow.greeting ? 'Saudar' : 'Não saudar'}
        2. ${this.personality.conversation_flow.identify_needs ? 'Identificar necessidades' : 'Não identificar'}
        3. ${this.personality.conversation_flow.offer_solutions ? 'Oferecer soluções' : 'Não oferecer'}
        4. ${this.personality.conversation_flow.confirm_understanding ? 'Confirmar entendimento' : 'Não confirmar'}
        5. ${this.personality.conversation_flow.follow_up ? 'Acompanhar' : 'Não acompanhar'}
        6. ${this.personality.conversation_flow.closing ? 'Encerrar' : 'Não encerrar'}
        
        REGRAS IMPORTANTES:
        1. NUNCA diga que é um bot ou IA
        2. Seja empático e solucione problemas
        3. Mantenha o foco no cliente
        4. Ofereça ajuda concreta
        5. Se não souber algo, seja honesto e ofereça alternativa
        6. Use o nome do cliente quando possível
        7. Mantenha conversa natural
        
        AGORA RESPONDA À SEGUINTE MENSAGEM DO CLIENTE:
        `;
    }

    updateConversationContext(userId, userMessage, aiResponse) {
        if (!this.conversationContext.has(userId)) {
            this.conversationContext.set(userId, {
                history: [],
                needsIdentified: [],
                solutionsOffered: [],
                stage: 'greeting',
                startTime: new Date()
            });
        }
        
        const context = this.conversationContext.get(userId);
        
        // Adicionar ao histórico
        context.history.push(`Cliente: ${userMessage}`);
        context.history.push(`${this.personality.name}: ${aiResponse}`);
        
        // Limitar histórico
        if (context.history.length > 20) {
            context.history = context.history.slice(-20);
        }
        
        // Análise básica para atualizar estágio
        this.analyzeAndUpdateStage(context, userMessage);
        
        // Atualizar contexto
        this.conversationContext.set(userId, context);
    }

    analyzeAndUpdateStage(context, userMessage) {
        const lowerMsg = userMessage.toLowerCase();
        
        // Detectar estágios baseado no conteúdo
        if (context.stage === 'greeting') {
            context.stage = 'identifying_needs';
        }
        
        // Detectar necessidades
        const needsKeywords = {
            'problema': 'suporte_técnico',
            'ajuda': 'assistência',
            'quero': 'solicitação',
            'preciso': 'necessidade',
            'como': 'instrução',
            'dúvida': 'esclarecimento',
            'valor': 'orçamento',
            'preço': 'informação_preço',
            'agendar': 'agendamento',
            'horário': 'disponibilidade'
        };
        
        for (const [keyword, need] of Object.entries(needsKeywords)) {
            if (lowerMsg.includes(keyword) && !context.needsIdentified.includes(need)) {
                context.needsIdentified.push(need);
            }
        }
        
        // Atualizar estágio se soluções foram oferecidas
        if (context.solutionsOffered.length > 0) {
            context.stage = 'solution_discussion';
        }
        
        // Detectar fechamento
        if (lowerMsg.includes('obrigado') || lowerMsg.includes('agradeço') || 
            lowerMsg.includes('tchau') || lowerMsg.includes('adeus')) {
            context.stage = 'closing';
        }
    }

    addSolutionOffered(userId, solution) {
        const context = this.conversationContext.get(userId);
        if (context && !context.solutionsOffered.includes(solution)) {
            context.solutionsOffered.push(solution);
        }
    }

    getGreeting() {
        return this.personality.behavior.greeting;
    }

    getFarewell() {
        return this.personality.behavior.farewell;
    }

    getTransferMessage() {
        return this.personality.behavior.transfer_human;
    }

    getBusyMessage() {
        return this.personality.behavior.busy;
    }

    getUnknownMessage() {
        return this.personality.behavior.unknown;
    }

    getPersonalityInfo() {
        return {
            name: this.personality.name,
            role: this.personality.role,
            company: this.personality.company,
            traits: this.personality.traits,
            services: this.personality.knowledge_base.services
        };
    }

    clearUserContext(userId) {
        this.conversationContext.delete(userId);
    }

    getUserContext(userId) {
        return this.conversationContext.get(userId) || null;
    }
}

module.exports = new PersonalityService();