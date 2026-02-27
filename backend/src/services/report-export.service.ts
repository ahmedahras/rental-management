import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export interface ReportRow {
  [key: string]: string | number | null;
}

async function pdfBuffer(title: string, rows: ReportRow[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 30 });
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(title);
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown(1);

    if (rows.length === 0) {
      doc.text('No data available');
      doc.end();
      return;
    }

    const headers = Object.keys(rows[0]);
    doc.fontSize(10).text(headers.join(' | '));
    doc.moveDown(0.3);
    doc.text('-'.repeat(100));
    doc.moveDown(0.3);

    for (const row of rows) {
      const line = headers.map((header) => String(row[header] ?? '')).join(' | ');
      doc.text(line);
    }

    doc.end();
  });
}

async function xlsxBuffer(sheetName: string, rows: ReportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

  if (rows.length === 0) {
    sheet.addRow(['No data available']);
  } else {
    const headers = Object.keys(rows[0]);
    sheet.addRow(headers);
    for (const row of rows) {
      sheet.addRow(headers.map((header) => row[header]));
    }
    sheet.getRow(1).font = { bold: true };
    sheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.max(18, header.length + 4),
    }));
  }

  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}

export async function buildReportFile(
  title: string,
  rows: ReportRow[],
  format: 'pdf' | 'xlsx',
): Promise<{ contentType: string; ext: 'pdf' | 'xlsx'; data: Buffer }> {
  if (format === 'pdf') {
    return {
      contentType: 'application/pdf',
      ext: 'pdf',
      data: await pdfBuffer(title, rows),
    };
  }

  return {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: 'xlsx',
    data: await xlsxBuffer(title, rows),
  };
}
