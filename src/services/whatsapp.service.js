require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 8080;

// Configurações
const WAHA_API = process.env.WAHA_API_URL || 'http://localhost:3000';
const WAHA_API_KEY = process.env.WAHA_API_KEY;
const SESSION_NAME = process.env.WAHA_SESSION_NAME || 'precisocr';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Verificar API Key do Gemini
if (!GEMINI_API_KEY) {
    console.error('❌ ERRO: Configure GEMINI_API_KEY no arquivo .env');
    console.error('Obtenha em: https://makersuite.google.com/app/apikey');
    process.exit(1);
}

// Configurar Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: 'gemini-pro',
    generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
    }
});

console.log('🚀 PRECISOCR WHATSAPP BOT - VERSÃO SIMPLES');
console.log('===========================================\n');
console.log('✅ Gemini AI configurado');
console.log(`📱 WAHA API: ${WAHA_API}`);
console.log(`🔑 API Key: ${WAHA_API_KEY ? '✓ Configurada' : '✗ Não configurada'}`);
console.log(`🤖 Sessão: ${SESSION_NAME}\n`);

// Personalidade do bot
const BOT_PERSONALITY = {
    name: "PrecisoCR",
    greeting: "👋 Olá! Eu sou o *PrecisoCR*, seu assistente virtual inteligente! Como posso ajudar?",
    farewell: "Foi um prazer ajudar! Volte sempre! 👋",
    help: `*🤖 COMANDOS DISPONÍVEIS*\n\n` +
        `• \`oi\` - Iniciar conversa\n` +
        `• \`ajuda\` - Ver comandos\n` +
        `• \`info\` - Sobre mim\n` +
        `• Faça qualquer pergunta!\n\n` +
        `_Estou aqui para ajudar!_ 😊`
};

// Histórico de conversas
const chatHistory = new Map();

// Configurar axios para WAHA com API Key
const wahaAxios = axios.create({
    baseURL: WAHA_API,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        ...(WAHA_API_KEY && { 'Authorization': `Bearer ${WAHA_API_KEY}` })
    }
});

// Função para validar API Key no webhook
function validateWebhookAuth(req) {
    if (!WEBHOOK_API_KEY) {
        return true; // Se não tiver API key configurada, aceita todas
    }
    
    const apiKey = req.headers['x-api-key'] || 
                   req.headers['authorization']?.replace('Bearer ', '') ||
                   req.query.api_key;
    
    return apiKey === WEBHOOK_API_KEY;
}

// Função para enviar mensagem via WAHA
async function sendWhatsAppMessage(chatId, text) {
    try {
        const response = await wahaAxios.post('/api/sendText', {
            chatId: chatId,
            content: text,
            session: SESSION_NAME
        });
        return response.data;
    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error.response?.data || error.message);
        return null;
    }
}

// Função para gerar resposta com Gemini
async function generateAIResponse(userId, userMessage) {
    try {
        // Obter histórico da conversa
        if (!chatHistory.has(userId)) {
            chatHistory.set(userId, []);
        }
        const history = chatHistory.get(userId);

        // Criar prompt com personalidade
        const prompt = `Você é ${BOT_PERSONALITY.name}, um assistente virtual amigável e útil.
        
Histórico recente:
${history.slice(-3).join('\n')}

Pergunta do usuário: "${userMessage}"

Responda de forma natural e útil em português:`;

        // Gerar resposta
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Atualizar histórico
        history.push(`Usuário: ${userMessage}`);
        history.push(`Assistente: ${text}`);

        // Limitar histórico
        if (history.length > 6) {
            chatHistory.set(userId, history.slice(-6));
        }

        return text;

    } catch (error) {
        console.error('❌ Erro no Gemini:', error.message);
        return "Desculpe, tive um problema técnico. Tente novamente em alguns instantes.";
    }
}

// Função para configurar webhook automaticamente
async function setupWebhook() {
    try {
        const webhookUrl = `http://localhost:${PORT}/webhook/message`;
        
        console.log('🔄 Configurando webhook automaticamente...');
        
        const webhookConfig = {
            url: webhookUrl,
            events: ['message', 'message.any'],
            session: SESSION_NAME
        };
        
        // Adicionar API Key ao webhook se configurada
        if (WEBHOOK_API_KEY) {
            webhookConfig.headers = {
                'x-api-key': WEBHOOK_API_KEY
            };
        }
        
        const response = await wahaAxios.post('/api/webhook', webhookConfig);
        
        console.log('✅ Webhook configurado:', webhookUrl);
        return true;
        
    } catch (error) {
        console.log('⚠️  Não foi possível configurar webhook automaticamente');
        console.log('💡 Configure manualmente no painel do WAHA');
        return false;
    }
}

