import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  sender: {
    type: String,
    enum: ['user', 'ai'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const chatSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Chat name cannot exceed 100 characters']
  },
  messages: [messageSchema],
  metadata: {
    lastMessage: {
      type: String,
      default: ''
    },
    messageCount: {
      type: Number,
      default: 0
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    tags: [String],
    tokensUsed: {
      type: Number,
      default: 0
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  bufferCommands: false
});

// Index for efficient querying
chatSchema.index({ user: 1, updatedAt: -1 });
chatSchema.index({ user: 1, 'metadata.isArchived': 1 });

// Update metadata before saving
chatSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    const lastMsg = this.messages[this.messages.length - 1];
    this.metadata.lastMessage = lastMsg.text.substring(0, 50) + (lastMsg.text.length > 50 ? '...' : '');
    this.metadata.messageCount = this.messages.length;
  }
  this.updatedAt = new Date();
  next();
});

// Static method to find user's chats
chatSchema.statics.findByUser = function(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  return this.find({ user: userId, 'metadata.isArchived': false })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);
};

const Chat = mongoose.model('Chat', chatSchema);
export default Chat;
