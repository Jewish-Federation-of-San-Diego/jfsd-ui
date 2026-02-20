import { Tooltip } from 'antd';
import { definitions } from '../data/definitions';

interface DefinitionTooltipProps {
  term: string;
  dashboardKey: string;
  children: React.ReactNode;
}

export function DefinitionTooltip({ term, dashboardKey, children }: DefinitionTooltipProps) {
  const defs = definitions[dashboardKey] || [];
  const match = defs.find(d => d.term.toLowerCase() === term.toLowerCase());

  if (!match) return <>{children}</>;

  return (
    <Tooltip title={<><strong>{match.term}</strong><br />{match.definition}</>} overlayStyle={{ maxWidth: 320 }}>
      <span style={{ borderBottom: '1px dotted #C5A258', cursor: 'help' }}>{children}</span>
    </Tooltip>
  );
}
