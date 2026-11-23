import type { Request, Response, NextFunction } from 'express';
import {
  contactIdParamSchema,
  createEmergencyContactSchema,
  updateEmergencyContactSchema,
} from '../validators/emergency-contact.validator.js';
import { emergencyContactService } from '../services/emergency-contact.service.js';
import { sendSuccess } from '../utils/response.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Controller handling emergency contact creation (POST /api/v1/emergency-contacts).
 */
export async function createEmergencyContact(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const validatedData = createEmergencyContactSchema.parse(req.body);
    const contact = await emergencyContactService.createEmergencyContact(
      req.user.userId,
      validatedData
    );

    sendSuccess(res, { contact }, 'Emergency contact added successfully', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling listing of user's emergency contacts (GET /api/v1/emergency-contacts).
 */
export async function listEmergencyContacts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const contacts = await emergencyContactService.listEmergencyContacts(
      req.user.userId
    );

    sendSuccess(res, { contacts }, 'Emergency contacts retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling single emergency contact retrieval (GET /api/v1/emergency-contacts/:contactId).
 */
export async function getEmergencyContactById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { contactId } = contactIdParamSchema.parse(req.params);
    const contact = await emergencyContactService.getEmergencyContactById(
      req.user.userId,
      contactId
    );

    sendSuccess(res, { contact }, 'Emergency contact retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling emergency contact update (PATCH /api/v1/emergency-contacts/:contactId).
 */
export async function updateEmergencyContact(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { contactId } = contactIdParamSchema.parse(req.params);
    const validatedData = updateEmergencyContactSchema.parse(req.body);
    const contact = await emergencyContactService.updateEmergencyContact(
      req.user.userId,
      contactId,
      validatedData
    );

    sendSuccess(res, { contact }, 'Emergency contact updated successfully', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling emergency contact deletion (DELETE /api/v1/emergency-contacts/:contactId).
 */
export async function deleteEmergencyContact(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { contactId } = contactIdParamSchema.parse(req.params);
    await emergencyContactService.deleteEmergencyContact(
      req.user.userId,
      contactId
    );

    sendSuccess(res, null, 'Emergency contact deleted successfully', 200);
  } catch (error) {
    next(error);
  }
}

export const EmergencyContactController = {
  createEmergencyContact,
  listEmergencyContacts,
  getEmergencyContactById,
  updateEmergencyContact,
  deleteEmergencyContact,
};
