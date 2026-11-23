import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  alertIdParamSchema,
  createSOSAlertSchema,
  listSOSAlertsQuerySchema,
  resolveSOSAlertSchema,
} from '../validators/sos.validator.js';
import { SOSController } from '../controllers/sos.controller.js';

export const sosRouter = Router();

/**
 * Validation middleware for SOS alert activation.
 */
export const validateCreateSOSAlert = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.body = createSOSAlertSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validation middleware for alertId UUID route parameters.
 */
export const validateAlertIdParam = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    alertIdParamSchema.parse(req.params);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validation middleware for SOS history query parameters.
 */
export const validateListSOSAlerts = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    listSOSAlertsQuerySchema.parse(req.query);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validation middleware for SOS resolution body.
 */
export const validateResolveSOSAlert = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.body = resolveSOSAlertSchema.parse(req.body || {});
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/sos
 * Trigger/activate an SOS emergency alert.
 */
sosRouter.post(
  '/',
  authenticate,
  validateCreateSOSAlert,
  SOSController.triggerSOS
);

/**
 * GET /api/v1/sos/active
 * Retrieve the currently active SOS alert for the authenticated user.
 */
sosRouter.get(
  '/active',
  authenticate,
  SOSController.getActiveSOS
);

/**
 * GET /api/v1/sos/me
 * List the authenticated user's SOS alert history with pagination.
 */
sosRouter.get(
  '/me',
  authenticate,
  validateListSOSAlerts,
  SOSController.listUserAlerts
);

/**
 * GET /api/v1/sos/:alertId
 * Retrieve details of a specific SOS alert by ID (owner or platform ADMIN).
 */
sosRouter.get(
  '/:alertId',
  authenticate,
  validateAlertIdParam,
  SOSController.getSOSById
);

/**
 * PATCH /api/v1/sos/:alertId/resolve
 * Mark an active SOS alert as RESOLVED (owner or platform ADMIN).
 */
sosRouter.patch(
  '/:alertId/resolve',
  authenticate,
  validateAlertIdParam,
  validateResolveSOSAlert,
  SOSController.resolveSOS
);

/**
 * PATCH /api/v1/sos/:alertId/cancel
 * Cancel an active SOS alert as a false alarm (owner or platform ADMIN).
 */
sosRouter.patch(
  '/:alertId/cancel',
  authenticate,
  validateAlertIdParam,
  SOSController.cancelSOS
);

/**
 * GET /api/v1/sos/:alertId/notifications
 * View emergency notification delivery audit logs for an alert (owner or platform ADMIN).
 */
sosRouter.get(
  '/:alertId/notifications',
  authenticate,
  validateAlertIdParam,
  SOSController.getAlertNotifications
);

/**
 * POST /api/v1/sos/:alertId/notifications/retry
 * Re-attempt dispatch for failed emergency notifications on an active alert.
 */
sosRouter.post(
  '/:alertId/notifications/retry',
  authenticate,
  validateAlertIdParam,
  SOSController.retryNotifications
);
