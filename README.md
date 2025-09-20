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
# From the tobii/ folder
cd TobiiAccessibility/bin/Debug/net48/

# Execute the program (default port 8765)
./TobiiAccessibility.exe

# Or with custom parameters:
./TobiiAccessibility.exe --host 127.0.0.1 --port 8765
```

**Expected result:**

```text
Tobii -> WebSocket bridge
WebSocket server listening on ws://127.0.0.1:8765
Gaze tracking initialized...
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

The `.env` file should contain:

```env
AZURE_OPENAI_ENDPOINT=https://jmfz-aif-test.openai.azure.com/
DEPLOYMENT_NAME=o1
API_VERSION=2025-01-01-preview
PORT=3002
```

### Execute the proxy server

```bash
# Development mode
npm start

# Or direct mode
node server.js
```

**Expected result:**

```text
Server AAC AI Proxy started on port 3002
Azure authentication configured correctly
Azure OpenAI connection: OK
Server ready at http://localhost:3002
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
# From the front/ folder
# Option 1: Open directly in browser
open index.html

# Option 2: Use local HTTP server (recommended)
# With Python 3:
python -m http.server 8080

# With Node.js (if you have http-server installed):
npx http-server -p 8080
```

### Application access

Open in browser: `http://localhost:8080` (or directly the HTML file)

**Expected interface:**

- "Connect Tobii" button
- Azure OpenAI status
- Board with 6 pictograms
- Text area for generated sentences
- Gaze cursor controls

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
├── README.md                    # This file
├── tobii/                       # Tobii C#/.NET Bridge
│   ├── Tobii.sln               # Visual Studio solution
│   └── TobiiAccessibility/     # Main project
│       ├── Program.cs          # WebSocket server for eye tracking
│       └── TobiiAccessibility.csproj
├── backend-proxy/              # Node.js proxy server
│   ├── package.json           # npm dependencies
│   ├── server.js             # Express server + Azure OpenAI
│   └── .env                  # Environment variables
└── front/                     # HTML/JS Frontend
    ├── index.html            # Main interface
    ├── app.js               # Application logic
    ├── styles.css           # CSS styles
    └── assets/              # SVG pictograms
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