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

app.get('/count', (req, res) => {
	const count = io.engine.clientsCount;
	res.status(200)
	res.send({count})
})

io.on('connection', (socket) => {
	console.log('User connected:', socket.id)

	// handle WebRTC signaling events
	// Handle the creation of a new session
	socket.on('createSession', () => {
		const sessionId = generateSessionId();
		socket.join(sessionId);
		activeSessions.set(sessionId, { users: [socket.id], connections: new Map() })

		// Send the session ID back to the client
		socket.emit('sessionCreated', { sessionId });
	});

	// Handle joining an existing session
	socket.on('joinSession', ({ sessionId }) => {
		// Code to handle user joining a room
		socket.join(sessionId)
		activeSessions.set(sessionId, { users: [socket.id], connections: new Map() })
		socket.emit('userJoined', activeSessions[sessionId])

		// Notify all users in the session about the new participant
		// io.to(sessionId).emit('userJoined', { sessionId, userId: socket.id });
		// if (activeSessions.has(sessionId)) {
		// 	socket.join(sessionId);
		// 	activeSessions.get(sessionId).push(socket.id);

		// } else {
		// 	// Handle invalid session ID
		// 	socket.emit('invalidSession');
		// }
	});

	// Handle messages within a session
  socket.on('message', ({ sessionId, message }) => {
    // Broadcast the message to all users in the session
    io.to(sessionId).emit('message', { userId: socket.id, message });
  });

	socket.on('offer', (data) => {
    // Broadcast the offer to other clients in the same room
		socket.to(data.room).emit('offer', { offer: data.offer, sender: socket.id });
  });

  socket.on('answer', (data) => {
    // Broadcast the answer to other clients in the same room
		socket.to(data.room).emit('answer', { answer: data.answer, sender: socket.id });
  });

  socket.on('ice-candidate', (data) => {
    // Broadcast the ICE candidate to other clients in the same room
		socket.to(data.room).emit('ice-candidate', { candidate: data.candidate, sender: socket.id });
  });

	// Handle disconnecting
  socket.on('disconnect', () => {
    console.log('User disconnected');

    // Remove the user from the active session
    // activeSessions.forEach((userList, sessionId) => {
    //   const index = userList.indexOf(socket.id);
    //   if (index !== -1) {
    //     userList.splice(index, 1);
    //     io.to(sessionId).emit('userLeft', { sessionId, userId: socket.id });

    //     // If no users left in the session, delete it
    //     if (userList.length === 0) {
    //       activeSessions.delete(sessionId);
    //     }
    //   }
    // });
		activeSessions.forEach((roomData, room) => {
      const { users, connections } = roomData;
      const userIndex = users.indexOf(socket.id);

      if (userIndex !== -1) {
        users.splice(userIndex, 1);

        // Close connections associated with the disconnected user
        const userConnections = connections.get(socket.id);
        if (userConnections) {
          userConnections.forEach((connection, otherUser) => {
            io.to(otherUser).emit('userLeft', socket.id);
            connection.close();
          });
        }

        // If no users left in the room, delete the room
        if (users.length === 0) {
          activeSessions.delete(room);
        } else {
          socket.to(room).emit('userLeft', socket.id);
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