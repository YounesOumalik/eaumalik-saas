import { listNews } from '@/data/repositories';
import NewsManager from '@/components/admin/NewsManager';

export const dynamic = 'force-dynamic';

export default async function AdminNewsPage() {
  const news = await listNews({ includeExpired: true });
  return <NewsManager initialNews={news} />;
}
