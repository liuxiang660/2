import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController';
import { asyncHandler } from '../middleware';

const router = Router();

router.get('/', asyncHandler((req, res) => dashboardController.getDashboard(req as any, res)));
router.get('/metrics', asyncHandler((req, res) => dashboardController.getMetrics(req as any, res)));
router.get('/risk-index', asyncHandler((req, res) => dashboardController.getRiskIndex(req as any, res)));

export default router;
