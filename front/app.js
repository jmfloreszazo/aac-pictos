// Vanilla JS AAC demo with visible gaze cursor + WebSocket gaze + Azure OpenAI + TTS

// Pictogram data - labels will be updated by translation system
const PICTOS = [
  { key: 'yo',     label: 'Yo',              emoji: '👤',   tags: ['persona'] },
  { key: 'tu',     label: 'Tú',              emoji: '👥',   tags: ['interlocutor'] },
  { key: 'agua',   label: 'Vaso de agua',    emoji: '💧',   tags: ['beber'] },
  { key: 'comida', label: 'Plato de comida', emoji: '🍽️',   tags: ['plato'] },
  { key: 'si',     label: 'Sí',              emoji: '✅',   tags: ['confirmar'] },
  { key: 'no',     label: 'No',              emoji: '❌',   tags: ['negar'] },
  { key: 'baño',   label: 'Ir al baño',      emoji: '🚽',   tags: ['necesidad', 'baño'] },
  { key: 'tele',   label: 'Ver televisión',  emoji: '📺',   tags: ['entretenimiento', 'ver'] },
  { key: 'dormir', label: 'Quiero dormir',   emoji: '😴',   tags: ['descanso', 'sueño'] },
  { key: 'ayuda',  label: 'Necesito ayuda',  emoji: '🆘',   tags: ['asistencia', 'socorro'] },
  { key: 'dolor',  label: 'Me duele algo',   emoji: '😰',   tags: ['malestar', 'dolor'] },
  { key: 'calor',  label: 'Tengo calor',     emoji: '🥵',   tags: ['temperatura', 'calor'] },
];

// Make PICTOS available globally for translations
window.PICTOS = PICTOS;

const DWELL_MS = 2500; // Reduced from 4000ms to 2.5s for easier use
const WS_URL = 'ws://127.0.0.1:8765';

// Local proxy for Azure OpenAI (secure)
const PROXY_ENDPOINT = 'http://localhost:3002/api/generate-phrase';

// Azure OpenAI connection state
let azureFoundryAvailable = false;
let lastAzureCheck = 0;
let azureRetryCount = 0;
const AZURE_CHECK_INTERVAL = 30000; // Check every 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [2000, 5000, 10000]; // 2s, 5s, 10s

const boardEl = document.getElementById('board');
const chipsEl = document.getElementById('chips');
const outputEl = document.getElementById('output');
const connectBtn = document.getElementById('connect');
const statusEl = document.getElementById('status');
const azureStatusEl = document.getElementById('azure-status');
const retryAzureBtn = document.getElementById('retry-azure');
const gazeCursor = document.getElementById('gazeCursor');
const cursorSize = document.getElementById('cursorSize');
const cursorAlpha = document.getElementById('cursorAlpha');
const smoothness = document.getElementById('smoothness');
const dwellTime = document.getElementById('dwellTime');
const dwellDisplay = document.getElementById('dwellDisplay');

let selected = [];
let ws = null;
let currentDwellMs = 2500;
let currentSmooth = 0.15;

// Render grid
function renderBoard() {
  boardEl.innerHTML = ''; // Clear existing content
  PICTOS.forEach(item => {
    const el = document.createElement('button');
    el.className = 'card';
    el.dataset.key = item.key;
    
    // Get translated label
    const translatedLabel = t(`pictograms.${item.key}`);
    
    // Get translated tags
    const translatedTags = item.tags.map(tag => t(`tags.${tag}`)).join(', ');
    
    el.innerHTML = `
      <div class="dwell-ring" aria-hidden="true"><div class="dwell-fill"></div></div>
      <div class="emoji" aria-hidden="true">${item.emoji}</div>
      <h3 class="label">${translatedLabel}</h3>
      <p>${translatedTags}</p>
    `;
    setupDwellMouse(el, item.key);
    boardEl.appendChild(el);
  });
}

// Dwell state
let dwellTarget = null, dwellTimer = null, dwellStart = 0;

