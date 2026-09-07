import { z } from 'zod';
import { getSupabaseAdmin } from '@/server/config/supabase';
import {
  apiErrorResponse,
  authenticateRequest,
  authorizeRequest,
} from '@/server/lib/api';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ propertyId: string }> };

const siteVisitSchema = z.object({
  requestedAt: z.coerce.date(),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = authenticateRequest(request);
    authorizeRequest(user, 'user');
    const body = siteVisitSchema.parse(await request.json());
    const { propertyId } = await context.params;
    const supabase = getSupabaseAdmin();
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, seller_id')
      .eq('id', propertyId)
      .maybeSingle();
    if (propertyError) throw propertyError;
    if (!property) {
      return Response.json({ message: 'Property not found' }, { status: 404 });
    }

    const { data: visit, error } = await supabase
      .from('site_visits')
      .insert({
        property_id: property.id,
        buyer_id: user.id,
        seller_id: property.seller_id,
        requested_at: body.requestedAt.toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    return Response.json({ visit }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
