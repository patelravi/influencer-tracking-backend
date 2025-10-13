import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganization extends Document {
    name: string;
    createdBy: mongoose.Types.ObjectId; // User who created the organization
    createdAt: Date;
}

const OrganizationSchema: Schema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Index for faster lookups
OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ createdBy: 1 });

export const OrganizationModel = mongoose.model<IOrganization>('Organization', OrganizationSchema);

