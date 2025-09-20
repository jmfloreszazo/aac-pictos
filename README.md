# AAC Pictos - Augmentative and Alternative Communication with Tobii Eye Tracking

Augmentative and Alternative Communication (AAC) system that integrates Tobii eye tracking, Azure OpenAI artificial intelligence, and speech synthesis. Allows users with communication difficulties to create sentences using gaze and pictograms.

## System Architecture

The project consists of **3 main components** that must be executed in order:

```text
1. Tobii Bridge (C#/.NET)     →  Captures eye tracking data
2. Backend Proxy (Node.js)    →  Securely connects to Azure OpenAI  
3. Frontend (HTML/JS)         →  User interface with pictograms
```

### Operation Flow

1. **Tobii Bridge** captures gaze position and sends it via WebSocket
2. **Frontend** receives gaze data and detects selections by dwell time
3. **Backend Proxy** processes selections and generates sentences with Azure OpenAI
4. **Speech synthesis** reads the generated sentences

## Installation and Execution Guide

### Prerequisites

- **Tobii Eye Tracker** connected and configured
- **.NET Framework 4.8** (for Tobii bridge)
- **Node.js 16+** (for backend proxy)
- **Azure CLI** with authentication configured
- **Modern web browser** (Chrome, Firefox, Edge)

---

## Step 1: Execute Tobii Bridge (.NET)

### Initial Configuration

```bash
# Navigate to the Tobii project directory
cd tobii

# Compile the solution (requires Visual Studio or .NET SDK)
dotnet build Tobii.sln
```

### Execute the bridge

```bash
# Navigate to the compiled executable directory
cd tobii/TobiiAccessibility/bin/Debug/net48/

# Execute using Windows command through WSL/cmd (recommended)
cmd.exe /c "TobiiAccesibilidad.exe"

# Or with custom parameters:
cmd.exe /c "TobiiAccesibilidad.exe --host 127.0.0.1 --port 8765"

# Alternative: Use full Windows path
cmd.exe /c "C:\sources\dotNet\Test_Tobii\aac-pictos\tobii\TobiiAccessibility\bin\Debug\net48\TobiiAccesibilidad.exe"
```

**Expected result:**

```text
[bridge] Starting WebSocket server at ws://127.0.0.1:8765
20/09/2025 17:03:14 [Info] Server started at ws://127.0.0.1:8765 (actual port 8765) 
[bridge] Checking Tobii environment...
[bridge] Found 6 Tobii processes running:
[bridge]   - Tobii.EyeX.Engine
[bridge]   - TobiiGameHub
[bridge]   - Tobii.EyeX.Interaction
[bridge]   - Tobii.Service
[bridge] Attempting to initialize Tobii host...
[bridge] Creating gaze point data stream...
[bridge] Ready to stream gaze data. Press Ctrl+C to exit.
```

---

## Step 2: Execute Backend Proxy (Node.js)

### Backend Configuration

```bash
# Navigate to the backend directory
cd backend-proxy

# Install dependencies
npm install

# Verify Azure authentication
az login
```

### Configure environment variables

Create a `.env` file in the `backend-proxy/` directory with your Azure OpenAI configuration:

```bash
# Create the .env file
cd backend-proxy
touch .env
```

**Example `.env` file:**

