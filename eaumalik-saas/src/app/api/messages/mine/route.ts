import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { readMessagesRaw, readUsersRaw } from '@/data/repositories';
import { isMockMode, safeErrorResponse, unauthorized } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/messages/mine
 * Renvoie la conversation du client courant : tous les messages où il est
 * sender OU recipient. Utilisé par l'onglet Chat pour rafraîchir
 * périodiquement et afficher les réponses admin en temps réel.
 */
export async function GET(_req: NextRequest) {
  try {
    if (isMockMode()) {
      const { getDevUserFromCookie } = await import('@/lib/auth/devSession');
      const dev = await getDevUserFromCookie();
      if (!dev) return unauthorized();
      const [rows, users] = await Promise.all([readMessagesRaw(), readUsersRaw()]);
      const userId = dev.id;
      const filtered = (rows as any[])
        .filter((m: any) => {
          const senderId = m.senderId ?? m.sender_id ?? null;
          const recipientId = m.recipientId ?? m.recipient_id ?? null;
          return senderId === userId || recipientId === userId;
        })
        .map(normalizeMock)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      // On enrichit avec le nom de l'expéditeur si besoin (côté admin id).
      void users;
      return NextResponse.json({ messages: filtered });
    }

    const supabase = createSupabaseServerClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) return unauthorized();
    const userId = userRes.user.id;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('timestamp', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ messages: (data ?? []).map(normalizeSupabase) });
  } catch (e) {
    return safeErrorResponse(e);
  }
}

function normalizeMock(row: any) {
  const senderId = row.senderId ?? row.sender_id ?? null;
  const recipientId = row.recipientId ?? row.recipient_id ?? null;
  return {
    id: row.id,
    senderId: senderId === null ? 'admin-id' : senderId,
    senderName: row.senderName ?? row.sender_name ?? (senderId === null ? 'Administrateur EAUMALIK' : 'Client'),
    recipientId: recipientId,
    text: row.text,
    timestamp: row.timestamp ?? row.created_at ?? new Date().toISOString(),
  };
}

function normalizeSupabase(row: any) {
  const senderId = row.sender_id ?? null;
  const recipientId = row.recipient_id ?? null;
  return {
    id: row.id,
    senderId: senderId === null ? 'admin-id' : senderId,
    senderName: row.sender_name ?? (senderId === null ? 'Administrateur EAUMALIK' : 'Client'),
    recipientId: recipientId,
    text: row.text,
    timestamp: row.timestamp ?? row.created_at ?? new Date().toISOString(),
  };
}