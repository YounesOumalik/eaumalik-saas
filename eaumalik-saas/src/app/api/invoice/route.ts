import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { getCompanyProfile, listOrders } from '@/data/repositories';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('order_id');
  if (!orderId) {
    return NextResponse.json({ error: 'order_id requis' }, { status: 400 });
  }

  const orders = await listOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }
  const items = order.items || [];
  const company = await getCompanyProfile();

  // Génération PDF streamée
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>(resolve => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  // Header
  doc.fontSize(20).fillColor('#0891b2').text(company.legal_name, { align: 'left' });
  doc.fontSize(10).fillColor('#666')
    .text(company.address)
    .text(`Tel: ${company.phone}  Email: ${company.email}`)
    .text(`Capital: ${company.capital.toLocaleString('fr-MA')} MAD`);

  doc.moveDown(2);
  doc.fontSize(22).fillColor('#0f172a').text('FACTURE', { align: 'right' });
  doc.fontSize(10).fillColor('#666').text(order.order_number, { align: 'right' });
  doc.text(new Date(order.created_at).toLocaleDateString('fr-FR'), { align: 'right' });

  doc.moveDown();
  doc.fillColor('#0f172a').fontSize(12).text('Client', { underline: true });
  doc.fontSize(10).fillColor('#333')
    .text(order.client_name)
    .text(order.client_address)
    .text(`${order.client_city} — ${order.client_phone}`);

  // Items table
  doc.moveDown();
  const tableTop = doc.y;
  const cols = { name: 50, qty: 320, price: 380, total: 470 };
  doc.fillColor('#0891b2').fontSize(11).text('Description', cols.name, tableTop)
    .text('Qté', cols.qty, tableTop)
    .text('Prix U.', cols.price, tableTop)
    .text('Total', cols.total, tableTop);
  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#0891b2').stroke();

  let y = tableTop + 25;
  items.forEach(i => {
    doc.fillColor('#0f172a').fontSize(10)
      .text(i.product_name.substring(0, 45), cols.name, y)
      .text(String(i.quantity), cols.qty, y)
      .text(formatCurrency(i.unit_price), cols.price, y)
      .text(formatCurrency(i.line_total), cols.total, y);
    y += 22;
  });

  doc.moveTo(50, y).lineTo(550, y).strokeColor('#ccc').stroke();
  y += 12;
  doc.fontSize(10).fillColor('#666').text('Sous-total (TTC)', cols.price, y);
  doc.fillColor('#0f172a').text(formatCurrency(order.subtotal), cols.total, y);
  y += 15;

  const tva = (order.subtotal * 20) / 120; // 20% TVA included
  const ht = order.subtotal - tva;

  doc.fillColor('#666').text('dont TVA (20%)', cols.price, y);
  doc.fillColor('#0f172a').text(formatCurrency(tva), cols.total, y);
  y += 15;
  doc.fillColor('#666').text('Montant HT', cols.price, y);
  doc.fillColor('#0f172a').text(formatCurrency(ht), cols.total, y);
  y += 18;

  doc.fillColor('#666').text('Livraison', cols.price, y);
  doc.fillColor('#0f172a').text(order.delivery_fee === 0 ? 'Gratuite' : formatCurrency(order.delivery_fee), cols.total, y);
  y += 22;
  doc.moveTo(380, y).lineTo(550, y).strokeColor('#0891b2').lineWidth(1).stroke();
  y += 10;
  doc.fontSize(14).fillColor('#0891b2').text('TOTAL', cols.price, y);
  doc.text(formatCurrency(order.total), cols.total, y);

  doc.moveDown(4);
  doc.fontSize(9).fillColor('#888')
    .text('Merci pour votre confiance. Paiement a la livraison.', { align: 'center' })
    .text(`${company.legal_name} — RCS Casablanca`, { align: 'center' });

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="facture-${order.order_number}.pdf"`,
    },
  });
}
