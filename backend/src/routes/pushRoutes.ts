import { Router, type Router as RouterType } from 'express';
import { pushController } from '../controllers/pushController';

const router: RouterType = Router();

// Subscribe to push notifications
router.post('/subscribe', pushController.subscribe);

// Unsubscribe from push notifications
router.post('/unsubscribe', pushController.unsubscribe);

// Send a test notification
router.post('/test', pushController.test);

// Get VAPID public key
router.get('/public-key', pushController.getPublicKey);

export default router;
