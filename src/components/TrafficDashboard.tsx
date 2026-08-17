import React, { useState, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
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

export default function TrafficDashboard({ data, filters, funnelData, finalChartData, loading }: TrafficDashboardProps) {
  const [campaignSearch, setCampaignSearch] = useState('');
  const [granularitySearch, setGranularitySearch] = useState('');
  const [granularityPage, setGranularityPage] = useState(1);
  const itemsPerPage = 10;

  // Sorting states
  const [channelSortField, setChannelSortField] = useState<string>('sessions');
  const [channelSortDir, setChannelSortDir] = useState<'asc' | 'desc'>('desc');

  const [campaignSortField, setCampaignSortField] = useState<string>('sessions');
  const [campaignSortDir, setCampaignSortDir] = useState<'asc' | 'desc'>('desc');

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
  const newUsers = parseInt(overview[2]?.value || '0');
  const returnUsers = totalUsers - newUsers;

  const engRate = parseFloat(overview[3]?.value || '0') * 100;
  const prevEngRate = parseFloat(prevOverview[1]?.value || '0') * 100;
  const engVar = prevEngRate > 0 ? ((engRate - prevEngRate) / prevEngRate) * 100 : 0;

  const conversions = parseInt(overview[4]?.value || '0');
  const prevConversions = parseInt(prevOverview[2]?.value || '0');
  const convVar = prevConversions > 0 ? ((conversions - prevConversions) / prevConversions) * 100 : 0;
  const convRate = sessions > 0 ? (conversions / sessions) * 100 : 0;

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

  const areaData = useMemo(() => {
    const dateMap: Record<string, any> = {};
    channelsRaw.forEach((r: any) => {
      const date = r.dimensionValues?.[0]?.value;
      const ch = r.dimensionValues?.[1]?.value || '(not set)';
      const val = parseInt(r.metricValues?.[0]?.value || '0');
      
      if (date && date.length >= 8) {
        const formattedDate = `${date.substring(6,8)}/${date.substring(4,6)}`;
        if (!dateMap[date]) dateMap[date] = { date: formattedDate, rawDate: date };
        dateMap[date][ch] = (dateMap[date][ch] || 0) + val;
      }
    });
    return Object.values(dateMap).sort((a: any, b: any) => a.rawDate.localeCompare(b.rawDate));
  }, [channelsRaw]);

  const uniqueChannels = useMemo(() => Array.from(new Set(channelsRaw.map((r: any) => r.dimensionValues?.[1]?.value || '(not set)'))), [channelsRaw]);

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

  const renderBadge = (val: number) => {
    const isPos = val >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${isPos ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
        {isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(val).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="p-6 bg-slate-50 min-h-full flex flex-col gap-6">
      {/* CAMADA 1: KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Sessões Totais</span>
            {renderBadge(sessionVar)}
          </div>
          <div className="text-2xl font-bold text-slate-900">{sessions.toLocaleString('pt-BR')}</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Usuários Únicos</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalUsers.toLocaleString('pt-BR')}</div>
          <div className="text-xs text-slate-500 font-medium">Novos: {newUsers.toLocaleString('pt-BR')} | Recorrentes: {returnUsers.toLocaleString('pt-BR')}</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Taxa de Engajamento</span>
            {renderBadge(engVar)}
          </div>
          <div className="text-2xl font-bold text-slate-900">{engRate.toFixed(1)}%</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Sessões Convertidas</span>
            {renderBadge(convVar)}
          </div>
          <div className="text-2xl font-bold text-slate-900">{conversions.toLocaleString('pt-BR')}</div>
          <div className="text-xs text-slate-500 font-medium">Taxa de Conversão: {convRate.toFixed(2)}%</div>
        </div>
      </div>

      {/* CAMADA 2: Funil GA4 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full mb-2">
        {/* Tendência do Funil - Linhas */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <h3 className="text-[14px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Tendência do Funil de Vendas (GA4)</h3>
          <div className="flex-1 w-full min-h-0">
            {finalChartData && finalChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={finalChartData} margin={{ top: 15, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="displayDate" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="top" height={30} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '9px', fontWeight: 'semibold', paddingBottom: '10px' }} />
                  <Line type="linear" dataKey="visitors" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="1. Visitantes Únicos" />
                  <Line type="linear" dataKey="viewItem" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="2. Viu Produto" />
                  <Line type="linear" dataKey="cart" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="3. Carrinho" />
                  <Line type="linear" dataKey="shipping" stroke="#06B6D4" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="4. Entrega" />
                  <Line type="linear" dataKey="payment" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="5. Pagamento" />
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
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <h3 className="text-[14px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Funil de Conversão (GA4)</h3>
          
          {!funnelData ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
              {loading ? 'Carregando funil...' : 'Sem dados de funil'}
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between py-1 w-full gap-2 min-h-0">
              {[
                { label: 'Visitantes', value: funnelData.visitors, max: funnelData.visitors },
                { label: 'Viu Produto', value: funnelData.viewItem, max: funnelData.visitors },
                { label: 'Carrinho', value: funnelData.cart, max: funnelData.visitors },
                { label: 'Entrega', value: funnelData.shipping, max: funnelData.visitors },
                { label: 'Pagamento', value: funnelData.payment, max: funnelData.visitors },
              ].map((step, idx, arr) => {
                const percentageOverall = step.max > 0 ? (step.value / step.max) * 100 : 0;
                const prevValue = idx === 0 ? step.max : arr[idx - 1].value;
                const stepConversion = prevValue > 0 ? (step.value / prevValue) * 100 : 0;
                const stepColors = ['#3B82F6', '#8B5CF6', '#F59E0B', '#06B6D4', '#10B981'];
                
                return (
                  <div key={idx} className="flex items-center w-full gap-3">
                    <div className="w-20 text-right text-xs font-semibold text-slate-500 truncate shrink-0">
                      {step.label}
                    </div>
                    
                    <div className="flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden flex items-center p-0.5 border border-slate-200 min-w-0">
                      <div 
                        className="h-full rounded-md transition-all duration-500 flex items-center justify-end px-2"
                        style={{ 
                          width: `${Math.max(percentageOverall, 12)}%`,
                          backgroundColor: stepColors[idx]
                        }}
                      >
                        {percentageOverall > 20 && (
                          <span className="text-[9px] font-bold text-white/90">{percentageOverall.toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="w-24 pl-1 flex flex-col justify-center min-w-0 shrink-0">
                      <span className="text-xs font-bold text-slate-800 truncate leading-none mb-0.5">{step.value.toLocaleString('pt-BR')}</span>
                      {idx > 0 ? (
                        <span className={`text-[10px] font-semibold leading-none ${stepConversion < 20 ? 'text-red-500' : 'text-slate-400'}`}>
                          {stepConversion.toFixed(1)}% do anterior
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold leading-none text-slate-400">Total de tráfego</span>
                      )}
                    </div>
                  </div>
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
