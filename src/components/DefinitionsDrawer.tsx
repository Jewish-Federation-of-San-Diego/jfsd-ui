import { useState, useMemo } from 'react';
import { Drawer, Collapse, Input, Typography, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { definitions } from '../data/definitions';

const { Text } = Typography;

interface DefinitionsDrawerProps {
  dashboardKey: string;
  open: boolean;
  onClose: () => void;
}

const dashboardNames: Record<string, string> = {
  overview: 'Overview', campaign: 'Campaign Tracker', 'donor-health': 'Donor Health',
  drm: 'DRM Portfolios', 'ask-list': 'Weekly Ask List', silence: 'Silence Alerts',
  prospect: 'Prospect Research', pledge: 'Pledge Management', board: 'Board Reporting',
  stripe: 'Stripe Analytics', givecloud: 'GiveCloud', ramp: 'Ramp Analytics',
  'ap-expense': 'AP & Expense', facilities: 'Facilities', 'data-quality': 'Data Quality',
};

export function DefinitionsDrawer({ dashboardKey, open, onClose }: DefinitionsDrawerProps) {
  const [search, setSearch] = useState('');

  const defs = definitions[dashboardKey] || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return defs;
    const q = search.toLowerCase();
    return defs.filter(d => d.term.toLowerCase().includes(q) || d.definition.toLowerCase().includes(q));
  }, [defs, search]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    for (const d of filtered) {
      (map[d.category] ??= []).push(d);
    }
    return map;
  }, [filtered]);

  const categories = Object.keys(grouped);

  return (
    <Drawer
      title={<span style={{ color: '#1B365D' }}>Definitions — {dashboardNames[dashboardKey] || 'Dashboard'}</span>}
      placement="right"
      width={420}
      onClose={() => { setSearch(''); onClose(); }}
      open={open}
      styles={{ body: { padding: '12px 16px' } }}
      className="definitions-drawer"
    >
      <Input
        placeholder="Search definitions…"
        prefix={<SearchOutlined style={{ color: '#8C8C8C' }} />}
        value={search}
        onChange={e => setSearch(e.target.value)}
        allowClear
        style={{ marginBottom: 16 }}
      />

      {categories.length === 0 && (
        <Text type="secondary">No definitions found.</Text>
      )}

      <Collapse
        defaultActiveKey={categories}
        ghost
        items={categories.map(cat => ({
          key: cat,
          label: <Text strong style={{ color: '#1B365D' }}>{cat}</Text>,
          children: (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {grouped[cat].map(d => (
                <div key={d.term}>
                  <Text strong style={{ display: 'block', marginBottom: 2 }}>{d.term}</Text>
                  <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>{d.definition}</Text>
                </div>
              ))}
            </Space>
          ),
        }))}
      />
    </Drawer>
  );
}
