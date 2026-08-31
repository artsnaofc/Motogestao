import jsPDF from 'jspdf';
import { FreightQuote } from '../types/freight';
import { freightStorage } from './freightStorage';

interface GeneratePdfOptions {
  action?: 'download' | 'share' | 'blob' | 'print';
  userId?: string;
}

const paymentLabels: Record<string, string> = {
  pix: 'PIX (À Vista / Chave Direta)',
  dinheiro: 'Dinheiro na Entrega',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  faturado_15d: 'Faturado 15 Dias (Boleto/Transferência)',
  faturado_30d: 'Faturado 30 Dias (Boleto/Transferência)',
  '50_50': '50% no Carregamento + 50% na Entrega',
};

const serviceLabels: Record<string, string> = {
  express: 'Express / Urgente (Direto)',
  agendado: 'Agendado com Data/Hora Fixa',
  dedicado: 'Transporte Dedicado Exclusivo',
  fracionado: 'Fracionado / Coleta Programada',
};

const formatBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
};

/**
 * Generates a clean, vector-based PDF for a Freight Quote using jsPDF.
 * Output is crisp at any zoom, works offline, and supports iframe sandbox environments.
 */
export async function generateFreightQuotePDF(
  quote: FreightQuote,
  options: GeneratePdfOptions = {}
): Promise<{ doc: jsPDF; filename: string; blob: Blob }> {
  const { userId = 'default' } = options;
  const vehicleInfo = freightStorage.getVehicleInfo(quote, quote.user_id || userId);

  // A4 dimensions in mm: 210 x 297
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  let currentY = margin;

  // Helper colors
  const primaryColor = [22, 101, 192]; // Vibrant Blue #1665C0
  const primaryDark = [15, 23, 42]; // Slate 900 #0f172a
  const textDark = [30, 41, 59]; // Slate 800 #1e293b
  const textMuted = [100, 116, 139]; // Slate 500 #64748b
  const bgLight = [248, 250, 252]; // Slate 50 #f8fafc
  const bgBorder = [226, 232, 240]; // Slate 200 #e2e8f0
  const emeraldColor = [5, 150, 105]; // Emerald 600 #059669
  const amberColor = [217, 119, 6]; // Amber 600 #d97706

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - margin - 10) {
      doc.addPage();
      currentY = margin;
      drawHeaderWatermark();
    }
  };

  const drawHeaderWatermark = () => {
    doc.setFontSize(8);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(`Orçamento de Frete #${quote.code} - ${quote.client_name}`, margin, 8);
    doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, 10, pageWidth - margin, 10);
  };

  // ==========================================
  // 1. TOP HEADER & BRANDING BAR
  // ==========================================
  // Header background block
  doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.roundedRect(margin, currentY, contentWidth, 26, 3, 3, 'F');

  // Left Title
  const companyTitle = quote.driver_company || quote.driver_name || 'Transportes & Logística';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(companyTitle, margin + 6, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // Slate 300
  const subTitle = quote.driver_document 
    ? `Soluções em Logística e Transporte | CNPJ/CPF: ${quote.driver_document}`
    : 'Soluções Ágeis em Frete Dedicado e Entregas Expressas';
  doc.text(subTitle, margin + 6, currentY + 16);

  if (quote.driver_phone) {
    doc.setFontSize(8);
    doc.text(`Contato: ${quote.driver_phone}`, margin + 6, currentY + 22);
  }

  // Right Badge: Quote Code & Date
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(pageWidth - margin - 52, currentY + 4, 46, 18, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('ORÇAMENTO DE FRETE', pageWidth - margin - 52 + 23, currentY + 9, { align: 'center' });

  doc.setFontSize(10.5);
  doc.text(quote.code, pageWidth - margin - 52 + 23, currentY + 15, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(224, 231, 255);
  doc.text(`Emissão: ${formatDate(quote.created_at)}`, pageWidth - margin - 52 + 23, currentY + 19.5, { align: 'center' });

  currentY += 29;

  // ==========================================
  // 2. CLIENT & TRANSPORTER INFO CARDS
  // ==========================================
  const cardWidth = (contentWidth - 4) / 2;
  const cardHeight = 32;

  // Client Card
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('DADOS DO CLIENTE / CONTRATANTE', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const clientName = quote.client_name || 'Cliente';
  doc.text(clientName.length > 30 ? clientName.substring(0, 28) + '...' : clientName, margin + 4, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  let clientLineY = currentY + 17;
  if (quote.client_company) {
    doc.text(`Empresa: ${quote.client_company}`, margin + 4, clientLineY);
    clientLineY += 4.5;
  }
  if (quote.client_phone) {
    doc.text(`Telefone / Whats: ${quote.client_phone}`, margin + 4, clientLineY);
    clientLineY += 4.5;
  }
  if (quote.client_email) {
    doc.text(`E-mail: ${quote.client_email}`, margin + 4, clientLineY);
  }

  // Transporter / Vehicle Card
  const rightCardX = margin + cardWidth + 4;
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.roundedRect(rightCardX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('PRESTADOR & VEÍCULO DESIGNADO', rightCardX + 4, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const driverDisplay = quote.driver_name || 'Profissional Autônomo';
  doc.text(driverDisplay, rightCardX + 4, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Veículo: ${vehicleInfo.label}`, rightCardX + 4, currentY + 17);
  doc.text(`Capacidade: ${vehicleInfo.maxWeight || 'Padrão'}`, rightCardX + 4, currentY + 21.5);
  if (quote.valid_until) {
    doc.text(`Validade da Proposta: até ${formatDate(quote.valid_until)}`, rightCardX + 4, currentY + 26);
  } else {
    doc.text('Validade da Proposta: 48 horas após emissão', rightCardX + 4, currentY + 26);
  }

  currentY += cardHeight + 4;

  // ==========================================
  // 3. ROUTE & CARGO SPECIFICATION
  // ==========================================
  const routeBoxHeight = quote.additional_stops && quote.additional_stops.length > 0 ? 44 : 36;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
  doc.roundedRect(margin, currentY, contentWidth, routeBoxHeight, 2, 2, 'FD');

  // Title bar inside route box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('ITINERÁRIO E DETALHES DO TRANSPORTE', margin + 4, currentY + 6);

  // Route metrics pill on top right
  const routePillText = `${quote.total_calculated_km.toFixed(1)} KM ${quote.is_round_trip ? '(Ida e Volta)' : '(Apenas Ida)'} • ${serviceLabels[quote.service_type] || 'Transporte Direto'}`;
  doc.setFontSize(7.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(routePillText, pageWidth - margin - 4, currentY + 6, { align: 'right' });

  // Draw Origin
  doc.setFillColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  doc.circle(margin + 6, currentY + 13, 1.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  doc.text('COLETA (ORIGEM):', margin + 10, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const originFull = quote.origin_neighborhood 
    ? `${quote.origin_address} (${quote.origin_neighborhood})`
    : quote.origin_address;
  doc.text(originFull.length > 70 ? originFull.substring(0, 68) + '...' : originFull, margin + 10, currentY + 15.5);

  let routeLineY = currentY + 21;

  // Stops (if any)
  if (quote.additional_stops && quote.additional_stops.length > 0) {
    quote.additional_stops.slice(0, 2).forEach((stop, idx) => {
      doc.setFillColor(amberColor[0], amberColor[1], amberColor[2]);
      doc.circle(margin + 6, routeLineY + 1, 1.4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(amberColor[0], amberColor[1], amberColor[2]);
      doc.text(`PARADA ${idx + 1}:`, margin + 10, routeLineY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(stop.address.length > 70 ? stop.address.substring(0, 68) + '...' : stop.address, margin + 10, routeLineY + 3.5);
      routeLineY += 6;
    });
  }

  // Draw Destination
  doc.setFillColor(225, 29, 72); // Rose 600
  doc.circle(margin + 6, routeLineY + 1, 1.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(225, 29, 72);
  doc.text('ENTREGA (DESTINO):', margin + 10, routeLineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const destFull = quote.destination_neighborhood 
    ? `${quote.destination_address} (${quote.destination_neighborhood})`
    : quote.destination_address;
  doc.text(destFull.length > 70 ? destFull.substring(0, 68) + '...' : destFull, margin + 10, routeLineY + 3.5);

  currentY += routeBoxHeight + 3;

  // Cargo mini-bar
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.roundedRect(margin, currentY, contentWidth, 12, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(`Carga: ${quote.cargo_description || 'Volumes diversos'}`, margin + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  const cargoDetails = [
    quote.cargo_weight_kg ? `Peso: ${quote.cargo_weight_kg} kg` : null,
    quote.cargo_value ? `Valor Declarado: ${formatBRL(quote.cargo_value)}` : null,
    quote.scheduled_date ? `Data: ${formatDate(quote.scheduled_date)}` : null,
    quote.scheduled_time ? `Horário: ${quote.scheduled_time}` : null,
  ].filter(Boolean).join('  |  ');
  doc.text(cargoDetails || 'Horário comercial / Envio sob agendamento', margin + 4, currentY + 9.5);

  currentY += 15;

  // ==========================================
  // 4. FINANCIAL DISCRIMINATION TABLE
  // ==========================================
  checkPageBreak(70);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('DISCRIMINAÇÃO DETALHADA DOS VALORES', margin, currentY + 4);

  currentY += 6;

  // Table Header
  doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.roundedRect(margin, currentY, contentWidth, 7, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('ITEM / ESPECIFICAÇÃO DO SERVIÇO', margin + 4, currentY + 4.8);
  doc.text('QUANTIDADE / REF.', margin + 115, currentY + 4.8);
  doc.text('VALOR', pageWidth - margin - 4, currentY + 4.8, { align: 'right' });

  currentY += 7;

  // Table Rows
  const tableRows: Array<{ label: string; ref: string; value: number; isDiscount?: boolean }> = [
    {
      label: 'Taxa Base de Saída e Disponibilidade de Veículo',
      ref: 'Taxa Fixa',
      value: quote.base_fee,
    },
    {
      label: `Deslocamento Quilométrico (${quote.total_calculated_km.toFixed(1)} km × ${formatBRL(quote.price_per_km)}/km)`,
      ref: `${quote.total_calculated_km.toFixed(1)} km`,
      value: quote.total_calculated_km * quote.price_per_km,
    },
  ];

  if (quote.extra_stops_fee > 0) {
    tableRows.push({
      label: 'Paradas Intermediárias Adicionais',
      ref: `${quote.additional_stops?.length || 1} parada(s)`,
      value: quote.extra_stops_fee,
    });
  }

  if (quote.heavy_cargo_fee > 0) {
    tableRows.push({
      label: 'Adicional de Carga Especial / Ajudante Carga e Descarga',
      ref: 'Adicional',
      value: quote.heavy_cargo_fee,
    });
  }

  if (quote.stairs_floor_fee > 0) {
    tableRows.push({
      label: 'Subida / Descida de Escadas e Acesso Difícil',
      ref: 'Serviço',
      value: quote.stairs_floor_fee,
    });
  }

  if (quote.urgent_or_rain_fee > 0) {
    tableRows.push({
      label: 'Adicional de Urgência Imediata / Condições Adversas',
      ref: 'Prioritário',
      value: quote.urgent_or_rain_fee,
    });
  }

  if (quote.night_fee > 0) {
    tableRows.push({
      label: 'Adicional de Horário Noturno / Madrugada',
      ref: 'Noturno',
      value: quote.night_fee,
    });
  }

  if (quote.tolls_fee > 0) {
    tableRows.push({
      label: 'Reembolso de Tarifas de Pedágio no Trajeto',
      ref: 'Tarifas',
      value: quote.tolls_fee,
    });
  }

  if (quote.waiting_hours_fee > 0) {
    tableRows.push({
      label: 'Tempo de Espera no Ponto Contratado',
      ref: 'Horas',
      value: quote.waiting_hours_fee,
    });
  }

  if (quote.discount > 0) {
    tableRows.push({
      label: 'Desconto Comercial Aplicado',
      ref: 'Bonificação',
      value: quote.discount,
      isDiscount: true,
    });
  }

  tableRows.forEach((row, idx) => {
    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
      doc.rect(margin, currentY, contentWidth, 6.2, 'F');
    }

    doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
    doc.setLineWidth(0.15);
    doc.line(margin, currentY + 6.2, pageWidth - margin, currentY + 6.2);

    doc.setFont('helvetica', row.isDiscount ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(
      row.isDiscount ? emeraldColor[0] : textDark[0],
      row.isDiscount ? emeraldColor[1] : textDark[1],
      row.isDiscount ? emeraldColor[2] : textDark[2]
    );

    doc.text(row.label, margin + 4, currentY + 4.3);
    doc.text(row.ref, margin + 115, currentY + 4.3);

    const valFormatted = row.isDiscount ? `- ${formatBRL(row.value)}` : formatBRL(row.value);
    doc.text(valFormatted, pageWidth - margin - 4, currentY + 4.3, { align: 'right' });

    currentY += 6.2;
  });

  // TOTAL ROW
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(margin, currentY + 1, contentWidth, 9, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('VALOR TOTAL DO SERVIÇO DE FRETE:', margin + 4, currentY + 6.8);

  doc.setFontSize(11);
  doc.text(formatBRL(quote.total_price), pageWidth - margin - 4, currentY + 7, { align: 'right' });

  currentY += 14;

  // ==========================================
  // 5. PAYMENT & PIX CONDITIONS
  // ==========================================
  checkPageBreak(40);

  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
  doc.roundedRect(margin, currentY, contentWidth, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('FORMA DE PAGAMENTO & INFORMAÇÕES BANCÁRIAS', margin + 4, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  const paymentTitle = paymentLabels[quote.payment_method] || quote.payment_method;
  doc.text(`Condição: ${paymentTitle}`, margin + 4, currentY + 11);

  if (quote.pix_key) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(`Chave PIX (${quote.pix_key_type.toUpperCase()}): ${quote.pix_key}`, margin + 4, currentY + 15.5);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Comprovante deve ser enviado ao transportador após a realização do pagamento.', pageWidth - margin - 4, currentY + 11, { align: 'right' });

  currentY += 21;

  // ==========================================
  // 6. TERMS & OBSERVATIONS
  // ==========================================
  if (quote.terms_and_conditions || quote.observations) {
    checkPageBreak(35);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text('TERMOS E OBSERVAÇÕES:', margin, currentY + 4);
    currentY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);

    const fullText = [
      quote.terms_and_conditions,
      quote.observations ? `Notas adicionais: ${quote.observations}` : '',
    ].filter(Boolean).join('\n\n');

    const splitTerms = doc.splitTextToSize(fullText, contentWidth - 4);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
    const termsBoxHeight = Math.min(splitTerms.length * 3.2 + 4, 30);
    doc.roundedRect(margin, currentY, contentWidth, termsBoxHeight, 1.5, 1.5, 'FD');
    doc.text(splitTerms.slice(0, 8), margin + 3, currentY + 4);

    currentY += termsBoxHeight + 5;
  }

  // ==========================================
  // 7. SIGNATURES & ACCEPTANCE FOOTER
  // ==========================================
  checkPageBreak(25);

  const sigWidth = 70;
  const sigY = pageHeight - margin - 15;

  // Transporter Signature Line
  doc.setDrawColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setLineWidth(0.3);
  doc.line(margin + 5, sigY, margin + 5 + sigWidth, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(quote.driver_name || 'Transportador Responsável', margin + 5 + sigWidth / 2, sigY + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Assinatura do Prestador', margin + 5 + sigWidth / 2, sigY + 7.5, { align: 'center' });

  // Client Signature Line
  const rightSigX = pageWidth - margin - 5 - sigWidth;
  doc.line(rightSigX, sigY, rightSigX + sigWidth, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(quote.client_name || 'Cliente Contratante', rightSigX + sigWidth / 2, sigY + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Aceite e Autorização', rightSigX + sigWidth / 2, sigY + 7.5, { align: 'center' });

  // Footer note
  doc.setFontSize(6);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Documento gerado eletronicamente. Proposta sujeita a confirmação de agendamento.', pageWidth / 2, pageHeight - 5, { align: 'center' });

  // Generate output Blob and Filename
  const cleanClient = (quote.client_name || 'cliente').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `Orcamento_${quote.code}_${cleanClient}.pdf`;
  const blob = doc.output('blob');

  return { doc, filename, blob };
}

/**
 * Downloads the PDF directly to user's computer or phone.
 */
export async function downloadFreightQuotePDF(quote: FreightQuote, userId: string = 'default'): Promise<void> {
  const { doc, filename } = await generateFreightQuotePDF(quote, { userId, action: 'download' });
  doc.save(filename);
}

/**
 * Shares the PDF with mandatory PDF file attachment using Mobile Share API (WhatsApp, etc.) or downloads and opens WhatsApp with attachment message.
 */
export async function shareFreightQuotePDF(quote: FreightQuote, userId: string = 'default'): Promise<boolean> {
  const { blob, filename } = await generateFreightQuotePDF(quote, { userId, action: 'share' });
  const messageText = `Olá! Segue em anexo a proposta comercial formal em PDF do frete ${quote.code} (${formatBRL(quote.total_price)}).`;

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Orçamento de Frete ${quote.code}`,
          text: messageText,
        });
        return true;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Share API failed, fallback to download & WhatsApp:', err);
      } else {
        return false;
      }
    }
  }

  // Fallback: direct download PDF and open WhatsApp if phone exists
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);

  // If client phone exists, open WhatsApp with attachment message
  const rawPhone = (quote.client_phone || '').replace(/\D/g, '');
  const cleanPhone = rawPhone.startsWith('55') ? rawPhone : (rawPhone ? `55${rawPhone}` : '');
  const encodedMsg = encodeURIComponent(messageText);

  if (cleanPhone && cleanPhone.length >= 10) {
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
    window.open(waUrl, '_blank');
  }

  return true;
}
