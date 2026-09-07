import { z } from 'zod';
import { getSupabaseAdmin } from '@/server/config/supabase';
import {
  apiErrorResponse,
  authenticateRequest,
  authorizeRequest,
} from '@/server/lib/api';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ propertyId: string }> };

const enquirySchema = z.object({
  source: z.enum(['listing', 'reel', 'requirement']).optional(),
  type: z.enum(['call', 'chat', 'enquiry']).optional(),
  notes: z.string().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = authenticateRequest(request);
    authorizeRequest(user, 'user');
    const body = enquirySchema.parse(await request.json());
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

    const { data: enquiry, error } = await supabase
      .from('enquiries')
      .insert({
        customer_id: user.id,
        property_id: property.id,
        assigned_to: property.seller_id,
        source: body.source ?? 'listing',
        type: body.type ?? 'enquiry',
        notes: body.notes,
      })
      .select()
      .single();
    if (error) throw error;

    return Response.json({ enquiry }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
