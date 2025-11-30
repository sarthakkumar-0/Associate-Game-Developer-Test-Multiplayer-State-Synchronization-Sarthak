
const WebSocket = require('ws');
const crypto = require('crypto');

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });

// Game State
const PLAYERS = {};
const COINS = [];
const COIN_SPAWN_INTERVAL = 3000; // 3 seconds
const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const PLAYER_SIZE = 20;
const COIN_SIZE = 10;
const PLAYER_SPEED = 5;

// Latency Simulation (200ms)
const LATENCY_MS = 200;

console.log(`Server started on port ${PORT}`);

// Helper to simulate network delay
function sendWithDelay(ws, message) {
    setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }, LATENCY_MS);
}

// Spawn a coin
function spawnCoin() {
    const id = crypto.randomUUID();
    const x = Math.floor(Math.random() * (MAP_WIDTH - COIN_SIZE));
    const y = Math.floor(Math.random() * (MAP_HEIGHT - COIN_SIZE));
    const coin = { id, x, y };
    COINS.push(coin);
    
    // Broadcast new coin to all players
    const msg = { type: 'coin_spawn', coin };
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            sendWithDelay(client, msg);
        }
    });
}

setInterval(spawnCoin, COIN_SPAWN_INTERVAL);

wss.on('connection', (ws) => {
    const playerId = crypto.randomUUID();
    const color = '#' + Math.floor(Math.random()*16777215).toString(16);
    
    // Initialize player
    PLAYERS[playerId] = {
        id: playerId,
        x: Math.random() * (MAP_WIDTH - PLAYER_SIZE),
        y: Math.random() * (MAP_HEIGHT - PLAYER_SIZE),
        score: 0,
        color: color
    };

    console.log(`Player connected: ${playerId}`);

    // Send initial state
    const initMsg = {
        type: 'init',
        selfId: playerId,
        players: PLAYERS,
        coins: COINS,
        map: { width: MAP_WIDTH, height: MAP_HEIGHT }
    };
    sendWithDelay(ws, initMsg);

    // Broadcast new player to others
    const joinMsg = { type: 'player_join', player: PLAYERS[playerId] };
    wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            sendWithDelay(client, joinMsg);
        }
    });

    ws.on('message', (message) => {
        // Simulate receiving delay
        setTimeout(() => {
            try {
                const data = JSON.parse(message);
                
                if (data.type === 'move') {
                    handleMove(playerId, data.input);
                }
            } catch (e) {
                console.error('Invalid message:', e);
            }
        }, LATENCY_MS);
    });

    ws.on('close', () => {
        console.log(`Player disconnected: ${playerId}`);
        delete PLAYERS[playerId];
        
        const leaveMsg = { type: 'player_leave', id: playerId };
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                sendWithDelay(client, leaveMsg);
            }
        });
    });
});

function handleMove(playerId, input) {
    const player = PLAYERS[playerId];
    if (!player) return;

    // Update position based on input (Authoritative)
    if (input.left) player.x -= PLAYER_SPEED;
    if (input.right) player.x += PLAYER_SPEED;
    if (input.up) player.y -= PLAYER_SPEED;
    if (input.down) player.y += PLAYER_SPEED;

    // Clamp to map bounds
    player.x = Math.max(0, Math.min(MAP_WIDTH - PLAYER_SIZE, player.x));
    player.y = Math.max(0, Math.min(MAP_HEIGHT - PLAYER_SIZE, player.y));

    // Check coin collisions
    checkCollisions(player);

    // Broadcast update
    // In a real game, we might send this less frequently (snapshot), 
    // but for this assignment, we send on every move processed to ensure smooth interpolation source data.
    // Actually, sending every tick is better. Let's set up a tick loop.
}

function checkCollisions(player) {
    for (let i = COINS.length - 1; i >= 0; i--) {
        const coin = COINS[i];
        if (
            player.x < coin.x + COIN_SIZE &&
            player.x + PLAYER_SIZE > coin.x &&
            player.y < coin.y + COIN_SIZE &&
            player.y + PLAYER_SIZE > coin.y
        ) {
            // Collision detected
            player.score += 1;
            COINS.splice(i, 1);
            
            const scoreMsg = { type: 'score_update', playerId: player.id, score: player.score, coinId: coin.id };
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    sendWithDelay(client, scoreMsg);
                }
            });
        }
    }
}

// Server Tick Loop (20 Hz)
setInterval(() => {
    const stateMsg = {
        type: 'state_update',
        players: PLAYERS,
        timestamp: Date.now()
    };
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            sendWithDelay(client, stateMsg);
        }
    });
}, 50); // 50ms = 20 ticks per second
