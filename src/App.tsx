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
  BulbOutlined,
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
import { DashboardAuditDashboard } from './dashboards/DashboardAuditDashboard';
import { GuideDashboard } from './dashboards/GuideDashboard';
import { CFOAnalystBriefDashboard } from './dashboards/CFOAnalystBriefDashboard';
import { CampaignSimulationDashboard } from './dashboards/CampaignSimulationDashboard';
import { ShareOfWalletDashboard } from './dashboards/ShareOfWalletDashboard';
import { DonorLifecycleDashboard } from './dashboards/DonorLifecycleDashboard';
import { CommunityNetworkDashboard } from './dashboards/CommunityNetworkDashboard';
import { VoiceAgentDashboard } from './dashboards/VoiceAgentDashboard';
import { ImmersiveTravelDashboard } from './dashboards/ImmersiveTravelDashboard';
import { MajorGiftsDashboard } from './dashboards/MajorGiftsDashboard';
import { TheUnaskedDashboard } from './dashboards/TheUnaskedDashboard';
import { CohortSurvivalDashboard } from './dashboards/CohortSurvivalDashboard';
import { RetentionFlowDashboard } from './dashboards/RetentionFlowDashboard';
import { HoldingsDashboard } from './dashboards/HoldingsDashboard';
import { DefinitionsDrawer } from './components/DefinitionsDrawer';
import { PrintButton } from './components/PrintButton';
import { GlobalSearch } from './components/GlobalSearch';
import './App.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const groupLabelStyle = { fontSize: 11, letterSpacing: '0.5px', color: 'rgba(255,255,255,0.4)', padding: '12px 16px 4px' };

const menuItems = [
  { key: 'guide', icon: <InfoCircleOutlined />, label: 'Guide & Directory' },
  { key: 'cfo-brief', icon: <BulbOutlined />, label: 'CFO Analyst Brief' },
  { key: 'campaign-sim', icon: <FundOutlined />, label: 'Campaign Simulation' },
  { key: 'overview', icon: <PieChartOutlined />, label: 'Overview' },
  {
    type: 'group' as const,
    label: <span style={groupLabelStyle}>DEVELOPMENT</span>,
    children: [
      { key: 'campaign', icon: <FundOutlined />, label: 'Campaign Tracker' },
      { key: 'donor-health', icon: <HeartOutlined />, label: 'Donor Health' },
      { key: 'drm', icon: <UsergroupAddOutlined />, label: 'DRM Portfolios' },
      { key: 'share-of-wallet', icon: <DollarOutlined />, label: 'Share of Wallet' },
      { key: 'major-gifts', icon: <TrophyOutlined />, label: 'Major Gifts' },
      { key: 'the-unasked', icon: <AlertOutlined />, label: 'The Unasked' },
      { key: 'donor-lifecycle', icon: <TeamOutlined />, label: 'Donor Lifecycle' },
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
      { key: 'projects', icon: <ProjectOutlined />, label: 'Project Tracker' },
      { key: 'monday', icon: <CalendarOutlined />, label: 'Monday.com' },
      { key: 'voice-agent', icon: <PhoneOutlined />, label: 'Voice Agent' },
      { key: 'immersive-travel', icon: <CalendarOutlined />, label: 'Immersive Travel' },
      { key: 'holdings', icon: <HomeOutlined />, label: 'Holdings' },
    ],
  },
  {
    type: 'group' as const,
    label: <span style={groupLabelStyle}>ANALYTICS</span>,
    children: [
      { key: 'data-quality', icon: <SafetyCertificateOutlined />, label: 'Data Quality' },
      { key: 'data-duel', icon: <TrophyOutlined />, label: 'Data Duel' },
      { key: 'ecobee-trends', icon: <LineChartOutlined />, label: 'Ecobee Trends' },
      { key: 'chart-gallery', icon: <BarChartOutlined />, label: 'Chart Gallery' },
      { key: 'cohort-analysis', icon: <LineChartOutlined />, label: 'Cohort Analysis' },
      { key: 'retention-flow', icon: <ApartmentOutlined />, label: 'Retention Flow' },
      { key: 'community-network', icon: <ApartmentOutlined />, label: 'Community Network' },
      { key: 'dashboard-audit', icon: <SafetyCertificateOutlined />, label: 'Dashboard Audit' },
    ],
  },
];

const dashboardTitles: Record<string, string> = {
  overview: 'Overview',
  campaign: 'Campaign Tracker',
  'donor-health': 'Donor Health',
  drm: 'DRM Portfolios',
  'share-of-wallet': 'Share of Wallet',
  'major-gifts': 'Major Gifts',
  'the-unasked': 'The Unasked',
  'donor-lifecycle': 'Donor Lifecycle',
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
  'cohort-analysis': 'Cohort Analysis',
  'retention-flow': 'Retention Flow',
  'community-network': 'Community Network',
  'voice-agent': 'Voice Agent',
  'immersive-travel': 'Immersive Travel',
  holdings: 'Holdings',
};

interface SidebarContentProps {
  selectedKey: string;
  onMenuClick: (info: { key: string }) => void;
}

function SidebarContent({ selectedKey, onMenuClick }: SidebarContentProps) {
  return (
    <>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Typography.Title level={4} style={{ color: '#4DA3FF', margin: 0, fontSize: 18 }}>
          Federation Analytics
        </Typography.Title>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
          Jewish Federation of San Diego
        </div>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={onMenuClick}
      />
    </>
  );
}

function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [defsOpen, setDefsOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState('overview');

  const handleMenuClick = ({ key }: { key: string }) => {
    setSelectedKey(key);
    setDrawerOpen(false);
  };

  const renderDashboard = () => {
    switch (selectedKey) {
      case 'guide': return <GuideDashboard onNavigate={(key: string) => setSelectedKey(key)} />;
      case 'cfo-brief': return <CFOAnalystBriefDashboard />;
      case 'campaign-sim': return <CampaignSimulationDashboard />;
      case 'overview': return <OverviewDashboard onNavigate={(key: string) => setSelectedKey(key)} />;
      case 'campaign': return <CampaignTrackerDashboard />;
      case 'donor-health': return <DonorHealthDashboard />;
      case 'drm': return <DRMPortfolioDashboard />;
      case 'share-of-wallet': return <ShareOfWalletDashboard />;
      case 'major-gifts': return <MajorGiftsDashboard />;
      case 'the-unasked': return <TheUnaskedDashboard />;
      case 'donor-lifecycle': return <DonorLifecycleDashboard />;
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
      case 'cohort-analysis': return <CohortSurvivalDashboard />;
      case 'retention-flow': return <RetentionFlowDashboard />;
      case 'community-network': return <CommunityNetworkDashboard />;
      case 'voice-agent': return <VoiceAgentDashboard />;
      case 'immersive-travel': return <ImmersiveTravelDashboard />;
      case 'holdings': return <HoldingsDashboard />;
      case 'dashboard-audit': return <DashboardAuditDashboard />;
      default: return null;
    }
  };

  return (
    <ConfigProvider theme={jfsdTheme}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={230} theme="dark" breakpoint="lg" collapsedWidth={0} trigger={null}
          className="desktop-sider">
          <SidebarContent selectedKey={selectedKey} onMenuClick={handleMenuClick} />
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
            <SidebarContent selectedKey={selectedKey} onMenuClick={handleMenuClick} />
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
