import { Button } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';

export function PrintButton() {
  return (
    <Button 
      icon={<PrinterOutlined />} 
      onClick={() => window.print()}
      size="small"
      className="no-print"
    >
      Print
    </Button>
  );
}
