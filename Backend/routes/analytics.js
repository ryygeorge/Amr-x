// Backend/routes/analytics.js
// RWUI Analytics API

import express from 'express';
import { getRWUIMetrics, getRWUISummary } from '../services/rwuiService.js';

const router = express.Router();

/**
 * GET /api/analytics/rwui
 * Get RWUI (resistance rate) metrics from pharmacist_entries
 * 
 * Query params:
 * - organism: Filter by organism name (optional)
 * - district: Filter by district (optional)
 * - time_window: Days to look back, default 30 (optional)
 * 
 * Example: GET /api/analytics/rwui?district=Kottayam
 */
router.get('/rwui', async (req, res) => {
  try {
    const { organism, district, time_window } = req.query;
    
    const metrics = await getRWUIMetrics({
      organism,
      district,
      time_window: time_window ? parseInt(time_window) : 30
    });
    
    res.json({
      ok: true,
      data: metrics,
      count: metrics.length,
      filters: { organism, district, time_window }
    });
  } catch (error) {
    console.error('RWUI error:', error.message);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/summary
 * Get aggregated resistance statistics
 * 
 * Query params:
 * - district: Filter by district (optional)
 * - time_window: Days to look back, default 30 (optional)
 * 
 * Example: GET /api/analytics/summary?district=Kottayam
 */
router.get('/summary', async (req, res) => {
  try {
    const { district, time_window } = req.query;
    
    const summary = await getRWUISummary({
      district,
      time_window: time_window ? parseInt(time_window) : 30
    });
    
    res.json({
      ok: true,
      summary,
      filters: { district, time_window }
    });
  } catch (error) {
    console.error('Summary error:', error.message);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/health
 * Health check
 */
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    status: 'analytics service ready'
  });
});

export default router;
