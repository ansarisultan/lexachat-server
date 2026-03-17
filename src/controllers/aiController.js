import { AppError } from '../utils/AppError.js';

const GROQ_API_URL =
  process.env.GROQ_API_URL ||
  process.env.VITE_GROQ_API_URL ||
  'https://api.groq.com/openai/v1/chat/completions';
const GENERAL_MODEL = 'llama-3.3-70b-versatile';
const STRONG_FALLBACK_MODEL = 'openai/gpt-oss-120b';
const REASONING_MODEL = 'openai/gpt-oss-120b';
const CODING_MODEL = 'qwen/qwen3-32b';
const TAVILY_API_URL = 'https://api.tavily.com/search';
const SERPER_API_URL = 'https://google.serper.dev/search';

const SEARCH_INTENT_REGEX =
  /\b(search|find|look\s*up|google|latest|today|news|current|real[-\s]?time|updated?)\b/i;
const CODE_INTENT_REGEX =
  /(```|`[^`]+`|\b(code|coding|debug|bug|error|stack trace|exception|refactor|optimiz(e|ation)|algorithm|complexity|regex|sql|query|api|endpoint|function|class|typescript|javascript|python|java|c\+\+|react|node|express|mongodb)\b)/i;
const REASONING_INTENT_REGEX =
  /\b(reason|reasoning|analy[sz]e|analysis|think\s+step|step[-\s]?by[-\s]?step|complex|deep|carefully|compare|trade[\s-]?off|pros?\s+and\s+cons|why|explain\s+in\s+detail|detailed)\b/i;

const GENERAL_RESPONSE_SYSTEM_PROMPT = `You are LexaChat, a premium AI assistant focused on answer quality.

Your priority is to give the user the best possible response, not the fastest-looking one.

Core behavior:
- understand the exact user intent before answering
- answer directly, accurately, and with strong relevance to the prompt
- give the most useful result first
- prefer clarity, substance, and correctness over filler
- avoid vague, generic, or repetitive wording

Presentation:
- make responses attractive and easy to scan
- use short sections only when they improve readability
- use highlighted markdown bullets for key points when helpful
- use concise emphasis for important ideas
- keep formatting clean and professional

Rules:
- do not add unnecessary introductions or endings
- do not overexplain simple things
- if the user asks for detail, give depth with structure
- if the user asks for a short answer, keep it compact
- if information is uncertain, say so clearly instead of bluffing
- do not include unnecessary safety-style filler or repeated disclaimers`;

const CODING_RESPONSE_SYSTEM_PROMPT = `You are LexaChat, a premium coding and debugging assistant.

Your priority is to produce the best quality technical answer with strong correctness, relevance, and formatting judgment.

Core behavior:
- solve the user's exact problem first
- identify the real cause when debugging, not just surface symptoms
- recommend the best fix first when multiple options exist
- keep explanations practical, technically accurate, and implementation-focused

Formatting rules:
- do not put everything in code fences
- use code blocks only for code, commands, config, queries, or exact syntax
- prefer a short explanation before code when that improves understanding
- if code is not necessary, answer in plain text
- if code is necessary, provide clean and complete snippets

Response quality:
- avoid fluff, repetition, and generic advice
- avoid unnecessary theory unless the user asks for it
- when debugging, structure as cause, fix, and final answer
- when comparing solutions, clearly state the recommended approach
- keep the response attractive, concise, and highly useful`;

const normalizeStoredMemory = (memory = {}) => ({
  preferredName: typeof memory?.preferredName === 'string' ? memory.preferredName.trim() : '',
  responseTone: typeof memory?.responseTone === 'string' ? memory.responseTone.trim() : '',
  customPrompt: typeof memory?.customPrompt === 'string' ? memory.customPrompt.trim() : '',
  savedMemories: Array.isArray(memory?.savedMemories)
    ? memory.savedMemories
        .filter((item) => typeof item === 'string' && item.trim())
        .map((item) => item.trim())
    : []
});

const buildUserMemoryPrompt = (memory = {}, fallbackName = '') => {
  const normalized = normalizeStoredMemory(memory);
  const sections = [];

  if (normalized.preferredName) {
    sections.push(`Address the user as: ${normalized.preferredName}`);
  } else if (fallbackName) {
    sections.push(`User account name: ${fallbackName}`);
  }

  if (normalized.responseTone) {
    sections.push(`Preferred response tone: ${normalized.responseTone}`);
  }

  if (normalized.customPrompt) {
    sections.push(`Persistent user instruction: ${normalized.customPrompt}`);
  }

  if (normalized.savedMemories.length > 0) {
    sections.push(
      `Saved user memory facts:\n${normalized.savedMemories.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
    );
  }

  if (sections.length === 0) return '';

  return [
    'Personalization memory for this authenticated user:',
    '- This memory is user-approved persistent profile data.',
    '- Use it only when it improves the response.',
    '- Do not mention the memory unless it is relevant.',
    '- If the current user message conflicts with saved memory, follow the current message.',
    ...sections
  ].join('\n');
};

const getUserTextFromContent = (content) => {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part) return '';
        if (typeof part === 'string') return part;
        if (part.type === 'text') return part.text || '';
        return '';
      })
      .join(' ')
      .trim();
  }

  return '';
};

const getLastUserMessageText = (messages = []) => {
  const reversed = [...messages].reverse();
  const lastUser = reversed.find((message) => message?.role === 'user');
  if (!lastUser) return '';
  return getUserTextFromContent(lastUser.content);
};

const hasImageContent = (messages = []) =>
  messages.some((message) => {
    if (!Array.isArray(message?.content)) return false;
    return message.content.some((part) => part?.type === 'image_url');
  });

const needsRealtimeSearch = (messages = []) => {
  const lastUserText = getLastUserMessageText(messages);
  if (!lastUserText) return false;
  return SEARCH_INTENT_REGEX.test(lastUserText);
};

const selectModelForMessages = (messages = []) => {
  const lastUserText = getLastUserMessageText(messages);
  if (hasImageContent(messages)) return GENERAL_MODEL;
  if (!lastUserText) return GENERAL_MODEL;
  if (CODE_INTENT_REGEX.test(lastUserText)) return CODING_MODEL;
  if (REASONING_INTENT_REGEX.test(lastUserText) || lastUserText.length > 900) return REASONING_MODEL;
  return GENERAL_MODEL;
};

const getFallbackChainForModel = (model = '') => {
  switch (model) {
    case GENERAL_MODEL:
      return [STRONG_FALLBACK_MODEL];
    case CODING_MODEL:
      return [STRONG_FALLBACK_MODEL];
    case REASONING_MODEL:
      return [];
    default:
      return [STRONG_FALLBACK_MODEL];
  }
};

const STATIC_FAQ_RESPONSES = [
  {
    match: /\b(who\s+created\s+you|who\s+made\s+you|who\s+built\s+you|your\s+creator|your\s+founder)\b/i,
    content:
      'I was created by Sultan Salauddin Ansari, a Computer Science Engineering student at Presidency University, Bengaluru, and the builder behind the FuncLexa AI ecosystem. LexaChat is part of his vision to develop fast, reliable, and developer-focused AI tools for real-world productivity.'
  },
  {
    match: /\b(about\s+funclexa|what\s+is\s+funclexa|tell\s+me\s+about\s+funclexa)\b/i,
    content:
      'FuncLexa is an AI-driven SaaS ecosystem focused on building intelligent, practical tools for developers, students, and modern digital workflows. The platform combines full-stack engineering, voice AI, and applied artificial intelligence to deliver real-world productivity solutions. LexaChat serves as one of the flagship products within the FuncLexa ecosystem.'
  },
  {
    match: /\b(about\s+creator|about\s+the\s+creator|who\s+is\s+the\s+creator|about\s+sultan)\b/i,
    content:
      'Sultan Salauddin Ansari is a B.Tech Computer Science Engineering student at Presidency University, Bengaluru, and an aspiring AI Engineer and MERN stack developer. He specializes in building production-ready full-stack applications and applied AI systems. His key work includes the FuncLexa ecosystem, the LexaChat real-time AI platform, and an advanced AI voice assistant, all focused on solving real-world problems through modern web technologies.'
  },
  {
    match: /\b(about\s+lexachat|what\s+is\s+lexachat|tell\s+me\s+about\s+lexachat)\b/i,
    content:
      'LexaChat is a developer-focused AI chat assistant built under the FuncLexa ecosystem. It is designed to provide fast, accurate, and context-aware assistance for coding, debugging, learning, and real-world productivity. Built with modern full-stack technologies and advanced AI integration, LexaChat aims to deliver a smooth, reliable, and intelligent chat experience for developers and tech enthusiasts.'
  }
];

const getStaticFaqResponse = (text = '') => {
  if (!text) return null;
  const match = STATIC_FAQ_RESPONSES.find((entry) => entry.match.test(text));
  return match ? match.content : null;
};

const searchWithTavily = async (query, apiKey) => {
  const response = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 5,
      include_answer: true,
      search_depth: 'basic'
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily API error ${response.status}`);
  }

  const data = await response.json();
  const resultItems = Array.isArray(data?.results) ? data.results : [];

  const sources = resultItems.slice(0, 5).map((item) => ({
    title: item?.title || item?.url || 'Untitled',
    url: item?.url || '',
    snippet: item?.content || ''
  }));

  return {
    provider: 'tavily',
    answer: data?.answer || '',
    sources
  };
};

const searchWithSerper = async (query, apiKey) => {
  const response = await fetch(SERPER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey
    },
    body: JSON.stringify({
      q: query,
      num: 5
    })
  });

  if (!response.ok) {
    throw new Error(`Serper API error ${response.status}`);
  }

  const data = await response.json();
  const sources = (data?.organic || []).slice(0, 5).map((item) => ({
    title: item?.title || item?.link || 'Untitled',
    url: item?.link || '',
    snippet: item?.snippet || ''
  }));

  return {
    provider: 'serper',
    answer: '',
    sources
  };
};

