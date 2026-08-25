// Gerador do PDF de cobrança do lojista (fechamento quinzenal).
// Mesmo layout do orçamento de Mudanças: marca d'água do logo, timbrado
// com os dados da empresa e cor de destaque vinda da paleta escolhida.
// jsPDF carregado sob demanda para não pesar o bundle inicial.

let jsPDFPromise = null;
function loadJsPDF() {
  if (!jsPDFPromise) jsPDFPromise = import('jspdf').then(m => m.jsPDF || m.default);
  return jsPDFPromise;
}

const BRL = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  return d ? `${d}/${m}/${y}` : iso;
};

function hexToRgbArr(hex) {
  if (!hex) return null;
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

function imgSize(dataUrl) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve(null);
      // Trava de segurança: logo que nunca carrega não pode travar o PDF.
      setTimeout(() => resolve(null), 4000);
      img.src = dataUrl;
    } catch (e) { resolve(null); }
  });
}

/**
 * Gera o PDF de cobrança de um fechamento de lojista.
 *
 * @param {object} fech    - { numero, periodoLabel, inicio, fim, vencimento, qtdTotal, total, linhas[] }
 *                           linhas: [{ data, qtd, tarifa, total, usouMinimo }]
 * @param {object} lojista - { nome, documento, telefone, endereco, contato }
 * @param {object} empresa - { nome, logoUrl, cnpj, telefone, endereco, cidade, uf, emailContato, corPrimaria, pixCobranca }
 * @param {object} opts    - { modo: 'download' | 'blob' }
 */
