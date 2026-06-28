import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type ParsedCV = {
  rawText: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  location?: string;
};

export async function parseCV(file: File): Promise<ParsedCV> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  let text = '';

  if (ext === 'pdf') {
    text = await parsePdf(arrayBuffer);
  } else if (ext === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer });
    text = result.value;
  } else if (ext === 'txt') {
    text = await file.text();
  } else {
    throw new Error('Unsupported CV format. Upload PDF, DOCX, or TXT.');
  }

  return extractBasicFields(text);
}

async function parsePdf(arrayBuffer: ArrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const chunks: string[] = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str || '').join(' ');
    chunks.push(pageText);
  }

  return chunks.join('\n');
}

function extractBasicFields(text: string): ParsedCV {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const email = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = normalized.match(/(?:\+?63|0)?\s?9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0];

  const excluded = /(curriculum|vitae|resume|cv|email|phone|mobile|address|linkedin|github|portfolio)/i;
  const possibleName = lines.find((line) =>
    line.length >= 3 &&
    line.length <= 60 &&
    !excluded.test(line) &&
    !line.includes('@') &&
    !/\d{3,}/.test(line)
  );
  const parts = (possibleName || '').split(/\s+/).filter(Boolean);
  const first_name = parts[0];
  const last_name = parts.length > 1 ? parts.slice(1).join(' ') : undefined;

  const locationLine = lines.find((line) => /(city|philippines|metro manila|makati|quezon|pasig|taguig|cebu|davao|laguna|cavite|bulacan)/i.test(line));

  return {
    rawText: normalized,
    first_name,
    last_name,
    email,
    phone,
    location: locationLine,
  };
}
