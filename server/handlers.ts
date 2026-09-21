import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from './config/env.js';
import { getSupabaseAdmin } from './config/supabase.js';
import { ApiError, apiErrorResponse, authenticateRequest, authorizeRequest, credentialVersion, type UserRole } from './lib/api.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  portal: z.enum(['user', 'broker', 'admin']),
});

const listingSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(20),
  type: z.string().min(2),
  purpose: z.enum(['Buy', 'Rent', 'Resale', 'Joint Venture']),
  sellerType: z.enum(['Owner', 'Broker', 'Builder', 'Promoter']),
  price: z.number().nonnegative(),
  city: z.string().min(2),
  locality: z.string().min(2),
  area: z.number().positive().optional(),
  bhk: z.number().int().min(0).max(50).optional(),
  media: z.object({ photos: z.array(z.string().url().startsWith('https://')).max(20), reels: z.array(z.string().url().regex(/^https:\/\/(www\.)?(vimeo\.com\/\d+|youtube\.com\/watch\?|youtu\.be\/)/)).max(5) }).optional(),
});

const enquirySchema = z.object({
  source: z.enum(['listing', 'reel', 'requirement']).optional(),
  type: z.enum(['call', 'chat', 'enquiry']).optional(),
  notes: z.string().optional(),
});

const siteVisitSchema = z.object({ requestedAt: z.coerce.date() });
const moderationSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  verified: z.boolean().optional(),
});

export function handleHealth() {
  return Response.json({ status: 'ok', service: 'ease-home-api' });
}

