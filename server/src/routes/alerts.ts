import { Router } from 'express';
import { alertController } from '../controllers/alertController';
import { asyncHandler } from '../middleware';

const router = Router();

router.get('/', asyncHandler((req, res) => alertController.getAlerts(req as any, res)));
router.post('/', asyncHandler((req, res) => alertController.createAlert(req as any, res)));
router.put('/:id/read', asyncHandler((req, res) => alertController.markAsRead(req as any, res)));
router.delete('/:id', asyncHandler((req, res) => alertController.deleteAlert(req as any, res)));

export default router;
