import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validateMiddleware.js';
import { chatCompletion } from '../controllers/aiController.js';

const router = express.Router();

router.post(
  '/chat',
  [
    body('messages').isArray({ min: 1 }).withMessage('messages must be a non-empty array'),
    body('webSearchEnabled').optional().isBoolean().withMessage('webSearchEnabled must be a boolean')
  ],
  validate,
  chatCompletion
);

export default router;