// Rota principal - Dashboard
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🤖 PrecisoCR Bot</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    color: white;
                }
                .container {
                    background: rgba(255, 255, 255, 0.95);
                    padding: 40px;
                    border-radius: 20px;
                    color: #333;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                }
                h1 {
                    color: #4a6fa5;
                    text-align: center;
                }
                .status {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 10px;
                    margin: 20px 0;
                    border-left: 5px solid #4a6fa5;
                }
                .btn {
                    display: inline-block;
                    background: #4a6fa5;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    text-decoration: none;
                    margin: 10px 5px;
                    font-weight: bold;
                    transition: all 0.3s;
                }
                .btn:hover {
                    background: #3a5a8a;
                    transform: translateY(-2px);
                }
                .instructions {
                    background: #e8f4f8;
                    padding: 20px;
                    border-radius: 10px;
                    margin-top: 30px;
                }
                .status-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: bold;
                    margin-left: 10px;
                }
                .online {
                    background: #4CAF50;
                    color: white;
                }
                .offline {
                    background: #f44336;
                    color: white;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 ${BOT_PERSONALITY.name} - WhatsApp Bot</h1>
                
                <div class="status">
                    <h2>📊 Status do Sistema</h2>
                    <p><strong>🟢 Bot Online</strong></p>
                    <p><strong>🤖 Personalidade:</strong> ${BOT_PERSONALITY.name}</p>
                    <p><strong>🧠 IA:</strong> Gemini Pro (Google)</p>
                    <p><strong>📱 WAHA:</strong> ${WAHA_API}</p>
                    <p><strong>🔑 API Key:</strong> ${WAHA_API_KEY ? '<span class="status-badge online">✓ Configurada</span>' : '<span class="status-badge offline">✗ Não configurada</span>'}</p>
                    <p><strong>💬 Conversas ativas:</strong> ${chatHistory.size}</p>
                </div>
                
                <h2>🔗 Acesse os Painéis:</h2>
                <div>
                    <a href="${WAHA_API.replace('3000', '3001')}" class="btn" target="_blank">
                        📱 Painel do WAHA
                    </a>
                    <a href="/health" class="btn">🩺 Health Check</a>
                    <a href="/test" class="btn">🧪 Testar Bot</a>
                    <a href="/setup-webhook" class="btn">⚙️ Configurar Webhook</a>
                </div>
                
                <div class="instructions">
                    <h2>📋 Como Usar:</h2>
                    <ol>
                        <li>Acesse o <strong>Painel do WAHA</strong> acima</li>
                        <li>Escaneie o <strong>QR Code</strong> com seu WhatsApp</li>
                        <li>Envie <code>oi</code> para o número conectado</li>
                        <li>Teste comandos: <code>ajuda</code>, <code>info</code></li>
                        <li>Faça perguntas normais!</li>
                    </ol>
                    
                    <p><strong>⚠️ Se o webhook não estiver configurado:</strong></p>
                    <p>Clique em <strong>"Configurar Webhook"</strong> acima ou:</p>
                    <code style="background: #333; color: #fff; padding: 10px; display: block; border-radius: 5px; margin: 10px 0;">
                        curl -X POST ${WAHA_API}/api/webhook \\
                          -H "Authorization: Bearer ${WAHA_API_KEY}" \\
                          -H "Content-Type: application/json" \\
                          -d '{"url": "http://localhost:${PORT}/webhook/message", "events": ["message"]}'
                    </code>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'PrecisoCR WhatsApp Bot',
        version: '1.0',
        personality: BOT_PERSONALITY.name,
        whatsapp_api: WAHA_API,
        api_key_configured: !!WAHA_API_KEY,
        conversations_active: chatHistory.size,
        timestamp: new Date().toISOString()
    });
});

// Rota para configurar webhook manualmente
app.get('/setup-webhook', async (req, res) => {
    try {
        const success = await setupWebhook();
        
        if (success) {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Webhook Configurado</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 50px; text-align: center; }
                        .success { color: green; font-size: 24px; }
                    </style>
                </head>
                <body>
                    <div class="success">✅ Webhook configurado com sucesso!</div>
                    <p><a href="/">Voltar ao Dashboard</a></p>
                </body>
                </html>
            `);
        } else {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Erro Webhook</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 50px; text-align: center; }
                        .error { color: red; font-size: 24px; }
                        code { background: #f0f0f0; padding: 10px; display: block; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="error">❌ Erro ao configurar webhook</div>
                    <p>Configure manualmente no painel do WAHA ou execute:</p>
                    <code>
                        curl -X POST ${WAHA_API}/api/webhook \\
                          -H "Authorization: Bearer ${WAHA_API_KEY}" \\
                          -H "Content-Type: application/json" \\
                          -d '{"url": "http://localhost:${PORT}/webhook/message", "events": ["message"]}'
                    </code>
                    <p><a href="/">Voltar ao Dashboard</a></p>
                </body>
                </html>
            `);
        }
    } catch (error) {
        res.status(500).send(`Erro: ${error.message}`);
    }
});

