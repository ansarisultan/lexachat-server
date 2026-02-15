import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { buildResetUrl, sendPasswordResetEmail } from '../utils/email.js';

// Generate JWT Token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Create and send token response
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  
  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    success: true,
    token,
    data: {
      user
    }
  });
};

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
export const signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('User already exists with this email', 400));
    }

    // Create new user (password will be hashed by pre-save hook)
    const user = await User.create({
      name,
      email,
      password,
      preferences: {
        theme: 'dark',
        defaultMode: 'session'
      }
    });

    // Send response with token
    createSendToken(user, 201, res);

  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Send response
    createSendToken(user, 200, res);

  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res, next) => {
  try {
    // In a real app, you might want to blacklist the token
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user preferences
// @route   PATCH /api/auth/preferences
// @access  Private
export const updatePreferences = async (req, res, next) => {
  try {
    const { theme, defaultMode } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        preferences: {
          theme: theme || req.user.preferences.theme,
          defaultMode: defaultMode || req.user.preferences.defaultMode
        }
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PATCH /api/auth/change-password
// @access  Private
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return next(new AppError('Current password is incorrect', 401));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Send new token
    createSendToken(user, 200, res);

  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const genericMessage =
      'If an account with that email exists, a password reset link has been sent.';

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: genericMessage
      });
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = buildResetUrl(resetToken);
    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl
    });

    const response = {
      success: true,
      message: genericMessage
    };

    if (!emailResult.delivered && process.env.NODE_ENV !== 'production') {
      response.data = {
        resetUrl,
        note: 'SMTP is not configured, so reset link is returned for local testing.'
      };
    }

    if (!emailResult.delivered && process.env.NODE_ENV === 'production') {
      return next(new AppError('Email service is not configured. Please contact support.', 503));
    }

    return res.status(200).json(response);
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      return next(new AppError('Unable to send reset email right now. Please try again later.', 503));
    }
    next(error);
  }
};

// @desc    Reset password
// @route   PATCH /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) {
      return next(new AppError('Reset token is required', 400));
    }

    if (!password) {
      return next(new AppError('New password is required', 400));
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken +passwordResetExpires +password');

    if (!user) {
      return next(new AppError('Reset token is invalid or has expired', 400));
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};
