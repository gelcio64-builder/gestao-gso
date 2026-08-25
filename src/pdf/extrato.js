// Extrato de Repasse do Motoboy.
// Mesmo padrão dos demais PDFs do GSO: marca d'água do logo, timbrado com os
// dados da empresa e cor de destaque vinda da paleta escolhida.
//
// IMPORTANTE: este documento NUNCA recalcula com a tarifa atual. Ele imprime
// exatamente o que veio carimbado em cada rota. Um extrato de agosto emitido
// em dezembro sai com os valores de agosto.

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
const fmtDia = (iso) => {
  const [, m, d] = String(iso || '').split('-');
  return d ? `${d}/${m}` : '—';
};

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

const SIT_LABEL = {
  pago: 'QUITADO',
  parcial: 'PARCIALMENTE PAGO',
  pendente: 'A PAGAR',
  vencido: 'EM ATRASO',
};

/**
 * @param {object} ext     - { numero, periodoLabel, inicio, fim, vencimento,
 *                             qtdEntregas, valorEntregas, qtdColetas, valorColetas,
 *                             total, pago, saldo, situacao, linhas[], pagamentos[] }
 * @param {object} motoboy - { nome, telefone, pix, regiao, baseNome, documento }
 * @param {object} empresa - { nome, logoUrl, cnpj, telefone, endereco, cidade, uf, emailContato, corPrimaria }
 * @param {object} opts    - { modo: 'download' | 'blob' }
 */
