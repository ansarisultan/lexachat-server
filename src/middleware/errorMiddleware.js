export const notFound = (req, res, next) => {
  if (!res.headersSent) {
    res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
    return;
  }
  next();
};

export const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || 'Internal Server Error';

  // Mongo duplicate key (e.g., email already exists)
  if (err?.code === 11000) {
    statusCode = 400;
    const duplicateField = Object.keys(err.keyPattern || {})[0];
    message = duplicateField
      ? `${duplicateField.charAt(0).toUpperCase()}${duplicateField.slice(1)} already exists`
      : 'Duplicate value error';
  }

  // Mongoose validation errors
  if (err?.name === 'ValidationError') {
    statusCode = 400;
    const firstError = Object.values(err.errors || {})[0];
    message = firstError?.message || 'Validation failed';
  }

  // DB connectivity / buffering issues
  if (
    err?.name === 'MongoServerSelectionError' ||
    err?.name === 'MongooseServerSelectionError' ||
    (typeof err?.message === 'string' &&
      (
        err.message.toLowerCase().includes('buffering timed out') ||
        err.message.toLowerCase().includes('before initial connection is complete') ||
        err.message.toLowerCase().includes('not connected')
      ))
  ) {
    statusCode = 503;
    message = 'Database is temporarily unavailable. Please try again in a moment.';
  }

  res.status(statusCode).json({
    success: false,
    message
  });
};
