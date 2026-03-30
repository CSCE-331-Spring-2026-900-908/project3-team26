import { Router } from 'express';
import { query, withClient } from '../db/pool.js';
import { getSchemaSupport } from '../db/compat.js';
import { buildXReport, buildZPreview } from '../services/reporting.js';

const router = Router();
