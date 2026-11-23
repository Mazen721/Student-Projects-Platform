import mongoose from 'mongoose';
import {
  CONTACT_REQUEST_STATE_VALUES,
  CONTACT_REQUEST_STATES,
} from '@spp/shared/constants';

const sharedContactsSchema = new mongoose.Schema(
  {
    email: { type: String, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 30 },
    other: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false }
);

const replySchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 1500 },
    sharedContacts: { type: sharedContactsSchema, default: undefined },
  },
  { _id: false }
);

const contactRequestSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    investorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true, maxlength: 1500 },
    state: {
      type: String,
      enum: CONTACT_REQUEST_STATE_VALUES,
      default: CONTACT_REQUEST_STATES.PENDING,
    },
    reply: { type: replySchema, default: undefined },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  },
  { timestamps: true }
);

contactRequestSchema.index({ projectId: 1, state: 1 });
contactRequestSchema.index({ investorId: 1, createdAt: -1 });
contactRequestSchema.index({ collegeId: 1, departmentId: 1, state: 1 });

const ContactRequest =
  mongoose.models.ContactRequest || mongoose.model('ContactRequest', contactRequestSchema);
export default ContactRequest;
