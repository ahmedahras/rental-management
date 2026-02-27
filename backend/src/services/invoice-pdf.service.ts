import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { InvoiceContext } from '../types';

export async function renderInvoicePdf(context: InvoiceContext, outputPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const stream = doc.pipe(createWriteStream(outputPath));

    stream.on('finish', resolve);
    stream.on('error', reject);

    doc.fontSize(18).text(context.propertyName, { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Invoice Number: ${context.invoiceNumber}`);
    doc.text(`Invoice Date: ${context.invoiceDate}`);
    doc.moveDown(1);

    doc.fontSize(12).text('Tenant Details', { underline: true });
    doc.fontSize(10).text(`Tenant: ${context.tenantName}`);
    doc.text(`Owner: ${context.ownerName}`);
    doc.text(`Shop Number: ${context.shopNumber}`);
    doc.text(`Rent Month: ${context.rentMonth}`);
    doc.moveDown(1);

    doc.fontSize(12).text('Payment Summary', { underline: true });
    doc.fontSize(10).text(`Monthly Rent: INR ${context.monthlyRent.toFixed(2)}`);
    doc.text(`Previous Due: INR ${context.previousDue.toFixed(2)}`);
    doc.text(`Amount Paid: INR ${context.amountPaid.toFixed(2)}`);
    doc.text(`Remaining Due: INR ${context.remainingDue.toFixed(2)}`);
    doc.text(`Payment Mode: ${context.paymentMode}`);
    doc.moveDown(1);

    doc.fillColor('#1d4ed8').text(`Download Link: ${context.pdfDownloadUrl}`, {
      underline: true,
      link: context.pdfDownloadUrl,
    });
    doc.fillColor('#000000');

    doc.end();
  });
}
