// Gerador de PDF de orçamento de mudança.
// jsPDF é carregado sob demanda (lazy import) pra não pesar o bundle inicial.

let jsPDFPromise = null;
function loadJsPDF() {
  if (!jsPDFPromise) {
    jsPDFPromise = import('jspdf').then(m => m.jsPDF || m.default);
  }
  return jsPDFPromise;
}

const BRL = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// Converte "#RRGGBB" em [r,g,b] pra jsPDF; retorna null se inválido
function hexToRgbArr(hex) {
  if (!hex) return null;
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

// Detecta dimensões de uma imagem base64 pra manter proporção
function imgSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Gera e baixa (ou retorna) o PDF do orçamento.
 * @param {object} cot - registro da cotação
 * @param {object} calc - resultado de calcularOrcamento (linhas, matDetalhe, total, etc.)
 * @param {object} empresa - { nome, logoUrl, cnpj, telefone, endereco, cidade, uf, emailContato }
 * @param {object} opts - { modo: 'download' | 'blob' }
 * @returns {Promise<Blob|void>}
 */
export async function gerarOrcamentoPDF(cot, calc, empresa = {}, opts = {}) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297;
  const M = 16; // margem
  // Cor de destaque do PDF = cor primária da paleta da empresa (fallback: azul-marinho GSO)
  const BORDO = hexToRgbArr(empresa.corPrimaria) || [11, 21, 51];
  const INK = [11, 19, 36];
  const GRAY = [110, 118, 130];
  let y = M;

  // ---------- MARCA D'ÁGUA (logo grande, clara, centralizada) ----------
  if (empresa.logoUrl) {
    try {
      const size = await imgSize(empresa.logoUrl);
      if (size) {
        const maxW = 120;
        const ratio = size.h / size.w;
        const w = maxW, h = maxW * ratio;
        const x = (PW - w) / 2;
        const yy = (PH - h) / 2;
        // jsPDF não tem opacity nativa fácil em imagens; usamos GState se disponível
        if (doc.setGState) {
          const gs = new doc.GState({ opacity: 0.07 });
          doc.setGState(gs);
          doc.addImage(empresa.logoUrl, 'PNG', x, yy, w, h, undefined, 'FAST');
          doc.setGState(new doc.GState({ opacity: 1 }));
        } else {
          doc.addImage(empresa.logoUrl, 'PNG', x, yy, w, h, undefined, 'FAST');
        }
      }
    } catch (e) { /* silencioso: PDF sai sem marca d'água */ }
  }

  // ---------- CABEÇALHO ----------
  // Logo pequeno no topo esquerdo
  let headerTextX = M;
  if (empresa.logoUrl) {
    try {
      const size = await imgSize(empresa.logoUrl);
      if (size) {
        const lw = 22, lh = 22 * (size.h / size.w);
        doc.addImage(empresa.logoUrl, 'PNG', M, y, lw, Math.min(lh, 22));
        headerTextX = M + lw + 6;
      }
    } catch (e) { /* ok */ }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...BORDO);
  doc.text(empresa.nome || 'Orçamento de Mudança', headerTextX, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  const contatoLinhas = [];
  if (empresa.cnpj) contatoLinhas.push(`CNPJ: ${empresa.cnpj}`);
  const locParts = [empresa.endereco, empresa.cidade, empresa.uf].filter(Boolean);
  if (locParts.length) contatoLinhas.push(locParts.join(', '));
  const contato2 = [empresa.telefone, empresa.emailContato].filter(Boolean).join('  ·  ');
  if (contato2) contatoLinhas.push(contato2);
  contatoLinhas.forEach((linha, i) => doc.text(linha, headerTextX, y + 13 + i * 4.5));

  y += 30;
  doc.setDrawColor(...BORDO);
  doc.setLineWidth(0.6);
  doc.line(M, y, PW - M, y);
  y += 8;

  // ---------- TÍTULO + Nº ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text('ORÇAMENTO DE ' + (cot.tipoServico || 'MUDANÇA').toUpperCase(), M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  const hoje = new Date().toLocaleDateString('pt-BR');
  doc.text(`Emitido em ${hoje}`, PW - M, y, { align: 'right' });
  y += 9;

  // ---------- DADOS DO CLIENTE / SERVIÇO ----------
  const box = (titulo, linhas, x, largura) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...BORDO);
    doc.text(titulo.toUpperCase(), x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    linhas.forEach((l, i) => doc.text(l, x, y + 6 + i * 5));
  };

  const colW = (PW - M * 2 - 8) / 2;
  box('Cliente', [
    cot.clienteNome || '—',
    cot.clienteTelefone || '',
  ].filter(Boolean), M, colW);
  box('Serviço', [
    `Data: ${fmtData(cot.dataPrevista)}${cot.horaPrevista ? ' às ' + cot.horaPrevista : ''}`,
    `Origem: ${cot.origem || '—'}`,
    `Destino: ${cot.destino || '—'}`,
    `Distância: ${cot.distanciaKm || 0} km`,
    `Imóvel: ${cot.tipoImovel || '—'}`,
  ], M + colW + 8, colW);

  y += 6 + 5 * 5 + 6;

  // ---------- ITENS ----------
  const itens = Object.entries(cot.itens || {}).filter(([, q]) => q > 0);
  if (itens.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...BORDO);
    doc.text('ITENS DA MUDANÇA', M, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const itensTxt = itens.map(([n, q]) => `${n} (${q})`).join('  ·  ');
    const linhasQuebradas = doc.splitTextToSize(itensTxt, PW - M * 2);
    doc.text(linhasQuebradas, M, y);
    y += linhasQuebradas.length * 4.5 + 5;
  }

  // ---------- TABELA DE COMPOSIÇÃO ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...BORDO);
  doc.text('COMPOSIÇÃO DO VALOR', M, y);
  y += 6;

  const drawRow = (label, valor, bold = false) => {
    if (y > PH - 40) { doc.addPage(); y = M; }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...(bold ? INK : GRAY));
    const labelLines = doc.splitTextToSize(label, PW - M * 2 - 35);
    doc.text(labelLines, M, y);
    doc.setTextColor(...INK);
    doc.text(BRL(valor), PW - M, y, { align: 'right' });
    y += labelLines.length * 4.8 + 1.5;
  };

  (calc.linhas || []).forEach(l => drawRow(l.label, l.valor));
  if ((calc.matDetalhe || []).length > 0) {
    y += 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text('Materiais', M, y);
    y += 4.5;
    calc.matDetalhe.forEach(l => drawRow(l.label, l.valor));
  }
  if (calc.aplicouMinimo) drawRow('Valor mínimo do frete aplicado', calc.subtotal);
  if (calc.desconto > 0) drawRow('Desconto', -calc.desconto);

  // ---------- TOTAL ----------
  y += 3;
  if (y > PH - 40) { doc.addPage(); y = M; }
  doc.setFillColor(...BORDO);
  doc.roundedRect(M, y, PW - M * 2, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('VALOR TOTAL', M + 5, y + 10);
  doc.setFontSize(15);
  doc.text(BRL(calc.total), PW - M - 5, y + 10.5, { align: 'right' });
  y += 22;

  // ---------- OBSERVAÇÕES ----------
  if (cot.obs) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...BORDO);
    doc.text('OBSERVAÇÕES', M, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const obsLines = doc.splitTextToSize(cot.obs, PW - M * 2);
    doc.text(obsLines, M, y);
    y += obsLines.length * 4.5 + 4;
  }

  // ---------- ASSINATURA / RODAPÉ ----------
  const footerY = PH - 24;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(M, footerY, M + 70, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Assinatura', M, footerY + 4);

  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text(
    `Orçamento válido por 7 dias · Gerado por ${empresa.nome || 'Gestão GSO'}`,
    PW / 2, PH - 10, { align: 'center' }
  );

  const nomeArq = `Orcamento_${(cot.clienteNome || 'cliente').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  if (opts.modo === 'blob') {
    return doc.output('blob');
  }
  doc.save(nomeArq);
}
