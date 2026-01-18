require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 8080;

// CONFIGURAÇÕES FIXAS - USE ESTAS!
const WAHA_API = 'http://localhost:3000';
const WAHA_API_KEY = 'f15e1e93b5744831a3dbbc1740d490f6';
const SESSION_NAME = 'precisocr';
const WEBHOOK_API_KEY = 'f15e1e93b5744831a3dbbc1740d490f6';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

console.log('🚀 PRECISOCR WHATSAPP BOT');
console.log('=========================\n');
console.log('✅ Gemini AI configurado');
console.log(`📱 WAHA API: ${WAHA_API}`);
console.log(`🔑 API Key: ${WAHA_API_KEY}`);
console.log(`🤖 Sessão: ${SESSION_NAME}\n`);

// Personalidade do bot
const BOT_PERSONALITY = {
    name: "PrecisoCR",
    greeting: "👋 Olá! Eu sou o *PrecisoCR*, seu assistente virtual inteligente! Como posso ajudar?",
    help: `*🤖 COMANDOS DISPONÍVEIS*\n\n` +
        `• \`oi\` - Iniciar conversa\n` +
        `• \`ajuda\` - Ver comandos\n` +
        `• \`info\` - Sobre mim\n` +
        `• Faça qualquer pergunta!\n\n` +
        `_Estou aqui para ajudar!_ 😊`
};

// Histórico de conversas
const chatHistory = new Map();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar axios para WAHA com API Key
const wahaAxios = axios.create({
    baseURL: WAHA_API,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WAHA_API_KEY}`
    }
});

// Rota GET para verificação do webhook COM BARRA (WAHA usa assim)
app.get('/webhook/message/', (req, res) => {
    console.log('🔍 WAHA verificando webhook com GET (com barra)...');

    // Validar API Key se for fornecida
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (WEBHOOK_API_KEY && apiKey !== WEBHOOK_API_KEY) {
        console.warn('⚠️  Tentativa de acesso sem API Key válida (com barra)');
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'API Key inválida ou não fornecida',
            required_key: WEBHOOK_API_KEY
        });
    }

    console.log('✅ Webhook verificado com sucesso (com barra)');

    // Resposta de verificação
    res.json({
        status: 'online',
        service: 'PrecisoCR WhatsApp Bot Webhook',
        supported_methods: ['POST', 'GET'],
        webhook_url: `http://localhost:${PORT}/webhook/message/`,
        api_key_configured: !!WEBHOOK_API_KEY,
        timestamp: new Date().toISOString(),
        message: 'Este endpoint aceita requisições POST para processar mensagens do WhatsApp',
        note: 'Esta é a versão com barra no final da URL'
    });
});

// Rota POST para webhook COM BARRA também
app.post('/webhook/message/', async(req, res) => {
    console.log('\n📩 Recebendo requisição POST no webhook (com barra)...');

    // Reutilizar a mesma lógica do webhook sem barra
    return await handleWebhookRequest(req, res);
});

// Rota GET para verificação do webhook (WAHA testa com GET)
app.get('/webhook/message/', (req, res) => {
    console.log('🔍 WAHA verificando webhook com GET...');

    // Validar API Key se for fornecida
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (WEBHOOK_API_KEY && apiKey !== WEBHOOK_API_KEY) {
        console.warn('⚠️  Tentativa de acesso sem API Key válida');
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'API Key inválida ou não fornecida',
            required_key: WEBHOOK_API_KEY
        });
    }

    console.log('✅ Webhook verificado com sucesso');

    // Resposta de verificação
    res.json({
        status: 'online',
        service: 'PrecisoCR WhatsApp Bot Webhook',
        supported_methods: ['POST', 'GET'],
        webhook_url: `http://localhost:${PORT}/webhook/message`,
        api_key_configured: !!WEBHOOK_API_KEY,
        timestamp: new Date().toISOString(),
        message: 'Este endpoint aceita requisições POST para processar mensagens do WhatsApp'
    });
});

// Rota para o Chrome DevTools (evitar erro CSP)
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
    res.json({
        chrome: {
            devtools: {
                frontendUrl: 'devtools://devtools/bundled/inspector.html'
            }
        }
    });
});

