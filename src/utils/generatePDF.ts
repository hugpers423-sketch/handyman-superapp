import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface ServiceReceiptData {
  requestId: string;
  serviceType: string;
  detail: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  professionalName: string;
  professionalSpecialty: string;
  professionalPhone?: string;
  location: string;
  startedAt: Date;
  completedAt: Date;
  durationMinutes: number;
  amount: number;
  commission: number;
  platformFee: number;
  workerAmount: number;
  paymentMethod: 'yape' | 'plin' | 'efectivo' | 'tarjeta' | 'transferencia';
  paymentReference: string;
  evidenceBefore: string[];
  evidenceAfter: string[];
  signature?: string;
  rating?: number;
  companyName: string;
  companyRUC: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
}

const COMPANY = {
  name: 'HANDYMAN PERÚ SAC',
  ruc: '20601234567',
  address: 'Av. Javier Prado Este 2465, San Borja, Lima',
  phone: '+51 999 888 777',
  email: 'facturacion@handyman.pe'
};

const COLORS = {
  primary: rgb(0.039, 0.161, 0.133),
  green: rgb(0.412, 0.631, 0.161),
  lime: rgb(0.843, 1, 0.38),
  cream: rgb(0.969, 0.961, 0.937),
  muted: rgb(0.396, 0.459, 0.427),
  line: rgb(0.875, 0.89, 0.863),
  orange: rgb(1, 0.439, 0.263)
};