export async function gerarExtratoRepassePDF(ext, motoboy = {}, empresa = {}, opts = {}) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, M = 16;
  const COR = hexToRgbArr(empresa.corPrimaria) || [11, 21, 51];
  const INK = [11, 19, 36];
  const GRAY = [110, 118, 130];
  const VERDE = [4, 120, 87];
  const VERMELHO = [185, 28, 28];
  let y = M;

  let logoDims = null;
  if (empresa.logoUrl) {
    try { logoDims = await imgSize(empresa.logoUrl); } catch (e) { /* ok */ }
  }
  const marcaDagua = () => {
    if (!empresa.logoUrl || !logoDims) return;
    try {
      const maxW = 120, ratio = logoDims.h / logoDims.w;
      const w = maxW, h = maxW * ratio;
      if (doc.setGState) {
        doc.setGState(new doc.GState({ opacity: 0.07 }));
        doc.addImage(empresa.logoUrl, 'PNG', (PW - w) / 2, (PH - h) / 2, w, h, undefined, 'FAST');
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
  doc.text(empresa.nome || 'Extrato de Repasse', tx, y + 7);

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
  doc.text('EXTRATO DE REPASSE', M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY);
  const agora = new Date();
  doc.text(
    `Emitido em ${agora.toLocaleDateString('pt-BR')} às ${agora.toTimeString().slice(0, 5)}`,
    PW - M, y, { align: 'right' }
  );
  y += 6;
  doc.setFontSize(10); doc.setTextColor(...INK);
  doc.text(`Período ${fmtData(ext.inicio)} a ${fmtData(ext.fim)}`, M, y);
  if (ext.numero) {
    doc.setTextColor(...GRAY); doc.setFontSize(9);
    doc.text(`Nº ${ext.numero}`, PW - M, y, { align: 'right' });
  }
  y += 10;

  // ---------- MOTOBOY ----------
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...COR);
  doc.text('MOTOBOY', M, y);
  y += 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK);
  doc.text(motoboy.nome || '—', M, y);
  y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY);
  const dados = [
    motoboy.telefone,
    motoboy.documento && `Documento: ${motoboy.documento}`,
    [motoboy.regiao && `Região: ${motoboy.regiao}`, motoboy.baseNome && `Base: ${motoboy.baseNome}`]
      .filter(Boolean).join('  ·  '),
    motoboy.pix && `PIX: ${motoboy.pix}`,
  ].filter(Boolean);
  dados.forEach((l, i) => doc.text(l, M, y + i * 4.5));
  y += dados.length * 4.5 + 8;

  // ---------- RESUMO ----------
  const cardW = (PW - M * 2 - 6) / 3;
  const card = (x, titulo, valor, cor) => {
    doc.setFillColor(247, 248, 250);
    doc.roundedRect(x, y, cardW, 21, 2, 2, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
    doc.text(titulo.toUpperCase(), x + 4, y + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...(cor || INK));
    doc.text(BRL(valor), x + 4, y + 14);
  };
  card(M, 'Total gerado', ext.total);
  card(M + cardW + 3, 'Já pago', ext.pago, VERDE);
  card(M + (cardW + 3) * 2, 'Saldo a receber', ext.saldo, ext.saldo > 0 ? VERMELHO : VERDE);
  y += 27;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRAY);
  doc.text(`Entregas no período: ${ext.qtdEntregas || 0}`, M, y);
  if (ext.qtdColetas > 0) {
    doc.text(`Coletas remuneradas: ${ext.qtdColetas}`, M + 70, y);
  }
  y += 9;

  // ---------- DETALHAMENTO ----------
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...COR);
  doc.text('DETALHAMENTO DAS ROTAS', M, y);
  y += 6;

  const cabecalhoTabela = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
    doc.text('DATA', M, y);
    doc.text('ROTA', M + 20, y);
    doc.text('REGIÃO', M + 48, y);
    doc.text('ENTREGAS', M + 118, y, { align: 'right' });
    doc.text('TARIFA', M + 148, y, { align: 'right' });
    doc.text('VALOR', PW - M, y, { align: 'right' });
    y += 4;
    doc.setDrawColor(225, 229, 235); doc.setLineWidth(0.25);
    doc.line(M, y - 1, PW - M, y - 1);
    y += 3;
  };
  cabecalhoTabela();

  if (!(ext.linhas || []).length) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...GRAY);
    doc.text('Nenhuma rota registrada neste período.', M, y);
    y += 6;
  }

  (ext.linhas || []).forEach((l) => {
    if (novaPagina(40)) { cabecalhoTabela(); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK);
    doc.text(fmtDia(l.data), M, y);
    doc.setTextColor(...GRAY);
    doc.text(String(l.codigo || '—'), M + 20, y);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(String(l.regiao || '—'), 62)[0], M + 48, y);
    doc.text(String(l.qtd), M + 118, y, { align: 'right' });
    doc.setTextColor(...GRAY);
    doc.text(BRL(l.tarifa), M + 148, y, { align: 'right' });
    doc.setTextColor(...INK);
    doc.text(BRL(l.valor), PW - M, y, { align: 'right' });
    y += 5.4;
  });

  y += 2;
  doc.setDrawColor(225, 229, 235); doc.line(M, y, PW - M, y);
  y += 6;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK);
  doc.text('Total gerado no período', M, y);
  doc.text(BRL(ext.total), PW - M, y, { align: 'right' });
  y += 10;

  // ---------- PAGAMENTOS JÁ REALIZADOS ----------
  if ((ext.pagamentos || []).length) {
    novaPagina(46);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...COR);
    doc.text('PAGAMENTOS JÁ REALIZADOS', M, y);
    y += 6;
    ext.pagamentos.forEach((p) => {
      novaPagina(28);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK);
      doc.text(fmtData(p.data), M, y);
      doc.setTextColor(...GRAY);
      doc.text(String(p.forma || '—'), M + 30, y);
      if (p.obs) doc.text(doc.splitTextToSize(String(p.obs), 80)[0], M + 66, y);
      doc.setTextColor(...VERDE);
      doc.text(BRL(p.valor), PW - M, y, { align: 'right' });
      y += 5.4;
    });
    y += 4;
  }

  // ---------- SALDO ----------
  novaPagina(40);
  doc.setFillColor(...COR);
  doc.roundedRect(M, y, PW - M * 2, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text('SALDO A RECEBER', M + 5, y + 10);
  doc.setFontSize(15);
  doc.text(BRL(ext.saldo), PW - M - 5, y + 10.5, { align: 'right' });
  y += 22;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  doc.setTextColor(...(ext.saldo > 0 ? VERMELHO : VERDE));
  doc.text(`Situação: ${SIT_LABEL[ext.situacao] || '—'}`, M, y);
  if (ext.vencimento && ext.saldo > 0) {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY);
    doc.text(`Previsão de pagamento: ${fmtData(ext.vencimento)}`, PW - M, y, { align: 'right' });
  }
  y += 10;

  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...GRAY);
  const nota = doc.splitTextToSize(
    'Os valores acima refletem as tarifas vigentes na data de cada rota. Alterações posteriores '
    + 'de tarifa não modificam períodos já encerrados.',
    PW - M * 2
  );
  doc.text(nota, M, y);

  // ---------- RODAPÉ ----------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
    doc.text(`${empresa.nome || 'Gestão GSO'} · Extrato de repasse${ext.numero ? ` · ${ext.numero}` : ''}`, M, PH - 10);
    doc.text(`Página ${i} de ${total}`, PW - M, PH - 10, { align: 'right' });
  }

  const slug = String(motoboy.nome || 'motoboy')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
  const nomeArq = `Extrato_${slug}_${ext.inicio || ''}.pdf`;

  if (opts.modo === 'blob') return doc.output('blob');
  doc.save(nomeArq);
}
