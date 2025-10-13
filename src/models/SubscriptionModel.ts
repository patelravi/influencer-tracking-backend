import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
    organizationId: mongoose.Types.ObjectId;
    plan: 'free' | 'starter' | 'pro';
    startDate: Date;
    endDate: Date;
    status: 'active' | 'inactive' | 'cancelled';
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    createdAt: Date;
}

const SubscriptionSchema: Schema = new Schema({
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        unique: true,
    },
    plan: {
        type: String,
        enum: ['free', 'starter', 'pro'],
        default: 'free',
    },
    startDate: {
        type: Date,
        default: Date.now,
    },
    endDate: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'cancelled'],
        default: 'active',
    },
    stripeCustomerId: {
        type: String,
    },
    stripeSubscriptionId: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Index for organization lookups
SubscriptionSchema.index({ organizationId: 1 });

export const SubscriptionModel = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