```env
# ==============================================
# AZURE OPENAI CONFIGURATION (REQUIRED)
# ==============================================

# Your Azure OpenAI resource endpoint
# Format: https://YOUR-RESOURCE-NAME.openai.azure.com/
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/

# The deployment name of your model in Azure OpenAI Studio
# Common models: gpt-4, gpt-4-turbo, gpt-35-turbo, o1-preview
DEPLOYMENT_NAME=gpt-4

# Azure OpenAI API version
# Check latest versions at: https://learn.microsoft.com/en-us/azure/ai-services/openai/api-version-deprecation
API_VERSION=2024-08-01-preview

# ==============================================
# AUTHENTICATION OPTIONS (Choose one)
# ==============================================

# Option 1: Use API Key (simpler setup)
# Get from Azure Portal → Your OpenAI Resource → Keys and Endpoint
AZURE_OPENAI_API_KEY=your-api-key-here

# Option 2: Use Azure AD authentication (more secure)
# Leave AZURE_OPENAI_API_KEY empty to use Azure AD
# Requires: az login and proper RBAC permissions

# ==============================================
# SERVER CONFIGURATION (OPTIONAL)
# ==============================================

# Port for the backend proxy server
# Default: 3001, but we use 3002 to avoid conflicts
PORT=3002

# ==============================================
# EXAMPLE COMPLETE CONFIGURATION
# ==============================================
# AZURE_OPENAI_ENDPOINT=https://jmfz-aif-test.openai.azure.com/
# DEPLOYMENT_NAME=gpt-4
# API_VERSION=2024-08-01-preview
# AZURE_OPENAI_API_KEY=sk-1234567890abcdef...
# PORT=3002
```

**How to get these values:**

1. **AZURE_OPENAI_ENDPOINT**:
   - Go to Azure Portal → Your OpenAI Resource → "Keys and Endpoint"
   - Copy the "Endpoint" URL

2. **DEPLOYMENT_NAME**:
   - Go to Azure OpenAI Studio → Deployments
   - Copy the name of your model deployment (not the model name)

3. **AZURE_OPENAI_API_KEY** (if using API key authentication):
   - Go to Azure Portal → Your OpenAI Resource → "Keys and Endpoint"
   - Copy "Key 1" or "Key 2"

