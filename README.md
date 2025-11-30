# Multiplayer Coin Collector

A real-time multiplayer Coin Collector game built with Node.js and HTML5 Canvas, featuring authoritative server state, 200ms latency simulation, and entity interpolation.

## Requirements
- Node.js (v14 or higher)

## How to Run

### 1. Start the Server
Open a terminal in the project root and run:
```bash
cd server
npm install
node index.js
```
The server will start on port `8080`.

### 2. Play the Game
Open `client/index.html` in your web browser.
To simulate multiplayer, open the same file in multiple tabs or windows.

## Features
- **Authoritative Server**: All game logic (movement, collisions, scoring) happens on the server.
- **Latency Simulation**: The server artificially delays all network traffic by 200ms to simulate poor network conditions.
- **Entity Interpolation**: The client buffers server states and interpolates between them to render smooth movement despite the latency.
- **No Engines**: Built with raw WebSockets and HTML5 Canvas.

## Controls
- **Arrow Keys** or **WASD** to move.
