// Gerador do Relatório Executivo em PDF.
// Reaproveita os números que o módulo Relatórios já calcula — não recalcula nada.
// jsPDF é carregado sob demanda (lazy import).

let jsPDFPromise = null;
function loadJsPDF() {
  if (!jsPDFPromise) jsPDFPromise = import('jspdf').then(m => m.jsPDF || m.default);
  return jsPDFPromise;
}

const BRL = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PCT = (n) => `${(Number(n) || 0) >= 0 ? '+' : ''}${(Number(n) || 0).toFixed(1)}%`;

function hexToRgbArr(hex) {
  if (!hex) return null;
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

function imgSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

const fmtDataBR = (d) => d instanceof Date
  ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  : '—';

/**
 * Gera o relatório executivo em PDF.
 * @param {object} r - { periodoLabel, inicio, fim, resumo, recCat, cusCat, ranking, insights, extras }
 * @param {object} empresa - { nome, logoUrl, cnpj, telefone, endereco, cidade, uf, emailContato, corPrimaria }
 */
export async function gerarRelatorioPDF(r, empresa = {}) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, M = 16;
  const COR = hexToRgbArr(empresa.corPrimaria) || [11, 21, 51];
  const INK = [11, 19, 36];
  const GRAY = [110, 118, 130];
  const VERDE = [22, 163, 74];
  const VERMELHO = [220, 38, 38];
  let y = M;

  const novaPagina = (minEspaco = 30) => {
    if (y > PH - minEspaco) { doc.addPage(); y = M; marcaDagua(); }
  };

  // marca d'água do logo (repetida em cada página)
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
        doc.setGState(new doc.GState({ opacity: 0.06 }));
        doc.addImage(empresa.logoUrl, 'PNG', x, yy, w, h, undefined, 'FAST');
        doc.setGState(new doc.GState({ opacity: 1 }));
      }
    } catch (e) { /* silencioso */ }
  };
  marcaDagua();

  // ---------- CABEÇALHO ----------
  let tx = M;
  if (empresa.logoUrl && logoDims) {
    try {
      const lw = 20, lh = Math.min(20 * (logoDims.h / logoDims.w), 20);
      doc.addImage(empresa.logoUrl, 'PNG', M, y, lw, lh);
      tx = M + lw + 6;
    } catch (e) { /* ok */ }
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...COR);
  doc.text(empresa.nome || 'Relatório Executivo', tx, y + 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRAY);
  const linhas = [];
  if (empresa.cnpj) linhas.push(`CNPJ: ${empresa.cnpj}`);
  const loc = [empresa.cidade, empresa.uf].filter(Boolean).join(' - ');
  const contato = [loc, empresa.telefone].filter(Boolean).join('  ·  ');
  if (contato) linhas.push(contato);
  linhas.forEach((l, i) => doc.text(l, tx, y + 12.5 + i * 4));

  y += 26;
  doc.setDrawColor(...COR); doc.setLineWidth(0.6);
  doc.line(M, y, PW - M, y);
  y += 8;

  // ---------- TÍTULO ----------
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...INK);
  doc.text('RELATÓRIO EXECUTIVO', M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY);
  doc.text(`Emitido em ${fmtDataBR(new Date())}`, PW - M, y, { align: 'right' });
  y += 6;
  doc.setFontSize(10); doc.setTextColor(...INK);
  doc.text(`${r.periodoLabel} · ${fmtDataBR(r.inicio)} a ${fmtDataBR(r.fim)}`, M, y);
  y += 10;

  // ---------- CARDS DE RESUMO ----------
  const cardW = (PW - M * 2 - 6) / 3;
  const card = (x, titulo, valor, delta, corValor) => {
    doc.setFillColor(247, 248, 250);
    doc.roundedRect(x, y, cardW, 22, 2, 2, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
    doc.text(titulo.toUpperCase(), x + 4, y + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...(corValor || INK));
    doc.text(BRL(valor), x + 4, y + 13.5);
    if (delta !== undefined && delta !== null) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.setTextColor(...(delta >= 0 ? VERDE : VERMELHO));
      doc.text(`${PCT(delta)} vs. período anterior`, x + 4, y + 18.5);
    }
  };
  card(M, 'Receita', r.resumo.receita, r.resumo.gRec, VERDE);
  card(M + cardW + 3, 'Custos', r.resumo.custo, r.resumo.gCus, VERMELHO);
  card(M + (cardW + 3) * 2, 'Lucro', r.resumo.lucro, r.resumo.gLuc, r.resumo.lucro >= 0 ? VERDE : VERMELHO);
  y += 28;

  // margem em destaque
  doc.setFillColor(...COR);
  doc.roundedRect(M, y, PW - M * 2, 13, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.text('MARGEM DE LUCRO DO PERÍODO', M + 5, y + 8.5);
  doc.setFontSize(12);
  doc.text(`${r.resumo.margem.toFixed(1)}%`, PW - M - 5, y + 8.8, { align: 'right' });
  y += 20;

  // ---------- SEÇÃO: helper de tabela ----------
  const titulo = (txt) => {
    novaPagina(40);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...COR);
    doc.text(txt.toUpperCase(), M, y);
    y += 5.5;
  };
  const linhaTabela = (esq, dir, opts = {}) => {
    novaPagina(24);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...(opts.corEsq || GRAY));
    const wrap = doc.splitTextToSize(String(esq), PW - M * 2 - 42);
    doc.text(wrap, M, y);
    doc.setTextColor(...(opts.corDir || INK));
    doc.text(String(dir), PW - M, y, { align: 'right' });
    y += wrap.length * 4.6 + 1.6;
  };
  const separador = () => {
    doc.setDrawColor(233, 236, 240); doc.setLineWidth(0.2);
    doc.line(M, y, PW - M, y); y += 4;
  };

  // ---------- RECEITAS POR CATEGORIA ----------
  if ((r.recCat || []).length > 0) {
    titulo('Receitas por categoria');
    r.recCat.forEach(c => {
      const pct = r.resumo.receita ? (c.valor / r.resumo.receita * 100) : 0;
      linhaTabela(`${c.nome}  (${pct.toFixed(0)}%)`, BRL(c.valor), { corDir: VERDE });
    });
    separador();
    linhaTabela('Total de receitas', BRL(r.resumo.receita), { bold: true, corEsq: INK, corDir: VERDE });
    y += 6;
  }

  // ---------- DESPESAS POR CATEGORIA ----------
  if ((r.cusCat || []).length > 0) {
    titulo('Despesas por categoria');
    r.cusCat.forEach(c => {
      const pct = r.resumo.custo ? (c.valor / r.resumo.custo * 100) : 0;
      linhaTabela(`${c.nome}  (${pct.toFixed(0)}%)`, BRL(c.valor), { corDir: VERMELHO });
    });
    separador();
    linhaTabela('Total de despesas', BRL(r.resumo.custo), { bold: true, corEsq: INK, corDir: VERMELHO });
    y += 6;
  }

  // ---------- RANKING DE OPERAÇÕES ----------
  if ((r.ranking || []).length > 0) {
    titulo('Desempenho por operação / linha');
    novaPagina(30);
    // cabeçalho
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
    doc.text('OPERAÇÃO', M, y);
    doc.text('RECEITA', M + 88, y, { align: 'right' });
    doc.text('CUSTO', M + 122, y, { align: 'right' });
    doc.text('LUCRO', M + 154, y, { align: 'right' });
    doc.text('MARGEM', PW - M, y, { align: 'right' });
    y += 4.5;
    doc.setDrawColor(233, 236, 240); doc.line(M, y - 1.5, PW - M, y - 1.5);

    r.ranking.slice(0, 12).forEach(op => {
      novaPagina(22);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...INK);
      const nome = doc.splitTextToSize(op.nome, 68)[0];
      doc.text(nome, M, y);
      doc.setTextColor(...GRAY);
      doc.text(BRL(op.receita), M + 88, y, { align: 'right' });
      doc.text(BRL(op.custo), M + 122, y, { align: 'right' });
      doc.setTextColor(...(op.lucro >= 0 ? VERDE : VERMELHO));
      doc.text(BRL(op.lucro), M + 154, y, { align: 'right' });
      doc.setTextColor(...INK);
      doc.text(`${op.margem.toFixed(0)}%`, PW - M, y, { align: 'right' });
      y += 5.4;
    });
    y += 6;
  }

  // ---------- INDICADORES OPERACIONAIS ----------
  if (r.extras && Object.keys(r.extras).length > 0) {
    titulo('Indicadores operacionais');
    Object.entries(r.extras).forEach(([k, v]) => linhaTabela(k, v));
    y += 6;
  }

  // ---------- ANÁLISE / INSIGHTS ----------
  if ((r.insights || []).length > 0) {
    titulo('Análise do período');
    r.insights.forEach(txt => {
      novaPagina(26);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK);
      const wrap = doc.splitTextToSize(`•  ${txt}`, PW - M * 2);
      doc.text(wrap, M, y);
      y += wrap.length * 4.8 + 2.4;
    });
  }

  // ---------- RODAPÉ EM TODAS AS PÁGINAS ----------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
    doc.text(`${empresa.nome || 'Gestão GSO'} · Relatório Executivo`, M, PH - 10);
    doc.text(`Página ${i} de ${total}`, PW - M, PH - 10, { align: 'right' });
  }

  const slug = (r.periodoLabel || 'periodo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Relatorio_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
