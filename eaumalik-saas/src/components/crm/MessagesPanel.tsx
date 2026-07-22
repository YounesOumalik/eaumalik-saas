'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, User, Mail, MessageSquare, Globe2 } from 'lucide-react';
import { sendAdminReplyAction } from '@/app/actions/clientActions';

export interface ClientMessageItem {
  clientId: string;
  clientName: string;
  clientEmail: string;
  isPublic?: boolean;
  lastMessage: string;
  timestamp: string;
  messages: any[];
}

interface MessagesPanelProps {
  initialMessages: ClientMessageItem[];
  /** Hauteur du panneau (utile en modal vs page). */
  height?: string;
}

/**
 * Panneau de messagerie client — chat listant les clients à gauche et la
 * conversation à droite. Extrait de CrmMessages pour être réutilisé :
 *  - dans la page `/crm/messages` (via CrmMessages qui ajoute le titre h2) ;
 *  - dans la modale déclenchée depuis la page Fiches Clients (sans titre).
 *
 * Le composant n'enveloppe PAS le panneau dans un titre, c'est au parent
 * de le faire si nécessaire.
 */
export default function MessagesPanel({
  initialMessages,
  height = '70vh',
}: MessagesPanelProps) {
  const [clients, setClients] = useState<ClientMessageItem[]>(initialMessages);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    initialMessages.length > 0 ? initialMessages[0].clientId : null
  );
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selectedClient = clients.find(c => c.clientId === selectedClientId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedClientId, selectedClient?.messages]);

  // Si la liste change (ex. premier message reçu après ouverture du modal)
  // et qu'aucun client n'est sélectionné, on sélectionne le premier.
  useEffect(() => {
    if (!selectedClientId && clients.length > 0) {
      setSelectedClientId(clients[0].clientId);
    }
  }, [clients, selectedClientId]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !replyText.trim() || sending) return;
    setSending(true);

    const res = await sendAdminReplyAction(selectedClientId, replyText);
    if (res.success && res.message) {
      setClients(prev =>
        prev.map(c => {
          if (c.clientId === selectedClientId) {
            return {
              ...c,
              lastMessage: replyText,
              timestamp: res.message!.timestamp,
              messages: [...c.messages, res.message],
            };
          }
          return c;
        })
      );
      setReplyText('');
    }
    setSending(false);
  };

  return (
    <div
      className="glass-card flex overflow-hidden"
      style={{ transform: 'none', height }}
    >
      {/* Left side list */}
      <aside className="w-1/3 border-r border-[color:var(--border)] overflow-y-auto bg-[color:var(--bg-surface)]">
        {clients.length === 0 ? (
          <div className="p-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Aucun message client reçu.
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--border)]">
            {clients.map(c => {
              const active = c.clientId === selectedClientId;
              return (
                <button
                  key={c.clientId}
                  onClick={() => setSelectedClientId(c.clientId)}
                  className={`w-full text-left p-4 transition-colors flex flex-col gap-1 ${
                    active ? 'bg-[color:var(--bg-card-hover)]' : 'hover:bg-[color:var(--bg-card)]'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="min-w-0 flex items-center gap-1.5">
                      {c.isPublic ? (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                          Public
                        </span>
                      ) : null}
                      <span className="font-bold text-sm truncate">{c.clientName}</span>
                    </span>
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{c.clientEmail}</div>
                  <div className="text-xs truncate mt-1 text-[color:var(--text-secondary)]">{c.lastMessage}</div>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* Right side chat view */}
      <div className="flex-1 flex flex-col h-full">
        {selectedClient ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-[color:var(--border)] bg-[color:var(--bg-card)] flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-soft flex items-center justify-center text-primary-light">
                {selectedClient.isPublic ? <Globe2 size={18} /> : <User size={18} />}
              </div>
              <div>
                <div className="font-bold text-sm flex items-center gap-2">
                  {selectedClient.clientName}
                  {selectedClient.isPublic ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                      Public
                    </span>
                  ) : null}
                </div>
                <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  {selectedClient.isPublic ? <Globe2 size={10} /> : <Mail size={10} />}{' '}
                  {selectedClient.clientEmail}
                </div>
              </div>
            </div>

            {/* Message scroll */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[color:var(--bg-surface)]">
              {selectedClient.messages.map((m, idx) => {
                const isAdminMsg = m.senderId === 'admin-id';
                return (
                  <div key={m.id || idx} className={`flex ${isAdminMsg ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${
                      isAdminMsg
                        ? 'bg-[color:var(--primary)] text-white rounded-tr-none'
                        : 'bg-[color:var(--bg-card)] border border-[color:var(--border)] rounded-tl-none'
                    }`}>
                      <div className="font-bold text-[9px] mb-1 opacity-70">
                        {isAdminMsg ? 'Vous (Admin)' : selectedClient.clientName}
                      </div>
                      <div className="whitespace-pre-wrap">{m.text}</div>
                      <div className="text-[9px] text-right mt-1 opacity-60">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Reply Form */}
            {selectedClient.isPublic ? (
              <div className="p-3 border-t border-[color:var(--border)] text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Visiteur non inscrit — répondez-lui avec les coordonnées indiquées dans son message.
              </div>
            ) : (
              <form onSubmit={handleSendReply} className="p-3 border-t border-[color:var(--border)] flex gap-2">
                <input
                  type="text"
                  className="form-input flex-1"
                  placeholder={`Répondre à ${selectedClient.clientName}...`}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || sending}
                  className="btn-primary p-2.5 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8" style={{ color: 'var(--text-muted)' }}>
            <MessageSquare size={48} className="mb-3 opacity-30" />
            <p>Sélectionnez un client ou un visiteur public pour lire son message.</p>
          </div>
        )}
      </div>
    </div>
  );
}
