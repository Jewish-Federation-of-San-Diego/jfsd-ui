import { useState, useRef, useCallback, useEffect } from 'react';
import { AutoComplete, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { NAVY, MUTED } from '../theme/jfsdTheme';
import { safeCurrency } from '../utils/formatters';

interface GlobalSearchProps {
  onNavigate: (dashboardKey: string) => void;
}

interface SearchEntry {
  dashboard: string;
  dashboardKey: string;
  context: string;
}

type SearchIndex = Map<string, SearchEntry[]>;

const dashboardNames: Record<string, string> = {
  'ask-list': 'Outreach',
  drm: 'DRM Portfolios',
  campaign: 'Campaign Tracker',
  pledge: 'Pledge Management',
  prospect: 'Prospect Research',
  'donor-health': 'Donor Health',
  givecloud: 'GiveCloud',
  board: 'Board Reporting',
  ramp: 'Ramp Analytics',
  'ap-expense': 'AP & Expense',
};

const fmt = (n: number | undefined) => {
  return safeCurrency(n, { maximumFractionDigits: 0 });
};

async function fetchJson(file: string) {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function buildIndex(): Promise<SearchIndex> {
  const index: SearchIndex = new Map();

  const add = (name: string, dashboardKey: string, context: string) => {
    if (!name) return;
    const n = name.trim();
    const entries = index.get(n) || [];
    entries.push({ dashboard: dashboardNames[dashboardKey] || dashboardKey, dashboardKey, context });
    index.set(n, entries);
  };

  const [askList, silence, drm, campaign, pledge, prospect, health, gc, board, ramp, ap] = await Promise.all([
    fetchJson('weekly-ask-list.json'),
    fetchJson('silence-alerts.json'),
    fetchJson('drm-portfolio.json'),
    fetchJson('campaign-tracker.json'),
    fetchJson('pledge-management.json'),
    fetchJson('prospect-research.json'),
    fetchJson('sharon-donor-health.json'),
    fetchJson('givecloud.json'),
    fetchJson('board-reporting.json'),
    fetchJson('ramp-analytics.json'),
    fetchJson('james-ap-expense.json'),
  ]);

  askList?.donors?.forEach((d: any) => add(d.name, 'ask-list', `${d.category} · ${fmt(d.suggestedAsk)} ask`));
  silence?.donors?.forEach((d: any) => add(d.name, 'ask-list', `${d.riskTier} · ${fmt(d.fy25Amount)}`));
  drm?.drms?.forEach((d: any) => add(d.name, 'drm', `${d.totalDonors} donors · ${fmt(d.totalRecognitionFY26)}`));
  campaign?.topGiftsThisWeek?.forEach((d: any) => add(d.name, 'campaign', `${fmt(d.amount)} · ${d.campaign}`));
  pledge?.topOpenPledges?.forEach((d: any) => add(d.name, 'pledge', `${fmt(d.pledgedAmount)} pledge · ${d.campaign}`));
  pledge?.writeOffRisk?.forEach((d: any) => add(d.name, 'pledge', `Write-off risk · ${fmt(d.balance)}`));
  pledge?.recentPayments?.forEach((d: any) => add(d.name, 'pledge', `Payment · ${fmt(d.amount)}`));
  prospect?.upgradeProspects?.forEach((d: any) => add(d.name, 'prospect', 'Upgrade prospect'));
  prospect?.majorDonorPipeline?.forEach((d: any) => add(d.name, 'prospect', 'Major donor pipeline'));
  prospect?.trajectoryAnalysis?.forEach((d: any) => add(d.name, 'prospect', 'Trajectory analysis'));
  health?.failedRecurring?.forEach((d: any) => add(d.name, 'donor-health', 'Failed recurring'));
  health?.cancelledRecurring?.forEach((d: any) => add(d.name, 'donor-health', 'Cancelled recurring'));
  health?.newRecurring?.forEach((d: any) => add(d.name, 'donor-health', 'New recurring'));
  health?.lapsedReactivated?.forEach((d: any) => add(d.name, 'donor-health', 'Lapsed reactivated'));
  health?.milestoneApproaching?.forEach((d: any) => add(d.name, 'donor-health', 'Milestone approaching'));
  gc?.recentContributions?.forEach((d: any) => add(d.name, 'givecloud', `${fmt(d.amount)} contribution`));
  board?.boards?.forEach((b: any) => b.members?.forEach((m: any) => add(m.name, 'board', `${b.shortName || b.name} · ${m.status}`)));
  ramp?.topSpenders?.forEach((d: any) => add(d.name, 'ramp', `${fmt(d.amount)} spend · ${d.dept}`));
  ap?.actionItems?.forEach((d: any) => d.cardholder && add(d.cardholder, 'ap-expense', `${d.type} · ${fmt(d.amount)}`));

  return index;
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background: '#FFF3CD', fontWeight: 600 }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

export function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const indexRef = useRef<SearchIndex | null>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const ensureIndex = useCallback(async () => {
    if (indexRef.current) return indexRef.current;
    const idx = await buildIndex();
    indexRef.current = idx;
    return idx;
  }, []);

  useEffect(() => {
    // Preload index
    ensureIndex();
  }, [ensureIndex]);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setOptions([]); return; }

    debounceRef.current = setTimeout(async () => {
      const idx = await ensureIndex();
      const q = value.toLowerCase().trim();
      const matches: Array<{ name: string; entries: SearchEntry[] }> = [];

      for (const [name, entries] of idx) {
        if (name.toLowerCase().includes(q)) {
          matches.push({ name, entries });
        }
        if (matches.length >= 20) break;
      }

      const opts = matches.map(({ name, entries }) => ({
        label: (
          <div>
            <div style={{ fontWeight: 600, color: NAVY, marginBottom: 2 }}>
              {highlightMatch(name, value.trim())}
            </div>
            {entries.map((e, i) => (
              <div
                key={i}
                style={{ fontSize: 12, color: MUTED, cursor: 'pointer', padding: '2px 0 2px 8px' }}
                onClick={(ev) => { ev.stopPropagation(); onNavigate(e.dashboardKey); setQuery(''); setOptions([]); }}
              >
                {e.dashboard} · {e.context}
              </div>
            ))}
          </div>
        ),
        value: name,
        entries,
      }));

      setOptions(opts);
    }, 200);
  }, [ensureIndex, onNavigate]);

  const handleSelect = (_val: string, option: any) => {
    const first = option.entries?.[0];
    if (first) onNavigate(first.dashboardKey);
    setQuery('');
    setOptions([]);
  };

  return (
    <>
      {/* Desktop */}
      <div className="global-search-desktop" style={{ flex: 1, maxWidth: 400, margin: '0 12px' }}>
        <AutoComplete
          style={{ width: '100%' }}
          options={options}
          onSearch={handleSearch}
          onSelect={handleSelect}
          value={query}
          onChange={setQuery}
          popupMatchSelectWidth={380}
          popupClassName="global-search-dropdown"
        >
          <Input
            placeholder="Search donors..."
            prefix={<SearchOutlined style={{ color: MUTED }} />}
            allowClear
            size="middle"
          />
        </AutoComplete>
      </div>

      {/* Mobile: icon that expands */}
      <div className="global-search-mobile">
        {!expanded ? (
          <SearchOutlined
            style={{ fontSize: 18, color: MUTED, cursor: 'pointer' }}
            onClick={() => setExpanded(true)}
          />
        ) : (
          <AutoComplete
            style={{ width: '100%' }}
            options={options}
            onSearch={handleSearch}
            onSelect={handleSelect}
            value={query}
            onChange={setQuery}
            popupMatchSelectWidth={300}
            popupClassName="global-search-dropdown"
            open
            autoFocus
            onBlur={() => { if (!query) setExpanded(false); }}
          >
            <Input
              placeholder="Search donors..."
              prefix={<SearchOutlined style={{ color: MUTED }} />}
              allowClear
              size="middle"
              autoFocus
            />
          </AutoComplete>
        )}
      </div>
    </>
  );
}
