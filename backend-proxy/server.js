const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { AzureOpenAI } = require('openai');
const { DefaultAzureCredential, getBearerTokenProvider } = require('@azure/identity');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// Rate limiting - limit requests per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // maximum 100 requests per window per IP
  message: 'Too many requests from this IP, please try again in 15 minutes.'
});
app.use(limiter);

// CORS configured for frontend
app.use(cors({
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Middleware to parse JSON
app.use(express.json({ limit: '10mb' }));

// Validate that environment variables are configured
if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.DEPLOYMENT_NAME) {
  console.error('❌ Error: AZURE_OPENAI_ENDPOINT and DEPLOYMENT_NAME must be configured in .env');
  process.exit(1);
}

// Configure Azure OpenAI
let azureOpenAIClient = null;

async function initializeAzureOpenAI() {
  try {
    // Use API Key if available, otherwise use Azure AD
    if (process.env.AZURE_OPENAI_API_KEY) {
      azureOpenAIClient = new AzureOpenAI({
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        apiVersion: process.env.API_VERSION || '2025-01-01-preview',
      });
      console.log('✅ Azure OpenAI client initialized successfully with API Key');
    } else {
      // Fallback to Azure AD if no API Key
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
      console.log('✅ Azure OpenAI client initialized successfully with Azure AD');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error initializing Azure OpenAI:', error.message);
    return false;
  }
}

// Variables for statistics
let serverStats = {
  startTime: new Date(),
  requestCount: 0,
  azureSuccessCount: 0,
  azureErrorCount: 0,
  localFallbackCount: 0
};

// Middleware to count requests
app.use((req, res, next) => {
  serverStats.requestCount++;
  next();
});

// Health endpoint with statistics
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

// Main endpoint to generate phrases with Azure OpenAI
app.post('/api/generate-phrase', async (req, res) => {
  try {
    const { concepts, context } = req.body;

    // Validate input
    if (!concepts || !Array.isArray(concepts) || concepts.length === 0) {
      return res.status(400).json({
        error: 'A valid concepts array is required'
      });
    }

    // Check if Azure OpenAI is available
    if (!azureOpenAIClient) {
      console.warn('⚠️ Azure OpenAI not initialized, using local fallback');
      serverStats.localFallbackCount++;
      return res.json({
        phrase: generateLocalFallback(concepts),
        source: 'local_fallback',
        reason: 'azure_not_initialized'
      });
    }

    // Default context for AAC - optimized for GPT-4.1-mini
    const defaultContext = `Context: A person with disability uses a Tobii device to communicate with gaze. They need to communicate something to their caregiver using selected pictograms.`;
    
    const userPrompt = `${context || defaultContext}

Selected pictograms: ${concepts.join(', ')}

Generate a short, clear and respectful phrase in Spanish that expresses what the person wants to communicate. Respond only with the phrase:`;

    console.log(`🔄 Processing request for concepts: ${concepts.join(', ')}`);

    // Prepare messages for Azure OpenAI
    const messages = [
      {
        role: 'system',
        content: 'You are an assistant specialized in augmentative and alternative communication (AAC). You generate clear phrases in Spanish based on pictograms selected by people with disabilities who use assistive communication devices.'
      },
      {
        role: 'user',
        content: userPrompt
      }
    ];

    // Call to Azure OpenAI
    console.log('📤 Sending request to Azure OpenAI...');
    console.log('📋 Messages:', JSON.stringify(messages, null, 2));
    
    const completion = await azureOpenAIClient.chat.completions.create({
      model: process.env.DEPLOYMENT_NAME,
      messages: messages,
      max_completion_tokens: 150, // Reduced for GPT-4.1-mini
      temperature: 0.7,
      stream: false
    });

    console.log('📥 Complete response from Azure OpenAI:', JSON.stringify(completion, null, 2));
    
    const text = completion.choices?.[0]?.message?.content?.trim();
    
    console.log('📝 Extracted text:', JSON.stringify(text));
    console.log('🔍 Choices length:', completion.choices?.length);
    console.log('🔍 First choice:', JSON.stringify(completion.choices?.[0], null, 2));
    
    if (!text) {
      console.warn('⚠️ Empty response from Azure OpenAI, using local fallback');
      console.warn('💾 Complete completion object:', JSON.stringify(completion, null, 2));
      serverStats.localFallbackCount++;
      return res.json({
        phrase: generateLocalFallback(concepts),
        source: 'local_fallback',
        reason: 'empty_response',
        debug_completion: completion
      });
    }

    console.log(`✅ Phrase generated successfully: "${text}"`);
    serverStats.azureSuccessCount++;
    
    res.json({
      phrase: text,
      source: 'azure_openai',
      concepts: concepts,
      model: process.env.DEPLOYMENT_NAME
    });

  } catch (error) {
    console.error('❌ Error in proxy:', error.message);
    serverStats.azureErrorCount++;
    serverStats.localFallbackCount++;
    
    // Return local fallback in case of error
    res.json({
      phrase: generateLocalFallback(req.body.concepts || []),
      source: 'local_fallback',
      error: error.message
    });
  }
});

// Local fallback function
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

// Endpoint to test connection with Azure OpenAI
app.get('/api/test-connection', async (req, res) => {
  try {
    console.log('🔍 Testing connection with Azure OpenAI...');
    
    if (!azureOpenAIClient) {
      console.log('❌ Azure OpenAI client not initialized');
      return res.status(200).json({
        status: 'error',
        message: 'Azure OpenAI not initialized',
        timestamp: new Date().toISOString()
      });
    }

    // Make a simple call to Azure OpenAI to test the connection
    const completion = await azureOpenAIClient.chat.completions.create({
      model: process.env.DEPLOYMENT_NAME,
      messages: [
        {
          role: 'system',
          content: 'Respond with "OK" to confirm the connection.'
        },
        {
          role: 'user',
          content: 'Connection test'
        }
      ],
      max_completion_tokens: 50,
      temperature: 0
    });

    if (completion && completion.choices && completion.choices.length > 0) {
      console.log('✅ Azure OpenAI connected successfully');
      res.json({ 
        status: 'connected', 
        message: 'Azure OpenAI available',
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        deployment: process.env.DEPLOYMENT_NAME,
        api_version: process.env.API_VERSION,
        timestamp: new Date().toISOString(),
        test_response: completion.choices[0].message.content
      });
    } else {
      console.log('❌ Unexpected response from Azure OpenAI');
      res.status(200).json({
        status: 'error',
        message: 'Unexpected response from Azure OpenAI',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.log(`❌ Error connecting to Azure OpenAI: ${error.message}`);
    
    let errorMessage = 'Could not connect to Azure OpenAI';
    if (error.message.includes('authentication')) {
      errorMessage = 'Authentication error with Azure OpenAI';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Timeout connecting to Azure OpenAI';
    } else if (error.message.includes('quota')) {
      errorMessage = 'Quota exceeded in Azure OpenAI';
    }
    
    res.status(200).json({
      status: 'error', 
      message: errorMessage,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Global error handling
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong in the proxy'
  });
});

// Handle not found routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    available_endpoints: [
      'GET /health',
      'GET /api/test-connection',
      'POST /api/generate-phrase'
    ]
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 AAC proxy server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   • GET  /health - Server status`);
  console.log(`   • GET  /api/test-connection - Test Azure OpenAI connection`);
  console.log(`   • POST /api/generate-phrase - Generate phrases`);
  console.log(`🔧 Configuration:`);
  console.log(`   • Azure OpenAI Endpoint: ${process.env.AZURE_OPENAI_ENDPOINT || 'Not configured'}`);
  console.log(`   • Deployment: ${process.env.DEPLOYMENT_NAME || 'Not configured'}`);
  console.log(`   • API Version: ${process.env.API_VERSION || 'Not configured'}`);
  
  // Initialize Azure OpenAI
  console.log(`🔄 Initializing Azure OpenAI...`);
  const initialized = await initializeAzureOpenAI();
  if (initialized) {
    console.log(`✅ Azure OpenAI initialized successfully`);
  } else {
    console.log(`⚠️ Azure OpenAI not available - will work with local fallback only`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Shutting down server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 Shutting down server...');
  process.exit(0);
});