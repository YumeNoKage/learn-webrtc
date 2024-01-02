const express = require("express");
const app = express();
const path = require("path");
const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer(app);
const io = socketIo(server);


app.get("/", (req, res) => {
    res.status(200)
    res.sendFile(path.join(__dirname + '/views/index.html'))
});

io.on('connection', (socket) => {
    console.log('User Connected')

    // handle WebRTC signaling events
    socket.on('offer', (offer) => {
        socket.broadcast.emit('offer', offer)
    })

    socket.on('answer', (answer) => {
        socket.broadcast.emit('answer', answer)
    })

    socket.on('ice-candidate', (candidate) => {
        socket.broadcast.emit('ice-candidate', candidate)
    })

    socket.on('disconnect', () => {
        console.log('User Disconnected')
    })
})

const PORT = process.env.PORT || 3030;
server.listen(PORT);