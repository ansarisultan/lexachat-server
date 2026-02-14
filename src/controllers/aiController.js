import { AppError } from '../utils/AppError.js';

const GROQ_API_URL =
  process.env.GROQ_API_URL ||
  process.env.VITE_GROQ_API_URL ||
  'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

export const chatCompletion = async (req, res, next) => {
  try {
    const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      return next(new AppError('Missing GROQ_API_KEY on server', 500));
    }

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return next(new AppError('messages must be a non-empty array', 400));
    }

    const payload = {
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      stream: false
    };

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return next(new AppError(`Groq API error ${response.status}: ${errorText}`, 502));
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return next(new AppError('Invalid Groq API response format', 502));
    }

    return res.status(200).json({
      success: true,
      data: {
        content,
        model: GROQ_MODEL
      }
    });
  } catch (error) {
    return next(error);
  }
};
