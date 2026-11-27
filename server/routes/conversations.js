const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const auth = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const DEFAULT_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'];

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server/.env');
  }
  return new GoogleGenAI({ apiKey });
}

function isGeminiModelName(name) {
  if (!name || typeof name !== 'string') return false;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  if (
    normalized.startsWith('gpt-') ||
    normalized.startsWith('chatgpt') ||
    /^o[134](-|$)/.test(normalized)
  ) {
    return false;
  }
  return true;
}

function getCandidateModels(requestedModel) {
  const envModel = process.env.GEMINI_MODEL?.trim();
  const safeRequested = isGeminiModelName(requestedModel) ? requestedModel.trim() : null;
  const safeEnv = isGeminiModelName(envModel) ? envModel : null;

  return [...new Set([safeRequested, safeEnv, ...FALLBACK_MODELS].filter(Boolean))];
}

function extractChunkText(chunk) {
  if (!chunk) return '';
  if (typeof chunk.text === 'string') return chunk.text;
  const parts = chunk.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => p?.text || '').join('');
}

async function createGeminiStream({ contents, systemInstruction, requestedModel }) {
  const ai = getGenAIClient();
  const candidates = getCandidateModels(requestedModel);

  let lastError;
  for (const modelName of candidates) {
    try {
      const stream = await ai.models.generateContentStream({
        model: modelName,
        contents,
        config: systemInstruction ? { systemInstruction } : undefined
      });
      return { stream, modelUsed: modelName };
    } catch (err) {
      lastError = err;
      const status = err?.status || err?.code;
      if (status === 503 || status === 429) {
        console.warn(`Model ${modelName} unavailable (${status}), trying next fallback...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All Gemini models are currently unavailable.');
}

// GET /api/conversations - List active conversations for the current user
router.get('/', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      userId: req.user.id,
      isArchived: false
    }).sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// POST /api/conversations - Create a new conversation
router.post('/', auth, async (req, res) => {
  try {
    const {
      title = 'New Chat',
      model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL
    } = req.body;

    const conversation = await Conversation.create({
      userId: req.user.id,
      title: title.trim() || 'New Chat',
      model: isGeminiModelName(model) ? model.trim() : DEFAULT_MODEL,
      isArchived: false
    });

    res.status(201).json(conversation);
  } catch (err) {
    console.error('Error creating conversation:', err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// GET /api/conversations/:id/messages - Fetch messages for a conversation
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// DELETE /api/conversations/:id - Delete a conversation and its messages
router.delete('/:id', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await Message.deleteMany({ conversationId: conversation._id });
    res.json({ deleted: true, id: req.params.id });
  } catch (err) {
    console.error('Error deleting conversation:', err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// POST /api/conversations/:id/stream - Stream assistant response via SSE
router.post('/:id/stream', auth, async (req, res) => {
  try {
    const { content, systemInstruction } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Persist user message
    const userMessage = await Message.create({
      conversationId: conversation._id,
      userId: req.user.id,
      role: 'user',
      content: content.trim()
    });

    // Build prior history for multi-turn context
    const existingMessages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(40);

    const contents = existingMessages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Configure Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const { stream, modelUsed } = await createGeminiStream({
      contents,
      systemInstruction,
      requestedModel: conversation.model
    });

    let fullResponse = '';

    for await (const chunk of stream) {
      const token = extractChunkText(chunk);
      if (token) {
        fullResponse += token;
        res.write(`data: ${JSON.stringify({ token, content: fullResponse })}\n\n`);
      }
    }

    // Save completed assistant message
    const assistantMessage = await Message.create({
      conversationId: conversation._id,
      userId: req.user.id,
      role: 'assistant',
      content: fullResponse
    });

    // Update conversation metadata
    const updateFields = {
      model: modelUsed,
      updatedAt: new Date()
    };
    if (!conversation.title || conversation.title === 'New Chat') {
      updateFields.title = content.trim().slice(0, 50);
    }
    await Conversation.updateOne({ _id: conversation._id }, { $set: updateFields });

    res.write(
      `data: ${JSON.stringify({
        done: true,
        content: fullResponse,
        userMessageId: userMessage._id,
        assistantMessageId: assistantMessage._id,
        model: modelUsed
      })}\n\n`
    );
    res.end();
  } catch (err) {
    console.error('Streaming error:', err);
    if (!res.headersSent) {
      return res.status(err?.status || 500).json({
        error: err?.message || 'Failed to stream response from Gemini'
      });
    }
    res.write(
      `data: ${JSON.stringify({
        error: err?.message || 'Stream interrupted',
        done: true
      })}\n\n`
    );
    res.end();
  }
});

module.exports = router;