import { useState } from 'react';
import { ConfigProvider, Layout, Menu, Typography, Button, Drawer } from 'antd';
import {
  DollarOutlined,
  DashboardOutlined,
  TeamOutlined,
  HomeOutlined,
  HeartOutlined,
  MenuOutlined,
  InfoCircleOutlined,
  CreditCardOutlined,
  ShoppingCartOutlined,
  FundOutlined,
  UsergroupAddOutlined,
  AccountBookOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  FileTextOutlined,
  PhoneOutlined,
  PieChartOutlined,
  ProjectOutlined,
  MailOutlined,
  AlertOutlined,
  TrophyOutlined,
  BarChartOutlined,
  BankOutlined,
  CalendarOutlined,
  ApartmentOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { jfsdTheme } from './theme/jfsdTheme';
import { OverviewDashboard } from './dashboards/OverviewDashboard';
import { StripeDashboard } from './dashboards/StripeDashboard';
import { DonorHealthDashboard } from './dashboards/DonorHealthDashboard';
import APExpenseDashboard from './dashboards/APExpenseDashboard';
import { CampaignTrackerDashboard } from './dashboards/CampaignTrackerDashboard';
import { DRMPortfolioDashboard } from './dashboards/DRMPortfolioDashboard';
import { FacilitiesDashboard } from './dashboards/FacilitiesDashboard';
import { RampAnalyticsDashboard } from './dashboards/RampAnalyticsDashboard';
import { GiveCloudDashboard } from './dashboards/GiveCloudDashboard';
import { BoardReportingDashboard } from './dashboards/BoardReportingDashboard';
import { DataQualityDashboard } from './dashboards/DataQualityDashboard';
import { ProspectResearchDashboard } from './dashboards/ProspectResearchDashboard';
import { PledgeManagementDashboard } from './dashboards/PledgeManagementDashboard';
import { WeeklyAskListDashboard } from './dashboards/WeeklyAskListDashboard';
import { FinancialStatementsDashboard } from './dashboards/FinancialStatementsDashboard';
import { ProjectTrackerDashboard } from './dashboards/ProjectTrackerDashboard';
import { HubSpotDashboard } from './dashboards/HubSpotDashboard';
import { SilenceAlertsDashboard } from './dashboards/SilenceAlertsDashboard';
import { WealthEngineDashboard } from './dashboards/WealthEngineDashboard';
import { NonprofitBoardsDashboard } from './dashboards/NonprofitBoardsDashboard';
import { DataDuelDashboard } from './dashboards/DataDuelDashboard';
import { EcobeeTrendsDashboard } from './dashboards/EcobeeTrendsDashboard';
import { MondayDashboard } from './dashboards/MondayDashboard';
import { ChartGalleryDashboard } from './dashboards/ChartGalleryDashboard';
import { DefinitionsDrawer } from './components/DefinitionsDrawer';
import { PrintButton } from './components/PrintButton';
import { GlobalSearch } from './components/GlobalSearch';
import './App.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const groupLabelStyle = { fontSize: 11, letterSpacing: '0.5px', color: 'rgba(255,255,255,0.4)', padding: '12px 16px 4px' };

const menuItems = [
  { key: 'overview', icon: <PieChartOutlined />, label: 'Overview' },
  {
    type: 'group' as const,
    label: <span style={groupLabelStyle}>FUNDRAISING</span>,
    children: [
      { key: 'campaign', icon: <FundOutlined />, label: 'Campaign Tracker' },
      { key: 'donor-health', icon: <HeartOutlined />, label: 'Donor Health' },
      { key: 'drm', icon: <UsergroupAddOutlined />, label: 'DRM Portfolios' },
      { key: 'ask-list', icon: <PhoneOutlined />, label: 'Outreach' },
      { key: 'prospect', icon: <SearchOutlined />, label: 'Prospect Research' },
      { key: 'pledge', icon: <FileTextOutlined />, label: 'Pledge Management' },
      { key: 'board', icon: <TeamOutlined />, label: 'Board Reporting' },
      { key: 'hubspot', icon: <MailOutlined />, label: 'HubSpot' },
      { key: 'silence', icon: <AlertOutlined />, label: 'Silence Alerts' },
      { key: 'wealth', icon: <BankOutlined />, label: 'WealthEngine' },
      { key: 'boards', icon: <ApartmentOutlined />, label: 'Nonprofit Boards' },
    ],
  },
  {
    type: 'group' as const,
    label: <span style={groupLabelStyle}>FINANCE</span>,
    children: [
      { key: 'financial', icon: <AccountBookOutlined />, label: 'Financial Statements' },
      { key: 'stripe', icon: <DollarOutlined />, label: 'Stripe Analytics' },
      { key: 'givecloud', icon: <ShoppingCartOutlined />, label: 'GiveCloud' },
      { key: 'ramp', icon: <CreditCardOutlined />, label: 'Ramp Analytics' },
      { key: 'ap-expense', icon: <DashboardOutlined />, label: 'AP & Expense' },
    ],
  },
  {
    type: 'group' as const,
    label: <span style={groupLabelStyle}>OPERATIONS</span>,
    children: [
      { key: 'facilities', icon: <HomeOutlined />, label: 'Facilities' },
      { key: 'data-quality', icon: <SafetyCertificateOutlined />, label: 'Data Quality' },
      { key: 'projects', icon: <ProjectOutlined />, label: 'Project Tracker' },
      { key: 'data-duel', icon: <TrophyOutlined />, label: 'Data Duel' },
      { key: 'ecobee-trends', icon: <LineChartOutlined />, label: 'Ecobee Trends' },
      { key: 'monday', icon: <CalendarOutlined />, label: 'Monday.com' },
      { key: 'chart-gallery', icon: <BarChartOutlined />, label: 'Chart Gallery' },
    ],
  },
];

const dashboardTitles: Record<string, string> = {
  overview: 'Overview',
  campaign: 'Campaign Tracker',
  'donor-health': 'Donor Health',
  drm: 'DRM Portfolios',
  'ask-list': 'Outreach',
  prospect: 'Prospect Research',
  pledge: 'Pledge Management',
  board: 'Board Reporting',
  financial: 'Financial Statements',
  stripe: 'Stripe Analytics',
  givecloud: 'GiveCloud',
  ramp: 'Ramp Analytics',
  'ap-expense': 'AP & Expense',
  facilities: 'Facilities',
  'data-quality': 'Data Quality',
  projects: 'Project Tracker',
  hubspot: 'HubSpot',
  silence: 'Silence Alerts',
  wealth: 'WealthEngine',
  boards: 'Nonprofit Boards',
  'data-duel': 'Data Duel',
  'ecobee-trends': 'Ecobee Trends',
  monday: 'Monday.com',
  'chart-gallery': 'Chart Gallery',
};

function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [defsOpen, setDefsOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState('overview');

  const handleMenuClick = ({ key }: { key: string }) => {
    setSelectedKey(key);
    setDrawerOpen(false);
  };

  const SidebarContent = () => (
    <>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Title level={4} style={{ color: '#4DA3FF', margin: 0, fontSize: 18 }}>
          Federation Analytics
        </Title>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
          Jewish Federation of San Diego
        </div>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={handleMenuClick}
      />
    </>
  );

  const renderDashboard = () => {
    switch (selectedKey) {
      case 'overview': return <OverviewDashboard onNavigate={(key: string) => setSelectedKey(key)} />;
      case 'campaign': return <CampaignTrackerDashboard />;
      case 'donor-health': return <DonorHealthDashboard />;
      case 'drm': return <DRMPortfolioDashboard />;
      case 'ask-list': return <WeeklyAskListDashboard />;
      case 'prospect': return <ProspectResearchDashboard />;
      case 'pledge': return <PledgeManagementDashboard />;
      case 'board': return <BoardReportingDashboard />;
      case 'financial': return <FinancialStatementsDashboard />;
      case 'stripe': return <StripeDashboard />;
      case 'givecloud': return <GiveCloudDashboard />;
      case 'ramp': return <RampAnalyticsDashboard />;
      case 'ap-expense': return <APExpenseDashboard />;
      case 'facilities': return <FacilitiesDashboard />;
      case 'data-quality': return <DataQualityDashboard />;
      case 'projects': return <ProjectTrackerDashboard />;
      case 'hubspot': return <HubSpotDashboard />;
      case 'silence': return <SilenceAlertsDashboard />;
      case 'wealth': return <WealthEngineDashboard />;
      case 'boards': return <NonprofitBoardsDashboard />;
      case 'data-duel': return <DataDuelDashboard />;
      case 'ecobee-trends': return <EcobeeTrendsDashboard />;
      case 'monday': return <MondayDashboard />;
      case 'chart-gallery': return <ChartGalleryDashboard />;
      default: return null;
    }
  };

  return (
    <ConfigProvider theme={jfsdTheme}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={230} theme="dark" breakpoint="lg" collapsedWidth={0} trigger={null}
          className="desktop-sider">
          <SidebarContent />
        </Sider>

        <Drawer
          placement="left"
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          width={250}
          styles={{ body: { padding: 0, background: '#1B365D' } }}
          closable={false}
        >
          <div style={{ background: '#1B365D', minHeight: '100%' }}>
            <SidebarContent />
          </div>
        </Drawer>

        <Layout>
          <Header style={{
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #E8E8ED',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            gap: 12,
          }}>
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
              className="mobile-menu-btn"
            />
            <Title level={4} style={{ margin: 0, fontSize: 16, whiteSpace: 'nowrap' }}>
              {dashboardTitles[selectedKey] || 'Dashboard'}
            </Title>
            <GlobalSearch onNavigate={(key) => setSelectedKey(key)} />
            <Button
              type="text"
              icon={<InfoCircleOutlined />}
              onClick={() => setDefsOpen(true)}
              style={{ color: '#8C8C8C' }}
              title="Definitions"
              className="no-print"
            />
            {(selectedKey === 'board' || selectedKey === 'financial') && <PrintButton />}
            <div style={{ marginLeft: 'auto', color: '#8C8C8C', fontSize: 12, whiteSpace: 'nowrap' }}>
              FY26
            </div>
          </Header>
          <Content style={{ padding: 16, overflow: 'auto' }}>
            {renderDashboard()}
          </Content>
          <DefinitionsDrawer dashboardKey={selectedKey} open={defsOpen} onClose={() => setDefsOpen(false)} />
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
