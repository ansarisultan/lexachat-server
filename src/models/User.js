import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password by default
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  avatar: {
    type: String,
    default: '',
    trim: true,
    maxlength: [2500000, 'Avatar data is too large']
  },
  bio: {
    type: String,
    default: '',
    trim: true,
    maxlength: [280, 'Bio cannot exceed 280 characters']
  },
  phone: {
    type: String,
    default: '',
    trim: true,
    maxlength: [30, 'Phone number cannot exceed 30 characters']
  },
  links: {
    portfolio: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Portfolio URL cannot exceed 500 characters']
    },
    linkedin: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'LinkedIn URL cannot exceed 500 characters']
    },
    github: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'GitHub URL cannot exceed 500 characters']
    }
  },
  linkBadges: {
    portfolio: {
      type: Boolean,
      default: false
    },
    linkedin: {
      type: Boolean,
      default: false
    },
    github: {
      type: Boolean,
      default: false
    }
  },
  preferences: {
    theme: {
      type: String,
      enum: ['cyber', 'light', 'dark'],
      default: 'cyber'
    },
    defaultMode: {
      type: String,
      enum: ['local', 'session'],
      default: 'local'
    },
    memory: {
      preferredName: {
        type: String,
        default: '',
        trim: true,
        maxlength: [80, 'Preferred name cannot exceed 80 characters']
      },
      responseTone: {
        type: String,
        default: '',
        trim: true,
        maxlength: [80, 'Response tone cannot exceed 80 characters']
      },
      customPrompt: {
        type: String,
        default: '',
        trim: true,
        maxlength: [1200, 'Custom prompt cannot exceed 1200 characters']
      },
      savedMemories: [
        {
          type: String,
          trim: true,
          maxlength: [240, 'Each saved memory cannot exceed 240 characters']
        }
      ]
    }
  },
  lastLogin: {
    type: Date,
    default: null
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

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Create password reset token (store hashed token, return plain token)
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  return resetToken;
};

// Create email verification token (store hashed token, return plain token)
userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return verificationToken;
};

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

const User = mongoose.model('User', userSchema);
export default User;
