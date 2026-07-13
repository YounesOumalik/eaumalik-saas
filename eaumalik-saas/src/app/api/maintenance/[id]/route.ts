import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { MaintenanceProgramStatus } from '@/types';
import {
  addMaintenanceIntervention,
  updateMaintenanceNotes,
  updateMaintenanceStatus,
} from '@/data/repositories';
import { createSupabaseServiceRoleClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { badRequest, forbidden, isMockMode, safeErrorResponse, unauthorized } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

const interventionType = z.enum([
  'filter_change', 'inspection', 'repair', 'replacement', 'cleaning', 'diagnostic', 'other',
]);
const outcome = z.enum(['completed', 'pending', 'failed']);

const interventionSchema = z.object({
  intervention_type: interventionType,
  description: z.string().min(3).max(2000),
  performed_at: z.string().datetime().optional(),
  technician_name: z.string().max(120).optional(),
  parts_used: z.array(z.string().max(120)).max(20).optional(),
  cost: z.coerce.number().min(0).max(99999).optional(),
  next_service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  outcome: outcome.optional(),
});

const patchSchema = z.object({
  status: z.enum(['actif', 'a_renouveler', 'suspendu', 'resilie']).optional(),
  notes: z.string().max(4000).optional(),
  intervention: interventionSchema.optional(),
});

/**
 * PATCH /api/maintenance/[id]
 * Met à jour le statut global, les notes, ou ajoute une intervention au dossier.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // Mode mock : pas d'auth (dev local sans Supabase)
  if (isMockMode()) {
    const id = String(params.id).slice(0, 80);
    let body: unknown;
    try { body = await req.json(); } catch { return badRequest('JSON invalide.'); }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest('Payload invalide.', parsed.error.flatten());
    try {
      if (parsed.data.status) {
        await updateMaintenanceStatus(id, parsed.data.status as MaintenanceProgramStatus);
      }
      if (parsed.data.notes !== undefined) {
        await updateMaintenanceNotes(id, parsed.data.notes);
      }
      if (parsed.data.intervention) {
        const i = parsed.data.intervention;
        await addMaintenanceIntervention({
          record_id: id,
          intervention_type: i.intervention_type,
          description: i.description,
          performed_at: i.performed_at,
          technician_name: i.technician_name,
          parts_used: i.parts_used,
          cost: i.cost,
          next_service_date: i.next_service_date,
          outcome: i.outcome,
        });
      }
      return NextResponse.json({ success: true });
    } catch (e) {
      return safeErrorResponse(e);
    }
  }

  let callerRole: 'admin' | 'client';
  try {
    const supabase = createSupabaseServerClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) return unauthorized();
    const admin = createSupabaseServiceRoleClient();
    const { data: profile } = await admin.from('users').select('role').eq('id', userRes.user.id).single();
    callerRole = (profile?.role as 'admin' | 'client') ?? 'client';
  } catch (e) {
    return safeErrorResponse(e);
  }
  if (callerRole !== 'admin') return forbidden('Droits administrateur requis.');

  const id = String(params.id).slice(0, 80);
  let body: unknown;
  try { body = await req.json(); } catch { return badRequest('JSON invalide.'); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest('Payload invalide.', parsed.error.flatten());

  try {
    if (parsed.data.status) {
      await updateMaintenanceStatus(id, parsed.data.status as MaintenanceProgramStatus);
    }
    if (parsed.data.notes !== undefined) {
      await updateMaintenanceNotes(id, parsed.data.notes);
    }
    if (parsed.data.intervention) {
      const i = parsed.data.intervention;
      await addMaintenanceIntervention({
        record_id: id,
        intervention_type: i.intervention_type,
        description: i.description,
        performed_at: i.performed_at,
        technician_name: i.technician_name,
        parts_used: i.parts_used,
        cost: i.cost,
        next_service_date: i.next_service_date,
        outcome: i.outcome,
      });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return safeErrorResponse(e);
  }
}
