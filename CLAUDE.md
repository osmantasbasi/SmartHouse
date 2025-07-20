# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Smart Home MQTT Dashboard - a full-stack application with React frontend and Node.js/Express backend for IoT device management via MQTT protocol. The app features user authentication, real-time device monitoring, and a customizable dashboard.

## Essential Commands

### Development
```bash
# Start backend with auto-restart (nodemon)
npm run dev

# In separate terminal: Start webpack with watch mode for frontend
npm run watch
```

### Production Build & Run
```bash
# Build frontend assets
npm run build

# Start production server
npm start
```

### Testing & Debugging
- No test suite configured yet
- For MQTT testing: Use the built-in testing tools in Settings page
- Database: SQLite file at `database.sqlite` (auto-created on first run)

## Architecture Overview

### Backend Architecture (Express + Socket.IO)
- **Entry Point**: `server.js` - Express server with Socket.IO for real-time communication
- **Authentication**: Session-based with bcrypt password hashing, stored in SQLite
- **MQTT Integration**: Global MQTT client that broadcasts messages via Socket.IO
- **API Routes**: 
  - `/api/auth/*` - Authentication endpoints (register, login, logout, dashboard config)
  - `/api/*` - MQTT control endpoints (connect, disconnect, publish, subscribe)
  - All non-auth routes require session authentication via `requireAuth` middleware

### Frontend Architecture (React SPA)
- **Entry**: `src/index.js` → `src/App.js`
- **Routing**: React Router with protected routes via `AuthContext`
- **State Management**: React Context API
  - `AuthContext`: User authentication state and methods
  - `DeviceContext`: Device management and real-time updates
  - `MqttContext`: MQTT connection status and messaging
  - `ThemeContext`: Dark/light theme management
- **Real-time Updates**: Socket.IO client subscribes to MQTT messages from backend

### Database Schema (SQLite)
- **users**: User accounts with hashed passwords
- **user_settings**: Key-value settings per user
- **dashboard_config**: JSON dashboard layouts per user
- Foreign key constraints ensure data isolation between users

### MQTT Message Flow
1. Backend connects to MQTT broker with user-provided credentials
2. Frontend subscribes to topics via Socket.IO events
3. MQTT messages received by backend are broadcast to all connected Socket.IO clients
4. Device auto-detection based on topic patterns (configured in `src/config/devices.json`)

### Build Process
- Webpack bundles React app to `public/dist/bundle.js`
- HTML template from `src/index.html` → `public/index.html`
- Express serves static files from `public/` directory
- Catch-all route serves `index.html` for client-side routing

## Key Configuration Files

### Device Definitions (`src/config/devices.json`)
Defines all supported IoT device types with:
- Topic patterns for auto-detection
- Display properties (name, icon, controllable flag)
- Expected data keys and control interfaces
- Thresholds for value validation

### Message Formats (`src/config/message-formats.json`)
Example MQTT message payloads for each device type, used by the testing interface.

## Development Notes

### Adding New Device Types
1. Update `src/config/devices.json` with device definition
2. Add corresponding message format in `src/config/message-formats.json`
3. If controllable, implement control UI in `src/components/devices/DeviceWidget.js`

### Authentication Flow
- Registration creates user in SQLite with bcrypt-hashed password
- Login creates session stored in Express session (24h expiry)
- All API routes except `/api/auth/*` require valid session
- Frontend redirects to login when receiving 401 responses

### WebSocket Events
- `connectionStatus`: MQTT broker connection state
- `mqttMessage`: Incoming MQTT messages
- `subscribe`/`unsubscribe`: Topic subscription management
- `publish`: Send MQTT messages

### File Upload Handling
- Standard certificates: `uploads/certificates/`
- AWS IoT certificates: `uploads/aws-certificates/` (ca-cert.pem, client-cert.pem, client-key.pem)
- Multer middleware handles file validation and storage