4. **API_VERSION**:
   - Use the latest stable version from [Microsoft docs](https://learn.microsoft.com/en-us/azure/ai-services/openai/api-version-deprecation)
   - For newest features, use preview versions like `2024-08-01-preview`

**Security Note**: Never commit the `.env` file to version control. It's already included in `.gitignore`.

### Execute the proxy server

```bash
# Navigate to backend-proxy directory
cd backend-proxy

# Method 1: Execute directly from correct directory (recommended)
bash -c "cd /mnt/c/sources/dotNet/Test_Tobii/aac-pictos/backend-proxy && node server.js"

# Method 2: Use npm scripts (if configured)
npm start

# Method 3: Direct execution with full path
node /mnt/c/sources/dotNet/Test_Tobii/aac-pictos/backend-proxy/server.js
```

**Expected result:**

```text
🚀 AAC proxy server running on http://localhost:3002
📋 Available endpoints:
   • GET  /health - Server status
   • GET  /api/test-connection - Test Azure OpenAI connection
   • POST /api/generate-phrase - Generate phrases
🔧 Configuration:
   • Azure OpenAI Endpoint: https://jmfz-aif-test.cognitiveservices.azure.com/
   • Deployment: gpt-4.1-mini
   • API Version: 2025-01-01-preview
🔄 Initializing Azure OpenAI...
✅ Azure OpenAI client initialized successfully with API Key
✅ Azure OpenAI initialized successfully
```

### Verify the backend

```bash
# Test server health
curl http://localhost:3002/health

# Test Azure OpenAI connection
curl http://localhost:3002/api/test-connection
```

---

## Step 3: Execute Frontend (HTML/JS)

### Open the application

```bash
# Navigate to frontend directory
cd front

# Method 1: Using Python 3 HTTP server (recommended)
python3 -m http.server 8080

# Method 2: Direct execution with full path
cd /mnt/c/sources/dotNet/Test_Tobii/aac-pictos/front && python3 -m http.server 8080

# Method 3: Using Node.js (if you have http-server installed)
npx http-server -p 8080

# Method 4: Open directly in browser (less recommended)
# open index.html
```

**Expected frontend output:**

```text
Serving HTTP on 0.0.0.0 port 8080 (http://0.0.0.0:8080/) ...
```

### Application access

Open in browser: `http://localhost:8080`

**Expected interface:**

- "Connect Tobii" button
- Azure OpenAI status
- Board with 6 pictograms
- Text area for generated sentences
- Gaze cursor controls

---

## Quick Start Commands (Tested Working)

For quick execution, use these tested commands in separate terminals:

### Terminal 1: Tobii Bridge

```bash
cd /mnt/c/sources/dotNet/Test_Tobii/aac-pictos/tobii/TobiiAccessibility/bin/Debug/net48
cmd.exe /c "TobiiAccesibilidad.exe"
```

### Terminal 2: Backend Proxy

```bash
bash -c "cd /mnt/c/sources/dotNet/Test_Tobii/aac-pictos/backend-proxy && node server.js"
```

### Terminal 3: Frontend

```bash
cd /mnt/c/sources/dotNet/Test_Tobii/aac-pictos/front && python3 -m http.server 8080
```

### Access Application

Open browser: `http://localhost:8080`

---

## System Usage

### 1. Connect Eye Tracking

- Click "Connect Tobii (ws://127.0.0.1:8765)"
- Status should change to "Connected"
- A circular cursor that follows the gaze will appear

### 2. Select Pictograms

- Look at a pictogram for 2.5 seconds (dwell time)
- The pictogram will highlight and appear as a selected "chip"
- Select up to 3 pictograms

### 3. Generate Sentence

- After selecting 3 pictograms, a sentence is automatically generated with AI
- The sentence appears in the text area

### 4. Listen to Result

- Click "Read aloud" for speech synthesis
- Or use "Clear" to start over

## Advanced Configuration

### Eye Tracking Settings

- **Cursor size**: 12-80px
- **Opacity**: 10-90%
- **Smoothness**: Movement filter 5-50
- **Dwell time**: 1.5-5 seconds

### Backend Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server status |
| `/api/test-connection` | GET | Test Azure connection |
| `/api/generate-phrase` | POST | Generate sentences with AI |

## Troubleshooting

### Tobii doesn't connect

- Verify that the eye tracker is connected
- Check that port 8765 is free
- Review updated Tobii drivers

### Backend proxy fails

```bash
# Verify Azure authentication
az account show

# Change port if occupied
# In .env: PORT=3003

# Verify Azure OpenAI permissions
az role assignment list --assignee $(az account show --query user.name -o tsv)
```

### Frontend doesn't connect

- Verify that the backend is running on port 3002
- Check CORS in browser console
- Use local HTTP server instead of direct file

### "EADDRINUSE" error

```bash
# Find process using the port
lsof -i :3002
# Kill process if necessary
kill -9 <PID>
```

## Project Structure

```text
aac-pictos/
├── README.md                   # This file
├── tobii/                      # Tobii C#/.NET Bridge
│   ├── Tobii.sln               # Visual Studio solution
│   └── TobiiAccessibility/     # Main project
│       ├── Program.cs          # WebSocket server for eye tracking
│       └── TobiiAccessibility.csproj
├── backend-proxy/              # Node.js proxy server
│   ├── package.json            # npm dependencies
│   ├── server.js               # Express server + Azure OpenAI
│   └── .env                    # Environment variables
└── front/                      # HTML/JS Frontend
    ├── index.html              # Main interface
    ├── app.js                  # Application logic
    ├── styles.css              # CSS styles
    └── assets/                 # SVG pictograms
        ├── yo.svg
        ├── tu.svg
        ├── agua.svg
        ├── comida.svg
        ├── si.svg
        └── no.svg
```

## Security

- **Azure Authentication**: Uses Entra ID (more secure than API keys)
- **CORS configured**: Only allowed origins
- **Rate limiting**: Maximum 100 requests/15min per IP
- **Security headers**: Helmet.js configured

---

**Objective**: Facilitate communication for people with motor difficulties using eye tracking technology, AI and speech synthesis.

**Support**: For technical problems, check logs in each component and follow the troubleshooting guide.
