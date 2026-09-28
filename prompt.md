Build a polished standalone logic puzzle game called "Tango²".

Theme:
🐶 Dog vs 🐱 Cat

Tagline:
"Two animals. One solution."

CORE RULES:
- Every cell is either Dog or Cat.
- Each row and column must contain exactly 50% Dogs and 50% Cats.
- Never allow 3 identical symbols consecutively horizontally or vertically.
- "=" means adjacent cells must be the same.
- "×" means adjacent cells must be different.
- Every generated puzzle MUST have exactly one solution.

BOARD SIZES:
6×6, 8×8, 10×10, 12×12, 14×14, 16×16, 18×18, 20×20, 22×22, 24×24.

DIFFICULTIES:
Easy, Normal, Hard, Very Hard, Insane, Nightmare.

Build a procedural puzzle generator and efficient solver. Puzzles must be reproducible using a seed and difficulty should be based on actual solving complexity, not only board size.

FEATURES:
- New Game
- Daily Puzzle
- Custom Puzzle
- Seed/Puzzle ID
- Timer
- Undo/Redo
- Restart
- Hint system that explains logical moves
- Optional mistake checking
- Statistics and streaks
- Completion screen
- Share puzzle/result
- Keyboard, mouse, touch support
- Zoom/pan for large boards

DESIGN:
Create an original, modern, clean and playful UI centered around Dog/Cat.
Use consistent custom/vector-style Dog and Cat icons rather than relying only on platform emojis.
Make 16×16 and 24×24 boards comfortable and readable.

TECHNICAL:
First inspect the existing project and follow its framework and architecture.
Keep puzzle engine, solver, generator, difficulty system, game state and UI modular.
Do not break or remove existing functionality.
Avoid unnecessary dependencies.

Add tests for all puzzle rules, solver correctness, unique-solution detection, generation, seed reproducibility and all board sizes.

The final result must feel like a polished real game, not a prototype.