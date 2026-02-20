import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

interface CsvExportProps {
  data: Record<string, any>[];
  columns: { title: string; dataIndex: string }[];
  filename: string;
}

export function CsvExport({ data, columns, filename }: CsvExportProps) {
  const handleExport = () => {
    if (!data?.length) return;
    const headers = columns.map(c => typeof c.title === 'string' ? c.title : c.dataIndex);
    const rows = data.map(row => columns.map(c => {
      const val = row[c.dataIndex];
      const str = val == null ? '' : String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"` : str;
    }));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  return <Button size="small" icon={<DownloadOutlined />} onClick={handleExport}>Export CSV</Button>;
}
