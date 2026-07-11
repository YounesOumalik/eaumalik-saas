import { listClients, listOrders, listMaintenance } from '@/data/repositories';
import ClientList from '@/components/crm/ClientList';

export default async function CrmClientsPage() {
  const clients = await listClients();
  const orders = await listOrders();
  const maintenance = await listMaintenance();

  return (
    <ClientList
      initialClients={clients}
      allOrders={orders}
      allMaintenance={maintenance}
    />
  );
}
