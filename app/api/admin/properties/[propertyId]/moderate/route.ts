import { z } from 'zod';
import { getSupabaseAdmin } from '@/server/config/supabase';
import {
  apiErrorResponse,
  authenticateRequest,
  authorizeRequest,
} from '@/server/lib/api';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ propertyId: string }> };

const moderationSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  verified: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = authenticateRequest(request);
    authorizeRequest(user, 'admin');
    const body = moderationSchema.parse(await request.json());
    const { propertyId } = await context.params;

    const { data: property, error } = await getSupabaseAdmin()
      .from('properties')
      .update({
        moderation_status: body.status,
        verified: body.status === 'approved' && Boolean(body.verified),
      })
      .eq('id', propertyId)
      .select()
      .maybeSingle();
    if (error) throw error;

    if (!property) {
      return Response.json({ message: 'Property not found' }, { status: 404 });
    }

    return Response.json({ property });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
