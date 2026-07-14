'use client';

import MessagesPanel, { type ClientMessageItem } from './MessagesPanel';

/**
 * Page-level wrapper de la messagerie CRM : ajoute le titre h2 et délègue
 * toute la UI/état à `MessagesPanel` (réutilisé tel quel dans la modale de
 * la page Fiches Clients).
 */
export default function CrmMessages({ initialClients }: { initialClients: ClientMessageItem[] }) {
  return (
    <>
      <h2 className="font-display font-extrabold text-xl mb-6">Messages des Clients</h2>
      <MessagesPanel initialMessages={initialClients} />
    </>
  );
}
