import React, { useState, useMemo } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, LineChart, Line,
  CartesianAxis
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Users, Search, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface TrafficDashboardProps {
  data: any;
  filters: any;
  funnelData?: any;
  finalChartData?: any[];
  loading?: boolean;
  vtexOrders?: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  'Organic Search': '#10B981',
  'Direct': '#3B82F6',
  'Paid Search': '#F59E0B',
  'Social': '#8B5CF6',
  'Email': '#EC4899',
  'Referral': '#06B6D4',
  'Display': '#F97316',
  'Affiliate': '#64748B',
  'Unassigned': '#94A3B8'
};

const DEVICE_COLORS: Record<string, string> = {
  'Desktop': '#3B82F6',
  'Mobile': '#F59E0B',
  'Tablet': '#06B6D4'
};

function formatDuration(seconds: number) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function TrafficDashboard({ data, filters, funnelData, finalChartData, loading, vtexOrders }: TrafficDashboardProps) {
  const [campaignSearch, setCampaignSearch] = useState('');
  const [granularitySearch, setGranularitySearch] = useState('');
  const [granularityPage, setGranularityPage] = useState(1);
  const [channelSortField, setChannelSortField] = useState('revenue');
  const [channelSortDir, setChannelSortDir] = useState<'asc' | 'desc'>('desc');
  const [campaignSortField, setCampaignSortField] = useState('revenue');
  const [campaignSortDir, setCampaignSortDir] = useState<'asc' | 'desc'>('desc');
  const [funnelBase, setFunnelBase] = useState<'users' | 'sessions'>('users');
  const itemsPerPage = 10;

  const handleChannelSort = (field: string) => {
    if (channelSortField === field) setChannelSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setChannelSortField(field); setChannelSortDir('desc'); }
  };

  const handleCampaignSort = (field: string) => {
    if (campaignSortField === field) setCampaignSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setCampaignSortField(field); setCampaignSortDir('desc'); }
  };

  if (!data || data.mock || !data.overviewData || !data.overviewData.rows || data.overviewData.rows.length === 0) {
    return (
      <div className="p-8 flex flex-col gap-6 items-center justify-center h-full text-slate-500">
        <Users className="w-12 h-12 text-slate-300" />
        <h2 className="text-xl font-bold">Sem dados de Tráfego</h2>
        <p>O Google Analytics 4 não está configurado ou não retornou dados para este período.</p>
      </div>
    );
  }

  // --- Parse Data ---
  const overview = data.overviewData?.rows?.[0]?.metricValues || [];
  const prevOverview = data.prevOverviewData?.rows?.[0]?.metricValues || [];
  
  const sessions = parseInt(overview[0]?.value || '0');
  const prevSessions = parseInt(prevOverview[0]?.value || '0');
  const sessionVar = prevSessions > 0 ? ((sessions - prevSessions) / prevSessions) * 100 : 0;

  const totalUsers = parseInt(overview[1]?.value || '0');
  const prevTotalUsers = parseInt(prevOverview[1]?.value || '0');
  const totalUsersVar = prevTotalUsers > 0 ? ((totalUsers - prevTotalUsers) / prevTotalUsers) * 100 : 0;
  
  const newUsers = parseInt(overview[2]?.value || '0');
  const returnUsers = totalUsers - newUsers;

  const pageViews = parseInt(overview[7]?.value || '0');
  const prevPageViews = parseInt(prevOverview[4]?.value || '0');
  const pageViewsVar = prevPageViews > 0 ? ((pageViews - prevPageViews) / prevPageViews) * 100 : 0;

  const sessionsPerUser = totalUsers > 0 ? sessions / totalUsers : 0;
  const prevSessionsPerUser = prevTotalUsers > 0 ? prevSessions / prevTotalUsers : 0;
  const sessionsPerUserVar = prevSessionsPerUser > 0 ? ((sessionsPerUser - prevSessionsPerUser) / prevSessionsPerUser) * 100 : 0;

  const viewsPerVisitor = totalUsers > 0 ? pageViews / totalUsers : 0;
  const prevViewsPerVisitor = prevTotalUsers > 0 ? prevPageViews / prevTotalUsers : 0;
  const viewsPerVisitorVar = prevViewsPerVisitor > 0 ? ((viewsPerVisitor - prevViewsPerVisitor) / prevViewsPerVisitor) * 100 : 0;

  const viewsPerSession = sessions > 0 ? pageViews / sessions : 0;
  const prevViewsPerSession = prevSessions > 0 ? prevPageViews / prevSessions : 0;
  const viewsPerSessionVar = prevViewsPerSession > 0 ? ((viewsPerSession - prevViewsPerSession) / prevViewsPerSession) * 100 : 0;

  // --- Camada 2: Mix de Canais ---
  const channelsRaw = data.channelsData?.rows || [];
  
  const channelAgg = useMemo(() => {
    const agg: Record<string, any> = {};
    let maxSessions = 0;
    channelsRaw.forEach((r: any) => {
      const ch = r.dimensionValues?.[1]?.value || '(not set)';
      if (!agg[ch]) {
        agg[ch] = { name: ch, sessions: 0, users: 0, conversions: 0, revenue: 0, engTimeSum: 0, engRateSum: 0, count: 0 };
      }
      agg[ch].sessions += parseInt(r.metricValues?.[0]?.value || '0');
      agg[ch].users += parseInt(r.metricValues?.[1]?.value || '0');
      agg[ch].engRateSum += parseFloat(r.metricValues?.[2]?.value || '0');
      agg[ch].engTimeSum += parseFloat(r.metricValues?.[3]?.value || '0');
      agg[ch].conversions += parseInt(r.metricValues?.[4]?.value || '0');
      agg[ch].revenue += parseFloat(r.metricValues?.[5]?.value || '0');
      agg[ch].count += 1;
    });

    const list = Object.values(agg).map(c => {
      c.engRate = c.count > 0 ? (c.engRateSum / c.count) * 100 : 0;
      c.avgTime = c.count > 0 ? (c.engTimeSum / c.count) : 0;
      c.convRate = c.sessions > 0 ? (c.conversions / c.sessions) * 100 : 0;
      if (c.sessions > maxSessions) maxSessions = c.sessions;
      return c;
    });
    
    return { list, maxSessions };
  }, [channelsRaw]);


  // --- Camada 3: Tabela Canais ---
  const sortedChannels = [...channelAgg.list].sort((a, b) => {
    const vA = a[channelSortField] || 0;
    const vB = b[channelSortField] || 0;
    if (vA < vB) return channelSortDir === 'asc' ? -1 : 1;
    if (vA > vB) return channelSortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // --- Camada 4: Geo & Devices ---
  const geoRaw = data.geoData?.rows || [];
  const geoData = geoRaw.map((r: any) => ({
    name: r.dimensionValues?.[0]?.value || '(not set)',
    sessions: parseInt(r.metricValues?.[0]?.value || '0'),
    conversions: parseInt(r.metricValues?.[1]?.value || '0'),
    revenue: parseFloat(r.metricValues?.[2]?.value || '0')
  })).sort((a: any, b: any) => b.sessions - a.sessions).slice(0, 15);

  const deviceRaw = data.deviceData?.rows || [];
  const deviceData = deviceRaw.map((r: any) => {
    const sess = parseInt(r.metricValues?.[0]?.value || '0');
    const conv = parseInt(r.metricValues?.[1]?.value || '0');
    return {
      name: r.dimensionValues?.[0]?.value || '(not set)',
      sessions: sess,
      conversions: conv,
      revenue: parseFloat(r.metricValues?.[2]?.value || '0'),
      convRate: sess > 0 ? (conv / sess) * 100 : 0
    };
  });

  // --- Camada 5: Campaigns & Landing Pages ---
  const campRaw = data.campaignsData?.rows || [];
  const campList = campRaw.map((r: any) => {
    const sess = parseInt(r.metricValues?.[0]?.value || '0');
    const conv = parseInt(r.metricValues?.[1]?.value || '0');
    return {
      campaign: r.dimensionValues?.[0]?.value || '(not set)',
      source: r.dimensionValues?.[1]?.value || '(not set)',
      medium: r.dimensionValues?.[2]?.value || '(not set)',
      sessions: sess,
      conversions: conv,
      convRate: sess > 0 ? (conv / sess) * 100 : 0,
      revenue: parseFloat(r.metricValues?.[2]?.value || '0')
    };
  });
  
  let campMaxSessions = 0;
  const filteredCamp = campList.filter((c: any) => 
    (c.campaign || '').toLowerCase().includes(campaignSearch.toLowerCase()) ||
    (c.source || '').toLowerCase().includes(campaignSearch.toLowerCase())
  ).sort((a: any, b: any) => {
    const vA = a[campaignSortField] || 0;
    const vB = b[campaignSortField] || 0;
    if (vA < vB) return campaignSortDir === 'asc' ? -1 : 1;
    if (vA > vB) return campaignSortDir === 'asc' ? 1 : -1;
    return 0;
  });
  
  filteredCamp.forEach((c: any) => { if (c.sessions > campMaxSessions) campMaxSessions = c.sessions; });

  const lpRaw = data.landingPagesData?.rows || [];
  const lpList = lpRaw.map((r: any) => ({
    path: r.dimensionValues?.[0]?.value || '(not set)',
    sessions: parseInt(r.metricValues?.[0]?.value || '0'),
    conversions: parseInt(r.metricValues?.[1]?.value || '0'),
    bounce: parseFloat(r.metricValues?.[2]?.value || '0') * 100
  })).sort((a: any, b: any) => b.sessions - a.sessions).slice(0, 10);
  
  let lpMaxSessions = 0;
  lpList.forEach((c: any) => { if (c.sessions > lpMaxSessions) lpMaxSessions = c.sessions; });

  // --- Camada 6: Granularidade ---
  const granRaw = data.granularityData?.rows || [];
  const granList = granRaw.map((r: any) => {
    const rev = parseFloat(r.metricValues?.[2]?.value || '0');
    const cost = parseFloat(r.metricValues?.[3]?.value || '0');
    return {
      source: r.dimensionValues?.[0]?.value || '(not set)',
      medium: r.dimensionValues?.[1]?.value || '(not set)',
      campaign: r.dimensionValues?.[2]?.value || '(not set)',
      term: r.dimensionValues?.[3]?.value || '-',
      content: r.dimensionValues?.[4]?.value || '-',
      sessions: parseInt(r.metricValues?.[0]?.value || '0'),
      conversions: parseInt(r.metricValues?.[1]?.value || '0'),
      revenue: rev,
      cost: cost,
      roas: cost > 0 ? (rev / cost) : null
    };
  });
  
  let granMaxSessions = 0;
  const filteredGran = granList.filter((c: any) => 
    (c.source || '').toLowerCase().includes(granularitySearch.toLowerCase()) ||
    (c.medium || '').toLowerCase().includes(granularitySearch.toLowerCase()) ||
    (c.campaign || '').toLowerCase().includes(granularitySearch.toLowerCase())
  ).sort((a: any, b: any) => b.sessions - a.sessions);
  
  filteredGran.forEach((c: any) => { if (c.sessions > granMaxSessions) granMaxSessions = c.sessions; });
  
  const granPages = Math.ceil(filteredGran.length / itemsPerPage);
  const currentGranData = filteredGran.slice((granularityPage - 1) * itemsPerPage, granularityPage * itemsPerPage);

  const renderBadge = (val: number, prevVal?: string | number) => {
    const safeVal = isNaN(val) ? 0 : val;
    const isPos = safeVal >= 0;
    return (
      <div className="flex flex-col items-end">
        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${isPos ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          {isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(safeVal).toFixed(1)}%
        </span>
        {prevVal !== undefined && (
          <span className="text-[9px] text-slate-400 font-medium mt-0.5 text-right whitespace-nowrap">vs {prevVal}</span>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 bg-slate-50 min-h-full flex flex-col gap-6">
      {/* CAMADA 1: KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Sessões Totais</span>
            {renderBadge(sessionVar, (prevSessions || 0).toLocaleString('pt-BR'))}
          </div>
          <div className="text-2xl font-bold text-slate-900">{(sessions || 0).toLocaleString('pt-BR')}</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Usuários Únicos</span>
            {renderBadge(totalUsersVar, (prevTotalUsers || 0).toLocaleString('pt-BR'))}
          </div>
          <div className="text-2xl font-bold text-slate-900">{(totalUsers || 0).toLocaleString('pt-BR')}</div>
          <div className="text-[10px] text-slate-500 font-medium">Novos: {(newUsers || 0).toLocaleString('pt-BR')} | Rec: {(returnUsers || 0).toLocaleString('pt-BR')}</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Sessões / Usuário</span>
            {renderBadge(sessionsPerUserVar, (prevSessionsPerUser || 0).toFixed(2))}
          </div>
          <div className="text-2xl font-bold text-slate-900">{(sessionsPerUser || 0).toFixed(2)}</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Vis. de Páginas</span>
            {renderBadge(pageViewsVar, (prevPageViews || 0).toLocaleString('pt-BR'))}
          </div>
          <div className="text-2xl font-bold text-slate-900">{(pageViews || 0).toLocaleString('pt-BR')}</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">PVs / Visitante</span>
            {renderBadge(viewsPerVisitorVar, (prevViewsPerVisitor || 0).toFixed(2))}
          </div>
          <div className="text-2xl font-bold text-slate-900">{(viewsPerVisitor || 0).toFixed(2)}</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">PVs / Sessão</span>
            {renderBadge(viewsPerSessionVar, (prevViewsPerSession || 0).toFixed(2))}
          </div>
          <div className="text-2xl font-bold text-slate-900">{(viewsPerSession || 0).toFixed(2)}</div>
        </div>
      </div>

      {/* CAMADA 2: Funil GA4 */}
      <div className="w-full flex justify-between items-end mb-2">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Funil de Conversão do E-commerce</h2>
        <div className="flex bg-slate-200 p-1 rounded-md">
          <button 
            onClick={() => setFunnelBase('users')}
            className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all ${funnelBase === 'users' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Visitantes Únicos
          </button>
          <button 
            onClick={() => setFunnelBase('sessions')}
            className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all ${funnelBase === 'sessions' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Sessões
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full mb-2">
        {/* Tendência do Funil - Linhas */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[440px]">
          <h3 className="text-[14px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Tendência de Evolução</h3>
          <div className="flex-1 w-full min-h-0">
            {finalChartData && finalChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={finalChartData} margin={{ top: 15, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="displayDate" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="top" height={30} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '9px', fontWeight: 'semibold', paddingBottom: '10px' }} />
                  <Line type="linear" dataKey={funnelBase === 'users' ? 'visitors' : 'visitorsSessions'} stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name={funnelBase === 'users' ? "1. Visitantes Únicos" : "1. Sessões Iniciais"} />
                  <Line type="linear" dataKey={funnelBase === 'users' ? 'viewItem' : 'viewItemSessions'} stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="2. Viu Produto" />
                  <Line type="linear" dataKey={funnelBase === 'users' ? 'cart' : 'cartSessions'} stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="3. Carrinho" />
                  <Line type="linear" dataKey={funnelBase === 'users' ? 'checkout' : 'checkoutSessions'} stroke="#06B6D4" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="4. Checkout" />
                  <Line type="linear" dataKey="vtexOrders" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="5. Compras VTEX" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                {loading ? 'Carregando dados...' : 'Sem dados disponíveis para os filtros selecionados.'}
              </div>
            )}
          </div>
        </div>

        {/* Funil de Conversão - Barras horizontais */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[440px]">
          <h3 className="text-[14px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Etapas do Funil</h3>
          {!funnelData ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
              {loading ? 'Carregando funil...' : 'Sem dados de funil'}
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between py-1 w-full min-h-0">
              {[
                { label: funnelBase === 'users' ? 'Visitantes' : 'Sessões', value: funnelBase === 'users' ? funnelData.visitors : (funnelData.visitorsSessions || funnelData.visitors), max: funnelBase === 'users' ? funnelData.visitors : (funnelData.visitorsSessions || funnelData.visitors) },
                { label: 'Viu Produto', value: funnelBase === 'users' ? funnelData.viewItem : (funnelData.viewItemSessions || funnelData.viewItem), max: funnelBase === 'users' ? funnelData.visitors : (funnelData.visitorsSessions || funnelData.visitors) },
                { label: 'Carrinho', value: funnelBase === 'users' ? funnelData.cart : (funnelData.cartSessions || funnelData.cart), max: funnelBase === 'users' ? funnelData.visitors : (funnelData.visitorsSessions || funnelData.visitors) },
                { label: 'Checkout', value: funnelBase === 'users' ? funnelData.checkout : (funnelData.checkoutSessions || funnelData.checkout), max: funnelBase === 'users' ? funnelData.visitors : (funnelData.visitorsSessions || funnelData.visitors) },
                { label: 'Compras VTEX', value: vtexOrders || 0, max: funnelBase === 'users' ? funnelData.visitors : (funnelData.visitorsSessions || funnelData.visitors) },
              ].map((step, idx, arr) => {
                const safeMax = step.max || 0;
                const safeValue = step.value || 0;
                const percentageOverall = safeMax > 0 ? (safeValue / safeMax) * 100 : 0;
                const prevValue = idx === 0 ? safeMax : (arr[idx - 1].value || 0);
                const stepConversion = prevValue > 0 ? (safeValue / prevValue) * 100 : 0;
                const stepColors = ['#3B82F6', '#8B5CF6', '#F59E0B', '#06B6D4', '#10B981'];
                const rateLabels = ['', 'Taxa de Produto: ', 'Taxa de Carrinho: ', 'Taxa de Checkout: ', 'Taxa de Conversão: '];
                
                return (
                  <React.Fragment key={idx}>
                    <div className="flex flex-col w-full gap-1.5 py-1">
                      <div className="flex justify-between items-end w-full px-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-slate-600">{step.label}</span>
                          <span className="text-[11px] font-bold" style={{ color: stepColors[idx] }}>
                            {percentageOverall.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
                          </span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="text-sm font-bold text-slate-800 leading-none mb-1">{safeValue.toLocaleString('pt-BR')}</span>
                          <span className="text-[10px] font-medium text-slate-400 leading-none">
                            {idx === 0 ? '100% (Base)' : `${rateLabels[idx]} ${stepConversion.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`}
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-6 bg-slate-100 rounded-md overflow-hidden flex items-center p-[2px] border border-slate-200 shadow-sm">
                        <div 
                          className="h-full rounded-[4px] transition-all duration-500"
                          style={{ 
                            width: `${percentageOverall}%`,
                            minWidth: percentageOverall > 0 ? '4px' : '0px',
                            backgroundColor: stepColors[idx]
                          }}
                        />
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CAMADA 3: Tabela Qualidade */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
        <div className="p-5 border-b border-slate-100">
          <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Desempenho Detalhado por Canal de Aquisição</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[12px] select-none">
                <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleChannelSort('name')}>Canal {channelSortField === 'name' ? (channelSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-slate-800" onClick={() => handleChannelSort('sessions')}>Sessões {channelSortField === 'sessions' ? (channelSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-slate-800" onClick={() => handleChannelSort('users')}>Usuários {channelSortField === 'users' ? (channelSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-slate-800" onClick={() => handleChannelSort('engRate')}>Engajamento (%) {channelSortField === 'engRate' ? (channelSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-slate-800" onClick={() => handleChannelSort('avgTime')}>Tempo Médio {channelSortField === 'avgTime' ? (channelSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-slate-800" onClick={() => handleChannelSort('conversions')}>Conversões {channelSortField === 'conversions' ? (channelSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-slate-800" onClick={() => handleChannelSort('convRate')}>Taxa Conv. (%) {channelSortField === 'convRate' ? (channelSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-slate-800" onClick={() => handleChannelSort('revenue')}>Receita {channelSortField === 'revenue' ? (channelSortDir === 'desc' ? '▼' : '▲') : ''}</th>
              </tr>
            </thead>
            <tbody>
              {sortedChannels.map((c, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[c.name] || '#CBD5E1' }}></div>
                    {c.name}
                  </td>
                  <td className="py-3 px-4 text-right relative">
                    <div className="absolute inset-y-0 right-0 bg-slate-100 opacity-50 z-0" style={{ width: `${(c.sessions / channelAgg.maxSessions) * 100}%` }}></div>
                    <span className="relative z-10 font-mono font-medium">{c.sessions.toLocaleString('pt-BR')}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">{c.users.toLocaleString('pt-BR')}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">{c.engRate.toFixed(1)}%</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">{formatDuration(c.avgTime)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">{c.conversions.toLocaleString('pt-BR')}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">{c.convRate.toFixed(2)}%</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">R$ {c.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CAMADA 4: Geo & Dispositivos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm h-[400px] flex flex-col">
          <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Distribuição Geográfica de Tráfego</span>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={geoData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }} width={100} />
                <RechartsTooltip 
                  cursor={{ fill: '#F8FAFC' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: string) => {
                    if (name === 'revenue') return [`R$ ${Number(value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 'Receita'];
                    return [value.toLocaleString('pt-BR'), name === 'sessions' ? 'Sessões' : 'Conversões'];
                  }}
                />
                <Bar dataKey="sessions" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={16} name="Sessões" />
                <Bar dataKey="conversions" fill="#10B981" radius={[0, 4, 4, 0]} barSize={16} name="Conversões" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm h-[400px] flex flex-col">
          <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Comportamento por Dispositivo</span>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deviceData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }} width={80} />
                <RechartsTooltip 
                  cursor={{ fill: '#F8FAFC' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: string) => {
                    if (name === 'convRate') return [`${Number(value).toFixed(2)}%`, 'Taxa de Conv.'];
                    if (name === 'revenue') return [`R$ ${Number(value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 'Receita'];
                    return [value.toLocaleString('pt-BR'), 'Sessões'];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="sessions" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={12} name="Sessões" />
                <Bar dataKey="convRate" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={12} name="Taxa de Conv." />
                <Bar dataKey="revenue" fill="#06B6D4" radius={[0, 4, 4, 0]} barSize={12} name="Receita" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* CAMADA 5: Campaigns & Landing Pages */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-[500px]">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Performance de Campanhas (UTM)</span>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Filtrar campanhas..." 
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white transition-colors"
              />
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0 bg-white z-20">
                <tr className="text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[12px] select-none">
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleCampaignSort('campaign')}>Campanha</th>
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleCampaignSort('source')}>Origem / Mídia</th>
                  <th className="py-3 px-4 text-right cursor-pointer hover:text-slate-800" onClick={() => handleCampaignSort('sessions')}>Sessões</th>
                  <th className="py-3 px-4 text-right cursor-pointer hover:text-slate-800" onClick={() => handleCampaignSort('conversions')}>Conv.</th>
                  <th className="py-3 px-4 text-right cursor-pointer hover:text-slate-800" onClick={() => handleCampaignSort('convRate')}>Taxa Conv.</th>
                  <th className="py-3 px-4 text-right cursor-pointer hover:text-slate-800" onClick={() => handleCampaignSort('revenue')}>Receita</th>
                </tr>
              </thead>
              <tbody>
                {filteredCamp.slice(0, 50).map((c: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-800 max-w-[200px] truncate" title={c.campaign}>{c.campaign === '(not set)' ? '-' : c.campaign}</td>
                    <td className="py-3 px-4 text-slate-600 truncate max-w-[150px]">{c.source} / {c.medium}</td>
                    <td className="py-3 px-4 text-right relative">
                      <div className="absolute inset-y-0 right-0 bg-slate-100 opacity-50 z-0" style={{ width: `${(c.sessions / (campMaxSessions || 1)) * 100}%` }}></div>
                      <span className="relative z-10 font-mono">{c.sessions.toLocaleString('pt-BR')}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{c.conversions.toLocaleString('pt-BR')}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{c.convRate.toFixed(2)}%</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">R$ {c.revenue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-[500px]">
          <div className="p-5 border-b border-slate-100">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Top Landing Pages</span>
          </div>
          <div className="overflow-y-auto flex-1 p-0">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0 bg-white z-20">
                <tr className="text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                  <th className="py-2 px-4">Página</th>
                  <th className="py-2 px-2 text-right">Sessões</th>
                  <th className="py-2 px-2 text-right">Saída</th>
                  <th className="py-2 px-4 text-right">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {lpList.map((lp: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3 px-4 max-w-[140px] truncate text-slate-700 font-medium" title={lp.path}>{lp.path}</td>
                    <td className="py-3 px-2 text-right relative">
                      <div className="absolute inset-y-1 right-2 bg-blue-100 rounded-sm z-0" style={{ width: `${(lp.sessions / (lpMaxSessions || 1)) * 100}%` }}></div>
                      <span className="relative z-10 font-mono text-[12px]">{lp.sessions.toLocaleString('pt-BR')}</span>
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-[12px] text-slate-500">{lp.bounce.toFixed(1)}%</td>
                    <td className="py-3 px-4 text-right font-mono text-[12px] text-slate-900 font-bold">{lp.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CAMADA 6: Granularidade */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col mb-8">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Granularidade de Origem e Mídia</span>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar origem, mídia, campanha..." 
              value={granularitySearch}
              onChange={(e) => { setGranularitySearch(e.target.value); setGranularityPage(1); }}
              className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 bg-slate-50 w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[12px]">
                <th className="py-3 px-4">Origem</th>
                <th className="py-3 px-4">Mídia</th>
                <th className="py-3 px-4">Campanha</th>
                <th className="py-3 px-4">Termo</th>
                <th className="py-3 px-4">Conteúdo</th>
                <th className="py-3 px-4 text-right">Sessões</th>
                <th className="py-3 px-4 text-right">Conv.</th>
                <th className="py-3 px-4 text-right">Receita (R$)</th>
                <th className="py-3 px-4 text-right">Custo Estimado</th>
                <th className="py-3 px-4 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {currentGranData.map((g: any, idx: number) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-800 font-medium">{g.source}</td>
                  <td className="py-3 px-4 text-slate-600">{g.medium}</td>
                  <td className="py-3 px-4 text-slate-600 max-w-[150px] truncate" title={g.campaign}>{g.campaign === '(not set)' ? '-' : g.campaign}</td>
                  <td className="py-3 px-4 text-slate-500 max-w-[120px] truncate">{g.term === '(not set)' ? '-' : g.term}</td>
                  <td className="py-3 px-4 text-slate-500 max-w-[120px] truncate">{g.content === '(not set)' ? '-' : g.content}</td>
                  <td className="py-3 px-4 text-right relative">
                    <div className="absolute inset-y-0 right-0 bg-slate-100 opacity-50 z-0" style={{ width: `${(g.sessions / (granMaxSessions || 1)) * 100}%` }}></div>
                    <span className="relative z-10 font-mono">{g.sessions.toLocaleString('pt-BR')}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">{g.conversions.toLocaleString('pt-BR')}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{g.revenue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">
                    {g.cost > 0 ? (
                      `R$ ${g.cost.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded" title="Requer integração Google Ads/Meta">
                        <AlertCircle className="w-3 h-3" /> Sem Dados
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600">
                    {g.roas ? `${g.roas.toFixed(2)}x` : '-'}
                  </td>
                </tr>
              ))}
              {currentGranData.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">Nenhum dado encontrado para os filtros atuais.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
          <div>
            Mostrando {((granularityPage - 1) * itemsPerPage) + 1} a {Math.min(granularityPage * itemsPerPage, filteredGran.length)} de {filteredGran.length} registros
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setGranularityPage(p => Math.max(1, p - 1))}
              disabled={granularityPage === 1}
              className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setGranularityPage(p => Math.min(granPages, p + 1))}
              disabled={granularityPage === granPages || granPages === 0}
              className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
