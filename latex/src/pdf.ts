/**
 * SVG → vector PDF, pure-JS (pdfkit + svg-to-pdfkit). No system binaries.
 *
 * Triton's renderer emits an SVG string (see ../../src/render/svg.ts). LaTeX's
 * `\includegraphics` cannot ingest SVG, so this module converts that SVG into a
 * single-page vector PDF whose page box is sized to the diagram's viewBox.
 *
 * Why these libraries:
 *   - `pdfkit` writes real vector PDF content streams (paths, text, fills) and
 *     embeds the base-14 fonts (Helvetica/Times/Courier) with NO external font
 *     file — so Triton text becomes selectable, scalable vector text with no
 *     font-drift between dev / CI / Overleaf.
 *   - `svg-to-pdfkit` walks the SVG DOM and replays it onto a pdfkit document:
 *     rects, circles, paths (incl. the `d=` data Triton emits), `<text>` with
 *     `text-anchor`, and `<marker>` arrowheads referenced via `marker-end`.
 *
 * SMIL animations (`<animate>`, `<animateMotion>`) are intentionally dropped —
 * a PDF is static; the first frame is the correct print representation.
 */

// pdfkit / svg-to-pdfkit are CJS and kept EXTERNAL by esbuild (real node_modules).
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';

export interface PdfOptions {
  /** Uniform scale applied to the PDF page box (1 = SVG units → PDF points). */
  readonly scale?: number;
}

/** Extract the intrinsic pixel size of a Triton SVG from width/height or viewBox. */
export function svgSize(svg: string): { width: number; height: number } {
  const w = /\bwidth="([\d.]+)"/.exec(svg);
  const h = /\bheight="([\d.]+)"/.exec(svg);
  if (w && h) return { width: Number(w[1]), height: Number(h[1]) };

  const vb = /viewBox="([\d.\s-]+)"/.exec(svg);
  if (vb) {
    const parts = vb[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4) return { width: parts[2], height: parts[3] };
  }
  // Sensible fallback — keeps the converter from throwing on odd input.
  return { width: 800, height: 600 };
}

/**
 * Convert a Triton SVG string to a vector PDF buffer.
 *
 * The PDF page is sized to (width × scale) by (height × scale) POINTS, with zero
 * margin, so the diagram fills the page edge-to-edge. `\includegraphics` then
 * scales the whole page to the requested LaTeX width.
 */
export function svgToPdf(svg: string, opts: PdfOptions = {}): Promise<Buffer> {
  const scale = opts.scale ?? 1;
  const { width, height } = svgSize(svg);
  const pageW = Math.max(1, width * scale);
  const pageH = Math.max(1, height * scale);

  return new Promise<Buffer>((resolvePromise, reject) => {
    try {
      const doc = new PDFDocument({
        size: [pageW, pageH],
        margin: 0,
        // Compress the content stream — keeps committed PDFs small for Overleaf.
        compress: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
      doc.on('error', reject);

      SVGtoPDF(doc, svg, 0, 0, {
        width: pageW,
        height: pageH,
        // Triton emits unit-less user coordinates that map 1:1 to points.
        assumePt: true,
        // Triton never relies on external CSS — attributes carry all style.
        useCSS: false,
      });

      doc.end();
    } catch (cause) {
      reject(cause instanceof Error ? cause : new Error(String(cause)));
    }
  });
}
