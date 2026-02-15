import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

const app = express();

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'https://lexachat-funclexa.vercel.app',
  'https://www.lexachat-funclexa.vercel.app',
  'https://funclexa.me',
  'https://www.funclexa.me',
  'https://lexachat.online',
  'https://www.lexachat.online'
]);

const clientUrls = process.env.CLIENT_URLS || process.env.CLIENT_URL;
if (clientUrls) {
  clientUrls
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .forEach((url) => allowedOrigins.add(url));
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients (Postman/curl) and configured browser origins.
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, origin);
    }

    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/ai', aiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
