const { GoogleGenerativeAI } = require('@google/generative-ai');
const personalityService = require('./personality.service');

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.temperature = parseFloat(process.env.BOT_TEMPERATURE) || 0.7;

        if (!this.apiKey) {
            throw new Error('GEMINI_API_KEY não configurada no .env');
        }

        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: 'gemini-1.5-pro',
            generationConfig: {
                temperature: this.temperature,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 800,
            }
        });

        this.chatSessions = new Map();
    }

    async generateResponse(userId, userMessage) {
        try {
            // Obter prompt do sistema com personalidade
            const systemPrompt = personalityService.getSystemPrompt(userId);

            // Combinar com mensagem do usuário
            const fullPrompt = `${systemPrompt}\n\nCLIENTE: ${userMessage}\n\n${personalityService.getPersonalityInfo().name.toUpperCase()}:`;

            // Gerar resposta
            const result = await this.model.generateContent(fullPrompt);
            const response = await result.response;
            let text = response.text();

            // Limpar resposta se necessário
            text = this.cleanResponse(text);

            // Atualizar contexto da conversa
            personalityService.updateConversationContext(userId, userMessage, text);

            return text;

        } catch (error) {
            console.error('❌ Erro no Gemini:', error);

            // Fallback baseado no tipo de erro
            if (error.message.includes('API key not valid')) {
                return '⚠️ Configuração de serviço temporariamente indisponível. Entre em contato com nosso suporte técnico.';
            }

            if (error.message.includes('quota')) {
                return personalityService.getBusyMessage();
            }

            return personalityService.getUnknownMessage();
        }
    }

    cleanResponse(text) {
        // Remover possíveis artefatos do prompt
        let cleaned = text
            .replace(/^(?:${personalityService.getPersonalityInfo().name.toUpperCase()}:|ASSISTENTE:|BOT:)/i, '')
            .trim();

        // Garantir que comece com letra maiúscula
        if (cleaned.length > 0) {
            cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        }

        return cleaned;
    }

    async analyzeSentiment(message) {
        try {
            const prompt = `Analise o sentimento desta mensagem em português. Retorne apenas uma das opções: POSITIVO, NEUTRO, NEGATIVO, URGENTE.
            
            Mensagem: "${message}"
            
            Sentimento:`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim().toUpperCase();

        } catch (error) {
            console.error('Erro na análise de sentimento:', error);
            return 'NEUTRO';
        }
    }

    async extractIntent(message) {
        try {
            const prompt = `Extraia a intenção principal desta mensagem em português. Retorne apenas uma palavra-chave: PERGUNTA, RECLAMAÇÃO, ELOGIO, SOLICITAÇÃO, DÚVIDA, AGENDAMENTO, INFORMAÇÃO, OUTRO.
            
            Mensagem: "${message}"
            
            Intenção:`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim().toUpperCase();

        } catch (error) {
            console.error('Erro na extração de intenção:', error);
            return 'OUTRO';
        }
    }

    clearUserSession(userId) {
        this.chatSessions.delete(userId);
        personalityService.clearUserContext(userId);
    }
}

module.exports = new GeminiService();