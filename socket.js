const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ['GET', 'POST']
    }
});

io.on("connection", (socket) => {
    console.log(`✅ User connected: ${socket.id}`);

    // Listen for a custom event (like a chat message)
    socket.on("message", (data) => {
        console.log(`📩 Message from ${socket.id}: ${data}`);
        // Broadcast the message to all clients except sender
        socket.broadcast.emit("message", data);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        console.log(`❌ User disconnected: ${socket.id}`);
    });

    // You can add more custom events here (e.g., "typing", "join-room", etc.)
});

server.listen(3000, () => { console.log("listening on port 3000") });