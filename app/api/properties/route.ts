import { z } from 'zod';
import { getSupabaseAdmin } from '@/server/config/supabase';
import {
  apiErrorResponse,
  authenticateRequest,
  authorizeRequest,
} from '@/server/lib/api';

export const runtime = 'nodejs';

const listingSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(20),
  type: z.string().min(2),
  purpose: z.enum(['Buy', 'Rent', 'Resale', 'Joint Venture']),
  sellerType: z.enum(['Owner', 'Broker', 'Builder', 'Promoter']),
  price: z.number().nonnegative(),
  city: z.string().min(2),
  locality: z.string().min(2),
});

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    let query = getSupabaseAdmin()
      .from('properties')
      .select('*')
      .eq('moderation_status', 'approved')
      .eq('availability', 'available')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    const city = searchParams.get('city');
    const locality = searchParams.get('locality');
    const type = searchParams.get('type');
    const purpose = searchParams.get('purpose');
    const maxPrice = searchParams.get('maxPrice');
    if (city) query = query.ilike('city', `%${city}%`);
    if (locality) query = query.ilike('locality', `%${locality}%`);
    if (type) query = query.eq('type', type);
    if (purpose) query = query.eq('purpose', purpose);
    if (maxPrice && Number.isFinite(Number(maxPrice))) query = query.lte('price', Number(maxPrice));

    const { data: items, error } = await query;
    if (error) throw error;

    return Response.json({ items: items ?? [] });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = authenticateRequest(request);
    authorizeRequest(user, 'broker');
    const input = listingSchema.parse(await request.json());
    const { data: property, error } = await getSupabaseAdmin()
      .from('properties')
      .insert({
        title: input.title,
        description: input.description,
        type: input.type,
        purpose: input.purpose,
        seller_type: input.sellerType,
        seller_id: user.id,
        price: input.price,
        city: input.city,
        locality: input.locality,
        address: { city: input.city, locality: input.locality },
        moderation_status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;

    return Response.json({ property }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