export async function generateServiceReceipt(data: ServiceReceiptData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 48;
  const contentWidth = width - margin * 2;
  let y = height - margin;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const drawText = (text: string, x: number, yPos: number, size: number, fontType = font, color = COLORS.primary) => {
    page.drawText(text, { x, y: yPos, size, font: fontType, color });
  };

  const drawLine = (yPos: number, color = COLORS.line, thickness = 1) => {
    page.drawLine({
      start: { x: margin, y: yPos },
      end: { x: width - margin, y: yPos },
      thickness,
      color
    });
  };

  const drawRect = (x: number, yPos: number, w: number, h: number, color: any, borderColor?: any) => {
    page.drawRectangle({
      x, y: yPos, width: w, height: h,
      color,
      borderColor,
      borderWidth: borderColor ? 1 : 0
    });
  };

  // Header background
  drawRect(margin, y - 10, contentWidth, 70, COLORS.primary);
  
  // Logo area
  drawText(COMPANY.name, margin + 15, y + 40, 20, fontBold, rgb(1, 1, 1));
  drawText('SUPER APP', margin + 15, y + 18, 10, fontOblique, COLORS.lime);
  drawText('COMPROBANTE DE SERVICIO', width - margin - 200, y + 40, 14, fontBold, rgb(1, 1, 1));
  drawText(`#${data.requestId}`, width - margin - 200, y + 20, 12, font, rgb(1, 1, 1));

  y -= 90;

  // Company info
  drawText('EMISOR:', margin, y, 9, fontBold, COLORS.muted);
  y -= 14;
  drawText(COMPANY.name, margin, y, 10, fontBold);
  y -= 13;
  drawText(`RUC: ${COMPANY.ruc}`, margin, y, 9, font);
  y -= 13;
  drawText(COMPANY.address, margin, y, 9, font);
  y -= 13;
  drawText(`${COMPANY.phone} | ${COMPANY.email}`, margin, y, 9, font);
  y -= 20;

  drawLine(y);
  y -= 16;

  // Client & Professional
  const halfWidth = contentWidth / 2 - 8;
  
  drawText('CLIENTE:', margin, y, 9, fontBold, COLORS.muted);
  drawText('PROFESIONAL:', margin + halfWidth + 16, y, 9, fontBold, COLORS.muted);
  y -= 14;

  drawText(data.clientName, margin, y, 10, fontBold);
  drawText(data.professionalName, margin + halfWidth + 16, y, 10, fontBold);
  y -= 13;

  drawText(data.clientEmail, margin, y, 9, font);
  drawText(`${data.professionalSpecialty}`, margin + halfWidth + 16, y, 9, font);
  y -= 13;

  if (data.clientPhone) {
    drawText(data.clientPhone, margin, y, 9, font);
  }
  if (data.professionalPhone) {
    drawText(data.professionalPhone, margin + halfWidth + 16, y, 9, font);
  }
  y -= 20;

  drawLine(y);
  y -= 16;

  // Service details
  drawText('DETALLE DEL SERVICIO', margin, y, 11, fontBold);
  y -= 18;

  const serviceDetails = [
    { label: 'Tipo de servicio:', value: data.serviceType },
    { label: 'Descripción:', value: data.detail },
    { label: 'Ubicación:', value: data.location },
    { label: 'Fecha inicio:', value: new Date(data.startedAt).toLocaleString('es-PE') },
    { label: 'Fecha fin:', value: new Date(data.completedAt).toLocaleString('es-PE') },
    { label: 'Duración:', value: `${data.durationMinutes} min` }
  ];

  serviceDetails.forEach(({ label, value }) => {
    drawText(label, margin, y, 9, fontBold);
    drawText(value, margin + 110, y, 9, font);
    y -= 14;
  });

  y -= 10;
  drawLine(y);
  y -= 16;

  // Payment breakdown
  drawText('DESGLOSE DE PAGO', margin, y, 11, fontBold);
  y -= 18;

  const paymentRows = [
    { label: 'Subtotal', value: `S/ ${data.amount.toFixed(2)}`, bold: false },
    { label: 'Comisión plataforma (15%)', value: `S/ ${data.commission.toFixed(2)}`, bold: false },
    { label: 'Fee procesamiento (3%)', value: `S/ ${data.platformFee.toFixed(2)}`, bold: false },
    { label: 'Ganancia profesional', value: `S/ ${data.workerAmount.toFixed(2)}`, bold: true }
  ];

  paymentRows.forEach(({ label, value, bold }) => {
    drawText(label, margin, y, 9, bold ? fontBold : font);
    drawText(value, width - margin - 100, y, 9, bold ? fontBold : font, bold ? COLORS.green : COLORS.primary);
    y -= 15;
  });

  drawLine(y, COLORS.lime, 2);
  y -= 10;

  drawText('TOTAL PAGADO', margin, y, 11, fontBold);
  drawText(`S/ ${data.amount.toFixed(2)}`, width - margin - 100, y, 11, fontBold);
  y -= 18;

  drawText(`Método: ${data.paymentMethod.toUpperCase()}`, margin, y, 9, font);
  drawText(`Ref: ${data.paymentReference}`, margin + 200, y, 9, font);
  y -= 20;

  drawLine(y);
  y -= 16;

  // Evidence section
  if (data.evidenceBefore.length > 0 || data.evidenceAfter.length > 0) {
    drawText('EVIDENCIA FOTOGRÁFICA', margin, y, 11, fontBold);
    y -= 18;

    if (data.evidenceBefore.length > 0) {
      drawText('ANTES:', margin, y, 9, fontBold, COLORS.muted);
      y -= 14;
      data.evidenceBefore.forEach((url, i) => {
        drawText(`  ${i + 1}. ${url}`, margin, y, 8, font, COLORS.muted);
        y -= 12;
      });
      y -= 8;
    }

    if (data.evidenceAfter.length > 0) {
      drawText('DESPUÉS:', margin, y, 9, fontBold, COLORS.muted);
      y -= 14;
      data.evidenceAfter.forEach((url, i) => {
        drawText(`  ${i + 1}. ${url}`, margin, y, 8, font, COLORS.muted);
        y -= 12;
      });
      y -= 8;
    }
  }

  // Signature
  if (data.signature) {
    y -= 10;
    drawLine(y);
    y -= 16;
    drawText('FIRMA DIGITAL DEL CLIENTE', margin, y, 11, fontBold);
    y -= 18;
    drawText('El cliente confirma la conformidad del servicio:', margin, y, 9, font);
    y -= 16;
    drawText('[Firma digital capturada]', margin, y, 9, fontOblique, COLORS.muted);
    y -= 20;
  }

  // Rating
  if (data.rating) {
    drawLine(y);
    y -= 16;
    drawText('CALIFICACIÓN:', margin, y, 11, fontBold);
    drawText('★'.repeat(data.rating) + '☆'.repeat(5 - data.rating), margin + 90, y, 14, font, COLORS.orange);
    drawText(`(${data.rating}/5)`, margin + 180, y, 9, font, COLORS.muted);
  }

  // Footer
  y = margin + 40;
  drawLine(y + 10);
  y -= 5;
  drawText('Este comprobante es válido como constancia de servicio.', margin, y, 8, fontOblique, COLORS.muted);
  y -= 12;
  drawText(`Generado el ${new Date().toLocaleString('es-PE')} · Handyman Super App`, margin, y, 8, font, COLORS.muted);
  y -= 12;
  drawText('Consulte su historial en app.handyman.pe', margin, y, 8, font, COLORS.muted);

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export async function downloadPDF(data: ServiceReceiptData, filename?: string): Promise<void> {
  const pdfBytes = await generateServiceReceipt(data);
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `comprobante-${data.requestId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function generatePDFBase64(data: ServiceReceiptData): Promise<string> {
  const pdfBytes = await generateServiceReceipt(data);
  return btoa(String.fromCharCode(...pdfBytes));
}