import mongoose, { Schema, Document } from 'mongoose';

export interface IInfluencer extends Document {
    name: string;
    platform: 'X' | 'YouTube' | 'Instagram' | 'LinkedIn';
    handle: string;
    userId: mongoose.Types.ObjectId; // User who added the influencer
    organizationId: mongoose.Types.ObjectId; // Organization tracking the influencer
    platformUserId?: string; // Social media platform's unique ID for the influencer
    avatarUrl?: string;
    bio?: string; // Profile bio/description
    followerCount?: number; // Number of followers/subscribers
    verified?: boolean; // Whether the account is verified
    createdAt: Date;
}

const InfluencerSchema: Schema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    platform: {
        type: String,
        required: true,
        enum: ['X', 'YouTube', 'Instagram', 'LinkedIn'],
    },
    handle: {
        type: String,
        required: true,
        trim: true,
    },
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
    platformUserId: {
        type: String,
        trim: true,
    },
    avatarUrl: {
        type: String,
    },
    bio: {
        type: String,
    },
    followerCount: {
        type: Number,
    },
    verified: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound index for organization's influencers and preventing duplicates
InfluencerSchema.index({ organizationId: 1, platform: 1, handle: 1 }, { unique: true });
InfluencerSchema.index({ userId: 1 });

export const InfluencerModel = mongoose.model<IInfluencer>('Influencer', InfluencerSchema);

