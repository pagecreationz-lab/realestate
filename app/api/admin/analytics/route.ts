import { getSupabaseAdmin } from '@/server/config/supabase';
import {
  apiErrorResponse,
  authenticateRequest,
  authorizeRequest,
} from '@/server/lib/api';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = authenticateRequest(request);
    authorizeRequest(user, 'admin');
    const supabase = getSupabaseAdmin();
    const [usersResult, propertiesResult, activeResult, pendingResult, categoriesResult] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('properties').select('*', { count: 'exact', head: true }),
      supabase.from('properties').select('*', { count: 'exact', head: true }).eq('moderation_status', 'approved').eq('availability', 'available'),
      supabase.from('properties').select('*', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
      supabase.from('properties').select('type'),
    ]);
    const databaseError = [usersResult, propertiesResult, activeResult, pendingResult, categoriesResult]
      .find((result) => result.error)?.error;
    if (databaseError) throw databaseError;

    const categoryCounts = new Map<string, number>();
    for (const property of categoriesResult.data ?? []) {
      categoryCounts.set(property.type, (categoryCounts.get(property.type) ?? 0) + 1);
    }
    const byCategory = [...categoryCounts.entries()]
      .map(([type, total]) => ({ _id: type, total }))
      .sort((a, b) => b.total - a.total);

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
