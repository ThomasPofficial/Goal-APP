require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const { requireAuth, socketAuth } = require('./middleware/auth');
const contactRoutes = require('./routes/contacts');
const threadRoutes = require('./routes/threads');
const registerHandlers = require('./socket/handlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.use('/api/contacts', requireAuth, contactRoutes);
app.use('/api/threads', requireAuth, threadRoutes);

io.use(socketAuth);
io.on('connection', (socket) => {
  socket.join(socket.user.id);
  registerHandlers(io, socket);
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  connectDB().then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
}

module.exports = { app, server, io };
