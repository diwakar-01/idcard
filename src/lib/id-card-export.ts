import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import JSZip from "jszip";
import FileSaver from "file-saver";
const { saveAs } = FileSaver;

async function nodeToCanvas(node: HTMLElement) {
  return html2canvas(node, { backgroundColor: null, scale: 2, useCORS: true });
}

export async function downloadPng(node: HTMLElement, filename: string) {
  const canvas = await nodeToCanvas(node);
  canvas.toBlob((blob) => {
    if (blob) saveAs(blob, filename);
  });
}

export async function downloadPdf(front: HTMLElement, back: HTMLElement, filename: string) {
  const [fc, bc] = await Promise.all([nodeToCanvas(front), nodeToCanvas(back)]);
  const pdf = new jsPDF({ unit: "px", format: [fc.width, fc.height] });
  pdf.addImage(fc.toDataURL("image/png"), "PNG", 0, 0, fc.width, fc.height);
  pdf.addPage([bc.width, bc.height], bc.width > bc.height ? "landscape" : "portrait");
  pdf.addImage(bc.toDataURL("image/png"), "PNG", 0, 0, bc.width, bc.height);
  pdf.save(filename);
}

export async function zipCards(
  cards: Array<{ name: string; front: HTMLElement; back: HTMLElement }>,
  zipName: string,
) {
  const zip = new JSZip();
  for (const c of cards) {
    const [fc, bc] = await Promise.all([nodeToCanvas(c.front), nodeToCanvas(c.back)]);
    const fb: Blob = await new Promise((res) => fc.toBlob((b) => res(b!), "image/png")!);
    const bb: Blob = await new Promise((res) => bc.toBlob((b) => res(b!), "image/png")!);
    const safe = c.name.replace(/[^a-z0-9_-]+/gi, "_");
    zip.file(`${safe}_front.png`, fb);
    zip.file(`${safe}_back.png`, bb);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, zipName);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
