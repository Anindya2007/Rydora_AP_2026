import type { Request, Response, NextFunction } from 'express';
import {
  alertIdParamSchema,
  createSOSAlertSchema,
  listSOSAlertsQuerySchema,
  resolveSOSAlertSchema,
} from '../validators/sos.validator.js';
import { sosService } from '../services/sos.service.js';
import { emergencyNotificationService } from '../services/emergency-notification.service.js';
import { sendSuccess } from '../utils/response.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Helper to check if authenticated user possesses the platform ADMIN role.
 */
function isUserAdmin(req: Request): boolean {
  return Boolean(req.user?.roles && req.user.roles.includes('ADMIN'));
}

/**
 * Controller handling SOS alert activation (POST /api/v1/sos).
 */
export async function triggerSOS(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const validatedData = createSOSAlertSchema.parse(req.body);
    const result = await sosService.createSOSAlert(
      req.user.userId,
      validatedData
    );

    sendSuccess(res, result, 'SOS alert activated successfully', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling retrieval of active SOS alerts where caller is a safety guardian (GET /api/v1/sos/guardian-alerts).
 */
export async function getGuardianAlerts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const userPhone = req.user.phone;
    if (!userPhone) {
      sendSuccess(res, { alerts: [] }, 'No guardian alerts found', 200);
      return;
    }

    const alerts = await sosService.getGuardianActiveAlerts(userPhone);
    sendSuccess(res, { alerts }, 'Guardian alerts retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling retrieval of currently active SOS alert (GET /api/v1/sos/active).
 */
export async function getActiveSOS(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const result = await sosService.getActiveSOSAlert(req.user.userId);
    sendSuccess(res, result, 'Active SOS alert retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling retrieval of single SOS alert by ID (GET /api/v1/sos/:alertId).
 */
export async function getSOSById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { alertId } = alertIdParamSchema.parse(req.params);
    const isAdmin = isUserAdmin(req);
    const result = await sosService.getSOSAlertById(
      req.user.userId,
      alertId,
      isAdmin
    );

    sendSuccess(res, result, 'SOS alert retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling listing user's SOS alert history (GET /api/v1/sos/me).
 */
export async function listUserAlerts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const query = listSOSAlertsQuerySchema.parse(req.query);
    const result = await sosService.listUserSOSAlerts(
      req.user.userId,
      query
    );

    sendSuccess(
      res,
      { alerts: result.alerts },
      'SOS alerts retrieved successfully',
      200,
      result.pagination
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling resolution of an active SOS alert (PATCH /api/v1/sos/:alertId/resolve).
 */
export async function resolveSOS(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { alertId } = alertIdParamSchema.parse(req.params);
    const body = resolveSOSAlertSchema.parse(req.body || {});
    const notes = body.notes || body.resolutionNotes || null;
    const isAdmin = isUserAdmin(req);

    const alert = await sosService.resolveSOSAlert(
      req.user.userId,
      alertId,
      isAdmin,
      notes
    );

    sendSuccess(res, { alert }, 'SOS alert resolved successfully', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling cancellation of an active SOS alert (PATCH /api/v1/sos/:alertId/cancel).
 */
export async function cancelSOS(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { alertId } = alertIdParamSchema.parse(req.params);
    const isAdmin = isUserAdmin(req);

    const alert = await sosService.cancelSOSAlert(
      req.user.userId,
      alertId,
      isAdmin
    );

    sendSuccess(res, { alert }, 'SOS alert cancelled successfully', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling retrieval of emergency notification delivery logs for an alert (GET /api/v1/sos/:alertId/notifications).
 */
export async function getAlertNotifications(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { alertId } = alertIdParamSchema.parse(req.params);
    const isAdmin = isUserAdmin(req);

    const notifications = await emergencyNotificationService.getAlertNotifications(
      req.user.userId,
      alertId,
      isAdmin
    );

    sendSuccess(
      res,
      { notifications },
      'SOS alert notifications retrieved successfully',
      200
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling retry/re-escalation of failed notifications for an active alert (POST /api/v1/sos/:alertId/notifications/retry).
 */
export async function retryNotifications(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { alertId } = alertIdParamSchema.parse(req.params);
    const isAdmin = isUserAdmin(req);

    const notifications = await emergencyNotificationService.retryFailedNotifications(
      req.user.userId,
      alertId,
      isAdmin
    );

    sendSuccess(
      res,
      { notifications },
      'SOS alert notifications re-escalated successfully',
      200
    );
  } catch (error) {
    next(error);
  }
}

export const SOSController = {
  triggerSOS,
  getActiveSOS,
  getGuardianAlerts,
  getSOSById,
  listUserAlerts,
  resolveSOS,
  cancelSOS,
  getAlertNotifications,
  retryNotifications,
};