const searchWithDuckDuckGo = async (query) => {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo API error ${response.status}`);
  }

  const data = await response.json();
  const sources = [];

  if (data?.AbstractURL || data?.AbstractText) {
    sources.push({
      title: data?.Heading || data?.AbstractSource || 'DuckDuckGo Result',
      url: data?.AbstractURL || '',
      snippet: data?.AbstractText || ''
    });
  }

  if (Array.isArray(data?.RelatedTopics)) {
    data.RelatedTopics.forEach((topic) => {
      if (sources.length >= 5) return;
      if (topic?.Text || topic?.FirstURL) {
        sources.push({
          title: topic?.Text?.split('-')?.[0]?.trim() || 'Related Topic',
          url: topic?.FirstURL || '',
          snippet: topic?.Text || ''
        });
      }

      if (Array.isArray(topic?.Topics)) {
        topic.Topics.forEach((nested) => {
          if (sources.length >= 5) return;
          if (nested?.Text || nested?.FirstURL) {
            sources.push({
              title: nested?.Text?.split('-')?.[0]?.trim() || 'Related Topic',
              url: nested?.FirstURL || '',
              snippet: nested?.Text || ''
            });
          }
        });
      }
    });
  }

  return {
    provider: 'duckduckgo',
    answer: '',
    sources
  };
};

const searchWeb = async (query) => {
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  const serperApiKey = process.env.SERPER_API_KEY;

  if (tavilyApiKey) {
    try {
      return await searchWithTavily(query, tavilyApiKey);
    } catch {
      // Fall through to the next provider.
    }
  }

  if (serperApiKey) {
    try {
      return await searchWithSerper(query, serperApiKey);
    } catch {
      // Fall through to the next provider.
    }
  }

  return searchWithDuckDuckGo(query);
};

const buildSearchContextMessage = (searchResult) => {
  const lines = [];
  lines.push('Live web search context (use this if relevant and cite links):');

  if (searchResult?.answer) {
    lines.push(`Summary: ${searchResult.answer}`);
  }

  (searchResult?.sources || []).forEach((source, index) => {
    lines.push(
      `[${index + 1}] ${source.title || 'Untitled'}\nURL: ${source.url || 'N/A'}\nSnippet: ${source.snippet || 'N/A'}`
    );
  });

  lines.push('If sources are weak or missing, explicitly say that and ask the user to refine the query.');
  return lines.join('\n\n');
};

const buildSystemPromptForModel = (model) => {
  if (model === CODING_MODEL) return CODING_RESPONSE_SYSTEM_PROMPT;
  return GENERAL_RESPONSE_SYSTEM_PROMPT;
};

const getGenerationSettingsForModel = (model) => {
  if (model === CODING_MODEL) {
    return {
      temperature: 0.35,
      max_tokens: 3072
    };
  }

  if (model === REASONING_MODEL) {
    return {
      temperature: 0.45,
      max_tokens: 3072
    };
  }

  return {
    temperature: 0.55,
    max_tokens: 2560
  };
};

export const chatCompletion = async (req, res, next) => {
  try {
    const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      return next(new AppError('Missing GROQ_API_KEY on server', 500));
    }

    const { messages, webSearchEnabled = true } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return next(new AppError('messages must be a non-empty array', 400));
    }

    const lastUserText = getLastUserMessageText(messages);
    const staticReply = getStaticFaqResponse(lastUserText);
    if (staticReply) {
      return res.status(200).json({
        success: true,
        data: {
          content: staticReply,
          model: 'static',
          webSearch: {
            used: false,
            provider: null,
            sources: []
          }
        }
      });
    }
    const selectedModel = selectModelForMessages(messages);
    const shouldSearch = Boolean(webSearchEnabled) && needsRealtimeSearch(messages);
    let webSearch = null;
    const userMemoryPrompt = buildUserMemoryPrompt(req.user?.preferences?.memory, req.user?.name || '');
    const systemMessages = [
      {
        role: 'system',
        content: buildSystemPromptForModel(selectedModel)
      }
    ];

    if (userMemoryPrompt) {
      systemMessages.push({
        role: 'system',
        content: userMemoryPrompt
      });
    }

    let messagesForModel = [...systemMessages, ...messages];

    if (shouldSearch && lastUserText) {
      try {
        webSearch = await searchWeb(lastUserText);

        if ((webSearch?.sources || []).length > 0) {
          const searchContext = buildSearchContextMessage(webSearch);
          messagesForModel = [
            ...systemMessages,
            {
              role: 'system',
              content: searchContext
            },
            ...messages
          ];
        }
      } catch {
        // Keep normal chat flow if web search fails.
        webSearch = null;
      }
    }

    const generationSettings = getGenerationSettingsForModel(selectedModel);
    const payload = {
      model: selectedModel,
      messages: messagesForModel,
      temperature: generationSettings.temperature,
      max_tokens: generationSettings.max_tokens,
      stream: false
    };
    const requestModel = async (model) => {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          ...payload,
          model
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          error: `Groq API error ${response.status}: ${errorText}`
        };
      }

      const data = await response.json();
      return { ok: true, data, model };
    };

    const candidateModels = [selectedModel, ...getFallbackChainForModel(selectedModel)];
    let result = { ok: false, error: 'No model attempts were made.' };

    for (const model of candidateModels) {
      result = await requestModel(model);
      if (result.ok) break;
    }

    if (!result.ok) {
      return next(new AppError(result.error, 502));
    }

    const { data } = result;
    let content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return next(new AppError('Invalid Groq API response format', 502));
    }

    if (webSearch?.sources?.length) {
      const hasLinksInReply = /(https?:\/\/[^\s]+)/i.test(content);
      if (!hasLinksInReply) {
        const sourceLines = webSearch.sources
          .filter((source) => source?.url)
          .slice(0, 3)
          .map((source, idx) => `${idx + 1}. ${source.title || source.url} - ${source.url}`);

        if (sourceLines.length > 0) {
          content = `${content}\n\nSources:\n${sourceLines.join('\n')}`;
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        content,
        model: result.model,
        webSearch: webSearch
          ? {
              used: true,
              provider: webSearch.provider,
              sources: webSearch.sources || []
            }
          : {
              used: false,
              provider: null,
              sources: []
            }
      }
    });
  } catch (error) {
    return next(error);
  }
};

// Image generation endpoint/controller disabled.
// export const generateImage = async (req, res, next) => {
//   try {
//     const prompt = String(req.query.prompt || '').trim();
//     if (!prompt) {
//       return next(new AppError('prompt is required', 400));
//     }
//
//     const seed = Number.parseInt(String(req.query.seed || Date.now()), 10);
//     const width = Math.min(1024, Math.max(256, Number.parseInt(String(req.query.w || 1024), 10) || 1024));
//     const height = Math.min(1024, Math.max(256, Number.parseInt(String(req.query.h || 1024), 10) || 1024));
//     const safePrompt = encodeURIComponent(prompt);
//
//     const providers = [
//       (s) => `https://image.pollinations.ai/prompt/${safePrompt}?model=flux&width=${width}&height=${height}&seed=${s}&nologo=true&safe=true`,
//       (s) => `https://image.pollinations.ai/prompt/${safePrompt}?model=turbo&width=${width}&height=${height}&seed=${s}&nologo=true&safe=true`,
//       (s) => `https://image.pollinations.ai/prompt/${safePrompt}?width=${width}&height=${height}&seed=${s}&nologo=true&safe=true`
//     ];
//
//     const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
//
//     for (const buildUrl of providers) {
//       for (let attempt = 0; attempt < 3; attempt += 1) {
//         const attemptSeed = seed + attempt;
//         const sourceUrl = buildUrl(attemptSeed);
//         try {
//           const upstream = await fetch(sourceUrl, {
//             method: 'GET',
//             headers: {
//               Accept: 'image/*',
//               'User-Agent': 'FuncLexaImageProxy/1.0'
//             }
//           });
//
//           if (!upstream.ok) {
//             await sleep(250 * (attempt + 1));
//             continue;
//           }
//
//           const arrayBuffer = await upstream.arrayBuffer();
//           const contentType = upstream.headers.get('content-type') || 'image/jpeg';
//
//           res.setHeader('Content-Type', contentType);
//           res.setHeader('Cache-Control', 'public, max-age=60');
//           return res.status(200).send(Buffer.from(arrayBuffer));
//         } catch {
//           await sleep(250 * (attempt + 1));
//         }
//       }
//     }
//
//     // Final fallback: always return a valid SVG image instead of failing with 500/502.
//     const label = prompt.length > 80 ? `${prompt.slice(0, 77)}...` : prompt;
//     const svg = `<?xml version="1.0" encoding="UTF-8"?>
// <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
//   <defs>
//     <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
//       <stop offset="0%" stop-color="#0f172a"/>
//       <stop offset="100%" stop-color="#1d4ed8"/>
//     </linearGradient>
//   </defs>
//   <rect width="100%" height="100%" fill="url(#bg)" />
//   <text x="50%" y="45%" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="28" text-anchor="middle">
//     Image service is busy
//   </text>
//   <text x="50%" y="53%" fill="#93c5fd" font-family="Arial, sans-serif" font-size="18" text-anchor="middle">
//     Prompt:
//   </text>
//   <text x="50%" y="59%" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="18" text-anchor="middle">
//     ${label.replace(/[<>&'"]/g, '')}
//   </text>
// </svg>`;
//
//     res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
//     res.setHeader('Cache-Control', 'no-store');
//     return res.status(200).send(svg);
//   } catch (error) {
//     return next(error);
//   }
// };
