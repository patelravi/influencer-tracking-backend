import { Request, Response, NextFunction } from 'express';
import { SubscriptionModel } from '../models/SubscriptionModel';
import { InfluencerModel } from '../models/InfluencerModel';

// Plan limits for influencers
const PLAN_LIMITS = {
    free: 1,
    starter: 10,
    pro: 50,
};

export const checkInfluencerLimit = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const organizationId = (req as any).organizationId;

        if (!organizationId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Get organization's subscription
        const subscription = await SubscriptionModel.findOne({ organizationId });

        if (!subscription || subscription.status !== 'active') {
            // Default to free plan
            const currentCount = await InfluencerModel.countDocuments({ organizationId });
            if (currentCount >= PLAN_LIMITS.free) {
                res.status(403).json({
                    error: 'Influencer limit reached',
                    message: 'Upgrade your plan to add more influencers',
                    currentLimit: PLAN_LIMITS.free,
                });
                return;
            }
        } else {
            // Check against subscription plan
            const limit = PLAN_LIMITS[subscription.plan];
            const currentCount = await InfluencerModel.countDocuments({ organizationId });

            if (currentCount >= limit) {
                res.status(403).json({
                    error: 'Influencer limit reached',
                    message: `Your ${subscription.plan} plan allows up to ${limit} influencers`,
                    currentLimit: limit,
                });
                return;
            }
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Error checking subscription limits' });
    }
};

