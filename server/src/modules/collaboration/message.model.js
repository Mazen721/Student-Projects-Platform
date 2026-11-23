import mongoose from 'mongoose';
import { MAX_MESSAGE_LENGTH } from '@spp/shared/constants';
import { fileRefSchema } from '../../core/schemas/fileRef.schema.js';

const readReceiptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const removedMetaSchema = new mongoose.Schema(
  {
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
    reason: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, trim: true, maxlength: MAX_MESSAGE_LENGTH, default: '' },
    textNormalized: { type: String, trim: true, default: '' },
    attachments: { type: [fileRefSchema], default: [] },
    replyToId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    mentions: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    readBy: { type: [readReceiptSchema], default: [] },
    removed: { type: removedMetaSchema, default: null },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ channelId: 1, createdAt: -1 });
messageSchema.index({ channelId: 1, _id: -1 });

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
export default Message;
