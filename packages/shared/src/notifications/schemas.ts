import { z } from "zod";

// Query params for GET /api/notifications (Issue 17). Coercion is for query-
// string values (all strings at the URL level) → typed values at the route
// level. Keyset pagination on (created_at, id) desc — `cursor` is an iso
// timestamp; rows with created_at strictly before it are returned.

export const notificationQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().datetime().optional(),
});

// Path param for POST /api/notifications/:id/read.
export const notificationIdSchema = z.object({
  id: z.string().uuid(),
});