// Rota para verificar se o servidor está acessível
app.get('/webhook/health', (req, res) => {
    res.json({
        status: 'online',
        endpoint: '/webhook/message',
        methods: ['GET', 'POST'],
        api_key_required: true,
        required_header: 'x-api-key',
        timestamp: new Date().toISOString()
    });
});

// Função para validar API Key no webhook
function validateWebhookAuth(req) {
    const apiKey = req.headers['x-api-key'] ||
        req.headers['authorization']?.replace('Bearer ', '');

    console.log('🔑 API Key recebida:', apiKey ? '***' + apiKey.slice(-4) : 'Nenhuma');
    console.log('🔑 API Key esperada:', '***' + WEBHOOK_API_KEY.slice(-4));

    return apiKey === WEBHOOK_API_KEY;
}

// Função para enviar mensagem via WAHA
async function sendWhatsAppMessage(chatId, text) {
    try {
        console.log(`📤 Enviando para ${chatId}: ${text.substring(0, 50)}...`);
        const response = await wahaAxios.post('/api/sendText', {
            chatId: chatId,
            content: text,
            session: SESSION_NAME
        });
        console.log('✅ Mensagem enviada com sucesso');
        return response.data;
    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error.response?.data || error.message);
        return null;
    }
}

// Função para gerar resposta com Gemini
async function generateAIResponse(userId, userMessage) {
    try {
        if (!chatHistory.has(userId)) {
            chatHistory.set(userId, []);
        }
        const history = chatHistory.get(userId);

        const prompt = `Você é ${BOT_PERSONALITY.name}, um assistente virtual amigável e útil.
        
Histórico recente:
${history.slice(-3).join('\n')}

Pergunta do usuário: "${userMessage}"

Responda de forma natural e útil em português:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        history.push(`Usuário: ${userMessage}`);
        history.push(`Assistente: ${text}`);

        if (history.length > 6) {
            chatHistory.set(userId, history.slice(-6));
        }

        return text;

    } catch (error) {
        console.error('❌ Erro no Gemini:', error.message);
        return "Desculpe, tive um problema técnico. Tente novamente em alguns instantes.";
    }
}

// Rota principal - Dashboard
app.get('/', (req, res) => {
    const html = `
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
                    background: #f0f2f5;
                    min-height: 100vh;
                }
                .container {
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                h1 {
                    color: #4a6fa5;
                    text-align: center;
                    border-bottom: 3px solid #4a6fa5;
                    padding-bottom: 10px;
                }
                .status-card {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #28a745;
                }
                .config-card {
                    background: #fff3cd;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #ffc107;
                }
                .test-card {
                    background: #d1ecf1;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #17a2b8;
                }
                .btn {
                    display: inline-block;
                    background: #4a6fa5;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 6px;
                    text-decoration: none;
                    margin: 10px 5px;
                    font-weight: bold;
                    border: none;
                    cursor: pointer;
                }
                .btn-success {
                    background: #28a745;
                }
                .btn-info {
                    background: #17a2b8;
                }
                .btn-warning {
                    background: #ffc107;
                    color: #212529;
                }
                code {
                    background: #e9ecef;
                    padding: 5px 10px;
                    border-radius: 4px;
                    font-family: monospace;
                    display: inline-block;
                    margin: 2px;
                }
                .copy-btn {
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    margin-left: 5px;
                }
                .endpoint-test {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 6px;
                    margin: 10px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 ${BOT_PERSONALITY.name} - WhatsApp Bot</h1>
                
                <div class="status-card">
                    <h2>✅ Status do Sistema</h2>
                    <p><strong>Bot:</strong> Online na porta ${PORT}</p>
                    <p><strong>WAHA:</strong> ${WAHA_API}</p>
                    <p><strong>Sessão:</strong> ${SESSION_NAME}</p>
                    <p><strong>Conversas ativas:</strong> ${chatHistory.size}</p>
                    <p><strong>Endpoints disponíveis:</strong></p>
                    <ul>
                        <li><code>GET /webhook/message</code> - Verificação</li>
                        <li><code>POST /webhook/message</code> - Processar mensagens</li>
                        <li><code>GET /webhook/health</code> - Health check</li>
                    </ul>
                </div>
                
                <div class="test-card">
                    <h2>🧪 Testar Endpoints</h2>
                    <div class="endpoint-test">
                        <p><strong>Testar Webhook (GET):</strong></p>
                        <button class="btn btn-info" onclick="testEndpoint('GET')">Testar GET /webhook/message</button>
                        <div id="testResult"></div>
                    </div>
                    
                    <div class="endpoint-test">
                        <p><strong>Testar Health Check:</strong></p>
                        <button class="btn btn-info" onclick="testHealth()">Testar /webhook/health</button>
                        <div id="healthResult"></div>
                    </div>
                </div>
                
                <div class="config-card">
                    <h2>⚙️ CONFIGURAÇÃO DO WEBHOOK NO WAHA</h2>
                    <p><strong>Siga ESTES passos no WAHA:</strong></p>
                    <ol>
                        <li>Acesse: <a href="http://localhost:3000/dashboard" target="_blank">http://localhost:3000/dashboard</a></li>
                        <li>Login: <code>admin</code> / <code>101d3a6628f7416b96b1652742879b10</code></li>
                        <li>Vá em <strong>"Webhooks"</strong></li>
                        <li>Configure exatamente assim:</li>
                    </ol>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
                        <p><strong>Nome:</strong> <code>whatsapp</code></p>
                        <p><strong>URL da API:</strong> <code id="webhookUrl">http://localhost:8080/webhook/message</code>
                        <button class="copy-btn" onclick="copyToClipboard('webhookUrl')">Copiar</button></p>
                        <p><strong>Chave de API:</strong> <code id="apiKey">f15e1e93b5744831a3dbbc1740d490f6</code>
                        <button class="copy-btn" onclick="copyToClipboard('apiKey')">Copiar</button></p>
                    </div>
                    
                    <p style="margin-top: 15px; color: #dc3545;">
                        <strong>⚠️ IMPORTANTE:</strong> Clique em <strong>SALVAR</strong> após configurar!
                    </p>
                </div>
                
                <h2>🔗 Links Úteis</h2>
                <div>
                    <a href="http://localhost:3000/dashboard" class="btn" target="_blank">
                        📱 Painel do WAHA
                    </a>
                    <a href="/health" class="btn btn-success">🩺 Health Check</a>
                    <a href="/test" class="btn">🧪 Testar IA</a>
                    <a href="/setup-webhook" class="btn btn-warning">⚡ Configurar Automaticamente</a>
                </div>
            </div>
            
            <script>
                function copyToClipboard(elementId) {
                    const element = document.getElementById(elementId);
                    const text = element.textContent;
                    navigator.clipboard.writeText(text).then(() => {
                        const btn = event.target;
                        btn.textContent = '✓ Copiado!';
                        setTimeout(() => btn.textContent = 'Copiar', 2000);
                    });
                }
                
                async function testEndpoint(method) {
                    const resultDiv = document.getElementById('testResult');
                    resultDiv.innerHTML = '⏳ Testando...';
                    
                    try {
                        const url = '/webhook/message?api_key=f15e1e93b5744831a3dbbc1740d490f6';
                        const response = await fetch(url);
                        const data = await response.json();
                        
                        if (response.ok) {
                            resultDiv.innerHTML = '<div style="background: #d4edda; color: #155724; padding: 10px; border-radius: 4px; margin-top: 10px;">✅ <strong>Sucesso!</strong><br>Status: ' + data.status + '<br>URL: ' + data.webhook_url + '</div>';
                        } else {
                            resultDiv.innerHTML = '<div style="background: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin-top: 10px;">❌ <strong>Erro ' + response.status + '</strong><br>' + (data.error || 'Erro desconhecido') + '</div>';
                        }
                    } catch (error) {
                        resultDiv.innerHTML = '<div style="background: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin-top: 10px;">❌ <strong>Erro de conexão</strong><br>' + error.message + '</div>';
                    }
                }
                
                async function testHealth() {
                    const resultDiv = document.getElementById('healthResult');
                    resultDiv.innerHTML = '⏳ Testando...';
                    
                    try {
                        const response = await fetch('/webhook/health');
                        const data = await response.json();
                        
                        resultDiv.innerHTML = '<div style="background: #d4edda; color: #155724; padding: 10px; border-radius: 4px; margin-top: 10px;">✅ <strong>Webhook Health Check</strong><br>Status: ' + data.status + '<br>Endpoint: ' + data.endpoint + '<br>Métodos: ' + data.methods.join(', ') + '</div>';
                    } catch (error) {
                        resultDiv.innerHTML = '<div style="background: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin-top: 10px;">❌ <strong>Erro</strong><br>' + error.message + '</div>';
                    }
                }
            </script>
        </body>
        </html>
    `;

    res.send(html);
});

// Health check geral
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'PrecisoCR WhatsApp Bot',
        webhook_url: `http://localhost:${PORT}/webhook/message`,
        webhook_api_key: WEBHOOK_API_KEY,
        gemini_configured: !!GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// Testar bot
app.get('/test', (req, res) => {
    const html = `
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
            <h1>🧪 Testar IA</h1>
            <form id="testForm">
                <textarea id="message" placeholder="Digite uma mensagem...">Como posso ajudar?</textarea>
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
                        resultDiv.innerHTML = '<strong>🤖 Resposta:</strong><br>' + data.response;
                    } catch (error) {
                        resultDiv.innerHTML = '❌ Erro: ' + error.message;
                    }
                };
            </script>
        </body>
        </html>
    `;

    res.send(html);
});

app.post('/test-message', async(req, res) => {
    try {
        const { message } = req.body;
        const response = await generateAIResponse('test-user', message);
        res.json({ response: response });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Webhook POST para receber mensagens do WhatsApp
app.post('/webhook/message', async(req, res) => {
    try {
        console.log('\n📩 Recebendo requisição no webhook...');

        // Validar API Key
        if (!validateWebhookAuth(req)) {
            console.warn('⚠️  Tentativa não autorizada ao webhook');
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'API Key inválida ou não fornecida'
            });
        }

        console.log('✅ API Key válida');

        const message = req.body;
        console.log(`📩 Mensagem de ${message.from}: "${message.body}"`);

        // Ignorar mensagens próprias
        if (message.fromMe) {
            console.log('⏭️  Ignorando mensagem própria');
            return res.status(200).json({ processed: false, reason: 'own_message' });
        }

        const lowerBody = message.body?.toLowerCase().trim() || '';

        // Comandos básicos
        if (lowerBody === 'oi' || lowerBody === 'olá' || lowerBody === 'ola') {
            console.log('👋 Respondendo com saudação');
            await sendWhatsAppMessage(message.from, BOT_PERSONALITY.greeting);
            return res.status(200).json({ processed: true, type: 'greeting' });
        }

        if (lowerBody === 'ajuda' || lowerBody === 'help') {
            console.log('❓ Respondendo com ajuda');
            await sendWhatsAppMessage(message.from, BOT_PERSONALITY.help);
            return res.status(200).json({ processed: true, type: 'help' });
        }

        // Processar com IA
        console.log('🤖 Processando com Gemini AI...');
        const aiResponse = await generateAIResponse(message.from, message.body);

        console.log(`💬 Resposta gerada: ${aiResponse.substring(0, 100)}...`);
        await sendWhatsAppMessage(message.from, aiResponse);

        console.log('✅ Resposta enviada com sucesso');

        res.status(200).json({
            processed: true,
            type: 'ai_response',
            response_length: aiResponse.length
        });

    } catch (error) {
        console.error('❌ Erro no webhook:', error.message);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// Rota para configurar webhook automaticamente
app.get('/setup-webhook', async(req, res) => {
    try {
        console.log('🔄 Tentando configurar webhook automaticamente...');

        const webhookConfig = {
            url: `http://localhost:${PORT}/webhook/message`,
            events: ["message", "message.any"],
            session: SESSION_NAME,
            headers: {
                "x-api-key": WEBHOOK_API_KEY
            }
        };

        console.log('📤 Enviando para WAHA:', webhookConfig);

        const response = await wahaAxios.post('/api/webhook', webhookConfig);

        console.log('✅ Webhook configurado com sucesso!');
        console.log('📝 Resposta:', response.data);

        const successHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Webhook Configurado</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 50px; text-align: center; }
                    .success { color: #28a745; font-size: 24px; margin: 20px 0; }
                    .info { background: #d1ecf1; padding: 15px; border-radius: 5px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="success">✅ Webhook configurado com sucesso!</div>
                <div class="info">
                    <p><strong>URL:</strong> http://localhost:${PORT}/webhook/message</p>
                    <p><strong>API Key:</strong> ${WEBHOOK_API_KEY}</p>
                    <p><strong>Sessão:</strong> ${SESSION_NAME}</p>
                </div>
                <p><a href="/">← Voltar ao Dashboard</a></p>
                <p><a href="http://localhost:3000/dashboard" target="_blank">📱 Verificar no painel do WAHA</a></p>
            </body>
            </html>
        `;

        res.send(successHtml);

    } catch (error) {
        console.error('❌ Erro ao configurar webhook:', error.response?.data || error.message);

        const errorHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Erro ao Configurar</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 50px; }
                    .error { color: #dc3545; font-size: 24px; }
                    .instructions { background: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; }
                    code { background: #e9ecef; padding: 5px 10px; border-radius: 4px; }
                </style>
            </head>
            <body>
                <div class="error">❌ Não foi possível configurar automaticamente</div>
                
                <div class="instructions">
                    <h3>📋 Configure MANUALMENTE:</h3>
                    <ol>
                        <li>Acesse: <a href="http://localhost:3000/dashboard" target="_blank">http://localhost:3000/dashboard</a></li>
                        <li>Login: <code>admin</code> / <code>101d3a6628f7416b96b1652742879b10</code></li>
                        <li>Vá em "Webhooks"</li>
                        <li>Configure:
                            <ul>
                                <li><strong>Nome:</strong> whatsapp</li>
                                <li><strong>URL:</strong> http://localhost:8080/webhook/message</li>
                                <li><strong>Chave API:</strong> ${WEBHOOK_API_KEY}</li>
                            </ul>
                        </li>
                        <li><strong>Clique em SALVAR</strong></li>
                    </ol>
                </div>
                
                <p><a href="/">← Voltar ao Dashboard</a></p>
            </body>
            </html>
        `;

        res.send(errorHtml);
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('\n══════════════════════════════════════════════════');
    console.log('✅ SERVIDOR INICIADO COM ENDPOINTS CORRETOS');
    console.log(`🔗 Porta: ${PORT}`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
    console.log(`🔧 Webhook Test: http://localhost:${PORT}/webhook/health`);
    console.log(`⚡ Config Webhook: http://localhost:${PORT}/setup-webhook`);
    console.log('══════════════════════════════════════════════════\n');

    console.log('📋 ENDPOINTS DISPONÍVEIS:');
    console.log('• GET  /webhook/message    - Verificação do webhook');
    console.log('• POST /webhook/message    - Processar mensagens WhatsApp');
    console.log('• GET  /webhook/health     - Health check do webhook');
    console.log('• GET  /health             - Health check geral');
    console.log('• GET  /                   - Dashboard');
    console.log('══════════════════════════════════════════════════\n');

    console.log('📋 PASSO FINAL: CONFIGURE O WEBHOOK NO WAHA');
    console.log('1. Acesse: http://localhost:3000/dashboard');
    console.log('2. Login: admin / 101d3a6628f7416b96b1652742879b10');
    console.log('3. Vá em "Webhooks"');
    console.log('4. Configure:');
    console.log('   • Nome: whatsapp');
    console.log('   • URL: http://localhost:8080/webhook/message');
    console.log('   • Chave API: f15e1e93b5744831a3dbbc1740d490f6');
    console.log('5. Clique em SALVAR');
    console.log('══════════════════════════════════════════════════\n');

    console.log('🧪 TESTE OS ENDPOINTS:');
    console.log('curl -X GET "http://localhost:8080/webhook/message?api_key=f15e1e93b5744831a3dbbc1740d490f6"');
    console.log('curl -X GET "http://localhost:8080/webhook/health"');
    console.log('══════════════════════════════════════════════════\n');
});