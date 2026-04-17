import { Router, Request, Response } from 'express';
import { getCatalogVersions, getRequirementsForVersion, getControlsForVersion } from '../db/queries.js';

const router = Router();

// GET /catalog/versions
router.get('/versions', (_req: Request, res: Response) => {
  res.json(getCatalogVersions());
});

// GET /catalog/:version/requirements
router.get('/:version/requirements', (req: Request, res: Response) => {
  res.json(getRequirementsForVersion(String(req.params.version)));
});

// GET /catalog/:version/controls
router.get('/:version/controls', (req: Request, res: Response) => {
  res.json(getControlsForVersion(String(req.params.version)));
});

export default router;
