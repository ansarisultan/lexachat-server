import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import SignupOtp from '../models/SignupOtp.js';
import { AppError } from '../utils/AppError.js';
import {
  buildResetUrl,
  buildVerifyEmailUrl,
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendSignupOtpEmail
} from '../utils/email.js';

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

    const otpRecord = await SignupOtp.findOne({ email });
    if (!otpRecord || !otpRecord.verifiedAt || otpRecord.otpExpiresAt < Date.now()) {
      return next(new AppError('Please verify your email with OTP before creating an account.', 400));
    }

    // Create new user (password will be hashed by pre-save hook)
    const user = await User.create({
      name,
      email,
      password,
      emailVerified: true,
      preferences: {
        theme: 'dark',
        defaultMode: 'session'
      }
    });
    await SignupOtp.deleteOne({ email });

    return res.status(201).json({
      success: true,
      message: 'Signup successful. You can now log in.'
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Send signup OTP
// @route   POST /api/auth/send-signup-otp
// @access  Public
export const sendSignupOtp = async (req, res, next) => {
  try {
    const { email, name } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('User already exists with this email', 400));
    }

    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    const otpHash = crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex');

    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await SignupOtp.findOneAndUpdate(
      { email },
      {
        otpHash,
        otpExpiresAt,
        verifiedAt: null,
        attempts: 0
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    const emailResult = await sendSignupOtpEmail({
      to: email,
      name,
      otp
    });

    if (!emailResult.delivered && process.env.NODE_ENV === 'production') {
      return next(new AppError('Email service is not configured. Please contact support.', 503));
    }

    const response = {
      success: true,
      message: 'OTP sent to your email.'
    };

    if (!emailResult.delivered && process.env.NODE_ENV !== 'production') {
      response.data = {
        otp,
        note: 'SMTP is not configured, so OTP is returned for local testing.'
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    return next(new AppError('Unable to send OTP right now. Please try again later.', 503));
  }
};

// @desc    Verify signup OTP
// @route   POST /api/auth/verify-signup-otp
// @access  Public
export const verifySignupOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const otpRecord = await SignupOtp.findOne({ email }).select('+otpHash +otpExpiresAt');
    if (!otpRecord) {
      return next(new AppError('OTP not found. Please request a new OTP.', 400));
    }

    if (otpRecord.otpExpiresAt < Date.now()) {
      return next(new AppError('OTP has expired. Please request a new OTP.', 400));
    }

    if (otpRecord.attempts >= 5) {
      return next(new AppError('Too many failed attempts. Please request a new OTP.', 429));
    }

    const incomingHash = crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex');

    if (incomingHash !== otpRecord.otpHash) {
      otpRecord.attempts += 1;
      await otpRecord.save({ validateBeforeSave: false });
      return next(new AppError('Invalid OTP', 400));
    }

    otpRecord.verifiedAt = new Date();
    otpRecord.otpHash = undefined;
    otpRecord.attempts = 0;
    otpRecord.otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await otpRecord.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: 'Email verified with OTP. You can now create your account.'
    });
  } catch (error) {
    return next(error);
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

    if (user.emailVerified === false) {
      return next(new AppError('Please verify your email before logging in. Use resend verification if needed.', 403));
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
    console.error('forgotPassword error:', error?.message || error);
    return next(new AppError('Unable to send reset email right now. Please try again later.', 503));
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

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      return next(new AppError('Verification token is required', 400));
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return next(new AppError('Verification token is invalid or has expired', 400));
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.'
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    const genericMessage =
      'If your account exists and is not verified, a verification link has been sent.';

    const user = await User.findOne({ email });
    if (!user || user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: genericMessage
      });
    }

    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verifyUrl = buildVerifyEmailUrl(verificationToken);
    const emailResult = await sendEmailVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl
    });

    if (!emailResult.delivered && process.env.NODE_ENV === 'production') {
      return next(new AppError('Email service is not configured. Please contact support.', 503));
    }

    const response = {
      success: true,
      message: genericMessage
    };

    if (!emailResult.delivered && process.env.NODE_ENV !== 'production') {
      response.data = {
        verifyUrl,
        note: 'SMTP is not configured, so verify link is returned for local testing.'
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    return next(new AppError('Unable to send verification email right now. Please try again later.', 503));
  }
};
