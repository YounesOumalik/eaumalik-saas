export type MessageSenderKind = 'client' | 'admin' | 'public';

export interface CrmConversation {
  clientId: string;
  clientName: string;
  clientEmail: string;
  isPublic: boolean;
  lastMessage: string;
  timestamp: string;
  messages: any[];
}

function inferSenderKind(
  row: any,
  senderId: string | null,
  recipientId: string | null,
): MessageSenderKind {
  const explicit = row.senderKind ?? row.sender_kind;
  if (explicit === 'client' || explicit === 'admin' || explicit === 'public') return explicit;
  if (senderId !== null) return 'client';
  if (recipientId !== null || row.senderName === 'Administrateur EAUMALIK' || row.sender_name === 'Administrateur EAUMALIK') {
    return 'admin';
  }
  return 'public';
}

export function normalizeMessage(row: any) {
  const sourceSenderId = row.senderId ?? row.sender_id ?? null;
  const recipientId = row.recipientId ?? row.recipient_id ?? null;
  const senderKind = inferSenderKind(row, sourceSenderId, recipientId);
  const timestamp = row.timestamp ?? row.created_at ?? new Date().toISOString();
  const publicId = `public:${row.id ?? timestamp}`;
  const senderId = senderKind === 'public'
    ? publicId
    : sourceSenderId === null
      ? 'admin-id'
      : sourceSenderId;

  return {
    ...row,
    senderId,
    senderKind,
    senderName:
      row.senderName
      ?? row.sender_name
      ?? (senderKind === 'admin' ? 'Administrateur EAUMALIK' : senderKind === 'public' ? 'Visiteur' : 'Client'),
    recipientId,
    timestamp,
  };
}

export function groupMessagesForCrm(rows: any[], users: any[]): CrmConversation[] {
  const conversations = new Map<string, CrmConversation>();
  const usersById = new Map(users.map((user: any) => [user.id, user]));

  for (const raw of rows) {
    const message = normalizeMessage(raw);
    const isPublic = message.senderKind === 'public';
    const clientId = isPublic
      ? message.senderId
      : message.senderId === 'admin-id'
        ? message.recipientId
        : message.senderId;

    if (!clientId || clientId === 'admin-id') continue;
    const profile = isPublic ? null : usersById.get(clientId);

    if (!conversations.has(clientId)) {
      conversations.set(clientId, {
        clientId,
        clientName: profile?.full_name ?? message.senderName ?? (isPublic ? 'Visiteur' : 'Client'),
        clientEmail: isPublic ? 'Visiteur non inscrit' : profile?.email ?? '',
        isPublic,
        lastMessage: message.text,
        timestamp: message.timestamp,
        messages: [],
      });
    }

    const conversation = conversations.get(clientId)!;
    conversation.lastMessage = message.text;
    conversation.timestamp = message.timestamp;
    conversation.messages.push(message);
  }

  return Array.from(conversations.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
