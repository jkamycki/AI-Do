import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export async function exportElementToPdf({
  element,
  backgroundColor,
  filename,
  allowTaint = false,
}: {
  element: HTMLElement;
  backgroundColor: string;
  filename: string;
  allowTaint?: boolean;
}) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint,
    backgroundColor,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pageWidth = 595;
  const imgHeight = (canvas.height / canvas.width) * pageWidth;
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: [pageWidth, imgHeight + 1] });
  doc.addImage(imgData, "JPEG", 0, 0, pageWidth, imgHeight);
  doc.save(filename);
}
