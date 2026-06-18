/**
 * Published JSON Schema artifact (T7.1). Generated from the zod
 * designPackageSchema so the schema can never drift from the runtime validator.
 * This is the integration contract downstream tools (3D, BIM/CAD) pin to.
 */
import { z } from 'zod';
import { designPackageSchema } from './schema';

export function designPackageJSONSchema(): Record<string, unknown> {
  return z.toJSONSchema(designPackageSchema, { target: 'draft-7' }) as Record<string, unknown>;
}
