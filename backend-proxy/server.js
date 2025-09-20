const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { AzureOpenAI } = require('openai');
const { DefaultAzureCredential, getBearerTokenProvider } = require('@azure/identity');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de seguridad
app.use(helmet());

// Rate limiting - limitar requests por IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana por IP
  message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo en 15 minutos.'
});
app.use(limiter);

// CORS configurado para el frontend
app.use(cors({
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Middleware para parsear JSON
app.use(express.json({ limit: '10mb' }));

// Validar que las variables de entorno estén configuradas
if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.DEPLOYMENT_NAME) {
  console.error('❌ Error: AZURE_OPENAI_ENDPOINT y DEPLOYMENT_NAME deben estar configuradas en .env');
  process.exit(1);
}

// Configurar Azure OpenAI
let azureOpenAIClient = null;

async function initializeAzureOpenAI() {
  try {
    // Usar API Key si está disponible, sino usar Azure AD
    if (process.env.AZURE_OPENAI_API_KEY) {
      azureOpenAIClient = new AzureOpenAI({
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        apiVersion: process.env.API_VERSION || '2025-01-01-preview',
      });
      console.log('✅ Cliente Azure OpenAI inicializado correctamente con API Key');
    } else {
      // Fallback a Azure AD si no hay API Key
      const credential = new DefaultAzureCredential();
      const tokenProvider = getBearerTokenProvider(
        credential,
        'https://cognitiveservices.azure.com/.default'
      );

      azureOpenAIClient = new AzureOpenAI({
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        azureADTokenProvider: tokenProvider,
        apiVersion: process.env.API_VERSION || '2025-01-01-preview',
      });
      console.log('✅ Cliente Azure OpenAI inicializado correctamente con Azure AD');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error inicializando Azure OpenAI:', error.message);
    return false;
  }
}

// Variables para estadísticas
let serverStats = {
  startTime: new Date(),
  requestCount: 0,
  azureSuccessCount: 0,
  azureErrorCount: 0,
  localFallbackCount: 0
};

// Middleware para contar requests
app.use((req, res, next) => {
  serverStats.requestCount++;
  next();
});

// Endpoint de salud con estadísticas
app.get('/health', (req, res) => {
  const uptime = Date.now() - serverStats.startTime.getTime();
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'AAC AI Proxy',
    uptime_ms: uptime,
    uptime_human: Math.floor(uptime / 1000) + 's',
    stats: {
      total_requests: serverStats.requestCount,
      azure_success: serverStats.azureSuccessCount,
      azure_errors: serverStats.azureErrorCount,
      local_fallbacks: serverStats.localFallbackCount
    }
  });
});

// Endpoint principal para generar frases con Azure OpenAI
app.post('/api/generate-phrase', async (req, res) => {
  try {
    const { concepts, context } = req.body;

    // Validar entrada
    if (!concepts || !Array.isArray(concepts) || concepts.length === 0) {
      return res.status(400).json({
        error: 'Se requiere un array de conceptos válido'
      });
    }

    // Verificar que Azure OpenAI esté disponible
    if (!azureOpenAIClient) {
      console.warn('⚠️ Azure OpenAI no está inicializado, usando fallback local');
      serverStats.localFallbackCount++;
      return res.json({
        phrase: generateLocalFallback(concepts),
        source: 'local_fallback',
        reason: 'azure_not_initialized'
      });
    }

    // Contexto predeterminado para AAC - optimizado para GPT-4.1-mini
    const defaultContext = `Contexto: Una persona con discapacidad usa un dispositivo Tobii para comunicarse con la mirada. Necesita comunicar algo a su cuidador usando pictogramas seleccionados.`;
    
    const userPrompt = `${context || defaultContext}

Pictogramas seleccionados: ${concepts.join(', ')}

Genera una frase corta, clara y respetuosa en español que exprese lo que la persona quiere comunicar. Responde solo con la frase:`;

    console.log(`🔄 Procesando solicitud para conceptos: ${concepts.join(', ')}`);

    // Preparar mensajes para Azure OpenAI
    const messages = [
      {
        role: 'system',
        content: 'Eres un asistente especializado en comunicación aumentativa y alternativa (AAC). Generas frases claras en español basadas en pictogramas seleccionados por personas con discapacidad que usan dispositivos de comunicación asistida.'
      },
      {
        role: 'user',
        content: userPrompt
      }
    ];

    // Llamada a Azure OpenAI
    console.log('📤 Enviando solicitud a Azure OpenAI...');
    console.log('📋 Mensajes:', JSON.stringify(messages, null, 2));
    
    const completion = await azureOpenAIClient.chat.completions.create({
      model: process.env.DEPLOYMENT_NAME,
      messages: messages,
      max_completion_tokens: 150, // Reducido para GPT-4.1-mini
      temperature: 0.7,
      stream: false
    });

    console.log('📥 Respuesta completa de Azure OpenAI:', JSON.stringify(completion, null, 2));
    
    const text = completion.choices?.[0]?.message?.content?.trim();
    
    console.log('📝 Texto extraído:', JSON.stringify(text));
    console.log('🔍 Choices length:', completion.choices?.length);
    console.log('🔍 First choice:', JSON.stringify(completion.choices?.[0], null, 2));
    
    if (!text) {
      console.warn('⚠️ Respuesta vacía de Azure OpenAI, usando fallback local');
      console.warn('💾 Objeto completion completo:', JSON.stringify(completion, null, 2));
      serverStats.localFallbackCount++;
      return res.json({
        phrase: generateLocalFallback(concepts),
        source: 'local_fallback',
        reason: 'empty_response',
        debug_completion: completion
      });
    }

    console.log(`✅ Frase generada exitosamente: "${text}"`);
    serverStats.azureSuccessCount++;
    
    res.json({
      phrase: text,
      source: 'azure_openai',
      concepts: concepts,
      model: process.env.DEPLOYMENT_NAME
    });

  } catch (error) {
    console.error('❌ Error en el proxy:', error.message);
    serverStats.azureErrorCount++;
    serverStats.localFallbackCount++;
    
    // Retornar fallback local en caso de error
    res.json({
      phrase: generateLocalFallback(req.body.concepts || []),
      source: 'local_fallback',
      error: error.message
    });
  }
});

// Función de fallback local
function generateLocalFallback(concepts) {
  const set = new Set(concepts);
  
  if (set.has('yo') && set.has('agua')) {
    return 'Por favor, necesito un vaso de agua.';
  }
  if (set.has('yo') && set.has('comida')) {
    return 'Por favor, necesito un plato de comida.';
  }
  if (set.has('tu') && set.has('agua')) {
    return '¿Puedes traerme un vaso de agua, por favor?';
  }
  if (set.has('tu') && set.has('comida')) {
    return '¿Puedes traerme comida, por favor?';
  }
  if (set.has('si')) {
    return 'Sí, por favor.';
  }
  if (set.has('no')) {
    return 'No, gracias.';
  }
  
  return `Quiero comunicar: ${concepts.join(', ')}.`;
}

// Endpoint para probar la conexión con Azure OpenAI
app.get('/api/test-connection', async (req, res) => {
  try {
    console.log('🔍 Probando conexión con Azure OpenAI...');
    
    if (!azureOpenAIClient) {
      console.log('❌ Cliente Azure OpenAI no inicializado');
      return res.status(200).json({
        status: 'error',
        message: 'Azure OpenAI no inicializado',
        timestamp: new Date().toISOString()
      });
    }

    // Hacer una llamada simple a Azure OpenAI para probar la conexión
    const completion = await azureOpenAIClient.chat.completions.create({
      model: process.env.DEPLOYMENT_NAME,
      messages: [
        {
          role: 'system',
          content: 'Responde con "OK" para confirmar la conexión.'
        },
        {
          role: 'user',
          content: 'Test de conexión'
        }
      ],
      max_completion_tokens: 50,
      temperature: 0
    });

    if (completion && completion.choices && completion.choices.length > 0) {
      console.log('✅ Azure OpenAI conectado exitosamente');
      res.json({ 
        status: 'connected', 
        message: 'Azure OpenAI disponible',
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        deployment: process.env.DEPLOYMENT_NAME,
        api_version: process.env.API_VERSION,
        timestamp: new Date().toISOString(),
        test_response: completion.choices[0].message.content
      });
    } else {
      console.log('❌ Respuesta inesperada de Azure OpenAI');
      res.status(200).json({
        status: 'error',
        message: 'Respuesta inesperada de Azure OpenAI',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.log(`❌ Error al conectar con Azure OpenAI: ${error.message}`);
    
    let errorMessage = 'No se pudo conectar con Azure OpenAI';
    if (error.message.includes('authentication')) {
      errorMessage = 'Error de autenticación con Azure OpenAI';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Timeout conectando con Azure OpenAI';
    } else if (error.message.includes('quota')) {
      errorMessage = 'Cuota excedida en Azure OpenAI';
    }
    
    res.status(200).json({
      status: 'error', 
      message: errorMessage,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Manejo de errores global
app.use((error, req, res, next) => {
  console.error('❌ Error no manejado:', error);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: 'Algo salió mal en el proxy'
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    available_endpoints: [
      'GET /health',
      'GET /api/test-connection',
      'POST /api/generate-phrase'
    ]
  });
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🚀 Servidor proxy AAC ejecutándose en http://localhost:${PORT}`);
  console.log(`📋 Endpoints disponibles:`);
  console.log(`   • GET  /health - Estado del servidor`);
  console.log(`   • GET  /api/test-connection - Probar conexión con Azure OpenAI`);
  console.log(`   • POST /api/generate-phrase - Generar frases`);
  console.log(`🔧 Configuración:`);
  console.log(`   • Azure OpenAI Endpoint: ${process.env.AZURE_OPENAI_ENDPOINT || 'No configurado'}`);
  console.log(`   • Deployment: ${process.env.DEPLOYMENT_NAME || 'No configurado'}`);
  console.log(`   • API Version: ${process.env.API_VERSION || 'No configurado'}`);
  
  // Inicializar Azure OpenAI
  console.log(`🔄 Inicializando Azure OpenAI...`);
  const initialized = await initializeAzureOpenAI();
  if (initialized) {
    console.log(`✅ Azure OpenAI inicializado correctamente`);
  } else {
    console.log(`⚠️ Azure OpenAI no disponible - funcionará solo con fallback local`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 Cerrando servidor...');
  process.exit(0);
});