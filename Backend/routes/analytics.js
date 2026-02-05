// Backend/routes/analytics.js
// RWUI Analytics API

import express from 'express';
import { getRWUIMetrics, getRWUISummary, calculatePressureRWUI, getPressureRWUISummary, getAntibioticPressureBreakdown } from '../services/rwuiService.js';

const router = express.Router();

/**
 * GET /api/analytics/rwui
 * Get RWUI (Resistance Pressure Index) metrics from pharmacist_entries
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

/**
 * GET /api/analytics/pressure
 * Get Resistance Pressure RWUI (v2) - ML-based pressure model
 * 
 * Query params:
 * - organism: Filter by organism name (optional)
 * - district: Filter by district (optional)
 * - time_window: Days to look back, default 30 (optional)
 * 
 * Example: GET /api/analytics/pressure?district=Palakkad
 */
router.get('/pressure', async (req, res) => {
  try {
    const { organism, district, time_window } = req.query;
    
    const metrics = await calculatePressureRWUI({
      organism,
      district,
      time_window: time_window ? parseInt(time_window) : 30
    });
    
    res.json({
      ok: true,
      data: metrics,
      count: metrics.length,
      filters: { organism, district, time_window },
      model: 'pressure'
    });
  } catch (error) {
    console.error('Pressure RWUI error:', error.message);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/pressure/summary
 * Get aggregated resistance pressure statistics
 * 
 * Query params:
 * - district: Filter by district (optional)
 * - time_window: Days to look back, default 30 (optional)
 */
router.get('/pressure/summary', async (req, res) => {
  try {
    const { district, time_window } = req.query;
    
    const summary = await getPressureRWUISummary({
      district,
      time_window: time_window ? parseInt(time_window) : 30
    });
    
    res.json({
      ok: true,
      data: summary,
      filters: { district, time_window },
      model: 'pressure'
    });
  } catch (error) {
    console.error('Pressure summary error:', error.message);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/pressure/antibiotics
 * Get antibiotic-level pressure breakdown for organism + district
 * Shows which antibiotics were used and how much each contributes to organism pressure
 * 
 * Query params:
 * - organism: Organism name (required for meaningful results)
 * - district: Filter by district (optional)
 * - time_window: Days to look back, default 30 (optional)
 * 
 * Example: GET /api/analytics/pressure/antibiotics?organism=Escherichia%20coli&district=Palakkad
 */
router.get('/pressure/antibiotics', async (req, res) => {
  try {
    const { organism, district, time_window } = req.query;
    
    const breakdown = await getAntibioticPressureBreakdown({
      organism,
      district,
      time_window: time_window ? parseInt(time_window) : 30
    });
    
    res.json({
      ok: true,
      data: breakdown,
      count: breakdown.length,
      filters: { organism, district, time_window },
      model: 'antibiotic_breakdown'
    });
  } catch (error) {
    console.error('Antibiotic breakdown error:', error.message);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

export default router;