function beginDwell(element, key) {
  if (dwellTarget === element) return;
  endDwell();
  dwellTarget = element;
  dwellStart = performance.now();
  dwellTimer = setInterval(() => {
    if (!dwellTarget) return;
    const elapsed = performance.now() - dwellStart;
    const pct = Math.min(100, (elapsed / currentDwellMs) * 100);
    const fill = dwellTarget.querySelector('.dwell-fill');
    if (fill) fill.style.width = pct + '%';
    if (pct >= 100) {
      chooseKey(key);
      endDwell();
    }
  }, 60);
}

function endDwell() {
  if (dwellTimer) clearInterval(dwellTimer);
  dwellTimer = null;
  dwellStart = 0;
  if (dwellTarget) {
    const fill = dwellTarget.querySelector('.dwell-fill');
    if (fill) fill.style.width = '0%';
  }
  dwellTarget = null;
}

// Mouse fallback + visible cursor for testing (when WS not connected)
document.addEventListener('mousemove', (e) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showCursor(e.clientX, e.clientY);
  }
});

function setupDwellMouse(el, key) {
  el.addEventListener('mouseenter', () => beginDwell(el, key));
  el.addEventListener('mouseleave', endDwell);
  el.addEventListener('focus', () => beginDwell(el, key));
  el.addEventListener('blur', endDwell);
  el.addEventListener('click', () => chooseKey(key));
}

// Selection
function chooseKey(key) {
  if (selected.length >= 3) return;
  selected.push(key);
  renderChips();
  if (selected.length === 3) {
    composeAndSpeak(selected);
  }
}

function renderChips() {
  chipsEl.innerHTML = '';
  selected.forEach((key, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = t(`pictograms.${key}`);
    chip.title = t('retryButton'); // Using "Remove" equivalent
    chip.addEventListener('click', () => {
      selected.splice(i, 1);
      renderChips();
      outputEl.value = '';
    });
    chipsEl.appendChild(chip);
  });
}

document.getElementById('clear').addEventListener('click', () => {
  selected = [];
  renderChips();
  outputEl.value = '';
});

document.getElementById('speak').addEventListener('click', () => {
  speak(outputEl.value.trim());
});

function speak(text) {
  if (!text || !text.trim()) {
    console.warn('No text to speak');
    return;
  }
  
  // Cancel any previous speech
  speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text.trim());
  
  // Configure voice preferences for Spanish
  const voices = speechSynthesis.getVoices();
  const spanishVoice = voices.find(v => 
    v.lang && (
      v.lang.toLowerCase().startsWith('es-es') ||
      v.lang.toLowerCase().startsWith('es-mx') ||
      v.lang.toLowerCase().startsWith('es')
    )
  );
  
  if (spanishVoice) {
    utterance.voice = spanishVoice;
    console.log('Using Spanish voice:', spanishVoice.name);
  } else {
    console.warn('Spanish voice not found, using default voice');
  }
  
  // Configure speech parameters
  utterance.rate = 0.9;      // Slightly slower for clarity
  utterance.pitch = 1.0;     // Normal pitch
  utterance.volume = 1.0;    // Full volume
  
  // Event handlers
  utterance.onstart = () => {
    console.log('Starting to speak:', text);
    updateSpeechStatus('Hablando...');
  };
  
  utterance.onend = () => {
    console.log('Finished speaking');
    updateSpeechStatus('');
  };
  
  utterance.onerror = (event) => {
    console.error('Speech synthesis error:', event.error);
    updateSpeechStatus(t('messages.speechError'));
    setTimeout(() => updateSpeechStatus(''), 3000);
  };
  
  // Speak the text
  speechSynthesis.speak(utterance);
}

// Function to update speech status
function updateSpeechStatus(message) {
  const statusElement = document.getElementById('speech-status');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.style.display = message ? 'block' : 'none';
  }
}

