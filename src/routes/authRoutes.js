import express from 'express';
import { body } from 'express-validator';
import { 
  signup, 
  login, 
  logout, 
  getMe,
  updatePreferences,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  sendSignupOtp,
  verifySignupOtp,
  sendLoginVerificationOtp,
  verifyLoginVerificationOtp
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { requireDatabase } from '../middleware/dbReadyMiddleware.js';

const router = express.Router();

// Validation rules
const signupValidation = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .trim()
    .escape(),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
    .matches(/\d/)
    .withMessage('New password must contain at least one number')
    .matches(/[A-Z]/)
    .withMessage('New password must contain at least one uppercase letter')
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase()
];

const resetPasswordValidation = [
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
];

const resendVerificationValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase()
];

const sendSignupOtpValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase(),
  body('name')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Name must be between 1 and 50 characters')
];

const verifySignupOtpValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase(),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only digits')
];

const sendLoginVerificationOtpValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase()
];

const verifyLoginVerificationOtpValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase(),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only digits')
];

// Public routes
router.post('/signup', requireDatabase, signupValidation, validate, signup);
router.post('/login', requireDatabase, loginValidation, validate, login);
router.post('/forgot-password', requireDatabase, forgotPasswordValidation, validate, forgotPassword);
router.patch('/reset-password/:token', requireDatabase, resetPasswordValidation, validate, resetPassword);
router.get('/verify-email/:token', requireDatabase, verifyEmail);
router.post('/resend-verification', requireDatabase, resendVerificationValidation, validate, resendVerification);
router.post('/send-signup-otp', requireDatabase, sendSignupOtpValidation, validate, sendSignupOtp);
router.post('/verify-signup-otp', requireDatabase, verifySignupOtpValidation, validate, verifySignupOtp);
router.post('/send-login-verification-otp', requireDatabase, sendLoginVerificationOtpValidation, validate, sendLoginVerificationOtp);
router.post('/verify-login-verification-otp', requireDatabase, verifyLoginVerificationOtpValidation, validate, verifyLoginVerificationOtp);

// Protected routes
router.get('/me', requireDatabase, protect, getMe);
router.post('/logout', requireDatabase, protect, logout);
router.patch('/preferences', requireDatabase, protect, updatePreferences);
router.patch('/change-password', requireDatabase, protect, changePasswordValidation, validate, changePassword);

export default router;
