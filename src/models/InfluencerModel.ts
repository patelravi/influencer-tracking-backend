import mongoose, { Schema, Document } from 'mongoose';
import { PlatformType } from '../utils/const';

export interface IInfluencer extends Document {
    name: string;
    platform: PlatformType;
    handle: string;
    userId: mongoose.Types.ObjectId; // User who added the influencer
    organizationId: mongoose.Types.ObjectId; // Organization tracking the influencer
    platformUserId?: string; // Social media platform's unique ID for the influencer
    avatarUrl?: string;
    bio?: string; // Profile bio/description
    followerCount?: number; // Number of followers/subscribers
    verified?: boolean; // Whether the account is verified
    lastProfileSync?: Date; // Last time profile data was synced
    isPostSyncing?: boolean; // Whether posts are currently being synced
    isProfileSyncing?: boolean; // Whether profile is currently being synced
    lastSyncAttempt?: Date; // Last time any sync was attempted
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
        enum: Object.values(PlatformType),
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
    lastProfileSync: {
        type: Date,
    },
    isPostSyncing: {
        type: Boolean,
        default: false,
    },
    isProfileSyncing: {
        type: Boolean,
        default: false,
    },
    lastSyncAttempt: {
        type: Date,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound index for organization's influencers and preventing duplicates
InfluencerSchema.index({ organizationId: 1, platform: 1, handle: 1 }, { unique: true });
InfluencerSchema.index({ userId: 1 });
// Index for sync status queries
InfluencerSchema.index({ isPostSyncing: 1, isProfileSyncing: 1 });

export const InfluencerModel = mongoose.model<IInfluencer>('Influencer', InfluencerSchema);

