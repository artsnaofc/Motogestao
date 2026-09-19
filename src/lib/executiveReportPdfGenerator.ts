import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { UserSettings } from '../types';
import { toast } from './toast';

export interface ReportPDFData {
  grossIncome: number;
  totalOpExpense: number;
  opNetResult: number;
  opMargin: number;
  perExpense: number;
  netProfitReal: number;
  netMargin: number;
  totalKm: number;
  rpk: number;
  cpk: number;
  cpkFuel: number;
  cpkMaint: number;
  lpk: number;
  moe: number;
  fatBreakeven: number;
  kmBreakeven: number;
  safetyMarginPct: number;
  incomeByCategory: Record<string, number>;
  perByCategory: Record<string, number>;
  opByCategory: Record<string, number>;
  opFuel: number;
  opMaint: number;
  opOther: number;
  reserveAporte: number;
  reserveSpending: number;
}

const formatBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

/**
 * Generates and downloads a polished, vector-based PDF of the Executive Report using jsPDF.
 */
export async function downloadExecutiveReportPDF(
  dreData: ReportPDFData,
  periodLabel: string,
  settings: UserSettings | null
): Promise<void> {
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

  // Color Palette
  const primaryColor = [16, 185, 129]; // Emerald 500 #10b981
  const secondaryColor = [79, 70, 229]; // Indigo 600 #4f46e5
  const primaryDark = [15, 23, 42]; // Slate 900 #0f172a
  const textDark = [30, 41, 59]; // Slate 800 #1e293b
  const textMuted = [100, 116, 139]; // Slate 500 #64748b
  const bgLight = [248, 250, 252]; // Slate 50 #f8fafc
  const bgBorder = [226, 232, 240]; // Slate 200 #e2e8f0

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
    doc.text(`Relatório Gerencial de Performance - Período: ${periodLabel}`, margin, 8);
    doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, 10, pageWidth - margin, 10);
  };

  // ==========================================
  // 1. HEADER & BRANDING
  // ==========================================
  doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.roundedRect(margin, currentY, contentWidth, 26, 3, 3, 'F');

  // Left Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('RELATÓRIO GERENCIAL DE PERFORMANCE', margin + 6, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // Slate 300
  const operatorName = settings?.full_name || 'Gestão de Frota & Transporte';
  doc.text(`Operador / Responsável: ${operatorName}`, margin + 6, currentY + 17);

  // Right Badge
  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.roundedRect(pageWidth - margin - 52, currentY + 4, 46, 18, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('PERÍODO DE ANÁLISE', pageWidth - margin - 52 + 23, currentY + 9, { align: 'center' });

  doc.setFontSize(9);
  doc.text(periodLabel.toUpperCase(), pageWidth - margin - 52 + 23, currentY + 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(224, 231, 255);
  doc.text(`Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - margin - 52 + 23, currentY + 18.5, { align: 'center' });

  currentY += 31;

  // ==========================================
  // 2. FINANCIAL SUMMARY CARDS (KPIs)
  // ==========================================
  const cardWidth = (contentWidth - 6) / 4;
  const cardHeight = 22;

  const kpis = [
    { title: 'FATURAMENTO BRUTO', value: formatBRL(dreData.grossIncome), color: [16, 185, 129] }, // Emerald
    { title: 'CUSTO OPERACIONAL', value: formatBRL(dreData.totalOpExpense), color: [245, 158, 11] }, // Amber
    { title: 'EBITDA VEICULAR', value: formatBRL(dreData.opNetResult), color: [79, 70, 229] }, // Indigo
    { title: 'LUCRO LÍQUIDO REAL', value: formatBRL(dreData.netProfitReal), color: dreData.netProfitReal >= 0 ? [16, 185, 129] : [239, 68, 68] },
  ];

  kpis.forEach((kpi, idx) => {
    const x = margin + idx * (cardWidth + 2);
    doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
    doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(kpi.title, x + 3.5, currentY + 6);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, x + 3.5, currentY + 13);

    // Context label below
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    let labelText = '';
    if (idx === 0) labelText = '100% da Receita';
    else if (idx === 1) {
      const pct = dreData.grossIncome > 0 ? (dreData.totalOpExpense / dreData.grossIncome) * 100 : 0;
      labelText = `${pct.toFixed(1)}% do Faturamento`;
    } else if (idx === 2) {
      labelText = `Margem Op: ${dreData.opMargin.toFixed(1)}%`;
    } else if (idx === 3) {
      labelText = `Margem Líq: ${dreData.netMargin.toFixed(1)}%`;
    }
    doc.text(labelText, x + 3.5, currentY + 18);
  });

  currentY += cardHeight + 8;

  // ==========================================
  // 3. TABLE 1: DRE GERENCIAL
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('1. DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE GERENCIAL)', margin, currentY);
  currentY += 3;

  doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 2.5;

  // Draw DRE Table Header
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.rect(margin, currentY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('ESTRUTURA DE CONTAS', margin + 4, currentY + 4.5);
  doc.text('VALOR (R$)', pageWidth - margin - 45, currentY + 4.5, { align: 'right' });
  doc.text('% RECEITA', pageWidth - margin - 4, currentY + 4.5, { align: 'right' });
  currentY += 6;

  const dreRows: Array<{ label: string; value: number; percent: string; isBold: boolean; isSub: boolean; customColor?: number[] }> = [];

  // Faturamento
  dreRows.push({ label: '1.0 RECEITA OPERACIONAL BRUTA', value: dreData.grossIncome, percent: '100.0%', isBold: true, isSub: false, customColor: [16, 185, 129] });
  Object.entries(dreData.incomeByCategory).forEach(([cat, val]) => {
    const num = Number(val);
    const pct = dreData.grossIncome > 0 ? (num / dreData.grossIncome) * 100 : 0;
    dreRows.push({ label: `  (+) ${cat}`, value: num, percent: `${pct.toFixed(1)}%`, isBold: false, isSub: true });
  });

  // OpEx
  dreRows.push({ label: '2.0 CUSTOS OPERACIONAIS VEICULARES (OpEx Direto)', value: dreData.totalOpExpense, percent: `${(dreData.grossIncome > 0 ? (dreData.totalOpExpense / dreData.grossIncome) * 100 : 0).toFixed(1)}%`, isBold: true, isSub: false, customColor: [245, 158, 11] });
  
  // Detailed OpEx category breakdown
  if (Object.keys(dreData.opByCategory).length > 0) {
    Object.entries(dreData.opByCategory).forEach(([cat, val]) => {
      const num = Number(val);
      const pct = dreData.grossIncome > 0 ? (num / dreData.grossIncome) * 100 : 0;
      dreRows.push({ label: `  (-) ${cat}`, value: num, percent: `${pct.toFixed(1)}%`, isBold: false, isSub: true });
    });
  } else {
    dreRows.push({ label: '  (-) Combustível & Abastecimentos', value: dreData.opFuel, percent: `${(dreData.grossIncome > 0 ? (dreData.opFuel / dreData.grossIncome) * 100 : 0).toFixed(1)}%`, isBold: false, isSub: true });
    dreRows.push({ label: '  (-) Manutenção, Peças & Trocas', value: dreData.opMaint, percent: `${(dreData.grossIncome > 0 ? (dreData.opMaint / dreData.grossIncome) * 100 : 0).toFixed(1)}%`, isBold: false, isSub: true });
    if (dreData.opOther > 0) {
      dreRows.push({ label: '  (-) Outros Operacionais (Pedágios/Lava-jato/Equipamentos)', value: dreData.opOther, percent: `${(dreData.grossIncome > 0 ? (dreData.opOther / dreData.grossIncome) * 100 : 0).toFixed(1)}%`, isBold: false, isSub: true });
    }
  }

  // EBITDA
  dreRows.push({ label: '3.0 (=) RESULTADO OPERACIONAL BRUTO (EBITDA VEICULAR)', value: dreData.opNetResult, percent: `${dreData.opMargin.toFixed(1)}%`, isBold: true, isSub: false, customColor: [79, 70, 229] });

  // Pessoais
  dreRows.push({ label: '4.0 (-) DESPESAS PESSOAIS & RETIRADAS (Pró-labore)', value: dreData.perExpense, percent: `${(dreData.grossIncome > 0 ? (dreData.perExpense / dreData.grossIncome) * 100 : 0).toFixed(1)}%`, isBold: true, isSub: false, customColor: [59, 130, 246] });
  Object.entries(dreData.perByCategory).forEach(([cat, val]) => {
    const num = Number(val);
    const pct = dreData.grossIncome > 0 ? (num / dreData.grossIncome) * 100 : 0;
    dreRows.push({ label: `  (-) ${cat}`, value: num, percent: `${pct.toFixed(1)}%`, isBold: false, isSub: true });
  });

  // Net Profit
  dreRows.push({ label: '5.0 (=) LUCRO LÍQUIDO REAL CONSOLIDADO DO PERÍODO', value: dreData.netProfitReal, percent: `${dreData.netMargin.toFixed(1)}%`, isBold: true, isSub: false, customColor: dreData.netProfitReal >= 0 ? [16, 185, 129] : [239, 68, 68] });

  if (dreData.reserveAporte !== 0) {
    dreRows.push({ label: '(±) Aportes e Movimentações de Reservas de Emergência', value: dreData.reserveAporte, percent: '-', isBold: false, isSub: true });
  }

  dreRows.forEach(row => {
    checkPageBreak(5);
    if (row.isBold) {
      doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
      doc.rect(margin, currentY, contentWidth, 5.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      if (row.customColor) {
        doc.setTextColor(row.customColor[0], row.customColor[1], row.customColor[2]);
      } else {
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      }
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    }

    doc.text(row.label, margin + (row.isSub ? 5 : 2), currentY + 4);
    doc.text(formatBRL(row.value), pageWidth - margin - 45, currentY + 4, { align: 'right' });
    doc.text(row.percent, pageWidth - margin - 4, currentY + 4, { align: 'right' });

    doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
    doc.setLineWidth(0.15);
    doc.line(margin, currentY + 5.5, pageWidth - margin, currentY + 5.5);
    currentY += 5.5;
  });

  currentY += 8;

  // ==========================================
  // 4. TABLE 2: PERFORMANCE INDICATORS
  // ==========================================
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('2. INDICADORES GERENCIAIS DE PERFORMANCE E EFICIÊNCIA', margin, currentY);
  currentY += 3;

  doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 2.5;

  // Draw Indicators Table Header
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.rect(margin, currentY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('INDICADOR / DESCRIÇÃO TÉCNICA', margin + 4, currentY + 4.5);
  doc.text('UNIDADE', pageWidth - margin - 65, currentY + 4.5, { align: 'center' });
  doc.text('VALOR', pageWidth - margin - 40, currentY + 4.5, { align: 'right' });
  doc.text('REFERÊNCIA', pageWidth - margin - 4, currentY + 4.5, { align: 'right' });
  currentY += 6;

  const indicators = [
    { title: 'Quilometragem Total Rodada', sub: 'Distância percorrida no período analisado', unit: 'KM', value: dreData.totalKm > 0 ? `${dreData.totalKm.toLocaleString('pt-BR')} km` : '0 km', ref: 'Registro Operacional' },
    { title: 'Receita Bruta por KM (RPK)', sub: 'Faturamento bruto gerado a cada quilômetro rodado', unit: 'R$/KM', value: `${formatBRL(dreData.rpk)}/km`, ref: 'Rendimento Ativo' },
    { title: 'Custo Operacional por KM (CPK)', sub: 'Soma das despesas veiculares dividida pelos KMs', unit: 'R$/KM', value: `${formatBRL(dreData.cpk)}/km`, ref: 'Custo Logístico' },
    { title: '  • Parcela de Combustível', sub: 'Fração do custo por KM gasta com abastecimentos', unit: 'R$/KM', value: `${formatBRL(dreData.cpkFuel)}/km`, ref: 'Combustível Direto' },
    { title: '  • Parcela de Manutenção', sub: 'Fração do custo por KM gasta com oficinas e peças', unit: 'R$/KM', value: `${formatBRL(dreData.cpkMaint)}/km`, ref: 'Manutenção Geral' },
    { title: 'Lucro Real por KM (LPK)', sub: 'Retorno limpo (lucro líquido real) por quilômetro', unit: 'R$/KM', value: `${formatBRL(dreData.lpk)}/km`, ref: dreData.lpk >= 0 ? 'Lucrativo' : 'Prejuízo p/ KM' },
    { title: 'Multiplicador de Eficiência (MOE)', sub: 'Faturamento bruto dividido pelo custo operacional', unit: 'fator (x)', value: `${dreData.moe.toFixed(2)}x`, ref: dreData.moe >= 1.5 ? 'Alta Eficiência' : 'Média/Baixa' },
    { title: 'Ponto de Equilíbrio Financeiro', sub: 'Faturamento bruto mínimo necessário para cobrir todos os custos', unit: 'R$', value: formatBRL(dreData.fatBreakeven), ref: dreData.grossIncome >= dreData.fatBreakeven ? 'Ponto Superado' : 'Abaixo do Equilíbrio' },
    { title: 'Quilometragem Mínima de Breakeven', sub: 'Distância necessária rodar para equilibrar o caixa', unit: 'KM', value: dreData.kmBreakeven > 0 ? `${Math.round(dreData.kmBreakeven).toLocaleString('pt-BR')} km` : 'N/A', ref: 'Distância Mínima' },
    { title: 'Margem de Segurança Financeira', sub: 'Percentual do faturamento obtido que excede o breakeven', unit: '%', value: `${dreData.safetyMarginPct >= 0 ? '+' : ''}${dreData.safetyMarginPct.toFixed(1)}%`, ref: dreData.safetyMarginPct >= 20 ? 'Excelente' : 'Sensível' },
  ];

  indicators.forEach(ind => {
    checkPageBreak(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(ind.title, margin + 4, currentY + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(ind.sub, margin + 4, currentY + 6.5);

    doc.setFontSize(7.5);
    doc.text(ind.unit, pageWidth - margin - 65, currentY + 5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(ind.value, pageWidth - margin - 40, currentY + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(ind.ref, pageWidth - margin - 4, currentY + 5, { align: 'right' });

    doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
    doc.setLineWidth(0.15);
    doc.line(margin, currentY + 8, pageWidth - margin, currentY + 8);
    currentY += 8;
  });

  currentY += 8;

  // ==========================================
  // 5. BREAKEVEN & SAFETY ANALYSIS
  // ==========================================
  checkPageBreak(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('3. COMPOSIÇÃO DOS CUSTOS & SÍNTESE DIAGNÓSTICA', margin, currentY);
  currentY += 3;

  doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 3;

  // OpEx Visual Progress Bars Box
  const totalOp = dreData.totalOpExpense || 1;
  const pctFuel = (dreData.opFuel / totalOp) * 100;
  const pctMaint = (dreData.opMaint / totalOp) * 100;
  const pctOther = (dreData.opOther / totalOp) * 100;

  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('Distribuição do Custo Operacional (OpEx):', margin + 4, currentY + 5);

  // Bar Graphic Background
  const barX = margin + 4;
  const barY = currentY + 7.5;
  const barWidth = contentWidth - 8;
  const barHeight = 4.5;

  doc.setFillColor(bgBorder[0], bgBorder[1], bgBorder[2]);
  doc.rect(barX, barY, barWidth, barHeight, 'F');

  // Fill Segments
  let currentBarX = barX;
  if (pctFuel > 0) {
    const w = (pctFuel / 100) * barWidth;
    doc.setFillColor(249, 115, 22); // Orange
    doc.rect(currentBarX, barY, w, barHeight, 'F');
    currentBarX += w;
  }
  if (pctMaint > 0) {
    const w = (pctMaint / 100) * barWidth;
    doc.setFillColor(234, 179, 8); // Yellow
    doc.rect(currentBarX, barY, w, barHeight, 'F');
    currentBarX += w;
  }
  if (pctOther > 0) {
    const w = (pctOther / 100) * barWidth;
    doc.setFillColor(6, 182, 212); // Cyan
    doc.rect(currentBarX, barY, w, barHeight, 'F');
  }

  // Legend
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(249, 115, 22);
  doc.text(`■ Combustível: ${formatBRL(dreData.opFuel)} (${pctFuel.toFixed(1)}%)`, margin + 4, currentY + 18);

  doc.setTextColor(202, 138, 4);
  doc.text(`■ Manutenção: ${formatBRL(dreData.opMaint)} (${pctMaint.toFixed(1)}%)`, margin + 65, currentY + 18);

  doc.setTextColor(6, 182, 212);
  doc.text(`■ Outros: ${formatBRL(dreData.opOther)} (${pctOther.toFixed(1)}%)`, margin + 125, currentY + 18);

  currentY += 28;

  // Synthesis Box
  checkPageBreak(25);
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(`Diagnóstico de Breakeven & Sobrevivência Financeira`, margin + 4, currentY + 5.5);

  const isHealthy = dreData.grossIncome >= dreData.fatBreakeven;
  doc.setTextColor(isHealthy ? primaryColor[0] : 220, isHealthy ? primaryColor[1] : 38, isHealthy ? primaryColor[2] : 38);
  doc.text(
    isHealthy 
      ? `STATUS: OPERAÇÃO EM SUPERÁVIT (Faturamento ${((dreData.grossIncome - dreData.fatBreakeven) / (dreData.fatBreakeven || 1) * 100).toFixed(1)}% acima da meta de sobrevivência)` 
      : 'STATUS: OPERAÇÃO EM DÉFICIT (Faturamento abaixo do breakeven de custos fixos e variáveis)', 
    margin + 4, 
    currentY + 11
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    `Faturamento Mínimo Necessário: ${formatBRL(dreData.fatBreakeven)}  |  KM Mínima de Ponto de Equilíbrio: ${dreData.kmBreakeven > 0 ? Math.round(dreData.kmBreakeven).toLocaleString('pt-BR') : 0} km  |  Margem Segurança: ${dreData.safetyMarginPct.toFixed(1)}%`,
    margin + 4,
    currentY + 16
  );

  currentY += 26;

  // Signatures or Footer Disclaimer
  checkPageBreak(15);
  doc.setDrawColor(bgBorder[0], bgBorder[1], bgBorder[2]);
  doc.setLineWidth(0.2);
  doc.line(margin + 20, currentY, margin + 70, currentY);
  doc.line(pageWidth - margin - 70, currentY, pageWidth - margin - 20, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('RESPONSÁVEL OPERACIONAL', margin + 45, currentY + 4, { align: 'center' });
  doc.text('AUDITORIA FINANCEIRA / SISTEMA', pageWidth - margin - 45, currentY + 4, { align: 'center' });

  // Add Page Numbers to all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    doc.text('Sistema de Gestão Financeira & Operacional - Relatório Oficial', margin, pageHeight - 6);
  }

  // Save the PDF
  const filename = `Relatorio_Gerencial_Performance_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(filename);
  toast.success('Relatório Gerencial em PDF gerado e baixado com sucesso!');
}
