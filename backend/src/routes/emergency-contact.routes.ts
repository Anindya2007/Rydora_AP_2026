import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  contactIdParamSchema,
  createEmergencyContactSchema,
  updateEmergencyContactSchema,
} from '../validators/emergency-contact.validator.js';
import { EmergencyContactController } from '../controllers/emergency-contact.controller.js';

export const emergencyContactRouter = Router();

/**
 * Validation middleware for emergency contact creation.
 */
export const validateCreateEmergencyContact = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.body = createEmergencyContactSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validation middleware for emergency contact updates.
 */
export const validateUpdateEmergencyContact = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.body = updateEmergencyContactSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validation middleware for contactId UUID route parameters.
 */
export const validateContactIdParam = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    contactIdParamSchema.parse(req.params);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/emergency-contacts
 * Add a new emergency contact for authenticated user.
 */
emergencyContactRouter.post(
  '/',
  authenticate,
  validateCreateEmergencyContact,
  EmergencyContactController.createEmergencyContact
);

/**
 * GET /api/v1/emergency-contacts
 * View all saved emergency contacts for authenticated user.
 */
emergencyContactRouter.get(
  '/',
  authenticate,
  EmergencyContactController.listEmergencyContacts
);

/**
 * GET /api/v1/emergency-contacts/:contactId
 * View a specific emergency contact (ownership enforced).
 */
emergencyContactRouter.get(
  '/:contactId',
  authenticate,
  validateContactIdParam,
  EmergencyContactController.getEmergencyContactById
);

/**
 * PATCH /api/v1/emergency-contacts/:contactId
 * PUT   /api/v1/emergency-contacts/:contactId
 * Update an existing emergency contact (ownership enforced).
 */
emergencyContactRouter.patch(
  '/:contactId',
  authenticate,
  validateContactIdParam,
  validateUpdateEmergencyContact,
  EmergencyContactController.updateEmergencyContact
);

emergencyContactRouter.put(
  '/:contactId',
  authenticate,
  validateContactIdParam,
  validateUpdateEmergencyContact,
  EmergencyContactController.updateEmergencyContact
);

/**
 * DELETE /api/v1/emergency-contacts/:contactId
 * Delete an existing emergency contact (ownership enforced).
 */
emergencyContactRouter.delete(
  '/:contactId',
  authenticate,
  validateContactIdParam,
  EmergencyContactController.deleteEmergencyContact
);
