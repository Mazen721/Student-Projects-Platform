import mongoose from 'mongoose';
import {
  LINK_KIND_VALUES,
  MEDIA_KIND_VALUES,
  MEDIA_VISIBILITY,
  MEDIA_VISIBILITY_VALUES,
} from '@spp/shared/constants';
import { fileRefSchema } from '../../core/schemas/fileRef.schema.js';

const linkRefSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: LINK_KIND_VALUES, required: true },
    url: { type: String, required: true, trim: true, maxlength: 500 },
    title: { type: String, trim: true, maxlength: 150 },
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

const mediaItemSchema = new mongoose.Schema(
  {
    albumId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAlbum', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    kind: { type: String, enum: MEDIA_KIND_VALUES, required: true },
    file: { type: fileRefSchema, default: null },
    link: { type: linkRefSchema, default: null },
    caption: { type: String, trim: true, maxlength: 300, default: '' },
    visibility: {
      type: String,
      enum: MEDIA_VISIBILITY_VALUES,
      default: MEDIA_VISIBILITY.PRIVATE,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    removed: { type: removedMetaSchema, default: null },
  },
  { timestamps: true }
);

mediaItemSchema.index({ projectId: 1, visibility: 1 });
mediaItemSchema.index({ albumId: 1, createdAt: 1 });

const MediaItem = mongoose.models.MediaItem || mongoose.model('MediaItem', mediaItemSchema);
export default MediaItem;
