# Quengabot

A lightweight, premium, and fast Discord music bot using modern Discord Message Components V2 and DisTube. It supports playback from YouTube, Spotify, Deezer, SoundCloud, and direct link streaming.

---

## 🎵 Commands Available

The bot supports both Discord Slash Commands (recommended) and Prefix Commands (using prefix `q!`).

| Slash Command | Prefix Command | Description |
|---|---|---|
| `/play <query>` | `q!play <query>` | Play a song or playlist from YouTube, Spotify, Deezer, SoundCloud, or search. |
| `/pause` | `q!pause` | Pause or resume current playback. |
| `/next` | `q!next` | Skip the current song. |
| `/leave` | `q!leave` | Stop playback, clear the queue, and make the bot leave the voice channel. |
| `/queue` | `q!queue` | Display the current music queue with interactive paging. |
| `/nowplaying` | `q!nowplaying` | Show detailed information about the currently playing track. |
| `/remove <index>` | `q!remove <index>` | Remove a specific song from the queue by its index. |
| `/shuffle` | `q!shuffle` / `q!sh` | Shuffle all the songs in the queue. |
| `/repeat` | `q!repeat` | Configure queue repeat mode: `[Disable]`, `[Song]`, or `[Queue]`. |
| `/help` | `q!help` | Display list of commands. |

---

## 🛠️ Development Setup & Installation

Follow these steps to run the bot locally in development:

### 1. Prerequisites
- **Node.js**: Version 18 or higher.
- **npm**: Included with Node.js.

### 2. Installation
Clone this repository, navigate into the directory, and install the dependencies:
```bash
npm install
```

### 3. Configuration
Create a `.env` file in the root directory (you can copy `.env.example` if it exists) and fill in the following variables:
```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_development_server_id (optional, for instant local slash command registration)

# Optional Spotify API credentials for more reliable link resolving
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# Optional cookie file to bypass YouTube rate limits
YTDLP_COOKIES_FILE=path_to_cookies.cookie
```

### 4. Deploy Slash Commands
Before running the bot, register the slash commands on Discord:
```bash
npm run deploy
```

### 5. Run in Development
Start the bot using `tsx` (TypeScript Execute) for hot-reloading:
```bash
npm run dev
```

---

## 🚀 Production Deployment & Execution

For production deployment, additional setup is recommended for stability and performance.

### Required Libraries & Executables

1. **Node.js runtime**: Make sure Node.js (v18+) is installed on the hosting server.
2. **FFmpeg**:
   - The project includes `ffmpeg-static` as a dependency, which automatically provides the binary for most OS architectures.
   - If using a minimal environment (like Alpine Linux or thin Docker images) where `ffmpeg-static` might fail, install FFmpeg on the host system:
     - **Ubuntu/Debian**: `sudo apt install ffmpeg`
     - **CentOS/RHEL**: `sudo dnf install ffmpeg`
     - **Windows**: Install via Chocolatey `choco install ffmpeg` or download binaries and add to system PATH.
3. **C++ Build Tools**:
   - Used to compile `@discordjs/opus` and `libsodium-wrappers` native bindings for high-performance audio processing.
   - **Ubuntu/Debian**: `sudo apt install build-essential python3`
   - **Windows**: Install Build Tools via `npm install --global --production windows-build-tools` or Visual Studio Installer.
4. **yt-dlp**:
   - Included via `@distube/yt-dlp`, which downloads binaries automatically. Ensure the user running the bot has write permissions in the directory to update yt-dlp binaries.

### Production Run Steps

1. **Install dependencies**:
   ```bash
   npm ci --omit=dev
   ```
2. **Deploy global Slash Commands**:
   *(Remove `DISCORD_GUILD_ID` from `.env` to deploy commands globally to all guilds instead of a single guild).*
   ```bash
   npm run deploy
   ```
3. **Build the project**:
   Compile TypeScript source files into JavaScript:
   ```bash
   npm run build
   ```
4. **Run using a Process Manager (PM2 Recommended)**:
   Install PM2 globally and start the bot:
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name "quengabot"
   ```
