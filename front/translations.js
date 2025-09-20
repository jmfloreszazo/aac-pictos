// Language translations for AAC Pictos application
const translations = {
  es: {
    title: "AAC · Tobii + IA (Vanilla JS) + Gaze Cursor",
    subtitle: "Mira un pictograma → elige 3 → generamos frase → la leemos.",
    subtitleExtra: "Ahora con <strong>puntero de mirada</strong> visible.",
    connectButton: "Conectar Tobii (ws://127.0.0.1:8765)",
    statusDisconnected: "Desconectado",
    statusConnected: "Conectado",
    azureLabel: "Azure OpenAI:",
    azureVerifying: "Verificando...",
    azureConnected: "Conectado",
    azureError: "Error",
    retryButton: "Reintentar",
    cursorSize: "Tamaño cursor:",
    opacity: "Opacidad:",
    smoothness: "Suavidad:",
    dwellTime: "Tiempo dwell:",
    boardLabel: "Tablero de pictogramas",
    placeholder: "Aquí aparecerá la frase…",
    clearButton: "Limpiar",
    speakButton: "Leer en voz alta",
    hint: "Sin Tobii, simula la mirada dejando el puntero 2.5s sobre un pictograma. El cursor verde seguirá tu mirada para facilitar el uso.",
    footer: "Aplicación AAC con IA integrada. Las credenciales están seguras en el servidor backend.",
    pictograms: {
      yo: "Yo",
      tu: "Tú", 
      agua: "Vaso de agua",
      comida: "Plato de comida",
      si: "Sí",
      no: "No",
      baño: "Ir al baño",
      tele: "Ver televisión",
      dormir: "Quiero dormir",
      ayuda: "Necesito ayuda",
      dolor: "Me duele algo",
      calor: "Tengo calor"
    },
    tags: {
      persona: "persona",
      interlocutor: "interlocutor",
      beber: "beber",
      plato: "plato",
      confirmar: "confirmar",
      negar: "negar",
      necesidad: "necesidad",
      baño: "baño",
      entretenimiento: "entretenimiento",
      ver: "ver",
      descanso: "descanso",
      sueño: "sueño",
      asistencia: "asistencia",
      socorro: "socorro",
      malestar: "malestar",
      dolor: "dolor",
      temperatura: "temperatura",
      calor: "calor"
    },
    messages: {
      connecting: "Conectando...",
      connected: "Conectado a Tobii",
      disconnected: "Desconectado de Tobii",
      connectionError: "Error de conexión",
      aiProcessing: "Procesando con IA...",
      aiError: "Error al generar frase",
      aiSuccess: "Frase generada",
      speechStart: "Reproduciendo...",
      speechEnd: "Reproducción completada",
      speechError: "Error en síntesis de voz"
    }
  },
  en: {
    title: "AAC · Tobii + AI (Vanilla JS) + Gaze Cursor",
    subtitle: "Look at a pictogram → choose 3 → we generate sentence → we read it.",
    subtitleExtra: "Now with visible <strong>gaze pointer</strong>.",
    connectButton: "Connect Tobii (ws://127.0.0.1:8765)",
    statusDisconnected: "Disconnected",
    statusConnected: "Connected",
    azureLabel: "Azure OpenAI:",
    azureVerifying: "Verifying...",
    azureConnected: "Connected",
    azureError: "Error",
    retryButton: "Retry",
    cursorSize: "Cursor size:",
    opacity: "Opacity:",
    smoothness: "Smoothness:",
    dwellTime: "Dwell time:",
    boardLabel: "Pictogram board",
    placeholder: "The sentence will appear here…",
    clearButton: "Clear",
    speakButton: "Read aloud",
    hint: "Without Tobii, simulate gaze by leaving the pointer 2.5s over a pictogram. The green cursor will follow your gaze for easier use.",
    footer: "AAC application with integrated AI. Credentials are secure on the backend server.",
    pictograms: {
      yo: "Me",
      tu: "You",
      agua: "Glass of water", 
      comida: "Plate of food",
      si: "Yes",
      no: "No",
      baño: "Go to bathroom",
      tele: "Watch television",
      dormir: "I want to sleep",
      ayuda: "I need help",
      dolor: "Something hurts",
      calor: "I'm hot"
    },
    tags: {
      persona: "person",
      interlocutor: "other person",
      beber: "drink",
      plato: "plate",
      confirmar: "confirm",
      negar: "deny",
      necesidad: "need",
      baño: "bathroom",
      entretenimiento: "entertainment",
      ver: "watch",
      descanso: "rest",
      sueño: "sleep",
      asistencia: "assistance",
      socorro: "help",
      malestar: "discomfort",
      dolor: "pain",
      temperatura: "temperature",
      calor: "heat"
    },
    messages: {
      connecting: "Connecting...",
      connected: "Connected to Tobii",
      disconnected: "Disconnected from Tobii", 
      connectionError: "Connection error",
      aiProcessing: "Processing with AI...",
      aiError: "Error generating sentence",
      aiSuccess: "Sentence generated",
      speechStart: "Playing...",
      speechEnd: "Playback completed",
      speechError: "Speech synthesis error"
    }
  }
};

