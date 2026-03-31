import { Router } from 'express';
import { eventController } from '../controllers/eventController';
import { asyncHandler } from '../middleware';

const router = Router();

// Events routes
router.get('/', asyncHandler((req, res) => eventController.getEvents(req as any, res)));
router.post('/', asyncHandler((req, res) => eventController.createEvent(req as any, res)));
router.get('/:id', asyncHandler((req, res) => eventController.getEventById(req as any, res)));
router.put('/:id', asyncHandler((req, res) => eventController.updateEvent(req as any, res)));
router.delete('/:id', asyncHandler((req, res) => eventController.deleteEvent(req as any, res)));

// Evidence chain routes
router.post('/:id/evidence', asyncHandler((req, res) => eventController.addEvidence(req as any, res)));

// Risk map routes
router.get('/risk-map/points', asyncHandler((req, res) => eventController.getRiskMapPoints(req as any, res)));
router.get('/risk-map/heatmap', asyncHandler((req, res) => eventController.getRiskMapHeatmap(req as any, res)));
router.get('/risk-map/aggregation', asyncHandler((req, res) => eventController.getRiskMapAggregation(req as any, res)));
router.get('/risk-map/saved-views', asyncHandler((req, res) => eventController.getRiskMapSavedViews(req as any, res)));
router.post('/risk-map/save-view', asyncHandler((req, res) => eventController.saveRiskMapView(req as any, res)));

export default router;
