const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Fix CORS configuration
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/collab-dashboard', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.log('❌ MongoDB error:', err));

// Simple Task Model
const taskSchema = new mongoose.Schema({
  id: Number,
  title: String,
  description: String,
  status: {
    type: String,
    default: 'Todo'
  },
  assignedTo: Number,
  priority: {
    type: String,
    default: 'medium'
  },
  createdAt: String,
  updatedAt: String
});

const Task = mongoose.model('Task', taskSchema);

// Get all tasks API
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find();
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Socket.io Events
io.on('connection', (socket) => {
  console.log('🔗 User connected:', socket.id);

  socket.on('task:created', async (taskData) => {
    try {
      console.log('Creating task:', taskData);
      const task = new Task(taskData);
      await task.save();
      io.emit('task:created', task);
    } catch (error) {
      console.error('Error creating task:', error);
    }
  });

  socket.on('task:updated', async (taskData) => {
    try {
      console.log('Updating task:', taskData);
      const task = await Task.findOneAndUpdate(
        { id: taskData.id },
        taskData,
        { new: true }
      );
      io.emit('task:updated', task);
    } catch (error) {
      console.error('Error updating task:', error);
    }
  });

  socket.on('task:deleted', async (taskId) => {
    try {
      console.log('Deleting task:', taskId);
      await Task.findOneAndDelete({ id: taskId });
      io.emit('task:deleted', taskId);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  });

  socket.on('task:moved', async (data) => {
    try {
      console.log('Moving task:', data);
      const task = await Task.findOneAndUpdate(
        { id: data.taskId },
        { status: data.newStatus, updatedAt: new Date().toISOString() },
        { new: true }
      );
      io.emit('task:moved', data);
    } catch (error) {
      console.error('Error moving task:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📡 WebSocket ready for connections`);
});