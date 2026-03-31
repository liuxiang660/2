import { Router } from 'express';
import { Request, Response } from 'express';
import { productController, subscriptionController, productPortraitController } from '../controllers/productController';
import { asyncHandler } from '../middleware';

const router = Router();

// Products routes
router.get('/products', asyncHandler((req: Request, res: Response) => productController.getProducts(req as any, res)));
router.post('/products', asyncHandler((req: Request, res: Response) => productController.createProduct(req as any, res)));
router.put('/products/:id', asyncHandler((req: Request, res: Response) => productController.updateProduct(req as any, res)));
router.delete('/products/:id', asyncHandler((req: Request, res: Response) => productController.deleteProduct(req as any, res)));

// Product portrait routes
router.get('/product-portrait', asyncHandler((req: Request, res: Response) => productPortraitController.getProductPortrait(req as any, res)));
router.get('/product-portrait/options', asyncHandler((req: Request, res: Response) => productPortraitController.getProductPortraitOptions(req as any, res)));
router.put('/product-portrait/config', asyncHandler((req: Request, res: Response) => productPortraitController.saveProductPortraitConfig(req as any, res)));
router.put('/product-portrait/rows', asyncHandler((req: Request, res: Response) => productPortraitController.saveProductPortraitRows(req as any, res)));
router.post('/product-portrait/rollback', asyncHandler((req: Request, res: Response) => productPortraitController.rollbackProductPortraitVersion(req as any, res)));

// Subscriptions routes
router.get('/subscriptions', asyncHandler((req: Request, res: Response) => subscriptionController.getSubscriptions(req as any, res)));
router.post('/subscriptions', asyncHandler((req: Request, res: Response) => subscriptionController.createSubscription(req as any, res)));
router.delete('/subscriptions/:id', asyncHandler((req: Request, res: Response) => subscriptionController.deleteSubscription(req as any, res)));

export default router;
