const assert = require('assert');
const { Chess } = require('chess.js');
const { ChessAI } = require('../chess-ai');
const GameManager = require('../game-manager');

const game = new Chess();
const ai = new ChessAI('easy');

const initialEvaluation = ai.evaluatePosition(game);
assert(Number.isFinite(initialEvaluation), 'initial position evaluation should be finite');
assert(
  Math.abs(initialEvaluation) < 100,
  `initial position should be roughly balanced, got ${initialEvaluation}`
);

const bestMove = ai.getBestMove(game);
assert(bestMove, 'AI should find a move from the starting position');
assert(bestMove.move, 'AI result should include a move');
assert(game.moves({ verbose: true }).some(move => move.san === bestMove.move.san), 'AI move should be legal');

game.move('e4');
const blackMove = ai.getBestMove(game);
assert(blackMove, 'AI should find a move for black');
assert(blackMove.move.color === 'b', 'AI should choose a black move when black is to move');

const manager = new GameManager();
manager.startGame({ white: 'Human', black: 'AI' });
assert(manager.makeHumanMove('e4'), 'game manager should accept legal SAN moves');

console.log('Smoke tests passed');