// Generate phrases using local proxy (secure)
async function composeRemote(concepts) {
  // If Azure is not available, use local fallback directly
  if (!azureFoundryAvailable) {
    console.log('Azure Foundry not available, using local generation');
    updateAIStatus('Usando generación local');
    return composeLocal(concepts);
  }

  try {
    // Show loading state
    updateAIStatus('Generando con Azure IA...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const res = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        concepts: concepts
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(`HTTP ${res.status}: ${errorData.error || 'Proxy error'}`);
    }
    
    const data = await res.json();
    const text = data.phrase || '';
    
    if (text) {
      if (data.source === 'azure_foundry' || data.source === 'azure_openai') {
        updateAIStatus('Generado con Azure IA ✓');
      } else {
        updateAIStatus('Azure falló - Generado localmente ✓');
        // Azure falló, actualizar estado
        azureFoundryAvailable = false;
        updateAzureStatus(false, 'Azure no respondió');
      }
      return text;
    } else {
      throw new Error('Respuesta vacía del proxy');
    }
    
  } catch (e) {
    console.warn('Fallo del proxy, usando generación local:', e);
    
    // Marcar Azure como no disponible
    azureFoundryAvailable = false;
    updateAzureStatus(false, t('messages.connectionError'));
    
    if (e.name === 'AbortError') {
      updateAIStatus('Timeout - usando local');
    } else {
      updateAIStatus(t('messages.aiError'));
    }
    
    return composeLocal(concepts);
  }
}

// Function to update Azure Foundry status
function updateAzureStatus(isAvailable, message = '', showRetry = true) {
  azureFoundryAvailable = isAvailable;
  lastAzureCheck = Date.now();
  
  azureStatusEl.className = 'badge';
  retryAzureBtn.style.display = 'none';
  
  if (isAvailable) {
    azureStatusEl.classList.add('ok');
    azureStatusEl.textContent = t('azureConnected');
    azureRetryCount = 0; // Reset retry count on success
  } else {
    azureStatusEl.classList.add('err');
    azureStatusEl.textContent = message || t('azureError');
    if (showRetry) {
      retryAzureBtn.style.display = 'inline-block';
    }
  }
}

// Function to retry Azure connection with exponential backoff
async function retryAzureConnection(attempt = 0) {
  if (attempt >= MAX_RETRY_ATTEMPTS) {
    console.log('❌ Maximum retry attempts reached for Azure Foundry');
    updateAzureStatus(false, 'Máx. reintentos alcanzado', true);
    return false;
  }

  const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
  
  updateAzureStatus(false, `Reintentando en ${delay/1000}s...`, false);
  
  await new Promise(resolve => setTimeout(resolve, delay));
  
  updateAzureStatus(false, `Reintento ${attempt + 1}/${MAX_RETRY_ATTEMPTS}...`, false);
  
  const success = await checkAzureFoundryStatus(false);
  
  if (!success) {
    return retryAzureConnection(attempt + 1);
  }
  
  return true;
}

