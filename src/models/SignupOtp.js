import mongoose from 'mongoose';

const signupOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    otpHash: {
      type: String,
      select: false
    },
    otpExpiresAt: {
      type: Date,
      required: true,
      select: false
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    attempts: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    bufferCommands: false
  }
);

const SignupOtp = mongoose.model('SignupOtp', signupOtpSchema);
export default SignupOtp;
