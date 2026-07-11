import { listClients } from '@/data/repositories';
import ClientList from '@/components/crm/ClientList';

export default async function CrmClientsPage() {
  const clients = await listClients();
  return <ClientList initialClients={clients} />;
}