// Function to check Azure Foundry availability
async function checkAzureFoundryStatus(showLoading = true) {
  try {
    if (showLoading) {
      azureStatusEl.className = 'badge warning';
      azureStatusEl.textContent = t('azureVerifying');
      retryAzureBtn.style.display = 'none';
    }
    
    const testResponse = await fetch('http://localhost:3002/api/test-connection', {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (testResponse.ok) {
      const data = await testResponse.json();
      if (data.status === 'connected') {
        updateAzureStatus(true);
        console.log('✅ Azure Foundry available');
        return true;
      } else {
        updateAzureStatus(false, data.message || 'No disponible');
        console.log('❌ Azure Foundry not available:', data.message);
        
        // Auto-retry if it's a temporary error
        if (azureRetryCount < MAX_RETRY_ATTEMPTS && 
            (data.message.includes('timeout') || data.message.includes('Timeout'))) {
          console.log('🔄 Starting automatic retries...');
          retryAzureConnection(0);
        }
        
        return false;
      }
    } else {
      updateAzureStatus(false, `Error ${testResponse.status}`);
      console.log('❌ Error verifying Azure Foundry:', testResponse.status);
      return false;
    }
  } catch (error) {
    updateAzureStatus(false, 'Proxy no accesible');
    console.log('❌ Could not verify Azure Foundry:', error.message);
    return false;
  }
}

// Function to periodically check Azure status
function startAzureStatusMonitoring() {
  // Check immediately
  checkAzureFoundryStatus();
  
  // Check periodically
  setInterval(() => {
    const timeSinceLastCheck = Date.now() - lastAzureCheck;
    if (timeSinceLastCheck >= AZURE_CHECK_INTERVAL) {
      checkAzureFoundryStatus(false); // Don't show loading for periodic checks
    }
  }, AZURE_CHECK_INTERVAL);
}

// Function to update AI status
function updateAIStatus(message) {
  const statusElement = document.getElementById('ai-status');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.style.display = 'block';
    
    // Auto-hide status after 3 seconds for success messages
    if (message.includes('✓')) {
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }
  }
}

// Local fallback
function composeLocal(concepts) {
  const set = new Set(concepts);
  if (set.has('yo') && set.has('agua')) return 'Por favor, necesito un vaso de agua.';
  if (set.has('yo') && set.has('comida')) return 'Por favor, necesito un plato de comida.';
  if (set.has('tu') && set.has('agua')) return '¿Puedes traerme un vaso de agua, por favor?';
  if (set.has('yo') && set.has('baño')) return 'Necesito ir al baño, por favor.';
  if (set.has('yo') && set.has('tele')) return 'Quiero ver la televisión.';
  if (set.has('yo') && set.has('dormir')) return 'Tengo sueño, quiero dormir.';
  if (set.has('yo') && set.has('ayuda')) return 'Por favor, necesito ayuda.';
  if (set.has('yo') && set.has('dolor')) return 'Me duele algo, no me siento bien.';
  if (set.has('yo') && set.has('calor')) return 'Tengo mucho calor.';
  if (set.has('tu') && set.has('ayuda')) return '¿Puedes ayudarme, por favor?';
  return `Quiero comunicar: ${concepts.join(', ')}.`;
}

async function composeAndSpeak(concepts) {
  try {
    outputEl.value = 'Generando frase con IA...';
    outputEl.style.fontStyle = 'italic';
    outputEl.style.opacity = '0.7';
    
    const phrase = await composeRemote(concepts);
    
    outputEl.value = phrase;
    outputEl.style.fontStyle = 'normal';
    outputEl.style.opacity = '1';
    
    // Add a small delay to let user see the generated text before speaking
    setTimeout(() => {
      speak(phrase);
    }, 500);
    
  } catch (error) {
    console.error('Error en composición y habla:', error);
    outputEl.value = 'Error al generar frase';
    outputEl.style.fontStyle = 'normal';
    outputEl.style.opacity = '1';
    updateAIStatus('Error: No se pudo generar la frase');
  }
}

// --- Gaze cursor helpers (visible green circle with smoothing) ---
let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
let tx = cx, ty = cy;

function showCursor(x, y) {
  tx = x; ty = y;
  gazeCursor.style.display = 'block';
}
function updateCursorLoop() {
  cx += (tx - cx) * currentSmooth;
  cy += (ty - cy) * currentSmooth;
  gazeCursor.style.left = cx + 'px';
  gazeCursor.style.top  = cy + 'px';
  requestAnimationFrame(updateCursorLoop);
}
updateCursorLoop();

// Cursor UI controls
function applyCursorStyle() {
  const size = Number(cursorSize.value);
  const alpha = Number(cursorAlpha.value) / 100;
  gazeCursor.style.width = size + 'px';
  gazeCursor.style.height = size + 'px';
  gazeCursor.style.background = `rgba(0, 255, 0, ${alpha})`;
  gazeCursor.style.borderColor = `rgba(0, 255, 0, ${Math.min(1, alpha + 0.5)})`;
}

function updateControls() {
  applyCursorStyle();
  currentSmooth = Number(smoothness.value) / 100;
  currentDwellMs = Number(dwellTime.value);
  dwellDisplay.textContent = (currentDwellMs / 1000).toFixed(1) + 's';
}

cursorSize.addEventListener('input', updateControls);
cursorAlpha.addEventListener('input', updateControls);
smoothness.addEventListener('input', updateControls);
dwellTime.addEventListener('input', updateControls);
updateControls();

// WebSocket gaze
function connectWS() {
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => { statusEl.textContent = t('statusConnected'); statusEl.classList.add('ok'); statusEl.classList.remove('err'); gazeCursor.style.display='block'; };
    ws.onclose = () => { statusEl.textContent = t('statusDisconnected'); statusEl.classList.remove('ok'); };
    ws.onerror = () => { statusEl.textContent = t('messages.connectionError'); statusEl.classList.add('err'); };
    ws.onmessage = (evt) => {
      const point = parseGazeMessage(evt.data);
      if (!point) return;
      const x = clamp01(point.xNorm ?? (point.x / window.innerWidth));
      const y = clamp01(point.yNorm ?? (point.y / window.innerHeight));
      const px = x * window.innerWidth;
      const py = y * window.innerHeight;
      showCursor(px, py);
      
      // Buscar elementos en un área más amplia para facilitar la selección
      const tolerance = 30; // píxeles de tolerancia
      let targetCard = null;
      
      // Probar punto exacto primero
      let el = document.elementFromPoint(px, py);
      let card = el && el.closest ? el.closest('.card') : null;
      if (card && card.parentElement === boardEl) {
        targetCard = card;
      } else {
        // Si no hay éxito, probar puntos alrededor con tolerancia
        for (let dx = -tolerance; dx <= tolerance && !targetCard; dx += tolerance) {
          for (let dy = -tolerance; dy <= tolerance && !targetCard; dy += tolerance) {
            const testX = px + dx;
            const testY = py + dy;
            if (testX >= 0 && testX < window.innerWidth && testY >= 0 && testY < window.innerHeight) {
              el = document.elementFromPoint(testX, testY);
              card = el && el.closest ? el.closest('.card') : null;
              if (card && card.parentElement === boardEl) {
                targetCard = card;
                break;
              }
            }
          }
        }
      }
      
      if (targetCard) {
        beginDwell(targetCard, targetCard.dataset.key);
      } else {
        endDwell();
      }
    };
  } catch (e) {
    statusEl.textContent = t('messages.connectionError');
    statusEl.classList.add('err');
  }
}

