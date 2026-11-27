const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  attachments: [{
    type: { type: String, enum: ['image', 'file'] },
    url: String,
    name: String
  }],
  feedback: { type: String, enum: ['up', 'down', null], default: null },
  suggestedActions: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
