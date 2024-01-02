const express = require("express");
const app = express();
const path = require("path");
const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer(app);
const io = socketIo(server);

// Store the active sessions
const activeSessions = new Map();

app.get("/", (req, res) => {
    res.status(200)
    res.sendFile(path.join(__dirname + '/views/index.html'))
});

io.on('connection', (socket) => {
	console.log('User Connected')

	// handle WebRTC signaling events
	// Handle the creation of a new session
	socket.on('createSession', () => {
		const sessionId = generateSessionId();
		socket.join(sessionId);
		activeSessions.set(sessionId, [socket.id]);

		// Send the session ID back to the client
		socket.emit('sessionCreated', { sessionId });
	});

	// Handle joining an existing session
	socket.on('joinSession', ({ sessionId }) => {
		if (activeSessions.has(sessionId)) {
			socket.join(sessionId);
			activeSessions.get(sessionId).push(socket.id);

			// Notify all users in the session about the new participant
			io.to(sessionId).emit('userJoined', { sessionId, userId: socket.id });
		} else {
			// Handle invalid session ID
			socket.emit('invalidSession');
		}
	});

	// Handle messages within a session
  socket.on('message', ({ sessionId, message }) => {
    // Broadcast the message to all users in the session
    io.to(sessionId).emit('message', { userId: socket.id, message });
  });

	socket.on('offer', (offer) => {
		socket.broadcast.emit('offer', offer)
	})

	socket.on('answer', (answer) => {
		socket.broadcast.emit('answer', answer)
	})

	socket.on('ice-candidate', (candidate) => {
		// console.log(candidate)
		socket.broadcast.emit('ice-candidate', candidate)
	})

	// Handle disconnecting
  socket.on('disconnect', () => {
    console.log('User disconnected');

    // Remove the user from the active session
    activeSessions.forEach((userList, sessionId) => {
      const index = userList.indexOf(socket.id);
      if (index !== -1) {
        userList.splice(index, 1);
        io.to(sessionId).emit('userLeft', { sessionId, userId: socket.id });

        // If no users left in the session, delete it
        if (userList.length === 0) {
          activeSessions.delete(sessionId);
        }
      }
    });
  });
})

function generateSessionId() {
  // Generate a unique session ID (you might want to use a more robust method)
  return Math.random().toString(36).substring(2, 9);
}

const PORT = process.env.PORT || 3030;
server.listen(PORT);