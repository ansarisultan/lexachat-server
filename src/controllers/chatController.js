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
      'metadata.isArchived': false 
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

    // Check if session exists
    let session = await Chat.findOne({
      user: req.user.id,
      sessionId
    });

    if (session) {
      // Update existing session
      session.name = name;
      session.messages = messages;
      session.metadata = { ...session.metadata, ...metadata };
      await session.save();
    } else {
      // Create new session
      session = await Chat.create({
        user: req.user.id,
        sessionId,
        name,
        messages,
        metadata
      });
    }

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