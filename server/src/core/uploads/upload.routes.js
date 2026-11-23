import { Router } from 'express';
import { signUploadSchema } from '@spp/shared/schemas';
import { authorize } from '../authz/authorize.js';
import { validate } from '../validation/validate.js';
import { signDirectUpload } from './cloudinarySign.js';

export function createUploadRouter(uploadSignLimiter) {
  const router = Router();

  const handlers = [
    ...(uploadSignLimiter ? [uploadSignLimiter] : []),
    authorize('upload.sign', 'upload'),
    validate({ body: signUploadSchema }),
    async (req, res, next) => {
      try {
        const result = await signDirectUpload({
          userId: req.user.id,
          ...req.body,
        });
        res.status(200).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  ];

  router.post('/sign', ...handlers);

  return router;
}
