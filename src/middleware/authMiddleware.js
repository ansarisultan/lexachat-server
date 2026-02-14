import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return next(new AppError('Not authorized to access this route', 401));
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new AppError('User not found', 401));
      }

      // Add user to request object
      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(new AppError('Token expired', 401));
      }
      if (error.name === 'JsonWebTokenError') {
        return next(new AppError('Invalid token', 401));
      }
      return next(new AppError('Not authorized', 401));
    }
  } catch (error) {
    next(error);
  }
};

// Optional: Role-based authorization
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Not authorized to perform this action', 403));
    }
    next();
  };
};

// Optional: Rate limiting based on user
export const rateLimitByUser = (maxRequests, timeWindow) => {
  const requests = new Map();

  return (req, res, next) => {
    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - timeWindow;

    if (!requests.has(userId)) {
      requests.set(userId, []);
    }

    const userRequests = requests.get(userId).filter(timestamp => timestamp > windowStart);
    
    if (userRequests.length >= maxRequests) {
      return next(new AppError('Too many requests, please try again later', 429));
    }

    userRequests.push(now);
    requests.set(userId, userRequests);
    next();
  };
};