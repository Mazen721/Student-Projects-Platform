import mongoose from 'mongoose';

export const fileRefSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    resourceType: { type: String, enum: ['image', 'raw'], required: true },
    deliveryType: { type: String, enum: ['upload', 'authenticated'], required: true },
    format: { type: String, required: true, trim: true },
    bytes: { type: Number, required: true, min: 1 },
    originalName: { type: String, trim: true },
  },
  { _id: false }
);