export async function handleLogin(request: Request) {
  try {
    if (!env.jwtSecret || env.jwtSecret === 'change-this-secret-before-production') throw new ApiError(503, 'Sign-in is not configured. Contact the administrator.');
    const input = loginSchema.parse(await request.json());
    const { data: user, error } = await getSupabaseAdmin()
      .from('users')
      .select('id, name, email, password_hash, roles, status, verification')
      .eq('email', input.email.toLowerCase())
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
      return Response.json({ message: 'Email or password is incorrect' }, { status: 401 });
    }

    if(user.verification?.email_required===true&&user.verification?.email!==true)throw new ApiError(403,'Verify your email before signing in. Use the Verify email / resend OTP option.');
    const roles = user.roles as UserRole[];
    if (!roles.includes(input.portal)) {
      return Response.json({ message: 'This account cannot access the selected portal' }, { status: 403 });
    }

    const token = jwt.sign({ id: user.id, email: user.email, roles, credentialVersion:credentialVersion(user.password_hash) }, env.jwtSecret, { expiresIn: '12h' });
    return Response.json({ token, user: { id: user.id, name: user.name, email: user.email, roles } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handleProperties(request: Request) {
  try {
    if (request.method === 'GET') {
      const searchParams = new URL(request.url).searchParams;
      if (searchParams.get('mine') === '1') {
        const user = await authenticateRequest(request);
        const {data, error} = await getSupabaseAdmin().from('properties').select('*').eq('seller_id', user.id).order('created_at', {ascending:false});
        if(error) throw error;
        return Response.json({items:data});
      }
      let query = getSupabaseAdmin()
        .from('properties').select('*')
        .eq('moderation_status', 'approved').eq('availability', 'available')
        .order('featured', { ascending: false }).order('created_at', { ascending: false }).limit(50);

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
    }

    if (request.method === 'POST') {
      const user = await authenticateRequest(request);
      authorizeRequest(user, 'user', 'broker', 'admin');
      const input = listingSchema.parse(await request.json());
      const { data: property, error } = await getSupabaseAdmin().from('properties').insert({
        title: input.title,
        description: input.description,
        type: input.type,
        purpose: input.purpose,
        seller_type: user.roles.includes('broker') || user.roles.includes('admin') ? input.sellerType : 'Owner',
        area_value: input.area,
        bhk: input.bhk,
        media: input.media,
        seller_id: user.id,
        price: input.price,
        city: input.city,
        locality: input.locality,
        address: { city: input.city, locality: input.locality },
        moderation_status: 'pending',
      }).select().single();
      if (error) throw error;
      return Response.json({ property }, { status: 201 });
    }

    return methodNotAllowed(['GET', 'POST']);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handleEnquiry(request: Request, propertyId: string) {
  try {
    if (request.method !== 'POST') return methodNotAllowed(['POST']);
    const user = await authenticateRequest(request);
    authorizeRequest(user, 'user');
    const body = enquirySchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const { data: property, error: propertyError } = await supabase.from('properties').select('id, seller_id').eq('id', propertyId).maybeSingle();
    if (propertyError) throw propertyError;
    if (!property) return Response.json({ message: 'Property not found' }, { status: 404 });
    const { data: enquiry, error } = await supabase.from('enquiries').insert({
      customer_id: user.id,
      property_id: property.id,
      assigned_to: property.seller_id,
      source: body.source ?? 'listing',
      type: body.type ?? 'enquiry',
      notes: body.notes,
    }).select().single();
    if (error) throw error;
    return Response.json({ enquiry }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handleSiteVisit(request: Request, propertyId: string) {
  try {
    if (request.method !== 'POST') return methodNotAllowed(['POST']);
    const user = await authenticateRequest(request);
    authorizeRequest(user, 'user');
    const body = siteVisitSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const { data: property, error: propertyError } = await supabase.from('properties').select('id, seller_id').eq('id', propertyId).maybeSingle();
    if (propertyError) throw propertyError;
    if (!property) return Response.json({ message: 'Property not found' }, { status: 404 });
    const { data: visit, error } = await supabase.from('site_visits').insert({
      property_id: property.id,
      buyer_id: user.id,
      seller_id: property.seller_id,
      requested_at: body.requestedAt.toISOString(),
    }).select().single();
    if (error) throw error;
    return Response.json({ visit }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handleAnalytics(request: Request) {
  try {
    if (request.method !== 'GET') return methodNotAllowed(['GET']);
    const user = await authenticateRequest(request);
    authorizeRequest(user, 'admin');
    const supabase = getSupabaseAdmin();
    const [usersResult, propertiesResult, activeResult, pendingResult, categoriesResult] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('properties').select('*', { count: 'exact', head: true }),
      supabase.from('properties').select('*', { count: 'exact', head: true }).eq('moderation_status', 'approved').eq('availability', 'available'),
      supabase.from('properties').select('*', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
      supabase.from('properties').select('type'),
    ]);
    const databaseError = [usersResult, propertiesResult, activeResult, pendingResult, categoriesResult].find((result) => result.error)?.error;
    if (databaseError) throw databaseError;
    const categoryCounts = new Map<string, number>();
    for (const property of categoriesResult.data ?? []) categoryCounts.set(property.type, (categoryCounts.get(property.type) ?? 0) + 1);
    const byCategory = [...categoryCounts.entries()].map(([type, total]) => ({ _id: type, total })).sort((a, b) => b.total - a.total);
    return Response.json({
      totalUsers: usersResult.count ?? 0,
      totalProperties: propertiesResult.count ?? 0,
      activeProperties: activeResult.count ?? 0,
      pendingProperties: pendingResult.count ?? 0,
      byCategory,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function handleModeration(request: Request, propertyId: string) {
  try {
    if (request.method !== 'PATCH') return methodNotAllowed(['PATCH']);
    const user = await authenticateRequest(request);
    authorizeRequest(user, 'admin');
    const body = moderationSchema.parse(await request.json());
    const { data: property, error } = await getSupabaseAdmin().from('properties').update({
      moderation_status: body.status,
      verified: body.status === 'approved' && Boolean(body.verified),
    }).eq('id', propertyId).select().maybeSingle();
    if (error) throw error;
    if (!property) return Response.json({ message: 'Property not found' }, { status: 404 });
    return Response.json({ property });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function methodNotAllowed(allowed: string[]) {
  return Response.json({ message: 'Method not allowed' }, { status: 405, headers: { Allow: allowed.join(', ') } });
}

