/**
 * CHESS.COM AI EXTENSION
 * An intelligent chess AI that can play games on chess.com
 * 
 * This extension integrates Stockfish with the chess.com interface
 * to automatically play chess games.
 */

/* CONTENT SCRIPT
 * This script runs in the context of chess.com pages
 * It has direct access to the DOM and can interact with the chess board
 */

(function() {
  'use strict';

  // Extension state
  const state = {
    isActive: false,
    enabled: false,
    playerColor: null,
    aiColor: null,
    isAITurn: false,
    gameInProgress: false,
    stockfishDepth: 15,
    lastBoardHash: null,
    failedMoveAttempts: 0
  };

  // Chess AI Engine (Browser-optimized)
  class ChessAIBrowser {
    constructor() {
      this.files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    }

    async loadSettings() {
      try {
        const settings = await this.safeChromeCall((keys) => {
          return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
        }, ['stockfishDepth', 'stockfishTime']);
        
        if (settings) {
          state.stockfishDepth = parseInt(settings.stockfishDepth) || 15;
          state.stockfishTime = parseInt(settings.stockfishTime) || 2000;
        }
      } catch (e) {
        console.warn('Chess AI: Using default settings due to storage error', e);
      }
    }

    // Get current board state from chess.com
    getBoardState() {
      const board = {};
      
      // Method 1: Modern/Beta Chess.com structure (pieces have square classes)
      const pieces = document.querySelectorAll('.piece');
      if (pieces.length > 0) {
        pieces.forEach(p => {
          const classList = Array.from(p.classList);
          const squareClass = classList.find(c => /^square-\d+$/.test(c));
          const typeClass = classList.find(c => /^[wb][pnbrqk]$/.test(c));
          
          if (squareClass && typeClass) {
            const x = parseInt(squareClass[7]);
            const y = parseInt(squareClass[8]);
            const squareId = this.coordToSquare(x - 1, y);
            const color = typeClass[0] === 'w' ? 'w' : 'b';
            const type = typeClass[1];
            board[squareId] = color === 'w' ? type.toUpperCase() : type;
          }
        });
      }

      // Method 2: Classic Chess.com structure (data-square attribute)
      if (Object.keys(board).length === 0) {
        const squares = document.querySelectorAll('[data-square]');
        squares.forEach(square => {
          const squareId = square.getAttribute('data-square');
          const pieceEl = square.querySelector('[data-piece]');
          const piece = pieceEl ? this.normalizePiece(pieceEl.getAttribute('data-piece')) : null;
          if (/^[a-h][1-8]$/.test(squareId) && piece) {
            board[squareId] = piece;
          }
        });
      }
      
      return board;
    }

    normalizePiece(rawPiece) {
      if (!rawPiece) return null;

      const value = String(rawPiece).trim();
      const lower = value.toLowerCase();
      const shortCode = lower.match(/(?:^|\s)([wb])([pnbrqk])(?:\s|$)/);
      if (shortCode) {
        return shortCode[1] === 'w' ? shortCode[2].toUpperCase() : shortCode[2];
      }

      const color = lower.includes('white') || lower.includes('piece-w') || lower[0] === 'w'
        ? 'w'
        : lower.includes('black') || lower.includes('piece-b') || lower[0] === 'b'
          ? 'b'
          : null;

      let type = null;
      if (lower.includes('pawn')) type = 'p';
      else if (lower.includes('knight')) type = 'n';
      else if (lower.includes('bishop')) type = 'b';
      else if (lower.includes('rook')) type = 'r';
      else if (lower.includes('queen')) type = 'q';
      else if (lower.includes('king')) type = 'k';
      else {
        const compact = lower.replace(/[^a-z]/g, '');
        type = compact.split('').find(char => 'pnbrqk'.includes(char));
      }

      if (!color || !type) return null;
      return color === 'w' ? type.toUpperCase() : type;
    }

    squareToCoord(square) {
      return {
        fileIndex: this.files.indexOf(square[0]),
        rank: Number(square[1])
      };
    }

    coordToSquare(fileIndex, rank) {
      return `${this.files[fileIndex]}${rank}`;
    }

    // Click a square (obsolete for moves, but used for UI interactions)
    async clickSquare(squareId) {
      return this.executeMove(squareId + "  "); // Placeholder for single click logic if needed
    }

    // Execute a move using drag-and-drop simulation
    async executeMove(move) {
      const from = typeof move === 'string' ? move.substring(0, 2) : move.from;
      const to = typeof move === 'string' ? move.substring(2, 4) : move.to;
      const promotion = typeof move === 'string' ? (move.length > 4 ? move[4] : null) : move.promotion;

      console.log(`Chess AI: Executing move ${from}-${to} via drag simulation`);
      
      const board = getBoardElement();
      if (!board) return false;

      const rect = board.getBoundingClientRect();
      const orientation = board.getAttribute('orientation') || (board.classList.contains('flipped') ? 'black' : 'white');
      
      const getCoords = (square) => {
        const { fileIndex, rank } = this.squareToCoord(square);
        const size = Math.min(rect.width, rect.height) / 8;
        const xIndex = orientation === 'black' ? 7 - fileIndex : fileIndex;
        const yIndex = orientation === 'black' ? rank - 1 : 8 - rank;
        return {
          x: rect.left + (xIndex + 0.5) * size,
          y: rect.top + (yIndex + 0.5) * size
        };
      };

      const fromCoords = getCoords(from);
      const toCoords = getCoords(to);

      // Start drag
      await this.dispatchPointerEvent('pointerdown', board, fromCoords);
      await this.delay(50);
      
      // Move to target (simulation of drag)
      await this.dispatchPointerEvent('pointermove', board, toCoords);
      await this.delay(50);
      
      // Release
      await this.dispatchPointerEvent('pointerup', board, toCoords);
      await this.delay(50);
      
      // Final click to ensure it registers
      await this.dispatchPointerEvent('click', board, toCoords);

      if (promotion) {
        await this.delay(400); // Wait for promotion menu
        await this.clickPromotionPiece(promotion);
      }
      
      return true;
    }

    async dispatchPointerEvent(type, element, coords) {
      const eventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: coords.x,
        clientY: coords.y,
        pointerId: 1,
        isPrimary: true,
        button: 0,
        buttons: type === 'pointerup' || type === 'click' ? 0 : 1
      };

      const event = type.startsWith('pointer') ? new PointerEvent(type, eventInit) : new MouseEvent(type, eventInit);
      element.dispatchEvent(event);
    }


    async clickPromotionPiece(piece) {
      // Chess.com promotion pieces often have classes like .promotion-piece.wq
      const side = getSideToMove() || 'white';
      const colorChar = side === 'white' ? 'w' : 'b';
      const selector = `.promotion-piece.${colorChar}${piece.toLowerCase()}, .promotion-menu .${piece.toLowerCase()}, [data-type="${piece.toLowerCase()}"]`;
      
      console.log(`Chess AI: Attempting to click promotion piece: ${piece} with selector: ${selector}`);
      
      let element = document.querySelector(selector);
      
      if (!element) {
        // Fallback
        const pieces = document.querySelectorAll('.promotion-piece, .promotion-menu > *');
        for (const p of pieces) {
          if (p.className.includes(piece.toLowerCase()) || p.getAttribute('data-type') === piece.toLowerCase()) {
            element = p;
            break;
          }
        }
      }

      if (element) {
        await this.dispatchClickEvents(element);
        return true;
      }
      
      console.warn(`Chess AI: Could not find promotion piece element for ${piece}`);
      return false;
    }

    // Make AI move
    async makeMove() {
      if (aiMoveInProgress) {
        return {
          success: false,
          error: 'Move already in progress'
        };
      }
      aiMoveInProgress = true;

      try {
        await this.loadSettings();
        
        const boardState = this.getBoardState();
        const boardHash = JSON.stringify(boardState);
        
        // Prevent infinite loop if move execution is stuck
        if (boardHash === state.lastBoardHash) {
          state.failedMoveAttempts = (state.failedMoveAttempts || 0) + 1;
          if (state.failedMoveAttempts > 5) {
            console.error('Chess AI: Stuck in move loop. Disabling AI.');
            state.enabled = false;
            showNotification('AI Stuck! Try moving manually once.');
            return { success: false, error: 'Stuck in loop' };
          }
          await this.delay(1000); // Wait longer if stuck
        } else {
          state.failedMoveAttempts = 0;
          state.lastBoardHash = boardHash;
        }

        console.time('ChessAI-BoardState');
        const sideToMove = getSideToMove() || inferSideToMove(boardState);
        console.timeEnd('ChessAI-BoardState');

        console.time('ChessAI-FEN');
        const fen = this.getFEN(boardState, sideToMove);
        console.timeEnd('ChessAI-FEN');
        
        if (!fen) {
          return {
            success: false,
            error: 'Could not read board FEN'
          };
        }

        console.log(`Chess AI: Requesting move from Stockfish (Depth: ${state.stockfishDepth}, Max Time: ${state.stockfishTime}ms)...`);
        console.time('ChessAI-Stockfish');
        let moveUCI = await this.getBestMoveFromStockfish(fen, state.stockfishDepth, state.stockfishTime);
        console.timeEnd('ChessAI-Stockfish');

        const validation = this.validateMove(fen, moveUCI);
        if (!validation.valid) {
          if (moveUCI) {
            console.warn(`Chess AI: Stockfish move ${moveUCI} was illegal.`);
          }
          return {
            success: false,
            error: 'Stockfish returned no legal move'
          };
        }

        if (moveUCI) {
          const moveStr = typeof moveUCI === 'string' ? moveUCI : `${moveUCI.from}${moveUCI.to}${moveUCI.promotion || ''}`;
          console.log(`Chess AI: Executing move ${moveStr} from Stockfish`);
          await this.executeMove(moveUCI);
          
          // Brief wait for board to update
          await this.delay(500);
          
          showNotification(`Stockfish moved: ${moveStr}`);
          return {
            success: true,
            move: moveStr
          };
        }

        return {
          success: false,
          error: 'Stockfish returned no move'
        };
      } catch (error) {
        console.error('AI move error:', error);
        if (String(error.message || error).includes('Extension context invalidated')) {
          state.enabled = false;
        }
        return {
          success: false,
          error: error.message
        };
      } finally {
        aiMoveInProgress = false;
      }
    }

    async getBestMoveFromStockfish(fen, depth = 15, time = 2000) {
      return new Promise(async (resolve, reject) => {
        if (!this.stockfish) {
          try {
            this.stockfish = await this.createStockfishWorker();
            this.stockfish.postMessage('uci');
          } catch (e) {
            reject(e);
            return;
          }
        }

        const timeout = setTimeout(() => {
          this.stockfish.postMessage('stop');
          reject(new Error('Stockfish timeout'));
        }, Math.max(time + 2000, 10000)); // Dynamic timeout
        
        const onMessage = (e) => {
          const msg = e.data;
          if (msg.startsWith('bestmove')) {
            clearTimeout(timeout);
            this.stockfish.removeEventListener('message', onMessage);
            const move = msg.split(' ')[1];
            resolve(move && move !== '(none)' ? move : null);
          }
        };

        this.stockfish.addEventListener('message', onMessage);
        this.stockfish.postMessage(`position fen ${fen}`);
        this.stockfish.postMessage(`go depth ${depth} movetime ${time}`);
      });
    }

    async createStockfishWorker() {
      const workerUrl = getExtensionResourceUrl('lib/stockfish.js');
      const wasmUrl = getExtensionResourceUrl('lib/stockfish.wasm');
      const response = await fetch(workerUrl);
      const scriptContent = await response.text();

      // Inject configuration to help Emscripten find the WASM file
      const config = `
        var Module = {
          locateFile: function(path) {
            if (path.endsWith('.wasm')) {
              return '${wasmUrl}';
            }
            return path;
          }
        };
      `;

      const blob = new Blob([config, scriptContent], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const worker = new Worker(blobUrl);
      
      // We don't revoke immediately because the worker might need it to load additional scripts
      // But for Stockfish, it's usually just one file.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      
      return worker;
    }

    // Generate a perfect FEN by replaying the move list
    getFEN(boardState, turn) {
      if (typeof Chess === 'undefined') return '';
      
      const chess = new Chess();
      const moveTexts = getMoveTexts();
      let success = true;

      // Try to replay the game from the move list for perfect state
      if (moveTexts.length > 0) {
        let lastSuccessfulMoveIndex = -1;
        for (let i = 0; i < moveTexts.length; i++) {
          try {
            chess.move(moveTexts[i]);
            lastSuccessfulMoveIndex = i;
          } catch (e) {
            console.warn(`Chess AI: Malformed move at index ${i}: ${moveTexts[i]}. Skipping.`);
            // If it's a minor malformation like 'xd5', we still want to try the rest 
            // but usually a failure means the rest will fail too.
            success = false;
          }
        }
        
        if (success) {
          return chess.fen();
        }
      }

      // Fallback: Scraping (less accurate for castling/en passant)
      if (!success || moveTexts.length === 0) {
        const fallbackChess = new Chess();
        fallbackChess.clear();
        for (const square in boardState) {
          const piece = boardState[square];
          const color = piece === piece.toUpperCase() ? 'w' : 'b';
          const type = piece.toLowerCase();
          fallbackChess.put({ type, color }, square);
        }
        
        const fen = fallbackChess.fen();
        const parts = fen.split(' ');
        parts[1] = turn === 'white' ? 'w' : 'b';
        
        // Add basic castling rights based on piece positions if not replayed
        let castling = '';
        if (boardState['e1'] === 'K') {
          if (boardState['h1'] === 'R') castling += 'K';
          if (boardState['a1'] === 'R') castling += 'Q';
        }
        if (boardState['e8'] === 'k') {
          if (boardState['h8'] === 'r') castling += 'k';
          if (boardState['a8'] === 'r') castling += 'q';
        }
        parts[2] = castling || '-';
        return parts.join(' ');
      }
      
      return chess.fen();
    }

    validateMove(fen, moveUCI) {
      if (!moveUCI || typeof Chess === 'undefined') return { valid: false };
      try {
        const chess = new Chess(fen);
        // UCI is usually from-to, e.g., "e2e4"
        const moveStr = typeof moveUCI === 'string' ? moveUCI : `${moveUCI.from}${moveUCI.to}`;
        const from = moveStr.substring(0, 2);
        const to = moveStr.substring(2, 4);
        const promotion = moveStr.length > 4 ? moveStr[4] : 'q';
        
        const move = chess.move({ from, to, promotion });
        if (move) {
          return { valid: true, move: { from, to, piece: move.piece, promotion } };
        }
      } catch (e) {
        console.error('Validation error:', e);
      }
      return { valid: false };
    }

    handleInvalidContext() {
      console.warn('Chess AI: Extension context invalidated. Stopping AI activities.');
      state.enabled = false;
      state.isActive = false;
      aiMoveInProgress = false;
      
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      
      if (queuedAIMoveTimer) {
        clearTimeout(queuedAIMoveTimer);
        queuedAIMoveTimer = null;
      }

      showNotification('Extension updated. Please refresh Chess.com');
    }

    // Helper for safe chrome storage/runtime access
    async safeChromeCall(fn, ...args) {
      if (!isExtensionContextValid()) {
        this.handleInvalidContext();
        return null;
      }
      try {
        return await fn(...args);
      } catch (error) {
        if (error.message.includes('Extension context invalidated')) {
          this.handleInvalidContext();
        }
        throw error;
      }
    }

    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  // Initialize AI
  let ai = new ChessAIBrowser();
  let aiMoveInProgress = false;
  let queuedAIMoveTimer = null;

  function isExtensionContextValid() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch (error) {
      return false;
    }
  }

  function getExtensionResourceUrl(path) {
    if (!isExtensionContextValid()) {
      state.enabled = false;
      throw new Error('Extension context invalidated. Reload chess.com tab.');
    }

    return chrome.runtime.getURL(path);
  }

  function getMoveTexts() {
    // Chess.com move list structure can be complex.
    // Try to find all move containers and extract their text.
    const selectors = [
      '.node-highlight-content', 
      '.move-node', 
      '.move-san-component', 
      '.move-text-component',
      '.kw-move-node'
    ];
    
    let moveNodes = [];
    selectors.forEach(sel => {
      const nodes = document.querySelectorAll(sel);
      if (nodes.length > moveNodes.length) {
        moveNodes = Array.from(nodes);
      }
    });

    return moveNodes
      .map(el => {
        // Handle cases where SAN is split into spans (e.g. icon + text)
        // We want the text content but stripped of extra whitespace
        let text = el.textContent.trim();
        // Remove move numbers if they were accidentally included (e.g. "1. e4")
        text = text.replace(/^\d+\.\s*/, '');
        return text;
      })
      .filter(text => {
        return text && 
               !/^\d+\.$/.test(text) && // Skip "1.", "2.", etc.
               !/^[a-h][1-8]$/.test(text) && // Skip raw square names if they are separate nodes
               text.length <= 10; // SAN moves are short
      });
  }


  function scheduleAIMove() {
    if (!isExtensionContextValid()) {
      state.enabled = false;
      return;
    }

    if (queuedAIMoveTimer || aiMoveInProgress) return;

    queuedAIMoveTimer = setTimeout(() => {
      queuedAIMoveTimer = null;
      if (isExtensionContextValid()) {
        makeAIMove();
      }
    }, 50);
  }

  function getBoardElement() {
    return document.querySelector('.board, wc-chess-board, chess-board');
  }

  function getPlayerColor(board = getBoardElement()) {
    if (!board) return 'white';

    // Check orientation attribute (Common in wc-chess-board)
    const orientation = board.getAttribute('orientation');
    if (orientation) return orientation.toLowerCase();

    const className = String(board.className || '').toLowerCase();
    if (
      className.includes('flipped') ||
      className.includes('black-bottom') ||
      className.includes('orientation-black')
    ) {
      return 'black';
    }

    return 'white';
  }

  function getSideToMove() {
    // 1. Check for active clocks (Most reliable during game)
    const whiteClock = document.querySelector('.clock-white.active, .clock-player-white.active, [data-testid="white-clock"].active');
    const blackClock = document.querySelector('.clock-black.active, .clock-player-black.active, [data-testid="black-clock"].active');
    
    if (whiteClock) return 'white';
    if (blackClock) return 'black';

    // 2. Check move list parity
    // Every move adds a .node-highlight-content or .move-node element
    const moves = document.querySelectorAll('.node-highlight-content, .move-node, .move-text-component');
    if (moves.length > 0) {
      // Find the last move node that has content
      let moveCount = 0;
      moves.forEach(m => {
        if (m.textContent.trim() && !/^\d+\.$/.test(m.textContent.trim())) {
          moveCount++;
        }
      });
      return moveCount % 2 === 0 ? 'white' : 'black';
    }

    // 3. Initial position check (Start of game)
    const highlights = document.querySelectorAll('.highlight');
    if (highlights.length === 0) {
      return 'white';
    }

    // 4. Body classes fallback
    const className = document.body.className.toLowerCase();
    if (className.includes('black-to-play') || className.includes('black-to-move')) return 'black';
    if (className.includes('white-to-play') || className.includes('white-to-move')) return 'white';

    return null;
  }

  function inferSideToMove(board) {
    if (!board || Object.keys(board).length !== 32) {
      return null;
    }

    const startingPieces = {
      a1: 'R', b1: 'N', c1: 'B', d1: 'Q', e1: 'K', f1: 'B', g1: 'N', h1: 'R',
      a2: 'P', b2: 'P', c2: 'P', d2: 'P', e2: 'P', f2: 'P', g2: 'P', h2: 'P',
      a7: 'p', b7: 'p', c7: 'p', d7: 'p', e7: 'p', f7: 'p', g7: 'p', h7: 'p',
      a8: 'r', b8: 'n', c8: 'b', d8: 'q', e8: 'k', f8: 'b', g8: 'n', h8: 'r'
    };

    return Object.entries(startingPieces).every(([square, piece]) => board[square] === piece)
      ? 'white'
      : null;
  }

  // Update game state
  function updateGameState() {
    if (!isExtensionContextValid()) {
      state.enabled = false;
      state.isAITurn = false;
      return;
    }

    const board = getBoardElement();
    if (!board) {
      state.gameInProgress = false;
      return;
    }
    
    state.gameInProgress = true;
    
    state.playerColor = getPlayerColor(board);
    state.aiColor = state.playerColor;

    const boardState = ai.getBoardState();
    const sideToMove = getSideToMove() || inferSideToMove(boardState);
    const fen = ai.getFEN(boardState, sideToMove);
    
    // If chess.com does not expose the turn in classes, keep auto-play idle.
    // Manual "Make AI Move" still works.
    state.isAITurn = sideToMove ? sideToMove === state.aiColor : false;
    
    // Auto-make move if AI is enabled and it's AI's turn
    if (state.enabled && state.isAITurn && !aiMoveInProgress) {
      scheduleAIMove();
    }
  }

  // Make AI move
  async function makeAIMove({ force = false } = {}) {
    if (aiMoveInProgress) {
      return {
        success: false,
        error: 'Move already in progress'
      };
    }


    if (!state.enabled && !force) {
      return {
        success: false,
        error: 'AI not enabled'
      };
    }
    
    try {
      // Just call the engine method, which handles its own locking and notifications
      const result = await ai.makeMove();
      return result || { success: true };
      } catch (error) {
        console.error('AI move error:', error);
        if (String(error.message || error).includes('Extension context invalidated')) {
          state.enabled = false;
        }
        return {
          success: false,
          error: error.message
      };
    } finally {
      // makeMove handles its own aiMoveInProgress, but we ensure it's cleared if exception happens
      // (Wait, ai.makeMove already has a finally block, so this is safe)
    }
  }

  // Show notification
  function showNotification(message) {
    // Remove existing notifications
    document.querySelectorAll('.chess-ai-notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = 'chess-ai-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 9999;
      font-family: Arial, sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
        style.parentNode.removeChild(style);
      }
    }, 3000);
  }

  // Enable/disable AI
  function setEnabled(enabled) {
    state.enabled = enabled;
    
    if (enabled) {
      showNotification('Chess AI Enabled 🤖');
      updateGameState();
    } else {
      showNotification('Chess AI Disabled');
    }
  }

  // Message handler
  async function handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'MAKE_AI_MOVE':
        const result = await makeAIMove({ force: true });
        sendResponse(result);
        break;
        
      case 'TOGGLE_AI':
        setEnabled(message.enabled);
        sendResponse({ success: true });
        break;

      case 'INIT_STATE':
        state.enabled = Boolean(message.enabled);
        updateGameState();
        sendResponse({ success: true });
        break;
        
      case 'GET_GAME_STATE':
        updateGameState();
        const boardState = ai.getBoardState();
        const sideToMove = getSideToMove() || inferSideToMove(boardState);
        sendResponse({
          enabled: state.enabled,
          gameState: (state.isAITurn ? 'AI Turn' : sideToMove ? 'Player Turn' : 'Ready'),
          playerColor: state.playerColor,
          sideToMove,
          pieceCount: Object.keys(boardState).length,
          engine: 'Stockfish',
          depth: state.stockfishDepth
        });
        break;
    }
  }

  // Fallback: Check game state every 2 seconds in case MutationObserver misses something
  setInterval(() => {
    if (state.enabled && !aiMoveInProgress && isExtensionContextValid()) {
      // Re-check for board if not already observing it
      const currentBoard = getBoardElement();
      if (currentBoard && !boardEl) {
        setupObserver(currentBoard);
      }
      updateGameState();
    }
  }, 2000);

  function setupObserver(target) {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      if (state.enabled) {
        updateGameState();
      }
    });
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
    console.log('Chess AI: Board observer attached to', target);
  }

  let observer = null;
  const boardEl = getBoardElement();
  if (boardEl) {
    setupObserver(boardEl);
  } else {
    setupObserver(document.body);
  }

  // Load initial state from storage
  if (isExtensionContextValid()) {
    chrome.storage.sync.get(['aiEnabled'], (result) => {
      if (chrome.runtime.lastError) {
        console.debug('Chess AI: could not load initial state:', chrome.runtime.lastError.message);
        return;
      }

      if (result.aiEnabled !== undefined) {
        state.enabled = result.aiEnabled;
      }
      updateGameState();
    });
  }


  // Listen for messages
  if (isExtensionContextValid()) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      handleMessage(message, sender, sendResponse).catch(error => {
        console.error('Chess AI message error:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });

      return true;
    });
  }

  console.log('Chess.com AI Extension loaded successfully');
  console.log('Features:');
  console.log('- Stockfish engine at depth 25 by default');
  console.log('- Automatic and manual move modes');
  console.log('- Real-time game state monitoring');
})();
