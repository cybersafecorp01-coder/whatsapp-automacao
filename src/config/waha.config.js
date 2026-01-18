module.exports = {
    // URL da API do WAHA
    apiUrl: process.env.WAHA_API_URL || 'http://localhost:3000',

    // API Key do WAHA
    apiKey: process.env.WAHA_API_KEY || 'f15e1e93b5744831a3dbbc1740d490fd',

    // Nome da sessão
    sessionName: process.env.WAHA_SESSION_NAME || 'precisocr',

    // URL do webhook
    webhookUrl: process.env.WEBHOOK_URL || 'http://localhost:8080/webhook/message',

    // API Key para o webhook
    webhookApiKey: process.env.WEBHOOK_API_KEY || 'f15e1e93b5744831a3dbbc1740d490fd',

    // Configurações do WhatsApp
    whatsappConfig: {
        headless: true,
        browserArgs: [
            '-no-sandbox',
            '-disable-setuid-sandbox',
            '-disable-dev-shm-usage'
        ],
        sessionTimeout: 60000,
        qrTimeout: 120000,
        authTimeout: 60000,
    },

    // Configurações do servidor
    serverConfig: {
        port: process.env.PORT || 8080,
        host: '0.0.0.0',
        cors: true,
        bodyLimit: '10mb'
    },

    // Configurações de logging
    logging: {
        level: 'info',
        format: 'combined',
        dir: 'logs'
    }
};