// Rota para testar o bot
app.get('/test', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Testar Bot</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                textarea { width: 100%; height: 100px; margin: 10px 0; padding: 10px; }
                button { background: #4a6fa5; color: white; padding: 10px 20px; border: none; cursor: pointer; border-radius: 5px; }
                #result { margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>🧪 Testar Resposta da IA</h1>
            <form id="testForm">
                <textarea id="message" placeholder="Digite uma mensagem para testar...">Como está o tempo hoje?</textarea>
                <br>
                <button type="submit">Testar IA</button>
            </form>
            <div id="result"></div>
            
            <script>
                document.getElementById('testForm').onsubmit = async function(e) {
                    e.preventDefault();
                    const message = document.getElementById('message').value;
                    const resultDiv = document.getElementById('result');
                    
                    resultDiv.innerHTML = '⏳ Processando...';
                    
                    try {
                        const response = await fetch('/test-message', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: message })
                        });
                        
                        const data = await response.json();
                        resultDiv.innerHTML = '<strong>🤖 Resposta da IA:</strong><br>' + data.response;
                    } catch (error) {
                        resultDiv.innerHTML = '❌ Erro: ' + error.message;
                    }
                };
            </script>
        </body>
        </html>
    `);
});

// Testar mensagem
app.post('/test-message', async(req, res) => {
    try {
        const { message } = req.body;
        const response = await generateAIResponse('test-user', message);
        res.json({ response: response });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Webhook para receber mensagens do WhatsApp
app.post('/webhook/message', async(req, res) => {
    try {
        // Validar API Key
        if (!validateWebhookAuth(req)) {
            console.warn('⚠️  Tentativa de acesso não autorizado ao webhook');
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const message = req.body;

        console.log(`\n📩 Nova mensagem de ${message.senderName || message.from}:`);
        console.log(`💬 "${message.body}"`);

        // Ignorar mensagens próprias
        if (message.fromMe) {
            return res.status(200).json({ processed: false, reason: 'own_message' });
        }

        // Comandos básicos
        const lowerBody = message.body?.toLowerCase().trim() || '';

        if (lowerBody === 'oi' || lowerBody === 'olá' || lowerBody === 'ola') {
            await sendWhatsAppMessage(message.from, BOT_PERSONALITY.greeting);
            return res.status(200).json({ processed: true, type: 'greeting' });
        }

        if (lowerBody === 'ajuda' || lowerBody === 'help') {
            await sendWhatsAppMessage(message.from, BOT_PERSONALITY.help);
            return res.status(200).json({ processed: true, type: 'help' });
        }

        if (lowerBody === 'info') {
            const infoMsg = `*${BOT_PERSONALITY.name}*\n\n` +
                `🤖 Assistente Virtual Inteligente\n` +
                `🧠 Powered by Gemini AI (Google)\n` +
                `💬 Atendimento 24/7\n\n` +
                `_Sempre aqui para ajudar!_ ✨`;
            await sendWhatsAppMessage(message.from, infoMsg);
            return res.status(200).json({ processed: true, type: 'info' });
        }

        if (lowerBody === 'limpar' || lowerBody === 'clear') {
            chatHistory.delete(message.from);
            await sendWhatsAppMessage(message.from, '✅ Histórico da conversa limpo!');
            return res.status(200).json({ processed: true, type: 'clear' });
        }

        // Processar com IA
        console.log('🤖 Processando com Gemini AI...');
        const aiResponse = await generateAIResponse(message.from, message.body);

        // Enviar resposta
        await sendWhatsAppMessage(message.from, aiResponse);

        console.log(`✅ Resposta enviada: ${aiResponse.substring(0, 100)}...`);

        res.status(200).json({
            processed: true,
            type: 'ai_response',
            response_length: aiResponse.length
        });

    } catch (error) {
        console.error('❌ Erro no webhook:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Rota para verificar webhook
app.get('/webhook/test', (req, res) => {
    const apiKey = req.query.api_key;
    
    if (WEBHOOK_API_KEY && apiKey !== WEBHOOK_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.json({
        status: 'online',
        webhook: 'active',
        timestamp: new Date().toISOString()
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('\n══════════════════════════════════════════════════');
    console.log('✅ SERVIDOR INICIADO');
    console.log(`🔗 Porta: ${PORT}`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
    console.log(`🧪 Testar: http://localhost:${PORT}/test`);
    console.log(`⚙️  Config Webhook: http://localhost:${PORT}/setup-webhook`);
    console.log('══════════════════════════════════════════════════\n');

    console.log('📋 PRÓXIMOS PASSOS:');
    console.log('1. Verifique se WAHA está rodando na porta 3000');
    console.log('2. Clique em "Configurar Webhook" no dashboard');
    console.log('3. Ou configure manualmente no painel do WAHA');
    console.log('4. Escaneie o QR Code com seu WhatsApp');
    console.log('5. Envie "oi" para testar!');
    console.log('══════════════════════════════════════════════════\n');
});

// Tentar configurar webhook após alguns segundos
setTimeout(() => {
    setupWebhook();
}, 5000);

// Gerenciar encerramento
process.on('SIGINT', () => {
    console.log('\n👋 Encerrando PrecisoCR Bot...');
    console.log('✨ Até logo!');
    process.exit(0);
});