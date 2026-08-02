import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, ComposedChart } from 'recharts';
import { Calendar, Filter, TrendingUp, ShoppingCart, DollarSign, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subWeeks, subMonths, subQuarters, subYears } from 'date-fns';
import { GA4DataRow, VTEXOrder, DashboardFilter, FunnelData } from '../types';

export default function Dashboard() {
  const [ga4Data, setGa4Data] = useState<GA4DataRow[]>([]);
  const [vtexOrders, setVtexOrders] = useState<any[]>([]); // simplified type for response
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'executive' | 'sales'>('executive');
  const [periodType, setPeriodType] = useState('Últimos 28 dias');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');

  const [filters, setFilters] = useState<DashboardFilter>({
    startDate: format(subDays(new Date(), 28), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    category: 'All',
    minConversionRate: 0,
    status: 'All',
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch GA4 Data
      const ga4Response = await fetch('/api/ga4/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: filters.startDate, endDate: filters.endDate }),
      });
      
      const ga4Json = await ga4Response.json();
      
      if (!ga4Response.ok) {
        throw new Error(ga4Json.error || 'Failed to fetch GA4 data');
      }
      
      setGa4Data(ga4Json);

      // Fetch GA4 Funnel Data
      const funnelResponse = await fetch('/api/ga4/funnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: filters.startDate, endDate: filters.endDate }),
      });
      
      const funnelJson = await funnelResponse.json();
      
      if (funnelResponse.ok) {
        setFunnelData(funnelJson);
      }

      // Fetch VTEX Data
      const vtexResponse = await fetch('/api/vtex/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: filters.startDate, endDate: filters.endDate, category: filters.category }),
      });
      
      const vtexJson = await vtexResponse.json();
      
      if (!vtexResponse.ok) {
        throw new Error(vtexJson.error || 'Failed to fetch VTEX data');
      }
      
      setVtexOrders(vtexJson.list || []); // Assuming the OMS response has a list property

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period: string) => {
    setPeriodType(period);
    
    if (period === 'Fixo') return;

    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (period) {
        case 'Hoje':
            start = today;
            end = today;
            break;
        case 'Ontem':
            start = subDays(today, 1);
            end = subDays(today, 1);
            break;
        case 'Esta semana (começa no domingo)':
            start = startOfWeek(today, { weekStartsOn: 0 });
            end = endOfWeek(today, { weekStartsOn: 0 });
            break;
        case 'Esta semana (começa na segunda-feira)':
            start = startOfWeek(today, { weekStartsOn: 1 });
            end = endOfWeek(today, { weekStartsOn: 1 });
            break;
        case 'Este mês':
            start = startOfMonth(today);
            end = endOfMonth(today);
            break;
        case 'Este mês, até agora':
            start = startOfMonth(today);
            end = today;
            break;
        case 'Este trimestre':
            start = startOfQuarter(today);
            end = endOfQuarter(today);
            break;
        case 'Este trimestre, até agora':
            start = startOfQuarter(today);
            end = today;
            break;
        case 'Este ano':
            start = startOfYear(today);
            end = endOfYear(today);
            break;
        case 'Este ano, até agora':
            start = startOfYear(today);
            end = today;
            break;
        case 'Últimos 7 dias':
            start = subDays(today, 6);
            end = today;
            break;
        case 'Últimos 14 dias':
            start = subDays(today, 13);
            end = today;
            break;
        case 'Últimos 28 dias':
            start = subDays(today, 27);
            end = today;
            break;
        case 'Últimos 30 dias':
            start = subDays(today, 29);
            end = today;
            break;
        case 'Semana passada (começa no domingo)':
            start = startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 });
            end = endOfWeek(subWeeks(today, 1), { weekStartsOn: 0 });
            break;
        case 'Semana passada (começa na segunda-feira)':
            start = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
            end = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
            break;
        case 'Mês passado':
            start = startOfMonth(subMonths(today, 1));
            end = endOfMonth(subMonths(today, 1));
            break;
        case 'Trimestre passado':
            start = startOfQuarter(subQuarters(today, 1));
            end = endOfQuarter(subQuarters(today, 1));
            break;
        case 'Ano passado':
            start = startOfYear(subYears(today, 1));
            end = endOfYear(subYears(today, 1));
            break;
    }

    setFilters({
        ...filters,
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd')
    });
  };

  useEffect(() => {
    fetchData();
  }, [filters]); // Re-fetch when filters change (debouncing would be better in a real app, but this is fine for now)

  // Calculate Aggregates
  const dashboardFilteredVtexOrders = vtexOrders.filter(order => filters.status === 'All' || order.status === filters.status);
  
  const totalSessions = ga4Data.reduce((acc, row) => acc + row.sessions, 0);
  const totalConversionsGA4 = ga4Data.reduce((acc, row) => acc + row.conversions, 0);
  const totalRevenueGA4 = ga4Data.reduce((acc, row) => acc + row.revenue, 0);
  const totalVtexRevenue = dashboardFilteredVtexOrders.reduce((acc, order) => acc + ((order.totalValue || 0) / 100), 0);
  const totalVtexOrders = dashboardFilteredVtexOrders.length;
  const avgConversionRate = totalSessions > 0 ? ((totalVtexOrders / totalSessions) * 100).toFixed(2) : '0.00';
  const avgOrderValue = totalVtexOrders > 0 ? (totalVtexRevenue / totalVtexOrders) : 0;

  // Group VTEX orders by date for chart integration
  const vtexOrdersByDate = dashboardFilteredVtexOrders.reduce((acc, order) => {
    try {
      const dateObj = new Date(order.creationDate);
      const dateStr = format(dateObj, 'yyyy-MM-dd');
      if (!acc[dateStr]) {
        acc[dateStr] = { orders: 0, revenue: 0 };
      }
      acc[dateStr].orders += 1;
      acc[dateStr].revenue += (order.totalValue || 0) / 100;
    } catch (e) {
      console.warn("Invalid date format in order", order);
    }
    return acc;
  }, {} as Record<string, { orders: number, revenue: number }>);

  // Format Data for Charts
  const chartData = ga4Data.map(row => {
      const d = String(row.date);
      const isoDate = d.length === 8 ? `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}` : String(row.date);
      const displayDate = d.length === 8 ? `${d.substring(6,8)}/${d.substring(4,6)}` : String(row.date);
      
      const vtexMetrics = vtexOrdersByDate[isoDate] || { orders: 0, revenue: 0 };
      const cr = row.sessions > 0 ? (vtexMetrics.orders / row.sessions) * 100 : 0;
      
      return {
          ...row,
          displayDate,
          conversionRate: cr,
          vtexOrders: vtexMetrics.orders,
          vtexRevenue: vtexMetrics.revenue
      }
  }).filter(row => row.conversionRate >= filters.minConversionRate);

  const filteredOrders = dashboardFilteredVtexOrders.filter(order => {
    const matchesSearch = orderSearch === '' || 
      order.orderId.toLowerCase().includes(orderSearch.toLowerCase()) || 
      (order.clientName && order.clientName.toLowerCase().includes(orderSearch.toLowerCase()));
    
    const matchesStatus = orderStatusFilter === 'All' || order.status === orderStatusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar: Navigation & Fixed Filters */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white text-xl">V</div>
            <span className="text-xl font-bold text-white tracking-tight">Insight Hub</span>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">VTEX + GA4 Intelligence</p>
        </div>

        <div className="flex-1 p-6 space-y-8 overflow-y-auto">
          {/* Navigation */}
          <nav className="space-y-2">
            <div 
              onClick={() => setActiveTab('executive')}
              className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${activeTab === 'executive' ? 'text-white bg-slate-800' : 'hover:text-white'}`}
            >
              <div className={`w-4 h-4 border-2 rounded-sm ${activeTab === 'executive' ? 'border-white' : 'border-slate-500 border'}`}></div>
              <span className="text-sm font-medium">Visão Executiva</span>
            </div>
            <div 
              onClick={() => setActiveTab('sales')}
              className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${activeTab === 'sales' ? 'text-white bg-slate-800' : 'hover:text-white'}`}
            >
              <div className={`w-4 h-4 border-2 rounded-sm ${activeTab === 'sales' ? 'border-white' : 'border-slate-500 border'}`}></div>
              <span className="text-sm font-medium">Análise de Vendas</span>
            </div>
            <div className="flex items-center gap-3 hover:text-white px-3 py-2 transition-colors cursor-pointer">
              <div className="w-4 h-4 border border-slate-500 rounded-sm"></div>
              <span className="text-sm font-medium">Insights de Audiência</span>
            </div>
          </nav>

          {/* Dynamic Filters */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Filtros Dinâmicos</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block uppercase">Período</label>
                <select 
                  value={periodType}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                  className="w-full bg-slate-800 border-none text-xs rounded py-2 px-3 text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none appearance-none"
                >
                  <option value="Fixo">Fixo</option>
                  <option value="Hoje">Hoje</option>
                  <option value="Ontem">Ontem</option>
                  <optgroup label="Esta semana">
                    <option value="Esta semana (começa no domingo)">Esta semana (começa no domingo)</option>
                    <option value="Esta semana (começa na segunda-feira)">Esta semana (começa na segunda-feira)</option>
                  </optgroup>
                  <optgroup label="Este mês">
                    <option value="Este mês">Este mês</option>
                    <option value="Este mês, até agora">Este mês, até agora</option>
                  </optgroup>
                  <optgroup label="Este trimestre">
                    <option value="Este trimestre">Este trimestre</option>
                    <option value="Este trimestre, até agora">Este trimestre, até agora</option>
                  </optgroup>
                  <optgroup label="Este ano">
                    <option value="Este ano">Este ano</option>
                    <option value="Este ano, até agora">Este ano, até agora</option>
                  </optgroup>
                  <optgroup label="Últimos">
                    <option value="Últimos 7 dias">Últimos 7 dias</option>
                    <option value="Últimos 14 dias">Últimos 14 dias</option>
                    <option value="Últimos 28 dias">Últimos 28 dias</option>
                    <option value="Últimos 30 dias">Últimos 30 dias</option>
                  </optgroup>
                  <optgroup label="Passado">
                    <option value="Semana passada (começa no domingo)">Semana passada (começa no domingo)</option>
                    <option value="Semana passada (começa na segunda-feira)">Semana passada (começa na segunda-feira)</option>
                    <option value="Mês passado">Mês passado</option>
                    <option value="Trimestre passado">Trimestre passado</option>
                    <option value="Ano passado">Ano passado</option>
                  </optgroup>
                </select>
              </div>
              
              {periodType === 'Fixo' && (
                <>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block uppercase">Data Inicial</label>
                    <div className="relative">
                      <Calendar className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input 
                        type="date" 
                        value={filters.startDate}
                        onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                        className="w-full bg-slate-800 border-none text-xs rounded py-2 pl-7 pr-2 text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block uppercase">Data Final</label>
                    <div className="relative">
                      <Calendar className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input 
                        type="date" 
                        value={filters.endDate}
                        onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                        className="w-full bg-slate-800 border-none text-xs rounded py-2 pl-7 pr-2 text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block uppercase">Categoria de Produto</label>
                <select 
                  value={filters.category}
                  onChange={(e) => setFilters({...filters, category: e.target.value})}
                  className="w-full bg-slate-800 border-none text-xs rounded py-2 px-3 text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none appearance-none"
                >
                  <option value="All">Todas as Categorias</option>
                  <option value="Electronics">Eletrônicos</option>
                  <option value="Apparel">Moda & Vestuário</option>
                  <option value="Home">Casa & Jardim</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block uppercase">Taxa Conv. Mínima (%)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="range" 
                    min="0" max="100" step="0.1"
                    value={filters.minConversionRate}
                    onChange={(e) => setFilters({...filters, minConversionRate: parseFloat(e.target.value) || 0})}
                    className="flex-1 h-1 bg-slate-700 appearance-none rounded-lg"
                  />
                  <span className="text-xs text-slate-300 w-8 text-right">{filters.minConversionRate}%</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block uppercase">Status do Pedido</label>
                <select 
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="w-full bg-slate-800 border-none text-xs rounded py-2 px-3 text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none appearance-none"
                >
                  <option value="All">Todos os Status</option>
                  <option value="invoiced">Faturado</option>
                  <option value="handling">Em Preparação</option>
                  <option value="payment-pending">Pagamento Pendente</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600"></div>
            <div className="text-xs">
              <p className="text-white font-medium">Usuário Analista</p>
              <p className="text-slate-500">Plano Enterprise</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{activeTab === 'executive' ? 'Dashboard de Operações E-commerce' : 'Análise de Vendas (Pedidos)'}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={fetchData} className="flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Atualizar Dados
            </button>
            <div className="h-8 w-[1px] bg-slate-200"></div>
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
              <button 
                onClick={() => handlePeriodChange('Ontem')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  periodType === 'Ontem' ? 'text-slate-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Diário
              </button>
              <button 
                onClick={() => handlePeriodChange('Últimos 7 dias')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  periodType === 'Últimos 7 dias' ? 'text-slate-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Semanal
              </button>
              <button 
                onClick={() => handlePeriodChange('Este mês')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  periodType === 'Este mês' ? 'text-slate-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Mensal
              </button>
            </div>
            <div className="h-8 w-[1px] bg-slate-200"></div>
            <div className="text-xs text-slate-500">
              Sincronização: <span className="text-emerald-600 font-medium italic">{loading ? 'Sincronizando...' : 'Agora mesmo'}</span>
            </div>
          </div>
        </header>

        {/* Content Dashboard */}
        <div className="p-8 flex-1 flex flex-col gap-6 overflow-y-auto">
          
          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4 shrink-0">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-800 font-medium">Configuração de Autenticação Necessária</h3>
                <p className="text-red-700 text-sm mt-1 mb-4 leading-relaxed">
                  Para conectar e visualizar dados reais da sua loja, você deve configurar as seguintes variáveis de ambiente nas Configurações do AI Studio:
                </p>
                <code className="block bg-red-100 text-red-800 p-3 rounded-lg text-xs font-mono mb-2">
                  GA4_PROPERTY_ID="seu-id-da-propriedade"<br/>
                  GOOGLE_APPLICATION_CREDENTIALS_JSON="..."<br/>
                  VTEX_ACCOUNT_NAME="sua-conta"<br/>
                  VTEX_APP_KEY="..."<br/>
                  VTEX_APP_TOKEN="..."
                </code>
                <p className="text-red-600 text-xs">Detalhes do erro: {error}</p>
              </div>
            </div>
          )}

          {/* KPI Cards Row */}
          {activeTab === 'executive' && (
            <>
              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 shrink-0">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight mb-1">Receita Total (VTEX)</p>
              <div className="flex items-end gap-2">
                <h2 className="text-2xl font-bold text-slate-900">R${totalVtexRevenue.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h2>
                <span className="text-[10px] font-bold text-emerald-600 pb-1">+12.5%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Vs período anterior (R$0,00)</p>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight mb-1">Total de Pedidos (VTEX)</p>
              <div className="flex items-end gap-2">
                <h2 className="text-2xl font-bold text-slate-900">{totalVtexOrders.toLocaleString('pt-BR')}</h2>
                <span className="text-[10px] font-bold text-emerald-600 pb-1">+5.2%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">De {totalSessions.toLocaleString('pt-BR')} sessões (GA4)</p>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight mb-1">Taxa de Conversão Média</p>
              <div className="flex items-end gap-2">
                <h2 className="text-2xl font-bold text-slate-900">{avgConversionRate}%</h2>
                <span className="text-[10px] font-bold text-emerald-600 pb-1">+0.8%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Acima da meta base (2.5%)</p>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm bg-gradient-to-br from-indigo-50 to-white">
              <p className="text-xs font-semibold text-indigo-800 uppercase tracking-tight mb-1">Ticket Médio (VTEX)</p>
              <div className="flex items-end gap-2">
                <h2 className="text-2xl font-bold text-indigo-900">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(avgOrderValue)}
                </h2>
              </div>
            </div>
          </section>

          {/* Main Visual Row */}
          <section className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[400px]">
            {/* Charts */}
            <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
              
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col flex-1 min-h-[250px]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-800 text-sm">Tendência de Tráfego & Conversões</h3>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-[10px] text-slate-500">Sessões</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[10px] text-slate-500">Conversões</span></div>
                  </div>
                </div>
                <div className="flex-1 w-full min-h-[200px]">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="displayDate" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line yAxisId="left" type="monotone" dataKey="sessions" stroke="#3b82f6" strokeWidth={3} dot={chartData.length === 1 ? { r: 4 } : false} activeDot={{ r: 6 }} name="Sessões (GA4)" />
                        <Line yAxisId="right" type="monotone" dataKey="vtexOrders" stroke="#10b981" strokeWidth={3} dot={chartData.length === 1 ? { r: 4 } : false} activeDot={{ r: 6 }} name="Pedidos (VTEX)" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                      {loading ? 'Carregando dados...' : 'Sem dados disponíveis para os filtros selecionados.'}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col flex-1 min-h-[250px]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-800 text-sm">Faturamento & Pedidos (VTEX)</h3>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-indigo-500"></div><span className="text-[10px] text-slate-500">Faturamento</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-emerald-500"></div><span className="text-[10px] text-slate-500">Pedidos</span></div>
                  </div>
                </div>
                <div className="flex-1 w-full min-h-[200px]">
                   {chartData.length > 0 ? (
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={chartData}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                         <XAxis dataKey="displayDate" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                         <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
                         <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val} ped.`} />
                         <Tooltip 
                           contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                           formatter={(value: any, name: any) => {
                             if (name === "Faturamento") return [`R$ ${parseFloat(value).toFixed(2)}`, name];
                             return [value, name];
                           }}
                         />
                         <Bar yAxisId="left" dataKey="vtexRevenue" fill="#6366f1" radius={[4, 4, 0, 0]} name="Faturamento" />
                         <Bar yAxisId="right" dataKey="vtexOrders" fill="#10b981" radius={[4, 4, 0, 0]} name="Pedidos" />
                       </BarChart>
                     </ResponsiveContainer>
                   ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                       {loading ? 'Carregando dados...' : 'Sem dados disponíveis para os filtros selecionados.'}
                     </div>
                   )}
                </div>
              </div>

            </div>

            {/* Funil de Conversão */}
            <div className="bg-slate-900 rounded-xl p-6 text-white flex flex-col">
              <h3 className="font-bold text-sm mb-4 border-b border-slate-700 pb-2">Funil de Conversão (GA4)</h3>
              
              {!funnelData ? (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                  {loading ? 'Carregando funil...' : 'Sem dados de funil'}
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center py-2 w-full">
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
                    
                    return (
                      <div key={idx} className="flex items-center w-full group relative mb-0.5">
                        {/* Label on the left */}
                        <div className="w-24 text-right pr-3 text-[11px] font-medium text-slate-400 leading-tight">
                          {step.label}
                        </div>
                        
                        {/* Funnel Bar Area */}
                        <div className="flex-1 flex justify-center items-center h-10 relative">
                          <div className="absolute w-full h-[1px] bg-slate-800/30 z-0"></div>
                          
                          <div 
                            className={`h-full relative z-10 shadow-sm transition-all duration-500 ${
                              idx === 0 ? 'bg-blue-500' : idx === arr.length - 1 ? 'bg-emerald-500' : 'bg-slate-600'
                            }`} 
                            style={{ 
                              width: `${Math.max(percentageOverall, 1)}%`,
                              minWidth: '4px',
                              borderTopLeftRadius: idx === 0 ? '6px' : '0px',
                              borderTopRightRadius: idx === 0 ? '6px' : '0px',
                              borderBottomLeftRadius: idx === arr.length - 1 ? '6px' : '0px',
                              borderBottomRightRadius: idx === arr.length - 1 ? '6px' : '0px',
                            }}
                          >
                          </div>
                        </div>
                        
                        {/* Values on the right */}
                        <div className="w-24 pl-3 flex flex-col justify-center">
                          <span className="text-xs font-bold text-white leading-tight">{step.value.toLocaleString('pt-BR')}</span>
                          {idx > 0 && <span className="text-[10px] text-slate-500 leading-tight">↓ {stepConversion.toFixed(1)}%</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
          
          {/* Footer Table / Bottom Row */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col shrink-0">
            <div className="px-6 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Pedidos Recentes por Categoria</h3>
              <button className="text-[10px] font-bold text-blue-600 uppercase hover:underline">Ver Relatório</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="text-[10px] text-slate-400 uppercase bg-white">
                  <tr>
                    <th className="px-6 py-2">Categoria</th>
                    <th className="px-6 py-2">Unidades Vendidas</th>
                    <th className="px-6 py-2">Receita VTEX</th>
                    <th className="px-6 py-2">Sessões GA4</th>
                    <th className="px-6 py-2 text-right">Taxa Conv.</th>
                  </tr>
                </thead>
                <tbody className="text-xs text-slate-700 divide-y divide-slate-50">
                  <tr>
                    <td className="px-6 py-3 font-medium">Eletrônicos</td>
                    <td className="px-6 py-3">412</td>
                    <td className="px-6 py-3">R$82.400</td>
                    <td className="px-6 py-3">12.450</td>
                    <td className="px-6 py-3 text-right font-bold text-emerald-600">4.8%</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 font-medium">Moda & Vestuário</td>
                    <td className="px-6 py-3">1.205</td>
                    <td className="px-6 py-3">R$32.150</td>
                    <td className="px-6 py-3">25.800</td>
                    <td className="px-6 py-3 text-right font-bold text-slate-500">2.1%</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 font-medium">Casa & Jardim</td>
                    <td className="px-6 py-3">184</td>
                    <td className="px-6 py-3">R$13.900</td>
                    <td className="px-6 py-3">8.200</td>
                    <td className="px-6 py-3 text-right font-bold text-emerald-600">3.2%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
            </>
          )}

          {/* Sales Tab */}
          {activeTab === 'sales' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 shrink-0 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Buscar pedido ou cliente..." 
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 bg-white"
                    />
                  </div>
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="py-2 px-4 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="All">Todos os Status</option>
                    <option value="invoiced">Faturado (Invoiced)</option>
                    <option value="handling">Em Preparação (Handling)</option>
                    <option value="payment-pending">Pagamento Pendente</option>
                    <option value="canceled">Cancelado</option>
                  </select>
                </div>
                <div className="text-sm text-slate-500 font-medium">
                  {filteredOrders.length} pedidos encontrados
                </div>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left min-w-[800px]">
                  <thead className="text-[11px] text-slate-500 uppercase bg-white sticky top-0 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 font-semibold border-b border-slate-200">ID do Pedido</th>
                      <th className="px-6 py-3 font-semibold border-b border-slate-200">Data</th>
                      <th className="px-6 py-3 font-semibold border-b border-slate-200">Cliente</th>
                      <th className="px-6 py-3 font-semibold border-b border-slate-200">Status</th>
                      <th className="px-6 py-3 font-semibold text-right border-b border-slate-200">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                    {filteredOrders.map((order, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-blue-600">{order.orderId}</td>
                        <td className="px-6 py-4 text-slate-500">{new Date(order.creationDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="px-6 py-4">{order.clientName || 'Cliente Indefinido'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            order.status === 'invoiced' ? 'bg-emerald-100 text-emerald-800' :
                            order.status === 'canceled' ? 'bg-rose-100 text-rose-800' :
                            order.status === 'handling' ? 'bg-blue-100 text-blue-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {order.status === 'payment-pending' ? 'pgto pendente' : order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">R$ {(order.totalValue / 100)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50">
                          Nenhum pedido encontrado com os filtros atuais.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
