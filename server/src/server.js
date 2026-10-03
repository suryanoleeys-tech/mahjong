import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : '*';

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function buildRoomPayload(room) {
  return {
    roomCode: room.code,
    status: room.status,
    players: room.players,
    createdAt: room.createdAt
  };
}

function getRoomBySocket(socket) {
  for (const room of rooms.values()) {
    if (room.players.some((player) => player.socketId === socket.id)) {
      return room;
    }
  }
  return null;
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('room:create', ({ playerName }) => {
    const code = generateRoomCode();
    const room = {
      code,
      status: 'waiting',
      players: [{
        socketId: socket.id,
        name: playerName || '玩家',
        isHost: true
      }],
      createdAt: Date.now()
    };

    rooms.set(code, room);
    socket.join(code);
    socket.emit('room:state', buildRoomPayload(room));
  });

  socket.on('room:join', ({ playerName, roomCode }) => {
    const room = rooms.get(roomCode?.toUpperCase());
    if (!room) {
      socket.emit('room:error', { message: '房间不存在' });
      return;
    }

    if (room.players.length >= 4) {
      socket.emit('room:error', { message: '房间已满' });
      return;
    }

    room.players.push({
      socketId: socket.id,
      name: playerName || '玩家',
      isHost: false
    });

    socket.join(room.code);
    io.to(room.code).emit('room:state', buildRoomPayload(room));
  });

  socket.on('game:start', () => {
    const room = getRoomBySocket(socket);
    if (!room) return;

    room.status = 'playing';
    io.to(room.code).emit('room:state', buildRoomPayload(room));
  });

  socket.on('disconnect', () => {
    const room = getRoomBySocket(socket);
    if (!room) return;

    room.players = room.players.filter((player) => player.socketId !== socket.id);

    if (room.players.length === 0) {
      rooms.delete(room.code);
      return;
    }

    if (room.players.length === 1) {
      room.players[0].isHost = true;
    }

    io.to(room.code).emit('room:state', buildRoomPayload(room));
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'server-running' });
});

const PORT = Number(process.env.PORT) || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
