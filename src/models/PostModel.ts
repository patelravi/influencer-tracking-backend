import mongoose, { Schema, Document } from 'mongoose';

export interface IPost extends Document {
    influencerId: mongoose.Types.ObjectId;
    content: string;
    mediaUrls: string[];
    postUrl: string;
    likes: number;
    comments: number;
    shares: number;
    postedAt: Date;
    platformPostId: string; // Unique ID from the social platform
    createdAt: Date;
}

const PostSchema: Schema = new Schema({
    influencerId: {
        type: Schema.Types.ObjectId,
        ref: 'Influencer',
        required: true,
    },
    content: {
        type: String,
        default: '',
    },
    mediaUrls: {
        type: [String],
        default: [],
    },
    postUrl: {
        type: String,
        required: true,
    },
    likes: {
        type: Number,
        default: 0,
    },
    comments: {
        type: Number,
        default: 0,
    },
    shares: {
        type: Number,
        default: 0,
    },
    postedAt: {
        type: Date,
        required: true,
    },
    platformPostId: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Indexes for queries and preventing duplicate posts
PostSchema.index({ influencerId: 1, postedAt: -1 });
PostSchema.index({ platformPostId: 1 }, { unique: true });

export const PostModel = mongoose.model<IPost>('Post', PostSchema);

