# Chess AI Agent

An intelligent chess-playing AI agent built with Node.js. Features a sophisticated Minimax algorithm with alpha-beta pruning, capable of playing chess at multiple difficulty levels.

## 🎯 Features

- 🧠 **Minimax Algorithm with Alpha-Beta Pruning**: Efficient search with intelligent pruning
- 🎮 **Multiple Difficulty Levels**: Easy, Medium, Hard, Expert
- 🔍 **Advanced Position Evaluation**: Material counting, positional tables, mobility, and tactics
- 📊 **Move Ordering**: Improved search efficiency with capture/promotion prioritization
- 🎨 **Interactive CLI**: User-friendly command-line interface
- ♟️ **Chess Rules**: Full implementation using chess.js library

## 🚀 Installation

```bash
# Install dependencies
npm install
```

## 🎮 Usage

### Interactive CLI Mode

Start the chess AI agent:

```bash
node index.js
```

### Available Commands

- `new [difficulty]` - Start a new game (easy/medium/hard/expert)
- `move <san>` - Make a move (e.g., "move e4", "move Nf3")
- `ai` - Let AI play a move
- `board` - Show current board
- `eval` - Evaluate current position
- `history` - Show move history
- `undo` - Undo last move
- `ai-vs-ai` - Watch AI play against itself
- `help` - Show help message
- `quit` - Exit the program

### Quick Start Example

```bash
# Start a new game on medium difficulty
> new medium

# Make your first move
> move e4

# Let AI respond
> ai

# Continue playing...
> move Nf3
> ai
```

## 🏗️ Architecture

### Core Components

#### 1. ChessAI Class (`chess-ai.js`)
- Implements Minimax algorithm with alpha-beta pruning
- Configurable search depth based on difficulty
- Advanced position evaluation with:
  - Material balance
  - Piece-square tables (positional understanding)
  - Mobility bonus
  - Check/attack evaluation
- Move ordering for efficient pruning

#### 2. GameManager Class (`game-manager.js`)
- Manages game state and flow
- Handles player turns (Human vs AI or AI vs AI)
- Move validation and history tracking
- Game result detection

#### 3. CLI Interface (`index.js`)
- Interactive command-line interface
- User-friendly commands
- Real-time board display

## 🤖 AI Difficulty Levels

| Level | Search Depth | Description |
|-------|-------------|-------------|
| Easy | 2 | Quick decisions, basic tactics |
| Medium | 3 | Balanced play, sees ahead 3 moves |
| Hard | 4 | Strong player, deeper calculation |
| Expert | 5 | Very challenging, deep analysis |

## 💡 How It Works

### Minimax Algorithm

The AI uses the Minimax algorithm to search through possible future game states:

1. **Maximizing Player (AI)**: Tries to maximize the position score
2. **Minimizing Player (Opponent)**: Tries to minimize the position score
3. **Recursive Search**: Explores all possible moves to a given depth
4. **Evaluation**: Scores leaf positions based on material and positional factors

### Alpha-Beta Pruning

Optimizes the search by pruning branches that won't affect the final decision:

- **Alpha**: Best value for maximizing player
- **Beta**: Best value for minimizing player
- **Pruning**: When beta <= alpha, stop searching that branch

This reduces the effective branching factor, allowing deeper searches in the same time.

### Position Evaluation

Each position is scored based on:

1. **Material**: Piece values (Pawn=100, Knight=320, Bishop=330, Rook=500, Queen=900, King=20000)
2. **Positional Tables**: Piece-square tables favor central control and development
3. **Mobility**: Bonus for having more legal moves
4. **Tactics**: Penalties for being in check, bonuses for attacks

## 📊 Example Game

```
=== New Game Started ===
White: Human
Black: AI (medium)

  a b c d e f g h
8 r n b q k b n r
7 p p p p p p p p
6 · · · · · · · ·
5 · · · · · · · ·
4 · · · · · · · ·
3 · · · · · · · ·
2 P P P P P P P P
1 R N B Q K B N R

Turn: White
Move: 1

Enter your move (e.g., e4, Nf3) or "quit" to exit:
> move e4

You played: e4

AI (medium - depth 3) is thinking...
AI evaluated 8945 positions in 234ms
AI plays: e5
Position evaluation: 12
```

## 🛠️ Extending the AI

### Adding New Features

1. **Opening Book**: Add common opening moves
2. **Endgame Tablebase**: Perfect endgame play
3. **Time Management**: Control thinking time
4. **Learning**: Adapt based on game history
5. **Quiescence Search**: Deeper search in tactical positions

### Customizing Evaluation

Modify the `evaluatePosition()` method in `chess-ai.js` to add new factors:

```javascript
// Example: Add pawn structure evaluation
if (pieceType === 'p') {
  // Doubled pawns penalty
  // Isolated pawns penalty
  // Passed pawn bonus
}
```

## 📁 File Structure

```
chess-ai/
├── index.js              # Main CLI interface
├── chess-ai.js           # AI engine (Minimax, evaluation)
├── game-manager.js       # Game logic and state management
├── package.json          # Project configuration
└── README.md            # This file
```

## 🎯 Performance

- **Easy**: ~100-500 positions/second
- **Medium**: ~1,000-10,000 positions/second
- **Hard**: ~5,000-50,000 positions/second
- **Expert**: ~20,000-100,000+ positions/second

*Performance varies based on position complexity and hardware*

## 🎓 Learning Resources

- [Chess Programming Wiki](https://www.chessprogramming.org/)
- [Minimax Algorithm](https://en.wikipedia.org/wiki/Minimax)
- [Alpha-Beta Pruning](https://en.wikipedia.org/wiki/Alpha%E2%80%93beta_pruning)
- [chess.js](https://github.com/jhlywa/chess.js)

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Enhanced evaluation functions
- Opening book integration
- Better move ordering
- UCI protocol support
- GUI interface

## 🌟 Acknowledgments

- chess.js for reliable chess move generation
- AlphaZero and Stockfish for inspiration
- Chess programming community for knowledge sharing
