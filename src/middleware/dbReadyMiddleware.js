import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';

export const requireDatabase = (req, _res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return next(new AppError('Database is not connected. Please try again in a moment.', 503));
  }
  return next();
};
