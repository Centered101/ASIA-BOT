import { PDFParse } from 'pdf-parse'

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return result.text ?? ''
}

export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = []
  const normalized = text.replace(/\n{3,}/g, '\n\n').trim()
  let start = 0
  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length)
    const chunk = normalized.slice(start, end).trim()
    if (chunk.length > 20) chunks.push(chunk)
    if (end >= normalized.length) break
    start = end - overlap
  }
  return chunks
}
