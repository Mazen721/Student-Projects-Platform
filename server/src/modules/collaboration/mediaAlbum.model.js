import mongoose from 'mongoose';

const mediaAlbumSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    order: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true }
);

mediaAlbumSchema.index({ projectId: 1, order: 1, createdAt: 1 });

const MediaAlbum = mongoose.models.MediaAlbum || mongoose.model('MediaAlbum', mediaAlbumSchema);
export default MediaAlbum;
