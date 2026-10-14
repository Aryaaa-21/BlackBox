/**
 * Phase 9 — Product Polish & Demo Mode
 * Demo Controller — HTTP endpoints for demo environment reset, conflict triggers,
 * and demo credentials retrieval.
 */

import { Request, Response, NextFunction } from 'express';
import { demoService } from '../services/demo.service';

export class DemoController {
  async resetDemo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await demoService.resetDemo();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async triggerConflict(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { missionId } = req.body;
      const result = await demoService.triggerSimulatedConflict(missionId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDemoInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await demoService.getDemoInfo();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const demoController = new DemoController();
