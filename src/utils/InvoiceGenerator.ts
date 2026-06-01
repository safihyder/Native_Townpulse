import { jsPDF } from 'jspdf';
import RNFS from 'react-native-fs';

export interface InvoiceOrderData {
  orderId: string;
  createdAt: string;
  paymentMode: string;
  items: Array<{ name: string; quantity: number; itemTotal?: number; pricing?: { finalPrice?: number } }>;
  pricing: {
    itemsTotal?: number;
    deliveryFee?: number;
    taxTotal?: number;
    grandTotal?: number;
  };
  customerName?: string;
  customerPhone?: string;
}

export const generateInvoicePdf = async (order: InvoiceOrderData): Promise<string> => {
  const doc = new jsPDF();
  let y = 20;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(198, 40, 40); // #C62828 TownPulse Red
  doc.text('TownPulse', 105, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Delivering Happiness', 105, y, { align: 'center' });
  y += 15;

  // Invoice Details
  doc.setFontSize(16);
  doc.setTextColor(50, 50, 50);
  doc.text('INVOICE', 20, y);
  y += 8;

  doc.setFontSize(12);
  doc.text(`Order ID: #${order.orderId}`, 20, y);
  y += 6;
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 20, y);
  y += 6;
  doc.text(`Payment: ${order.paymentMode}`, 20, y);
  y += 15;

  if (order.customerName) {
    doc.setFontSize(14);
    doc.text('Billed To:', 20, y);
    y += 6;
    doc.setFontSize(12);
    doc.text(order.customerName, 20, y);
    y += 6;
    if (order.customerPhone) {
      doc.text(order.customerPhone, 20, y);
      y += 6;
    }
    y += 5;
  }

  // Items Table Header
  doc.setFillColor(198, 40, 40);
  doc.rect(20, y, 170, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text('Item', 25, y + 7);
  doc.text('Qty', 110, y + 7);
  doc.text('Price', 140, y + 7);
  doc.text('Total', 170, y + 7);
  y += 15;

  // Items
  doc.setTextColor(50, 50, 50);
  order.items.forEach(item => {
    doc.text(item.name.substring(0, 30), 25, y);
    doc.text(item.quantity.toString(), 110, y);
    doc.text(`Rs ${(item.pricing?.finalPrice || 0).toFixed(2)}`, 140, y);
    doc.text(`Rs ${(item.itemTotal || ((item.pricing?.finalPrice || 0) * item.quantity)).toFixed(2)}`, 170, y);
    y += 8;
  });

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 10;

  // Totals
  const tXLabel = 140;
  const tXVal = 170;
  doc.text('Subtotal:', tXLabel, y);
  doc.text(`Rs ${(order.pricing?.itemsTotal || 0).toFixed(2)}`, tXVal, y);
  y += 8;
  doc.text('Delivery Fee:', tXLabel, y);
  doc.text(`Rs ${(order.pricing?.deliveryFee || 0).toFixed(2)}`, tXVal, y);
  y += 8;
  doc.text('Taxes (GST):', tXLabel, y);
  doc.text(`Rs ${(order.pricing?.taxTotal || 0).toFixed(2)}`, tXVal, y);
  y += 10;
  
  doc.setFontSize(14);
  doc.setTextColor(198, 40, 40);
  doc.text('Grand Total:', tXLabel - 5, y);
  doc.text(`Rs ${(order.pricing?.grandTotal || 0).toFixed(2)}`, tXVal, y);

  // Footer
  y += 30;
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text('Thank you for ordering with TownPulse!', 105, y, { align: 'center' });

  // Generate PDF file
  const pdfBase64 = doc.output('datauristring').split(',')[1];
  const filePath = `${RNFS.CachesDirectoryPath}/Invoice_${order.orderId.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`;
  
  await RNFS.writeFile(filePath, pdfBase64, 'base64');
  return filePath;
};
