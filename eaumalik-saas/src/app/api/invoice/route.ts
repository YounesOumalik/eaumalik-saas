import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { badRequest, forbidden, safeErrorResponse, unauthorized } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

// Garde-fous : le client ne peut télécharger QUE sa propre commande (anti-IDOR).
async function loadOrderForCaller(orderId: string) {
  const supabase = createSupabaseServerClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) throw new Response('unauthorized', { status: 401 });

  // Tentative directe via RLS : un client ne voit que ses commandes (user_id = auth.uid()).
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (order) return order;

  // Sinon, fallback admin via service role.
  const admin = createSupabaseServiceRoleClient();
  const { data: profile } = await admin.from('users').select('role').eq('id', userRes.user.id).single();
  if (profile?.role !== 'admin') {
    throw new Response('forbidden', { status: 403 });
  }
  const { data: adminOrder, error: adminErr } = await admin
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', orderId)
    .maybeSingle();
  if (adminErr || !adminOrder) throw new Response('not found', { status: 404 });
  return adminOrder;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = String(searchParams.get('order_id') ?? '').slice(0, 80);
  if (!orderId) return badRequest('order_id requis.');

  let order: any;
  try {
    order = await loadOrderForCaller(orderId);
  } catch (resp) {
    if (resp instanceof Response) return resp;
    return safeErrorResponse(resp);
  }

  const items = order.items ?? [];

  // Profil société
  let company: any = {
    legal_name: 'EAUMALIK S.A.R.L.',
    address: '',
    phone: '',
    email: '',
    capital: 0,
  };
  try {
    const admin = createSupabaseServiceRoleClient();
    const { data } = await admin.from('company_profile').select('*').maybeSingle();
    if (data) company = data;
  } catch { /* ignore */ }

  // PDF
  try {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));

    doc.fontSize(20).fillColor('#0891b2').text(company.legal_name ?? 'EAUMALIK', { align: 'left' });
    doc.fontSize(10).fillColor('#666')
      .text(company.address ?? '')
      .text(`Tél. : ${company.phone ?? ''}  Email : ${company.email ?? ''}`)
      .text(`Capital : ${Number(company.capital ?? 0).toLocaleString('fr-MA')} MAD`);

    doc.moveDown(2);
    doc.fontSize(22).fillColor('#0f172a').text('FACTURE', { align: 'right' });
    doc.fontSize(10).fillColor('#666').text(order.order_number, { align: 'right' });
    doc.text(new Date(order.created_at).toLocaleDateString('fr-FR'), { align: 'right' });

    doc.moveDown();
    doc.fillColor('#0f172a').fontSize(12).text('Client', { underline: true });
    doc.fontSize(10).fillColor('#333')
      .text(order.client_name ?? '')
      .text(order.client_address ?? '')
      .text(`${order.client_city ?? ''} — ${order.client_phone ?? ''}`);

    doc.moveDown();
    const tableTop = doc.y;
    const cols = { name: 50, qty: 320, price: 380, total: 470 };
    doc.fillColor('#0891b2').fontSize(11).text('Description', cols.name, tableTop)
      .text('Qté', cols.qty, tableTop)
      .text('Prix U.', cols.price, tableTop)
      .text('Total', cols.total, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#0891b2').stroke();
    let y = tableTop + 25;
    items.forEach((i: any) => {
      doc.fillColor('#0f172a').fontSize(10)
        .text(String(i.product_name ?? '').substring(0, 45), cols.name, y)
        .text(String(i.quantity ?? 0), cols.qty, y)
        .text(`${Number(i.unit_price ?? 0).toLocaleString('fr-MA')} DH`, cols.price, y)
        .text(`${Number(i.line_total ?? 0).toLocaleString('fr-MA')} DH`, cols.total, y);
      y += 22;
    });

    doc.moveTo(50, y).lineTo(550, y).strokeColor('#ccc').stroke();
    y += 12;
    doc.fontSize(10).fillColor('#666').text('Sous-total (TTC)', cols.price, y);
    doc.fillColor('#0f172a').text(`${Number(order.subtotal ?? 0).toLocaleString('fr-MA')} DH`, cols.total, y);
    y += 15;
    const tva = Math.round((Number(order.subtotal ?? 0) * 20) / 120);
    const ht = Number(order.subtotal ?? 0) - tva;
    doc.fillColor('#666').text('dont TVA (20 %)', cols.price, y);
    doc.fillColor('#0f172a').text(`${tva.toLocaleString('fr-MA')} DH`, cols.total, y);
    y += 15;
    doc.fillColor('#666').text('Montant HT', cols.price, y);
    doc.fillColor('#0f172a').text(`${ht.toLocaleString('fr-MA')} DH`, cols.total, y);
    y += 18;
    doc.fillColor('#666').text('Livraison', cols.price, y);
    doc.fillColor('#0f172a').text(order.delivery_fee === 0 ? 'Gratuite' : `${Number(order.delivery_fee).toLocaleString('fr-MA')} DH`, cols.total, y);
    y += 22;
    doc.moveTo(380, y).lineTo(550, y).strokeColor('#0891b2').lineWidth(1).stroke();
    y += 10;
    doc.fontSize(14).fillColor('#0891b2').text('TOTAL', cols.price, y);
    doc.text(`${Number(order.total ?? 0).toLocaleString('fr-MA')} DH`, cols.total, y);

    doc.moveDown(4);
    doc.fontSize(9).fillColor('#888')
      .text('Merci pour votre confiance. Paiement à la livraison.', { align: 'center' })
      .text(`${company.legal_name ?? 'EAUMALIK'} — RCS Casablanca`, { align: 'center' });

    doc.end();
    const buffer = await done;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="facture-${order.order_number}.pdf"`,
      },
    });
  } catch (e) {
    return safeErrorResponse(e);
  }
}
