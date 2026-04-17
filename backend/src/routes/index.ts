import { Router } from 'express';
import catalogRouter from './catalog.js';
import customersRouter from './customers.js';

const router = Router();

router.use('/catalog', catalogRouter);
router.use('/customers', customersRouter);

export default router;
