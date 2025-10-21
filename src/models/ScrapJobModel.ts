import mongoose, { Schema, Document } from 'mongoose';
import { PlatformType } from '../utils/const';

export interface IScrapJob extends Document {
    jobId: string; // Unique identifier for the scrap job
    organizationId: mongoose.Types.ObjectId; // Organization that initiated the job
    userId: mongoose.Types.ObjectId; // User who initiated the job
    influencerId: mongoose.Types.ObjectId; // Specific influencer being scraped (if applicable)
    platform: PlatformType; // Platform being scraped
    jobType: 'profile' | 'posts' | 'full_sync'; // Type of scraping job
    status: 'pending' | 'processing' | 'completed' | 'failed'; // Job status
    targetUrl?: string; // URL being scraped
    metadata?: Record<string, any>; // Additional job metadata
    startedAt: Date; // When the job was initiated
    completedAt?: Date; // When the job was completed
    errorMessage?: string; // Error message if job failed
    createdAt: Date;
}

const ScrapJobSchema: Schema = new Schema({
    jobId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    influencerId: {
        type: Schema.Types.ObjectId,
        ref: 'Influencer',
        required: true,
    },
    platform: {
        type: String,
        required: true,
        enum: Object.values(PlatformType),
    },
    jobType: {
        type: String,
        required: true,
        enum: ['profile', 'posts'],
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
    },
    targetUrl: {
        type: String,
        trim: true,
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {},
    },
    startedAt: {
        type: Date,
        required: true,
    },
    completedAt: {
        type: Date,
    },
    errorMessage: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Indexes for efficient queries
ScrapJobSchema.index({ organizationId: 1, status: 1 });
ScrapJobSchema.index({ userId: 1, status: 1 });
ScrapJobSchema.index({ jobId: 1 });
ScrapJobSchema.index({ status: 1, startedAt: -1 });
ScrapJobSchema.index({ influencerId: 1, status: 1 });

export const ScrapJobModel = mongoose.model<IScrapJob>('ScrapJob', ScrapJobSchema);
