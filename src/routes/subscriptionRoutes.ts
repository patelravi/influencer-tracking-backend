import { Router } from 'express';
import { getSubscription, createCheckoutSession, handleWebhook } from '../controllers/subscriptionController';
import { authenticate } from '../middleware/auth';
import express from 'express';

const router = Router();

// Webhook route (must be before express.json() middleware)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Authenticated routes
router.get('/', authenticate, getSubscription);
router.post('/create-checkout-session', authenticate, createCheckoutSession);

export default router;

