import { Button } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import { useCallback } from 'react';

interface PdfExportProps {
  filename: string;
  targetRef: React.RefObject<HTMLDivElement | null>;
}

export function PdfExport({ filename, targetRef }: PdfExportProps) {
  const handleExport = useCallback(async () => {
    if (!targetRef.current) return;
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    const canvas = await html2canvas(targetRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'letter');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - 2 * margin;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    let yOffset = 0;
    while (yOffset < imgHeight) {
      if (yOffset > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, margin - yOffset, contentWidth, imgHeight);
      yOffset += pageHeight - 2 * margin;
    }

    pdf.save(`${filename}.pdf`);
  }, [filename, targetRef]);

  return (
    <Button icon={<FilePdfOutlined />} onClick={handleExport} size="small" className="no-print">
      PDF
    </Button>
  );
}
