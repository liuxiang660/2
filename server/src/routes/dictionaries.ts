import { Router } from 'express';
import {
  getAllDictionaries,
  getProductClassification,
  getRiskClassification,
  getSupplychainProcess,
  getSupplychainTopology,
  getMediaSources,
  getGeographicData,
  getDisasterClassification,
} from '../controllers/dictController';

const router = Router();

// 获取所有字典表
router.get('/all', getAllDictionaries);

// 获取产品分类树
router.get('/product-classification', getProductClassification);

// 获取风险分类树
router.get('/risk-classification', getRiskClassification);

// 获取供应链流程
router.get('/supplychain-process', getSupplychainProcess);

// 获取供应链拓扑（节点+关系）
router.get('/supplychain-topology', getSupplychainTopology);

// 获取媒体数据源
router.get('/media-sources', getMediaSources);

// 获取地理信息
router.get('/geographic-data', getGeographicData);

// 获取自然灾害分类
router.get('/disaster-classification', getDisasterClassification);

export default router;
