document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const highscoreEl = document.getElementById('highscore');
    const livesEl = document.getElementById('lives');
    const startMenu = document.getElementById('start-menu');
    const gameOverMenu = document.getElementById('game-over-menu');
    const finalScoreEl = document.getElementById('final-score');
    const finalHighscoreEl = document.getElementById('final-highscore');
    const gameOverTitleEl = document.getElementById('game-over-title');

    // --- Game Configuration ---
    const TILE_SIZE = 20;
    canvas.width = TILE_SIZE * 20;
    canvas.height = TILE_SIZE * 20;
    const V = 4; // Base Speed Unit
    const PLAYER_SPEED = 0.8 * V;
    let ghostSpeed;

    // --- Maze Layout ---
    const initialMap = [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1],
        [1,3,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,3,1],
        [1,0,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,1,0,1],
        [1,0,0,0,0,1,0,0,0,1,1,0,0,0,1,0,0,0,0,1],
        [1,1,1,1,0,1,1,1,2,1,1,2,1,1,1,0,1,1,1,1],
        [1,1,1,1,0,1,2,9,9,9,9,9,9,2,1,0,1,1,1,1],
        [1,1,1,1,0,1,2,9,1,1,1,1,9,2,1,0,1,1,1,1],
        [0,0,0,0,0,2,2,9,1,2,2,1,9,2,2,0,0,0,0,0],
        [1,1,1,1,0,1,2,9,1,1,1,1,9,2,1,0,1,1,1,1],
        [1,1,1,1,0,1,2,9,9,9,9,9,9,2,1,0,1,1,1,1],
        [1,1,1,1,0,1,2,1,1,1,1,1,1,2,1,0,1,1,1,1],
        [1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1],
        [1,3,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,3,1],
        [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
        [1,1,0,1,0,1,0,1,1,1,1,1,1,0,1,0,1,0,1,1],
        [1,0,0,0,0,1,0,0,0,1,1,0,0,0,1,0,0,0,0,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ];
    let map;

    // --- Game State ---
    let gameState = 'menu'; // menu, playing, paused, gameOver
    let score, lives, highScore;
    let player, ghost;
    let boundaries, dots, powerPellets;
    let bufferedKey = '';
    let animationFrameId;

    // --- High Score Management ---
    const loadHighScore = () => {
        const storedHighScore = localStorage.getItem('pixelMuncherHighScore') || '0';
        highScore = parseInt(storedHighScore, 10);
        highscoreEl.textContent = highScore;
    };

    const saveHighScore = () => {
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('pixelMuncherHighScore', highScore);
            highscoreEl.textContent = highScore;
        }
    };

    // --- Classes ---
    class Boundary {
        constructor({ position }) {
            this.position = position;
            this.width = TILE_SIZE;
            this.height = TILE_SIZE;
        }
        draw() {
            ctx.fillStyle = '#3498db'; // Wall color
            ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
        }
    }

    class Character {
        constructor({ position, velocity, color }) {
            this.position = position;
            this.velocity = velocity;
            this.radius = TILE_SIZE / 2.5;
            this.color = color;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.closePath();
        }

        update() {
            this.draw();
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;
        }
    }

    class Player extends Character {
        constructor(options) {
            super(options);
            this.speed = PLAYER_SPEED;
        }
    }

    // ⭐ GHOST AI: Corrected Implementation ⭐
    class Ghost extends Character {
        constructor(options) {
            super(options);
            this.speed = options.speed;
            this.currentDirection = {x: 0, y: -1}; // Start by moving up
        }

        update() {
            // Only make a new decision when perfectly centered on a tile
            if (this.isAtGridCenter()) {
                this.aiMove();
            }
            // Always check for wall collisions to stop movement
            this.checkForWallCollision();
            super.update(); // Applies the velocity
        }

        // Helper to check if the ghost is at the center of a grid tile
        isAtGridCenter() {
            const centerOffset = TILE_SIZE / 2;
            return (
                (this.position.x - centerOffset) % TILE_SIZE === 0 &&
                (this.position.y - centerOffset) % TILE_SIZE === 0
            );
        }
        
        // Stops the ghost if it hits a wall
        checkForWallCollision() {
            for (const boundary of boundaries) {
                if (circleCollidesWithRectangle({ circle: this, rectangle: boundary })) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    // Nudge back to center to prevent getting stuck
                    this.position.x = Math.round((this.position.x - TILE_SIZE / 2) / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
                    this.position.y = Math.round((this.position.y - TILE_SIZE / 2) / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
                    break;
                }
            }
        }
        
        // The core AI logic to decide the next move at an intersection
        aiMove() {
            const gridX = Math.round((this.position.x - TILE_SIZE / 2) / TILE_SIZE);
            const gridY = Math.round((this.position.y - TILE_SIZE / 2) / TILE_SIZE);
            
            const possibleMoves = [];
            const directions = [
                { x: 0, y: -1, name: 'up' },    // Up
                { x: 1, y: 0, name: 'right' },  // Right
                { x: 0, y: 1, name: 'down' },   // Down
                { x: -1, y: 0, name: 'left' }   // Left
            ];

            // Check each direction to see if it's a valid path (not a wall)
            directions.forEach(dir => {
                const nextGridX = gridX + dir.x;
                const nextGridY = gridY + dir.y;
                if (map[nextGridY] && map[nextGridY][nextGridX] !== 1 && map[nextGridY][nextGridX] !== 9) {
                    possibleMoves.push(dir);
                }
            });

            // Prevent the ghost from reversing direction unless it's a dead end
            const oppositeDirection = { x: -this.currentDirection.x, y: -this.currentDirection.y };
            let validMoves = possibleMoves;
            if (possibleMoves.length > 1) {
                validMoves = possibleMoves.filter(move => move.x !== oppositeDirection.x || move.y !== oppositeDirection.y);
            }
            
            // Choose the best move from the valid options
            let bestMove = validMoves[0];
            let minDistance = Infinity;

            validMoves.forEach(move => {
                const futureX = this.position.x + move.x * TILE_SIZE;
                const futureY = this.position.y + move.y * TILE_SIZE;
                const distance = Math.hypot(player.position.x - futureX, player.position.y - futureY);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMove = move;
                }
            });

            // Set the new velocity and update the current direction
            this.currentDirection = bestMove;
            this.velocity.x = this.currentDirection.x * this.speed;
            this.velocity.y = this.currentDirection.y * this.speed;
        }
    }

    class Pellet {
        constructor({ position, color, radius }) {
            this.position = position;
            this.radius = radius;
            this.color = color;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.closePath();
        }
    }


    // --- Game Setup Functions ---
    const createMap = () => {
        map = initialMap.map(row => [...row]); // Create a mutable copy
        boundaries = [];
        dots = [];
        powerPellets = [];
        map.forEach((row, i) => {
            row.forEach((symbol, j) => {
                const position = {
                    x: TILE_SIZE * j + TILE_SIZE / 2,
                    y: TILE_SIZE * i + TILE_SIZE / 2
                };
                switch (symbol) {
                    case 1: // Wall
                        boundaries.push(new Boundary({ position: { x: TILE_SIZE * j, y: TILE_SIZE * i } }));
                        break;
                    case 9: // Ghost House Wall (impassable)
                        boundaries.push(new Boundary({ position: { x: TILE_SIZE * j, y: TILE_SIZE * i } }));
                        break;
                    case 0: // Dot
                        dots.push(new Pellet({ position, color: '#ecf0f1', radius: 3 }));
                        break;
                    case 3: // Power Pellet
                        powerPellets.push(new Pellet({ position, color: '#f1c40f', radius: 8 }));
                        break;
                }
            });
        });
    };
    
    const initGame = (difficulty) => {
        gameState = 'playing';
        startMenu.classList.add('hidden');
        
        if (difficulty === 'easy') {
            ghostSpeed = 0.75 * V * 0.75;
        } else {
            ghostSpeed = 0.75 * V * 1.25;
        }

        score = 0;
        lives = 3;
        bufferedKey = '';
        updateUI();
        createMap();

        player = new Player({
            position: { x: TILE_SIZE * 1.5, y: TILE_SIZE * 1.5 },
            velocity: { x: 0, y: 0 },
            color: '#f1c40f'
        });

        ghost = new Ghost({
            position: { x: TILE_SIZE * 10.5, y: TILE_SIZE * 9.5 },
            velocity: { x: 0, y: 0 },
            color: '#e74c3c',
            speed: ghostSpeed
        });
        
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animate();
    };
    
    const resetPlayerAndGhost = () => {
        player.position = { x: TILE_SIZE * 1.5, y: TILE_SIZE * 1.5 };
        player.velocity = { x: 0, y: 0 };
        ghost.position = { x: TILE_SIZE * 10.5, y: TILE_SIZE * 9.5 };
        ghost.velocity = { x: 0, y: 0 };
        bufferedKey = '';
    };

    // --- Collision Detection ---
    const circleCollidesWithRectangle = ({ circle, rectangle }) => {
        const padding = TILE_SIZE / 2 - circle.radius - 1;
        return (
            circle.position.y - circle.radius + circle.velocity.y <= rectangle.position.y + rectangle.height + padding &&
            circle.position.x + circle.radius + circle.velocity.x >= rectangle.position.x - padding &&
            circle.position.y + circle.radius + circle.velocity.y >= rectangle.position.y - padding &&
            circle.position.x - circle.radius + circle.velocity.x <= rectangle.position.x + rectangle.width + padding
        );
    };

    // --- UI Update ---
    const updateUI = () => {
        scoreEl.textContent = score;
        livesEl.textContent = '♥ '.repeat(lives).trim();
    };

    // --- Game Loop ---
    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        if (gameState !== 'playing') return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- Handle Player Buffered Input ---
        if (bufferedKey) {
             const newVelocity = getVelocityForKey(bufferedKey);
             let collisionDetected = false;
             for (const boundary of boundaries) {
                 if (circleCollidesWithRectangle({ circle: { ...player, velocity: newVelocity }, rectangle: boundary })) {
                     collisionDetected = true;
                     break;
                 }
             }
             if (!collisionDetected) {
                 player.velocity = newVelocity;
             }
        }
        
        // --- Player Wall Collision ---
        for (const boundary of boundaries) {
            if (circleCollidesWithRectangle({ circle: player, rectangle: boundary })) {
                player.velocity.x = 0;
                player.velocity.y = 0;
                break;
            }
        }

        // --- Draw Everything ---
        boundaries.forEach(boundary => boundary.draw());
        
        for (let i = dots.length - 1; i >= 0; i--) {
            const dot = dots[i];
            dot.draw();
            if (Math.hypot(dot.position.x - player.position.x, dot.position.y - player.position.y) < dot.radius + player.radius) {
                dots.splice(i, 1);
                score += 10;
                updateUI();
            }
        }

        for (let i = powerPellets.length - 1; i >= 0; i--) {
            const pellet = powerPellets[i];
            pellet.draw();
            if (Math.hypot(pellet.position.x - player.position.x, pellet.position.y - player.position.y) < pellet.radius + player.radius) {
                powerPellets.splice(i, 1);
                score += 50;
                updateUI();
            }
        }

        // --- Update Characters ---
        player.update();
        ghost.update();
        
        // --- Ghost-Player Collision ---
        if (Math.hypot(ghost.position.x - player.position.x, ghost.position.y - player.position.y) < ghost.radius + player.radius) {
            lives--;
            updateUI();
            if (lives <= 0) {
                endGame(false); // Game Over
            } else {
                gameState = 'paused';
                setTimeout(() => {
                    resetPlayerAndGhost();
                    gameState = 'playing';
                }, 1500); // Pause for 1.5 seconds
            }
        }

        // --- Win Condition ---
        if (dots.length === 0 && powerPellets.length === 0) {
            endGame(true); // You Win!
        }
    };
    
    const endGame = (isWin) => {
        gameState = 'gameOver';
        cancelAnimationFrame(animationFrameId);
        saveHighScore();
        
        gameOverTitleEl.textContent = isWin ? "YOU WIN!" : "GAME OVER";
        finalScoreEl.textContent = score;
        finalHighscoreEl.textContent = highScore;
        gameOverMenu.classList.remove('hidden');
    };

    // --- Controls ---
    const getVelocityForKey = (key) => {
        switch (key) {
            case 'w': case 'ArrowUp': return { x: 0, y: -PLAYER_SPEED };
            case 'a': case 'ArrowLeft': return { x: -PLAYER_SPEED, y: 0 };
            case 's': case 'ArrowDown': return { x: 0, y: PLAYER_SPEED };
            case 'd': case 'ArrowRight': return { x: PLAYER_SPEED, y: 0 };
            default: return { x: 0, y: 0 };
        }
    };

    window.addEventListener('keydown', (e) => {
        if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            bufferedKey = e.key;
        }
    });

    let touchStartX = 0;
    let touchStartY = 0;
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        handleSwipe(touchEndX - touchStartX, touchEndY - touchStartY);
    }, { passive: false });

    function handleSwipe(dx, dy) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) < 30) return;

        if (absDx > absDy) {
            bufferedKey = dx > 0 ? 'd' : 'a';
        } else {
            bufferedKey = dy > 0 ? 's' : 'w';
        }
    }
    
    // --- Event Listeners for Menus ---
    document.getElementById('easy-btn').addEventListener('click', () => initGame('easy'));
    document.getElementById('hard-btn').addEventListener('click', () => initGame('hard'));
    document.getElementById('play-again-btn').addEventListener('click', () => {
        gameOverMenu.classList.add('hidden');
        startMenu.classList.remove('hidden');
        gameState = 'menu';
        loadHighScore();
    });
    
    // --- Initial Load ---
    loadHighScore();
});
