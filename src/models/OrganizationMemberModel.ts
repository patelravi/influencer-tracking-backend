import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganizationMember extends Document {
    userId: mongoose.Types.ObjectId;
    organizationId: mongoose.Types.ObjectId;
    role: 'org_admin' | 'client';
    status: 'active' | 'inactive' | 'pending';
    joinedAt: Date;
    invitedBy?: mongoose.Types.ObjectId; // User who invited this member
}

const OrganizationMemberSchema: Schema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
    },
    role: {
        type: String,
        enum: ['org_admin', 'client'],
        default: 'client',
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'pending'],
        default: 'active',
    },
    joinedAt: {
        type: Date,
        default: Date.now,
    },
    invitedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
});

// Compound index to ensure a user can only have one membership per organization
OrganizationMemberSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

// Index for querying user's organizations
OrganizationMemberSchema.index({ userId: 1, status: 1 });

// Index for querying organization's members
OrganizationMemberSchema.index({ organizationId: 1, status: 1 });

export const OrganizationMemberModel = mongoose.model<IOrganizationMember>(
    'OrganizationMember',
    OrganizationMemberSchema
);

