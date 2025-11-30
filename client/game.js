
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const scoresEl = document.getElementById('scores');

const WS_URL = 'ws://localhost:8080';
let ws;
let myId = null;

// Game State
let players = {};
let coins = [];
let mapSize = { width: 800, height: 600 };

// Interpolation Buffer
const SERVER_TICK_RATE = 20; // 20 Hz
const RENDER_DELAY = 100; // Delay rendering by 100ms to allow for smooth interpolation
let stateBuffer = [];

// Input
const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    w: false, s: false, a: false, d: false
};

function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        statusEl.textContent = 'Connected';
        statusEl.style.color = '#2ecc71';
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === 'init') {
            myId = msg.selfId;
            players = msg.players;
            coins = msg.coins;
            mapSize = msg.map;
        } else if (msg.type === 'player_join') {
            players[msg.player.id] = msg.player;
        } else if (msg.type === 'player_leave') {
            delete players[msg.id];
        } else if (msg.type === 'coin_spawn') {
            coins.push(msg.coin);
        } else if (msg.type === 'score_update') {
            if (players[msg.playerId]) {
                players[msg.playerId].score = msg.score;
            }
            coins = coins.filter(c => c.id !== msg.coinId);
        } else if (msg.type === 'state_update') {
            // Add state to buffer for interpolation
            stateBuffer.push({
                timestamp: msg.timestamp,
                players: msg.players
            });

            // Keep buffer small
            if (stateBuffer.length > 20) {
                stateBuffer.shift();
            }
        }
    };

    ws.onclose = () => {
        statusEl.textContent = 'Disconnected';
        statusEl.style.color = '#e74c3c';
    };
}

function updateInput() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const input = {
        up: keys.ArrowUp || keys.w,
        down: keys.ArrowDown || keys.s,
        left: keys.ArrowLeft || keys.a,
        right: keys.ArrowRight || keys.d
    };

    if (input.up || input.down || input.left || input.right) {
        ws.send(JSON.stringify({ type: 'move', input }));
    }
}

// Interpolation Logic
function getInterpolatedState() {
    const now = Date.now();
    const renderTime = now - RENDER_DELAY;

    // Find two states surrounding the render time
    let t1 = null, t2 = null;

    for (let i = stateBuffer.length - 1; i >= 0; i--) {
        if (stateBuffer[i].timestamp <= renderTime) {
            t1 = stateBuffer[i];
            t2 = stateBuffer[i + 1];
            break;
        }
    }

    // If we don't have enough history, just return the latest (or nothing)
    if (!t1) return null;
    if (!t2) {
        // We are at the very end of the buffer (or ahead of it), just use t1
        return t1.players;
    }

    // Interpolate
    const total = t2.timestamp - t1.timestamp;
    const fraction = (renderTime - t1.timestamp) / total;

    const interpolatedPlayers = {};

    // We need to interpolate all players present in both states
    for (const id in t1.players) {
        if (t2.players[id]) {
            const p1 = t1.players[id];
            const p2 = t2.players[id];

            interpolatedPlayers[id] = {
                ...p1, // Copy props like color, score
                x: p1.x + (p2.x - p1.x) * fraction,
                y: p1.y + (p2.y - p1.y) * fraction
            };
        }
    }

    return interpolatedPlayers;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get interpolated positions
    const renderPlayers = getInterpolatedState() || players;

    // Draw Coins
    ctx.fillStyle = '#f1c40f';
    coins.forEach(coin => {
        ctx.beginPath();
        ctx.arc(coin.x + 5, coin.y + 5, 5, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw Players
    for (const id in renderPlayers) {
        const p = renderPlayers[id];
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 20, 20);

        // Draw ID/Score above player
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.fillText(`P${id.substr(0, 4)}: ${p.score}`, p.x - 5, p.y - 5);
    }

    // Update Scoreboard
    let scoreText = '';
    for (const id in players) {
        scoreText += `P${id.substr(0, 4)}: ${players[id].score}  `;
    }
    scoresEl.textContent = scoreText;

    requestAnimationFrame(draw);
}

// Input Listeners
window.addEventListener('keydown', e => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
});
window.addEventListener('keyup', e => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

// Start
connect();
setInterval(updateInput, 50); // Send input at 20Hz
draw();
