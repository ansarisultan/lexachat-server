import Chat from '../models/Chat.js';
import { AppError } from '../utils/AppError.js';

// Get all user sessions with pagination
export const getSessions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const sessions = await Chat.findByUser(req.user.id, page, limit);
    const total = await Chat.countDocuments({ 
      user: req.user.id, 
      'metadata.isArchived': { $ne: true } 
    });

    res.status(200).json({
      success: true,
      data: {
        sessions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get single session
export const getSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await Chat.findOne({
      user: req.user.id,
      sessionId
    });

    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// Save session
export const saveSession = async (req, res, next) => {
  try {
    const { sessionId, name, messages, metadata = {} } = req.body;

    const safeSessionId =
      typeof sessionId === 'string' && sessionId.trim()
        ? sessionId.trim()
        : `${Date.now()}`;

    const safeName =
      typeof name === 'string' && name.trim()
        ? name.trim().slice(0, 100)
        : 'Chat';

    const safeMessages = Array.isArray(messages)
      ? messages
          .map((msg) => {
            const sender = msg?.sender === 'user' ? 'user' : msg?.sender === 'ai' ? 'ai' : null;
            const text = typeof msg?.text === 'string' ? msg.text.trim() : '';
            if (!sender || !text) return null;
            return {
              text,
              sender,
              timestamp: msg?.timestamp || new Date().toISOString()
            };
          })
          .filter(Boolean)
      : [];

    const derivedLastMessage =
      safeMessages.length > 0
        ? safeMessages[safeMessages.length - 1].text.slice(0, 50)
        : '';

    const safeMetadata = {
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
      isArchived: Boolean(metadata?.isArchived),
      lastMessage:
        typeof metadata?.lastMessage === 'string'
          ? metadata.lastMessage.slice(0, 200)
          : derivedLastMessage,
      messageCount: safeMessages.length
    };

    const session = await Chat.findOneAndUpdate(
      { user: req.user.id, sessionId: safeSessionId },
      {
        $set: {
          name: safeName,
          messages: safeMessages,
          metadata: safeMetadata
        }
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// Update session
export const updateSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;

    const session = await Chat.findOneAndUpdate(
      { user: req.user.id, sessionId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// Delete session
export const deleteSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await Chat.findOneAndDelete({
      user: req.user.id,
      sessionId
    });

    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Archive session
export const archiveSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await Chat.findOneAndUpdate(
      { user: req.user.id, sessionId },
      { $set: { 'metadata.isArchived': true } },
      { new: true }
    );

    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// Search sessions
export const searchSessions = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query) {
      return next(new AppError('Search query is required', 400));
    }

    const sessions = await Chat.find({
      user: req.user.id,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { 'messages.text': { $regex: query, $options: 'i' } },
        { 'metadata.tags': { $in: [query] } }
      ]
    })
    .sort({ updatedAt: -1 })
    .limit(50);

    res.status(200).json({
      success: true,
      data: sessions
    });
  } catch (error) {
    next(error);
  }
};
