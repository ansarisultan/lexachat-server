import express from 'express';
import { body } from 'express-validator';
import { 
  getSessions,
  getSession,
  saveSession,
  updateSession,
  deleteSession,
  archiveSession,
  searchSessions
} from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { requireDatabase } from '../middleware/dbReadyMiddleware.js';

const router = express.Router();

// Validation rules
const sessionValidation = [
  body('name').optional().trim().isLength({ max: 100 }),
  body('messages').isArray(),
  body('messages.*.text').notEmpty().trim(),
  body('messages.*.sender').isIn(['user', 'ai']),
  body('metadata').optional().isObject()
];

// All chat routes require authentication
router.use(requireDatabase);
router.use(protect);

// GET routes
router.get('/sessions', getSessions);
router.get('/session/:sessionId', getSession);
router.get('/search', searchSessions);

// POST routes
router.post('/save', sessionValidation, validate, saveSession);

// PUT routes
router.put('/session/:sessionId', sessionValidation, validate, updateSession);

// DELETE routes
router.delete('/session/:sessionId', deleteSession);
router.patch('/session/:sessionId/archive', archiveSession);

export default router;
