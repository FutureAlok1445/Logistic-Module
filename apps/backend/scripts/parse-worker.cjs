const XLSX = require('xlsx');
const { unzipSync } = require('fflate');

async function parse(workerData) {
  const buffer = Buffer.from(workerData.buffer, 'base64');
  const ext = workerData.ext;
  let matrices = [];
  let text;
  if (['csv', 'xlsx', 'xls'].includes(ext)) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: false, cellHTML: false });
    if (workbook.SheetNames.length > 20) throw new Error('Maximum 20 sheets per import');
    matrices = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      if (sheet['!ref']) { const range = XLSX.utils.decode_range(sheet['!ref']); if (range.e.r > 1031 || range.e.c > 99) throw new Error('Split files into 1000 data rows and 100 columns'); }
      return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    });
    process.send({ matrices, names: workbook.SheetNames });
    return;
  } else {
    if (ext === 'docx') {
      const files = unzipSync(buffer, { filter: entry => entry.name === 'word/document.xml' });
      if (!files['word/document.xml']) throw new Error('Invalid Word file');
      const xml = Buffer.from(files['word/document.xml']).toString('utf8');
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsupported XML');
      const decode = s => s.replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, n) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n))).replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&');
      const getText = s => [...s.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => decode(m[1])).join('');
      const tableRows = [...xml.matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)];
      matrices = tableRows.length ? [tableRows.map(r => [...r[1].matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map(c => getText(c[1])))] : [[...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)].map(p => getText(p[1]).split(/\t|\s*\|\s*|\s*,\s*|\s{2,}/))];
      const sourceText = [...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)].map(p=>getText(p[1])).join('\n');
      process.send({ matrices, text: sourceText.length <= 100000 ? sourceText : undefined });
      return;
    }
    else { const { PDFParse } = require('pdf-parse'); const parser = new PDFParse({ data: new Uint8Array(buffer) }); try { text = (await parser.getText()).text; } finally { await parser.destroy(); } }
    // Structured documents must contain delimiters. Ambiguous prose/scans cannot be safely imported.
    matrices = [text.split(/\r?\n/).filter(l => l.trim()).map(l => l.trim().split(/\t|\s*\|\s*|\s*,\s*|\s{2,}/))];
  }
  process.send({ matrices, text: text.length <= 100000 ? text : undefined });
}
process.once('message', input => parse(input).catch(() => process.send({ error: 'Unable to parse this file. Use a structured table or CSV export.' })));