function parseGazeMessage(msg) {
  try {
    const j = JSON.parse(msg);
    if (typeof j.x === 'number' && typeof j.y === 'number') return { x: j.x, y: j.y };
    if (typeof j.xNorm === 'number' && typeof j.yNorm === 'number') return { xNorm: j.xNorm, yNorm: j.yNorm };
    if (j.gaze && typeof j.gaze.x === 'number' && typeof j.gaze.y === 'number') return { x: j.gaze.x, y: j.gaze.y };
    if (typeof j.lx === 'number' && typeof j.ly === 'number') return { x: j.lx, y: j.ly };
  } catch (_) {
    if (typeof msg === 'string' && msg.includes(',')) {
      const [sx, sy] = msg.split(',').map(Number);
      if (!Number.isNaN(sx) && !Number.isNaN(sy)) return { x: sx, y: sy };
    }
  }
  return null;
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

connectBtn.addEventListener('click', connectWS);

window.addEventListener('load', () => {
  // Ensure speech synthesis voices are loaded
  speechSynthesis.getVoices();
  
  // Listen for voices loaded event
  speechSynthesis.addEventListener('voiceschanged', () => {
    const voices = speechSynthesis.getVoices();
    const spanishVoices = voices.filter(v => 
      v.lang && v.lang.toLowerCase().includes('es')
    );
    console.log('Available Spanish voices:', spanishVoices.map(v => `${v.name} (${v.lang})`));
  });
  
  // Application initialization moved to initializeApp() function
});

// Event listener for retry Azure button
retryAzureBtn.addEventListener('click', () => {
  console.log('🔄 Retrying Azure Foundry connection...');
  checkAzureFoundryStatus(true);
});

connectBtn.addEventListener('click', connectWS);

// Language switcher functionality
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('lang-btn')) {
    const newLang = e.target.dataset.lang;
    setLanguage(newLang);
    updateLanguageButtons();
  }
});

function updateLanguageButtons() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLanguage);
  });
}

// Initialize the application
function initializeApp() {
  // Update interface with detected language
  updateInterface();
  
  // Update language buttons
  updateLanguageButtons();
  
  // Render board with translations
  renderBoard();
  
  // Update dwell time display
  dwellDisplay.textContent = (currentDwellMs / 1000).toFixed(1) + 's';
  
  // Start Azure status monitoring
  startAzureStatusMonitoring();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
