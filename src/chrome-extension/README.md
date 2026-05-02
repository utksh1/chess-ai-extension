# Chess.com AI Extension

## Installation

1. Open Chrome → chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `src/chrome-extension` folder
5. Navigate to chess.com to use

## Files

- **manifest.json** - Extension configuration (Chrome MV3)
- **background.js** - Background service worker
- **content.js** - Main integration with chess.com
- **popup.html** - Extension popup UI
- **popup.js** - Popup logic and controls
- **styles.css** - Styling for UI elements

## Features

- Stockfish.js WASM engine from lichess-org/stockfish.js
- Fixed search depth 25
- Auto-play mode
- Manual move mode
- Real-time board monitoring

## Usage

1. Start a game on chess.com
2. Click extension icon
3. Enable AI toggle
4. AI plays automatically!
