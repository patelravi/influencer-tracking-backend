import { Request, Response, Router } from 'express';
import Stripe from 'stripe';
import { SubscriptionModel } from '../models/SubscriptionModel';
import { Logger } from '../utils/logger';
import { EnvConfig } from '../utils/config';
import { authenticate } from '../middleware/auth';
import express from 'express';

export class SubscriptionController {
    public buildRouter(): Router {
        const router = Router();

        // Webhook route (must be before express.json() middleware)
        router.post('/webhook', express.raw({ type: 'application/json' }), this.handleWebhook.bind(this));

        // Authenticated routes
        router.get('/', authenticate, this.getSubscription.bind(this));
        router.post('/create-checkout-session', authenticate, this.createCheckoutSession.bind(this));

        return router;
    }

    private getStripeInstance = () => {
        return new Stripe(EnvConfig.get('STRIPE_SECRET_KEY'), {
            apiVersion: '2023-10-16',
        });
    };

    private getSubscription = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId = (req as any).organizationId;
            let subscription = await SubscriptionModel.findOne({ organizationId });

            if (!subscription) {
                // Create free subscription if none exists
                const oneYearFromNow = new Date();
                oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

                subscription = await SubscriptionModel.create({
                    organizationId,
                    plan: 'free',
                    startDate: new Date(),
                    endDate: oneYearFromNow,
                    status: 'active',
                });
            }

            res.json({ subscription });
        } catch (error) {
            Logger.error('Get subscription error:', error);
            res.status(500).json({ error: 'Failed to fetch subscription' });
        }
    };

    private createCheckoutSession = async (req: Request, res: Response): Promise<void> => {
        try {
            const { plan } = req.body;

            if (!['starter', 'pro'].includes(plan)) {
                res.status(400).json({ error: 'Invalid plan' });
                return;
            }

            // Map plan to Stripe price ID
            const priceIds: { [key: string]: string } = {
                starter: EnvConfig.get('STRIPE_STARTER_PRICE_ID'),
                pro: EnvConfig.get('STRIPE_PRO_PRICE_ID'),
            };

            const priceId = priceIds[plan];

            if (!priceId) {
                res.status(500).json({ error: 'Plan configuration error' });
                return;
            }

            // Create Stripe checkout session
            const organizationId = (req as any).organizationId;
            const session = await getStripeInstance().checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                success_url: `${EnvConfig.get('FRONTEND_URL')}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${EnvConfig.get('FRONTEND_URL')}/subscription`,
                client_reference_id: organizationId,
                metadata: {
                    organizationId: organizationId as string,
                    plan,
                },
            });

            res.json({ sessionUrl: session.url });
        } catch (error) {
            Logger.error('Create checkout session error:', error);
            res.status(500).json({ error: 'Failed to create checkout session' });
        }
    };

    private handleWebhook = async (req: Request, res: Response): Promise<void> => {
        const sig = req.headers['stripe-signature'] as string;

        try {
            const stripe = this.getStripeInstance();
            const event = stripe.webhooks.constructEvent(
                req.body,
                sig,
                EnvConfig.get('STRIPE_WEBHOOK_SECRET')
            );

            // Handle different event types
            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object as Stripe.Checkout.Session;
                    const organizationId = session.metadata?.organizationId;
                    const plan = session.metadata?.plan as 'starter' | 'pro';

                    if (organizationId && plan) {
                        // Update or create subscription
                        const oneYearFromNow = new Date();
                        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

                        await SubscriptionModel.findOneAndUpdate(
                            { organizationId },
                            {
                                plan,
                                startDate: new Date(),
                                endDate: oneYearFromNow,
                                status: 'active',
                                stripeCustomerId: session.customer as string,
                                stripeSubscriptionId: session.subscription as string,
                            },
                            { upsert: true }
                        );

                        Logger.info(`Subscription updated for organization ${organizationId} to ${plan}`);
                    }
                    break;
                }

                case 'customer.subscription.deleted': {
                    const subscription = event.data.object as Stripe.Subscription;
                    await SubscriptionModel.findOneAndUpdate(
                        { stripeSubscriptionId: subscription.id },
                        { status: 'cancelled' }
                    );
                    Logger.info(`Subscription cancelled: ${subscription.id}`);
                    break;
                }

                default:
                    Logger.info(`Unhandled event type: ${event.type}`);
            }

            res.json({ received: true });
        } catch (error) {
            Logger.error('Webhook error:', error);
            res.status(400).json({ error: 'Webhook error' });
        }
    }
}

