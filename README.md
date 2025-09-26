# Codectivity MCCore Web API

The official web API for managing Minecraft launchers built using the Codectivity MCCore infrastructure, built with Node.js, Express, and TypeScript. This API provides endpoints for managing launcher assets, Java distributions, and API key authentication.

## Features

- **Launcher Asset Management**: Configure and serve Minecraft launcher assets with version-specific configurations
- **Java Distribution Management**: Manage Java runtime distributions for different Minecraft versions
- **News Management**: Create and manage news articles for launcher announcements
- **API Key Authentication**: Secure admin endpoints with API key-based authentication
- **Web Admin Interface**: Built-in web UI for managing launcher configurations
- **Manifest Generation**: Automatic generation of mod and resource pack manifests
- **SQLite Database**: Lightweight database for storing configurations and assets
- **CORS Support**: Cross-origin resource sharing enabled for public endpoints

## Directory Structure

```
src/
├── app.ts                 # Express application setup
├── server.ts              # Server entry point
├── database/
│   ├── index.ts          # Database connection and initialization
│   ├── operations.ts     # Database operations
│   └── schema.ts         # Database schema definitions
├── middleware/
│   └── auth.ts           # API key authentication middleware
├── routes/
│   ├── admin.ts          # Admin API endpoints (protected)
│   ├── public.ts         # Public API endpoints
│   ├── setup.ts          # Initial setup endpoints
│   └── web.ts            # Web UI routes
├── utils/
│   └── manifest.ts       # Manifest generation utilities
└── views/                # EJS templates for web UI
```

## Installation

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/codectivity/mccore-webapi.git
   cd mccore-webapi
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

The server will start on `http://localhost:3000` by default.

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-secret-key-change-in-production
```

## API Documentation

### Base URL
All API endpoints are prefixed with `/v2/`

### Public Endpoints

#### GET `/v1/public/news`
Returns all news articles (public access).

**Response:**
```json
{
  "news": [
    {
      "id": 1,
      "title": "New Update Available",
      "description": "We've released a new update with exciting features!",
      "image": "https://example.com/image.jpg",
      "created_at": "2024-01-01T00:00:00.000Z",
      "modified_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### GET `/v1/public/news/:id`
Returns a specific news article by ID (public access).

**Response:**
```json
{
  "news": {
    "id": 1,
    "title": "New Update Available",
    "description": "We've released a new update with exciting features!",
    "image": "https://example.com/image.jpg",
    "created_at": "2024-01-01T00:00:00.000Z",
    "modified_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET `/v1/public/assets/java`
Returns Java runtime distribution information.

**Response:**
```json
{
  "java": [
    {
      "version": "17.0.2",
      "url": "https://example.com/java-17.zip",
      "sha256": "abc123..."
    }
  ]
}
```

#### POST `/v2/public/assets/launcher`
Returns launcher assets for a specific client, with optional per-version manifest resolution.

**Request Body:**
```json
{
  "client_id": "your-client-id",
  "version": "1.20.1-fabric" // optional: choose a specific version's manifests
}
```

**Response:**
```json
{
  "version": ["1.20.1-forge", "1.20.1-fabric"],
  "server": "play.example.com",
  "base": "https://cdn.example.com/1.20.1-fabric/",  
  "mods": {
    "files": { "modA.jar": "sha256-hash", "modB.jar": "sha256-hash" },
    "signature": "hex-signature"
  },
  "rp": {
    "files": { "assets.zip": "sha256-hash" },
    "signature": "hex-signature"
  },
  "social_media": { "discord": "https://discord.gg/..." }
}
```

Per-version manifests
- If you send `version`, the API will use `version_configs[version]` for `base`, `mods`, and `rp` manifests if available; otherwise it falls back to default URLs.
- If you omit `version`, defaults are used.

### Admin Endpoints (Require API Key)

All admin endpoints require an API key in the `Authorization` header:
```
Authorization: Bearer your-api-key
```

#### API Key Management

**POST `/v1/admin/keys`** - Create a new API key
```json
{
  "key": "your-api-key",
  "name": "Optional key name"
}
```

**GET `/v1/admin/keys`** - List all API keys

**DELETE `/v1/admin/keys/:keyHash`** - Deactivate an API key

#### Launcher Asset Management

Note: Asset creation and updates are usually done via the Web UI.

**POST `/v2/admin/assets`** - Create a launcher asset
```json
{
  "client_id": "client-identifier",
  "version": "1.20.1-forge",
  "server": "play.example.com",
  "base_url": "https://example.com/assets/",
  "mods_manifest_url": "https://example.com/mods_manifest.json",
  "rp_manifest_url": "https://example.com/rp_manifest.json",
  "private_key": "base64-encoded-private-key"
}
```

**GET `/v2/admin/assets`** - List all launcher assets

**GET `/v2/admin/assets/:clientId`** - Get specific launcher asset

**PUT `/v2/admin/assets/:clientId`** - Update launcher asset

**DELETE `/v2/admin/assets/:clientId`** - Delete launcher asset

#### Java Asset Management

**POST `/v1/admin/assets/java`** - Create Java asset configuration
```json
{
  "source": "custom",
  "java_data": "{\"java\": [{\"version\": \"17.0.2\", \"url\": \"https://example.com/java-17.zip\"}]}"
}
```

**GET `/v1/admin/assets/java`** - Get Java asset configuration

**PUT `/v1/admin/assets/java`** - Update Java asset configuration

#### News Management

**POST `/v1/admin/news`** - Create a news article
```json
{
  "title": "New Update Available",
  "description": "We've released a new update with exciting features!",
  "image": "https://example.com/image.jpg"
}
```

**GET `/v1/admin/news`** - List all news articles

**GET `/v1/admin/news/:id`** - Get specific news article

**PUT `/v1/admin/news/:id`** - Update news article

**DELETE `/v1/admin/news/:id`** - Delete news article

### Setup Endpoints

**GET `/v1/setup/status`** - Check if initial setup is required

**POST `/v1/setup/initialize`** - Initialize the system with default configuration

## Web Admin Interface

The API includes a web-based admin interface accessible at `http://localhost:3000/`:

- **Login Page**: `/login` - Authenticate with your API key
- **Dashboard**: `/` - Main admin dashboard (requires authentication)
- **Asset Management**: Manage launcher and Java assets through the web UI
- **API Key Management**: View and manage API keys

## Database Schema

The application uses SQLite with the following tables:

- **api_keys**: Stores API keys for authentication
- **launcher_assets**: Stores launcher configurations per client
- **java_assets**: Stores Java runtime distribution configurations
- **news**: Stores news articles with title, description, image, and timestamps

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server

### Code Style

The project follows TypeScript best practices with:
- Strict type checking
- Express.js for routing
- SQLite for data persistence
- EJS templating for web UI

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For support and questions, please contact [Codectivity](mailto:hello@codectivity.com) or create an issue in the repository. 
