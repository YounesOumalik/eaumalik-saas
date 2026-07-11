'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, User, Mail, MessageSquare } from 'lucide-react';
import { sendAdminReplyAction } from '@/app/actions/clientActions';

interface ClientItem {
  clientId: string;
  clientName: string;
  clientEmail: string;
  lastMessage: string;
  timestamp: string;
  messages: any[];
}

export default function CrmMessages({ initialClients }: { initialClients: ClientItem[] }) {
  const [clients, setClients] = useState<ClientItem[]>(initialClients);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    initialClients.length > 0 ? initialClients[0].clientId : null
  );
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selectedClient = clients.find(c => c.clientId === selectedClientId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedClientId, selectedClient?.messages]);

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
    <>
      <h2 className="font-display font-extrabold text-xl mb-6">Messages des Clients</h2>
      <div className="glass-card flex overflow-hidden h-[70vh]" style={{ transform: 'none' }}>
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
                      <span className="font-bold text-sm truncate">{c.clientName}</span>
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
                <div className="w-9 h-9 rounded-full bg-cyan-500/15 flex items-center justify-center text-cyan-400">
                  <User size={18} />
                </div>
                <div>
                  <div className="font-bold text-sm">{selectedClient.clientName}</div>
                  <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <Mail size={10} /> {selectedClient.clientEmail}
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
                        <div>{m.text}</div>
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
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8" style={{ color: 'var(--text-muted)' }}>
              <MessageSquare size={48} className="mb-3 opacity-30" />
              <p>Sélectionnez un client dans la liste pour lire et répondre à ses messages.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