export async function gerarCobrancaPDF(fech, lojista = {}, empresa = {}, opts = {}) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, M = 16;
  const COR = hexToRgbArr(empresa.corPrimaria) || [11, 21, 51];
  const INK = [11, 19, 36];
  const GRAY = [110, 118, 130];
  let y = M;

  // ---------- MARCA D'ÁGUA (repetida em cada página) ----------
  let logoDims = null;
  if (empresa.logoUrl) {
    try { logoDims = await imgSize(empresa.logoUrl); } catch (e) { /* ok */ }
  }
  const marcaDagua = () => {
    if (!empresa.logoUrl || !logoDims) return;
    try {
      const maxW = 120, ratio = logoDims.h / logoDims.w;
      const w = maxW, h = maxW * ratio;
      const x = (PW - w) / 2, yy = (PH - h) / 2;
      if (doc.setGState) {
        doc.setGState(new doc.GState({ opacity: 0.07 }));
        doc.addImage(empresa.logoUrl, 'PNG', x, yy, w, h, undefined, 'FAST');
        doc.setGState(new doc.GState({ opacity: 1 }));
      }
    } catch (e) { /* silencioso */ }
  };
  marcaDagua();

  const novaPagina = (minEspaco = 30) => {
    if (y > PH - minEspaco) { doc.addPage(); y = M; marcaDagua(); return true; }
    return false;
  };

  // ---------- CABEÇALHO ----------
  let tx = M;
  if (empresa.logoUrl && logoDims) {
    try {
      const lw = 22, lh = Math.min(22 * (logoDims.h / logoDims.w), 22);
      doc.addImage(empresa.logoUrl, 'PNG', M, y, lw, lh);
      tx = M + lw + 6;
    } catch (e) { /* ok */ }
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...COR);
  doc.text(empresa.nome || 'Cobrança', tx, y + 7);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY);
  const cab = [];
  if (empresa.cnpj) cab.push(`CNPJ: ${empresa.cnpj}`);
  const loc = [empresa.endereco, empresa.cidade, empresa.uf].filter(Boolean).join(', ');
  if (loc) cab.push(loc);
  const contato = [empresa.telefone, empresa.emailContato].filter(Boolean).join('  ·  ');
  if (contato) cab.push(contato);
  cab.forEach((l, i) => doc.text(l, tx, y + 13 + i * 4.5));

  y += 30;
  doc.setDrawColor(...COR); doc.setLineWidth(0.6);
  doc.line(M, y, PW - M, y);
  y += 8;

  // ---------- TÍTULO ----------
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...INK);
  doc.text('DEMONSTRATIVO DE COLETAS', M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, PW - M, y, { align: 'right' });
  y += 6;
  doc.setFontSize(10); doc.setTextColor(...INK);
  doc.text(`Período ${fmtData(fech.inicio)} a ${fmtData(fech.fim)}`, M, y);
  if (fech.numero) {
    doc.setTextColor(...GRAY); doc.setFontSize(9);
    doc.text(`Nº ${fech.numero}`, PW - M, y, { align: 'right' });
  }
  y += 10;

  // ---------- DADOS DO LOJISTA ----------
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...COR);
  doc.text('COBRAR DE', M, y);
  y += 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK);
  doc.text(lojista.nome || '—', M, y);
  y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY);
  const dadosLoj = [
    lojista.documento && `CNPJ/CPF: ${lojista.documento}`,
    [lojista.contato, lojista.telefone].filter(Boolean).join('  ·  '),
    lojista.endereco,
  ].filter(Boolean);
  dadosLoj.forEach((l, i) => doc.text(l, M, y + i * 4.5));
  y += dadosLoj.length * 4.5 + 8;

  // ---------- TABELA DE COLETAS ----------
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...COR);
  doc.text('COLETAS DO PERÍODO', M, y);
  y += 6;

  const cabecalhoTabela = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
    doc.text('DATA', M, y);
    doc.text('MARKETPLACE / VOLUMES', M + 74, y, { align: 'right' });
    doc.text('VALOR UNIT.', M + 122, y, { align: 'right' });
    doc.text('SUBTOTAL', PW - M, y, { align: 'right' });
    y += 4;
    doc.setDrawColor(225, 229, 235); doc.setLineWidth(0.25);
    doc.line(M, y - 1, PW - M, y - 1);
    y += 3;
  };
  cabecalhoTabela();

  // Uma coleta pode trazer pacotes de vários marketplaces, cada um com sua
  // tarifa. Por isso a data aparece uma vez e as linhas abaixo detalham a
  // quebra — é assim que o lojista consegue conferir contra o painel dele.
  (fech.linhas || []).forEach((l) => {
    const det = (l.detalhe && l.detalhe.length)
      ? l.detalhe
      : [{ plataforma: '', qtd: l.qtd, tarifa: l.tarifa, subtotal: l.bruto != null ? l.bruto : l.total }];
    const varios = det.length > 1;

    if (novaPagina(38 + det.length * 5)) { cabecalhoTabela(); }

    doc.setFont('helvetica', varios ? 'bold' : 'normal');
    doc.setFontSize(9); doc.setTextColor(...INK);
    doc.text(fmtData(l.data), M, y);

    if (!varios) {
      const d = det[0];
      if (d.plataforma) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY);
        doc.text(String(d.plataforma), M + 26, y);
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK);
      doc.text(String(d.qtd), M + 74, y, { align: 'right' });
      doc.setTextColor(...GRAY);
      doc.text(BRL(d.tarifa), M + 122, y, { align: 'right' });
      doc.setTextColor(...INK);
      doc.text(BRL(l.total), PW - M, y, { align: 'right' });
      y += 5.4;
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK);
      doc.text(String(l.qtd), M + 74, y, { align: 'right' });
      doc.text(BRL(l.total), PW - M, y, { align: 'right' });
      y += 5;
      det.forEach((d) => {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRAY);
        doc.text(String(d.plataforma || '—'), M + 6, y);
        doc.text(String(d.qtd), M + 74, y, { align: 'right' });
        doc.text(BRL(d.tarifa), M + 122, y, { align: 'right' });
        doc.text(BRL(d.subtotal), PW - M, y, { align: 'right' });
        y += 4.6;
      });
      y += 1;
    }

    if (l.usouMinimo) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
      doc.text('valor mínimo de coleta aplicado', M + 6, y);
      y += 4.4;
    }
  });

  y += 2;
  doc.setDrawColor(225, 229, 235); doc.setLineWidth(0.25);
  doc.line(M, y, PW - M, y);
  y += 6;

  // ---------- RESUMO ----------
  novaPagina(48);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRAY);
  doc.text('Total de volumes coletados', M, y);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
  doc.text(String(fech.qtdTotal || 0), PW - M, y, { align: 'right' });
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY);
  doc.text('Coletas realizadas', M, y);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
  doc.text(String((fech.linhas || []).length), PW - M, y, { align: 'right' });
  y += 10;

  // ---------- TOTAL ----------
  novaPagina(40);
  doc.setFillColor(...COR);
  doc.roundedRect(M, y, PW - M * 2, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text('TOTAL A PAGAR', M + 5, y + 10);
  doc.setFontSize(15);
  doc.text(BRL(fech.total), PW - M - 5, y + 10.5, { align: 'right' });
  y += 22;

  if (fech.vencimento) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK);
    doc.text(`Vencimento: ${fmtData(fech.vencimento)}`, M, y);
    y += 7;
  }

  if (empresa.pixCobranca) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...COR);
    doc.text('PAGAMENTO VIA PIX', M, y);
    y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
    doc.text(String(empresa.pixCobranca), M, y);
    y += 8;
  }

  if (fech.obs) {
    novaPagina(30);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...COR);
    doc.text('OBSERVAÇÕES', M, y);
    y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
    const obs = doc.splitTextToSize(String(fech.obs), PW - M * 2);
    doc.text(obs, M, y);
    y += obs.length * 4.5;
  }

  // ---------- RODAPÉ ----------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
    doc.text(`${empresa.nome || 'Gestão GSO'} · Demonstrativo de coletas`, M, PH - 10);
    doc.text(`Página ${i} de ${total}`, PW - M, PH - 10, { align: 'right' });
  }

  const slug = String(lojista.nome || 'lojista')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
  const nomeArq = `Cobranca_${slug}_${fech.inicio || ''}.pdf`;

  if (opts.modo === 'blob') return doc.output('blob');
  doc.save(nomeArq);
}
