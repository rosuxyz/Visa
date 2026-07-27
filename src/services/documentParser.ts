// Extract text or render images from PDF, DOCX, or image files in the browser

import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

export type ExtractResult =
  | { type: 'text';   text: string }
  | { type: 'images'; images: string[] };   // base64 data URLs (JPEG)

export async function extractFromFile(file: File): Promise<ExtractResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'pdf')  return extractFromPDF(file);
  if (ext === 'docx' || ext === 'doc') return extractFromDOCX(file);
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext ?? '')) {
    const dataUrl = await readAsDataURL(file);
    return { type: 'images', images: [dataUrl] };
  }
  throw new Error(`Unsupported file type: .${ext}. Please upload a PDF, DOCX, or image file.`);
}

async function extractFromPDF(file: File): Promise<ExtractResult> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const arrayBuffer = await file.arrayBuffer();
  let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;

  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  } catch {
    throw new Error('Failed to open the PDF. It may be encrypted, corrupted, or password-protected.');
  }

  // ── Step 1: try text extraction ──────────────────────────────────────
  const textPages: string[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map(item => ('str' in item ? (item as { str: string }).str : ''))
      .filter(s => s.trim())
      .join(' ');
    if (text.trim()) textPages.push(text);
  }

  const extractedText = textPages.join('\n\n').trim();
  if (extractedText) {
    return { type: 'text', text: extractedText };
  }

  // ── Step 2: scanned PDF — render pages to JPEG images ────────────────
  const images: string[] = [];
  const pagesToRender = Math.min(pdf.numPages, 4); // Claude Vision handles up to 4 well

  for (let i = 1; i <= pagesToRender; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.8 }); // higher scale = better OCR quality

    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvas, viewport }).promise;

    // Convert to JPEG at 85% quality — good balance of size vs readability
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    images.push(dataUrl);
  }

  if (images.length === 0) {
    throw new Error('Could not render any pages from this PDF. Please try uploading as JPG or PNG.');
  }

  return { type: 'images', images };
}

async function extractFromDOCX(file: File): Promise<ExtractResult> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value.trim();
  if (!text) throw new Error('No text could be extracted from this Word document.');
  return { type: 'text', text };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read the file.'));
    reader.readAsDataURL(file);
  });
}
