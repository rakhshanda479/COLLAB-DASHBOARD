import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Plus, X, Edit2, Trash2, Clock, User, Activity, Zap, TrendingUp, Users, CheckCircle2, Circle, Loader, GripVertical } from 'lucide-react';

// Available task statuses
const STATUSES = ['Todo', 'In Progress', 'Done'];

/**
 * Main Dashboard Component
 * Handles state management, WebSocket communication, and core functionality
 */
export default function CollaborationDashboard() {
  // State Management
  const [tasks, setTasks] = useState([]);
  const [users] = useState([
    { 
      id: 1, 
      name: 'Alice Chen', 
      avatar: 'AC',
      bgColor: 'bg-gradient-to-br from-blue-400 to-cyan-400',
      initials: 'AC'
    },
    { 
      id: 2, 
      name: 'Bob Smith', 
      avatar: 'BS',
      bgColor: 'bg-gradient-to-br from-blue-500 to-indigo-400',
      initials: 'BS'
    },
    { 
      id: 3, 
      name: 'Carol Davis', 
      avatar: 'CD',
      bgColor: 'bg-gradient-to-br from-cyan-400 to-blue-400',
      initials: 'CD'
    },
    { 
      id: 4, 
      name: 'David Lee', 
      avatar: 'DL',
      bgColor: 'bg-gradient-to-br from-indigo-400 to-blue-500',
      initials: 'DL'
    }
  ]);
  const [activityLog, setActivityLog] = useState([]);
  const [showNewTask, setShowNewTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0 });
  const [draggedTask, setDraggedTask] = useState(null);
  
  // Refs for persistent data
  const socketRef = useRef(null);
  const taskIdCounter = useRef(1);

  /**
   * Initialize WebSocket connection and load data on component mount
   */
  useEffect(() => {
    // Initialize real Socket.io connection
    socketRef.current = io('http://localhost:5000');
    
    // WebSocket event listeners for real-time updates
    socketRef.current.on('task:created', (task) => {
      setTasks(prev => [...prev, task]);
      addActivity('created', task);
    });
    
    socketRef.current.on('task:updated', (updatedTask) => {
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      addActivity('updated', updatedTask);
    });
    
    socketRef.current.on('task:deleted', (taskId) => {
      setTasks(prev => {
        const task = prev.find(t => t.id === taskId);
        if (task) addActivity('deleted', task);
        return prev.filter(t => t.id !== taskId);
      });
    });
    
    socketRef.current.on('task:moved', (data) => {
      setTasks(prev => prev.map(t => 
        t.id === data.taskId ? { ...t, status: data.newStatus } : t
      ));
      addActivity('moved', { id: data.taskId, title: data.taskTitle, status: data.newStatus });
    });

    // Load existing data from localStorage
    loadFromStorage();
    
    // Load initial tasks from backend API
    loadTasksFromAPI();
    
    // Cleanup WebSocket on unmount
    return () => socketRef.current?.disconnect();
  }, []);

  /**
   * Load tasks from backend API
   */
  const loadTasksFromAPI = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/tasks');
      const tasksFromAPI = await response.json();
      if (tasksFromAPI && tasksFromAPI.length > 0) {
        setTasks(tasksFromAPI);
        // Update taskIdCounter to avoid ID conflicts
        const maxId = Math.max(...tasksFromAPI.map(task => task.id), 0);
        taskIdCounter.current = maxId + 1;
      }
    } catch (error) {
      console.log('Could not load tasks from API, using localStorage:', error);
    }
  };

  /**
   * Save tasks to localStorage and update stats when tasks change
   */
  useEffect(() => {
    if (tasks.length > 0) {
      saveToStorage();
    }
    updateStats();
  }, [tasks]);

  /**
   * Calculate and update dashboard statistics
   */
  const updateStats = () => {
    setStats({
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'Done').length,
      inProgress: tasks.filter(t => t.status === 'In Progress').length
    });
  };

  /**
   * Load tasks and activity log from browser localStorage
   */
  const loadFromStorage = async () => {
    try {
      const saved = localStorage.getItem('collab-tasks-v2');
      if (saved) {
        const data = JSON.parse(saved);
        setTasks(data.tasks || []);
        setActivityLog(data.activityLog || []);
        taskIdCounter.current = data.nextId || 1;
      }
    } catch (error) {
      console.log('Starting fresh - no saved data found');
    }
  };

  /**
   * Save current state to browser localStorage
   */
  const saveToStorage = async () => {
    try {
      localStorage.setItem('collab-tasks-v2', JSON.stringify({
        tasks,
        activityLog,
        nextId: taskIdCounter.current
      }));
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  /**
   * Add activity to the activity log
   */
  const addActivity = (action, task) => {
    const activity = {
      id: Date.now(),
      action,
      task: task.title,
      taskId: task.id,
      status: task.status,
      timestamp: new Date().toISOString(),
      user: users[Math.floor(Math.random() * users.length)].name
    };
    setActivityLog(prev => [activity, ...prev].slice(0, 50));
  };

  /**
   * Create a new task and emit WebSocket event
   */
  const createTask = (status, title, description, assignedTo, priority) => {
    const newTask = {
      id: taskIdCounter.current++,
      title,
      description,
      status,
      assignedTo,
      priority: priority || 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    socketRef.current.emit('task:created', newTask);
    setShowNewTask(null);
  };

  /**
   * Update an existing task
   */
  const updateTask = (taskId, updates) => {
    const task = tasks.find(t => t.id === taskId);
    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    socketRef.current.emit('task:updated', updatedTask);
    setEditingTask(null);
  };

  /**
   * Delete a task by ID
   */
  const deleteTask = (taskId) => {
    socketRef.current.emit('task:deleted', taskId);
  };

  /**
   * Move a task to a different status column
   */
  const moveTask = (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      socketRef.current.emit('task:moved', { 
        taskId, 
        taskTitle: task.title,
        newStatus 
      });
    }
  };

  // ========== DRAG AND DROP HANDLERS ==========

  /**
   * Handle drag start event
   */
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id.toString());
    
    // Add visual feedback safely
    if (e.currentTarget) {
      e.currentTarget.classList.add('opacity-50', 'rotate-2', 'scale-105');
    }
  };

  /**
   * Handle drag end event and clean up visual styles
   */
  const handleDragEnd = (e) => {
    // Remove visual feedback safely
    try {
      const taskCards = document.querySelectorAll('.task-card');
      const columns = document.querySelectorAll('.column');
      
      taskCards.forEach(card => {
        card?.classList?.remove('opacity-50', 'rotate-2', 'scale-105', 'border-2', 'border-blue-400');
      });
      
      columns.forEach(column => {
        column?.classList?.remove('border-2', 'border-blue-400', 'bg-blue-500/20');
      });
    } catch (error) {
      console.log('Error cleaning up drag styles:', error);
    }
    
    setDraggedTask(null);
  };

  /**
   * Handle drag over event for column highlighting
   */
  const handleDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Visual feedback for column safely
    try {
      const columns = document.querySelectorAll('.column');
      columns.forEach(column => {
        column?.classList?.remove('border-2', 'border-blue-400', 'bg-blue-500/20');
      });
      
      if (e.currentTarget) {
        e.currentTarget.classList.add('border-2', 'border-blue-400', 'bg-blue-500/20');
      }
    } catch (error) {
      console.log('Error applying drag over styles:', error);
    }
  };

  /**
   * Handle drag leave event
   */
  const handleDragLeave = (e) => {
    // Remove visual feedback when leaving column safely
    try {
      if (!e.currentTarget.contains(e.relatedTarget) && e.currentTarget) {
        e.currentTarget.classList.remove('border-2', 'border-blue-400', 'bg-blue-500/20');
      }
    } catch (error) {
      console.log('Error cleaning up drag leave styles:', error);
    }
  };

  /**
   * Handle drop event to move tasks between columns
   */
  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    
    // Remove visual feedback safely
    try {
      const columns = document.querySelectorAll('.column');
      columns.forEach(column => {
        column?.classList?.remove('border-2', 'border-blue-400', 'bg-blue-500/20');
      });
    } catch (error) {
      console.log('Error cleaning up drop styles:', error);
    }
    
    // Move task if dropped in different column
    if (draggedTask && draggedTask.status !== newStatus) {
      moveTask(draggedTask.id, newStatus);
    }
    
    setDraggedTask(null);
  };

  // ========== UTILITY FUNCTIONS ==========

  /**
   * Get tasks filtered by status
   */
  const getTasksByStatus = (status) => {
    return tasks.filter(t => t.status === status);
  };

  /**
   * Get user object by user ID
   */
  const getAssignedUser = (userId) => {
    return users.find(u => u.id === userId);
  };

  // Calculate completion rate for stats
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header Section with Stats and Team Info */}
      <header className="bg-slate-800/80 backdrop-blur-xl border-b border-blue-500/30 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Logo and Title */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-lg">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">TaskFlow Pro</h1>
                <p className="text-blue-300 text-sm">Real-time collaboration workspace</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="flex gap-3">
              <div className="bg-slate-700/60 backdrop-blur-lg rounded-xl px-4 py-3 border border-blue-400/30 min-w-[100px]">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-blue-300" />
                  <span className="text-xs text-blue-200 font-medium">Total Tasks</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              
              <div className="bg-slate-700/60 backdrop-blur-lg rounded-xl px-4 py-3 border border-green-400/30 min-w-[100px]">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-300" />
                  <span className="text-xs text-green-200 font-medium">Completed</span>
                </div>
                <p className="text-2xl font-bold text-white">{completionRate}%</p>
              </div>

              {/* Activity Log Toggle Button */}
              <button
                onClick={() => setShowActivityLog(!showActivityLog)}
                className="bg-slate-700/60 hover:bg-slate-600/60 backdrop-blur-lg rounded-xl px-4 py-3 border border-blue-400/30 transition-all duration-300 flex items-center gap-2 group"
              >
                <Activity className="w-5 h-5 text-blue-300 group-hover:scale-110 transition-transform" />
                <span className="text-white font-medium">Activity</span>
                {activityLog.length > 0 && (
                  <span className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                    {activityLog.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Team Members Display */}
          <div className="mt-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-300" />
            <div className="flex gap-2">
              {users.map(user => (
                <div
                  key={user.id}
                  className={`w-10 h-10 ${user.bgColor} rounded-full border-2 border-slate-700 flex items-center justify-center text-white font-semibold text-sm shadow-lg hover:scale-110 transition-transform cursor-pointer`}
                  title={user.name}
                >
                  {user.initials}
                </div>
              ))}
            </div>
            <span className="text-blue-300 text-sm font-medium">{users.length} team members online</span>
          </div>
        </div>
      </header>

      {/* Main Content Area with Task Columns */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={getTasksByStatus(status)}
              onAddTask={() => setShowNewTask(status)}
              onEditTask={setEditingTask}
              onDeleteTask={deleteTask}
              onMoveTask={moveTask}
              getAssignedUser={getAssignedUser}
              showNewTask={showNewTask === status}
              onCancelNew={() => setShowNewTask(null)}
              onCreateTask={createTask}
              users={users}
              editingTask={editingTask}
              onUpdateTask={updateTask}
              onCancelEdit={() => setEditingTask(null)}
              // Drag and Drop props
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      </main>

      {/* Activity Log Sidebar */}
      {showActivityLog && (
        <ActivityLogSidebar
          activityLog={activityLog}
          onClose={() => setShowActivityLog(false)}
          users={users}
        />
      )}
    </div>
  );
}

/**
 * Column Component - Represents each status column (Todo, In Progress, Done)
 */
function Column({ 
  status, 
  tasks, 
  onAddTask, 
  onEditTask, 
  onDeleteTask, 
  onMoveTask,
  getAssignedUser,
  showNewTask,
  onCancelNew,
  onCreateTask,
  users,
  editingTask,
  onUpdateTask,
  onCancelEdit,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd
}) {
  // Column styling configuration
  const colors = {
    'Todo': 'bg-slate-800/60 border-blue-400/30',
    'In Progress': 'bg-slate-800/60 border-cyan-400/30', 
    'Done': 'bg-slate-800/60 border-green-400/30'
  };

  const iconColors = {
    'Todo': 'text-blue-400',
    'In Progress': 'text-cyan-400',
    'Done': 'text-green-400'
  };

  // Status-specific icons
  const Icon = status === 'Todo' ? Circle : status === 'In Progress' ? Loader : CheckCircle2;

  return (
    <div 
      className={`column backdrop-blur-lg bg-slate-800/40 rounded-2xl p-5 transition-all duration-500 hover:scale-[1.02] shadow-2xl border-2 min-h-[500px] ${colors[status]}`}
      onDragOver={(e) => onDragOver(e, status)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, status)}
    >
      {/* Column Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <Icon className={`w-6 h-6 ${iconColors[status]}`} />
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            {status}
            <span className="bg-slate-700/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold text-white">
              {tasks.length}
            </span>
          </h2>
        </div>
        {/* Add Task Button */}
        <button
          onClick={onAddTask}
          className="p-2 bg-slate-700/60 hover:bg-slate-600/60 rounded-xl transition-all duration-300 group hover:scale-110"
          title="Add task"
        >
          <Plus className="w-5 h-5 text-blue-400 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Task List Area */}
      <div 
        className="space-y-4 min-h-[400px]"
        onDragOver={(e) => onDragOver(e, status)}
        onDrop={(e) => onDrop(e, status)}
      >
        {/* New Task Form */}
        {showNewTask && (
          <TaskForm
            status={status}
            onSubmit={onCreateTask}
            onCancel={onCancelNew}
            users={users}
          />
        )}

        {/* Task Cards */}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
            onMove={onMoveTask}
            getAssignedUser={getAssignedUser}
            isEditing={editingTask?.id === task.id}
            onUpdate={onUpdateTask}
            onCancelEdit={onCancelEdit}
            users={users}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}

        {/* Empty State */}
        {tasks.length === 0 && !showNewTask && (
          <div 
            className="text-center py-16 border-2 border-dashed border-slate-600/50 rounded-xl transition-all duration-300 hover:border-blue-400/50 hover:bg-slate-700/30"
            onDragOver={(e) => onDragOver(e, status)}
            onDrop={(e) => onDrop(e, status)}
          >
            <div className="w-20 h-20 bg-slate-700/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon className="w-10 h-10 text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">No tasks yet</p>
            <p className="text-slate-500 text-xs mt-1">Click + to add one or drag tasks here</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * TaskCard Component - Individual task item with drag & drop support
 */
function TaskCard({ 
  task, 
  onEdit, 
  onDelete, 
  onMove, 
  getAssignedUser,
  isEditing,
  onUpdate,
  onCancelEdit,
  users,
  onDragStart,
  onDragEnd
}) {
  const assignedUser = getAssignedUser(task.assignedTo);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  // Priority-based styling
  const priorityColors = {
    high: 'border-l-4 border-l-red-500 bg-red-500/10',
    medium: 'border-l-4 border-l-yellow-500 bg-yellow-500/10',
    low: 'border-l-4 border-l-green-500 bg-green-500/10'
  };

  // Render TaskForm if in edit mode
  if (isEditing) {
    return (
      <TaskForm
        status={task.status}
        initialData={task}
        onSubmit={(status, title, description, assignedTo, priority) => {
          onUpdate(task.id, { title, description, assignedTo, priority });
        }}
        onCancel={onCancelEdit}
        users={users}
      />
    );
  }

  return (
    <div 
      className={`task-card backdrop-blur-lg bg-slate-700/40 rounded-xl p-4 shadow-xl hover:shadow-2xl transition-all duration-300 border border-slate-600/50 group hover:scale-[1.02] ${priorityColors[task.priority] || ''} cursor-grab active:cursor-grabbing`}
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
    >
      {/* Task Header with Title and Actions */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-start gap-2 flex-1">
          <GripVertical className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0 cursor-grab" />
          <h3 className="font-semibold text-white flex-1 text-lg group-hover:text-blue-300 transition-colors">
            {task.title}
          </h3>
        </div>
        {/* Action Buttons (Edit/Delete) */}
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(task)}
            className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-all duration-300 hover:scale-110"
          >
            <Edit2 className="w-4 h-4 text-blue-300" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-all duration-300 hover:scale-110"
          >
            <Trash2 className="w-4 h-4 text-red-300" />
          </button>
        </div>
      </div>

      {/* Task Description */}
      {task.description && (
        <p className="text-slate-300 text-sm mb-4 leading-relaxed ml-6">{task.description}</p>
      )}

      {/* Task Footer with Assignee and Actions */}
      <div className="flex justify-between items-center ml-6">
        {/* Assigned User */}
        {assignedUser ? (
          <div className="flex items-center gap-2 bg-slate-600/50 rounded-lg px-3 py-2 border border-slate-500/50">
            <div className={`w-8 h-8 ${assignedUser.bgColor} rounded-full flex items-center justify-center text-white font-medium text-xs`}>
              {assignedUser.initials}
            </div>
            <span className="text-sm text-slate-200 font-medium">{assignedUser.name.split(' ')[0]}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-slate-600/30 rounded-lg px-3 py-2">
            <User className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">Unassigned</span>
          </div>
        )}

        {/* Move Task Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMoveMenu(!showMoveMenu)}
            className="text-sm px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-all duration-300 text-blue-300 font-medium hover:scale-105"
          >
            Move →
          </button>
          
          {showMoveMenu && (
            <div className="absolute right-0 mt-2 backdrop-blur-xl bg-slate-800/95 border border-slate-600 rounded-xl shadow-2xl z-20 min-w-40 overflow-hidden">
              {STATUSES.filter(s => s !== task.status).map(status => (
                <button
                  key={status}
                  onClick={() => {
                    onMove(task.id, status);
                    setShowMoveMenu(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-sm text-white hover:bg-slate-700/50 transition-all duration-300"
                >
                  {status}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Task Metadata */}
      <div className="mt-3 pt-3 border-t border-slate-600/50 flex items-center justify-between ml-6">
        <div className="flex items-center gap-2 text-xs text-blue-300">
          <Clock className="w-3 h-3" />
          {new Date(task.createdAt).toLocaleDateString()}
        </div>
        {/* Priority Badge */}
        {task.priority && (
          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
            task.priority === 'high' ? 'bg-red-500/20 text-red-300' :
            task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
            'bg-green-500/20 text-green-300'
          }`}>
            {task.priority}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * TaskForm Component - Form for creating/editing tasks
 */
function TaskForm({ status, initialData, onSubmit, onCancel, users }) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [assignedTo, setAssignedTo] = useState(initialData?.assignedTo || '');
  const [priority, setPriority] = useState(initialData?.priority || 'medium');

  /**
   * Handle form submission
   */
  const handleSubmit = () => {
    if (title.trim()) {
      onSubmit(status, title, description, assignedTo, priority);
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setPriority('medium');
    }
  };

  /**
   * Handle Enter key press for quick submission
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="backdrop-blur-xl bg-slate-800/60 rounded-xl p-5 shadow-2xl border-2 border-blue-400/50 animate-fadeIn">
      {/* Task Title Input */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Task title..."
        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-400 transition-all duration-300"
        autoFocus
      />
      
      {/* Task Description Textarea */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add description..."
        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-400 resize-none transition-all duration-300"
        rows="2"
      />
      
      {/* Assignment and Priority Selection */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(Number(e.target.value))}
          className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-white transition-all duration-300"
        >
          <option value="" className="bg-slate-800">Unassigned</option>
          {users.map(user => (
            <option key={user.id} value={user.id} className="bg-slate-800">
              {user.initials} {user.name}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-white transition-all duration-300"
        >
          <option value="low" className="bg-slate-800">🟢 Low</option>
          <option value="medium" className="bg-slate-800">🟡 Medium</option>
          <option value="high" className="bg-slate-800">🔴 High</option>
        </select>
      </div>

      {/* Form Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white py-3 rounded-xl transition-all duration-300 font-bold hover:scale-105 shadow-lg"
        >
          {initialData ? '✓ Update' : '+ Add Task'}
        </button>
        <button
          onClick={onCancel}
          className="px-5 bg-slate-700/60 hover:bg-slate-600/60 rounded-xl transition-all duration-300 hover:scale-105"
        >
          <X className="w-5 h-5 text-slate-300" />
        </button>
      </div>
    </div>
  );
}

/**
 * ActivityLogSidebar Component - Displays recent activity history
 */
function ActivityLogSidebar({ activityLog, onClose, users }) {
  /**
   * Get color gradient based on activity type
   */
  const getActionColor = (action) => {
    switch (action) {
      case 'created': return 'from-green-500 to-emerald-500';
      case 'updated': return 'from-blue-500 to-cyan-500';
      case 'deleted': return 'from-red-500 to-pink-500';
      case 'moved': return 'from-indigo-500 to-purple-500';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  /**
   * Get human-readable action text
   */
  const getActionText = (activity) => {
    switch (activity.action) {
      case 'created': return 'created task';
      case 'updated': return 'updated task';
      case 'deleted': return 'deleted task';
      case 'moved': return `moved task to ${activity.status}`;
      default: return activity.action;
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 backdrop-blur-2xl bg-slate-900/95 shadow-2xl z-50 flex flex-col border-l border-slate-700">
      {/* Sidebar Header */}
      <div className="flex justify-between items-center p-6 border-b border-slate-700">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
            <Activity className="w-6 h-6 text-white" />
          </div>
          Activity Log
        </h2>
        <button
          onClick={onClose}
          className="p-2 bg-slate-700/60 hover:bg-slate-600/60 rounded-xl transition-all duration-300 hover:rotate-90"
        >
          <X className="w-5 h-5 text-slate-300" />
        </button>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {activityLog.length === 0 ? (
          // Empty State
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-10 h-10 text-slate-600" />
            </div>
            <p className="text-slate-400">No activity yet</p>
            <p className="text-slate-500 text-xs mt-1">Actions will appear here</p>
          </div>
        ) : (
          // Activity Items
          activityLog.map((activity) => (
            <div 
              key={activity.id} 
              className="flex gap-3 pb-4 border-b border-slate-700 last:border-0 hover:bg-slate-800/50 p-3 rounded-xl transition-all duration-300"
            >
              <div className={`w-10 h-10 bg-gradient-to-br ${getActionColor(activity.action)} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">
                  <span className="font-bold text-blue-300">{activity.user}</span>
                  {' '}<span className="text-slate-300">{getActionText(activity)}</span>
                </p>
                <p className="text-sm font-semibold text-slate-200 truncate mt-1">
                  "{activity.task}"
                </p>
                <p className="text-xs text-blue-400 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(activity.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}