// Detect browser language
function detectLanguage() {
  const browserLang = navigator.language || navigator.userLanguage;
  const lang = browserLang.substring(0, 2).toLowerCase();
  
  // Always default to Spanish for AAC application as the primary language
  // The user can manually switch to English if needed
  return 'es';
}

// Get current language
let currentLanguage = detectLanguage();

// Get translation function
function t(key) {
  const keys = key.split('.');
  let value = translations[currentLanguage];
  
  for (const k of keys) {
    value = value && value[k];
  }
  
  return value || key;
}

// Set language and update interface
function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    updateInterface();
  }
}

// Update all interface text
function updateInterface() {
  // Update document title and html lang
  document.title = t('title');
  document.documentElement.lang = currentLanguage;
  
  // Update header
  const h1 = document.querySelector('h1');
  if (h1) h1.textContent = t('title');
  
  const subtitle = document.querySelector('.subtitle');
  if (subtitle) {
    subtitle.innerHTML = t('subtitle') + '<br>' + t('subtitleExtra');
  }
  
  // Update buttons and labels
  const connectBtn = document.getElementById('connect');
  if (connectBtn) connectBtn.textContent = t('connectButton');
  
  const status = document.getElementById('status');
  if (status && status.textContent.includes('Desconectado') || status.textContent.includes('Disconnected')) {
    status.textContent = t('statusDisconnected');
  }
  
  const azureLabel = document.querySelector('.azure-label');
  if (azureLabel) azureLabel.textContent = t('azureLabel');
  
  const azureStatus = document.getElementById('azure-status');
  if (azureStatus && (azureStatus.textContent.includes('Verificando') || azureStatus.textContent.includes('Verifying'))) {
    azureStatus.textContent = t('azureVerifying');
  }
  
  const retryBtn = document.getElementById('retry-azure');
  if (retryBtn) retryBtn.textContent = t('retryButton');
  
  // Update control labels
  updateControlLabels();
  
  // Update board aria-label
  const board = document.getElementById('board');
  if (board) board.setAttribute('aria-label', t('boardLabel'));
  
  // Update placeholder
  const output = document.getElementById('output');
  if (output) output.placeholder = t('placeholder');
  
  // Update action buttons
  const clearBtn = document.getElementById('clear');
  if (clearBtn) clearBtn.textContent = t('clearButton');
  
  const speakBtn = document.getElementById('speak');
  if (speakBtn) speakBtn.textContent = t('speakButton');
  
  // Update hint
  const hint = document.querySelector('.hint');
  if (hint) hint.textContent = t('hint');
  
  // Update footer
  const footer = document.querySelector('footer small');
  if (footer) footer.textContent = t('footer');
  
  // Update pictogram labels if board is rendered
  updatePictogramLabels();
}

function updateControlLabels() {
  const labels = document.querySelectorAll('.cursorctl');
  const labelKeys = ['cursorSize', 'opacity', 'smoothness', 'dwellTime'];
  
  labels.forEach((label, index) => {
    if (labelKeys[index]) {
      const textNode = label.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        textNode.textContent = t(labelKeys[index]) + ' ';
      }
    }
  });
}

function updatePictogramLabels() {
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    const key = card.dataset.key;
    if (key && translations[currentLanguage].pictograms[key]) {
      const label = card.querySelector('.label');
      if (label) {
        label.textContent = t(`pictograms.${key}`);
      }
      
      // Update tags as well
      const tagsElement = card.querySelector('p');
      if (tagsElement) {
        // Get the original tags from PICTOS array
        const picto = window.PICTOS && window.PICTOS.find(p => p.key === key);
        if (picto && picto.tags) {
          const translatedTags = picto.tags.map(tag => t(`tags.${tag}`)).join(', ');
          tagsElement.textContent = translatedTags;
        }
      }
    }
  });
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { translations, t, setLanguage, updateInterface, detectLanguage };
}