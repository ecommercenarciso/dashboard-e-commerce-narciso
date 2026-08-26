import React, { useState, useMemo } from 'react';
import { startOfWeek, startOfMonth, format } from 'date-fns';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, LineChart, Line,
  CartesianAxis, LabelList
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Users, Search, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface TrafficDashboardProps {
  data: any;
  filters: any;
  funnelData?: any;
  finalChartData?: any[];
  loading?: boolean;
  vtexOrders?: number;
  chartInterval?: 'hour' | 'day' | 'week' | 'month';
  ga4Origins?: string[];
  setGa4Origins?: (val: string[]) => void;
  ga4States?: string[];
  setGa4States?: (val: string[]) => void;
  ga4Cities?: string[];
  setGa4Cities?: (val: string[]) => void;
  ga4Os?: string[];
  setGa4Os?: (val: string[]) => void;
  ga4OriginOptions?: string[];
  ga4StateOptions?: string[];
  ga4CityOptions?: string[];
  ga4OsOptions?: string[];
  vtexOrdersList?: any[];
  ga4Products?: any[];
  getDayOfWeekSuffix?: (ddMmStr: string) => string;
  getGA4GroupKey?: (rawDate: string, interval: string, rawHour?: string) => string;
  getGA4GroupDisplay?: (key: string, interval: string) => string;
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

const COLOR_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];

function formatDuration(seconds: number) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const FilterDropdown = ({ title, options, selected, onChange, isOpen, setIsOpen }: any) => {
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded text-[13px] font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors"
      >
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{title}:</span>
        {selected?.length === 0 || selected?.length === options?.length ? 'Todos' : `${selected?.length} selecionados`}
        <span className="text-[10px]">▼</span>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="flex border-b border-slate-100">
            <button className="flex-1 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50" onClick={() => onChange(options)}>Marcar Todos</button>
            <div className="w-px bg-slate-100"></div>
            <button className="flex-1 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50" onClick={() => onChange([])}>Limpar Todos</button>
          </div>
          <div className="max-h-60 overflow-y-auto p-2">
            {(options || []).map((opt: string) => {
              const isChecked = selected?.includes(opt);
              return (
                <label key={opt} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isChecked}
                    onChange={() => {
                      if (isChecked) onChange(selected.filter((s: string) => s !== opt));
                      else onChange([...(selected || []), opt]);
                    }}
                    className="rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-[13px] text-slate-700 truncate">{opt}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default function TrafficDashboard({ 
  data, filters, funnelData, finalChartData, loading, vtexOrders, chartInterval,
  ga4Origins, setGa4Origins, ga4States, setGa4States, ga4Cities, setGa4Cities, ga4Os, setGa4Os,
  ga4OriginOptions, ga4StateOptions, ga4CityOptions, ga4OsOptions, getDayOfWeekSuffix, vtexOrdersList, ga4Products,
  getGA4GroupKey, getGA4GroupDisplay
}: TrafficDashboardProps) {
  const [campaignSearch, setCampaignSearch] = useState('');
  const [granularitySearch, setGranularitySearch] = useState('');
  const [granularityPage, setGranularityPage] = useState(1);
  const [channelSortField, setChannelSortField] = useState('revenue');
  const [channelSortDir, setChannelSortDir] = useState<'asc' | 'desc'>('desc');
  const [campaignSortField, setCampaignSortField] = useState('revenue');
  const [campaignSortDir, setCampaignSortDir] = useState<'asc' | 'desc'>('desc');
  const [trackingSortField, setTrackingSortField] = useState('dateTime');
  const [trackingSortDir, setTrackingSortDir] = useState<'asc' | 'desc'>('desc');
  const [funnelBase, setFunnelBase] = useState<'users' | 'sessions'>('users');
  const [activeFunnelLines, setActiveFunnelLines] = useState<string[]>([]);
  const [isAverageView, setIsAverageView] = useState(false);
  
  const [isOriginOpen, setIsOriginOpen] = useState(false);
  const [isStateOpen, setIsStateOpen] = useState(false);
  const [isCityOpen, setIsCityOpen] = useState(false);
  const [isOsOpen, setIsOsOpen] = useState(false);

  const [conversionVar, setConversionVar] = useState<'origin' | 'city' | 'state' | 'device'>('origin');
  const [conversionSortField, setConversionSortField] = useState<'name' | 'sessions' | 'conversions' | 'rate' | 'revenue'>('conversions');
  const [conversionSortDir, setConversionSortDir] = useState<'asc' | 'desc'>('desc');

  // Daily evolution states
  const [channelsSortField, setChannelsSortField] = useState<'name' | 'soma' | 'pct' | 'avgDaily' | 'orders' | 'rate' | 'revenue'>('soma');
  const [channelsSortDir, setChannelsSortDir] = useState<'asc' | 'desc'>('desc');
  const [geoSortField, setGeoSortField] = useState<'name' | 'soma' | 'pct' | 'avgDaily' | 'orders' | 'rate' | 'revenue'>('soma');
  const [geoSortDir, setGeoSortDir] = useState<'asc' | 'desc'>('desc');
  const [osSortField, setOsSortField] = useState<'name' | 'soma' | 'pct' | 'avgDaily' | 'orders' | 'rate' | 'revenue'>('soma');
  const [osSortDir, setOsSortDir] = useState<'asc' | 'desc'>('desc');

  const [activeChannelsLines, setActiveChannelsLines] = useState<string[]>([]);
  const [activeGeoLines, setActiveGeoLines] = useState<string[]>([]);
  const [activeOsLines, setActiveOsLines] = useState<string[]>([]);

  const handleChannelsSort = (field: typeof channelsSortField) => {
    if (channelsSortField === field) {
      setChannelsSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setChannelsSortField(field);
      setChannelsSortDir('desc');
    }
  };
  const handleGeoSort = (field: typeof geoSortField) => {
    if (geoSortField === field) {
      setGeoSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setGeoSortField(field);
      setGeoSortDir('desc');
    }
  };
  const handleOsSort = (field: typeof osSortField) => {
    if (osSortField === field) {
      setOsSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setOsSortField(field);
      setOsSortDir('desc');
    }
  };

  const handleChannelsLegendClick = (e: any) => {
    const { dataKey } = e;
    if (activeChannelsLines.includes(dataKey)) {
      setActiveChannelsLines(prev => prev.filter(k => k !== dataKey));
    } else {
      setActiveChannelsLines(prev => [...prev, dataKey]);
    }
  };
  const handleGeoLegendClick = (e: any) => {
    const { dataKey } = e;
    if (activeGeoLines.includes(dataKey)) {
      setActiveGeoLines(prev => prev.filter(k => k !== dataKey));
    } else {
      setActiveGeoLines(prev => [...prev, dataKey]);
    }
  };
  const handleOsLegendClick = (e: any) => {
    const { dataKey } = e;
    if (activeOsLines.includes(dataKey)) {
      setActiveOsLines(prev => prev.filter(k => k !== dataKey));
    } else {
      setActiveOsLines(prev => [...prev, dataKey]);
    }
  };


  const handleConversionSort = (field: 'name' | 'sessions' | 'conversions' | 'rate' | 'revenue') => {
    if (conversionSortField === field) {
      setConversionSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setConversionSortField(field);
      setConversionSortDir('desc');
    }
  };

  const completedTransactions = useMemo(() => {
    if (!vtexOrdersList) return [];
    
    const ga4Rows = data?.transactionsData?.rows || [];

    return vtexOrdersList
      .filter(o => o.status !== 'canceled')
      .map((o: any) => {
        const matches = ga4Rows.filter((r: any) => {
          const tid = r.dimensionValues?.[2]?.value || '';
          return tid && (
            o.orderId === tid ||
            o.orderId === `${tid}-01` ||
            tid === o.orderId ||
            tid.startsWith(o.orderId) ||
            o.orderId.startsWith(tid)
          );
        });

        // Pick highest revenue match if Data-Driven Attribution splits credit
        matches.sort((a: any, b: any) => {
          const revA = parseFloat(a.metricValues?.[0]?.value || '0');
          const revB = parseFloat(b.metricValues?.[0]?.value || '0');
          return revB - revA;
        });

        const primaryMatch = matches[0];

        const rawDate = primaryMatch?.dimensionValues?.[0]?.value || '';
        const rawHour = primaryMatch?.dimensionValues?.[1]?.value || '00';
        const firstUserSourceMedium = primaryMatch?.dimensionValues?.[3]?.value || '-';
        const city = primaryMatch?.dimensionValues?.[4]?.value || '-';
        const operatingSystem = primaryMatch?.dimensionValues?.[5]?.value || '-';
        
        let displayDateTime = '';
        if (o.creationDate) {
          try {
            const dateObj = new Date(o.creationDate);
            displayDateTime = dateObj.toLocaleDateString('pt-BR') + ' ' + dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          } catch (e) {
            displayDateTime = 'Data Inválida';
          }
        } else {
          displayDateTime = rawDate ? `${rawDate.substring(6,8)}/${rawDate.substring(4,6)} ${rawHour}:00` : '-';
        }

        const revenue = o.totalValue ? (o.totalValue / 100) : 0;
        const region = o.state || '-';
        const finalCity = o.city || city;

        return {
          dateTime: displayDateTime,
          rawDate: rawDate || (o.creationDate ? o.creationDate.split('T')[0].replace(/-/g, '') : ''),
          orderId: o.orderId,
          firstUserSourceMedium,
          region,
          city: finalCity,
          operatingSystem,
          revenue,
          ga4Revenue: primaryMatch ? parseFloat(primaryMatch.metricValues?.[0]?.value || '0') : 0
        };
      });
  }, [data, vtexOrdersList]);

  const sortedTransactions = useMemo(() => {
    return [...completedTransactions].sort((a: any, b: any) => {
      let valA = a[trackingSortField];
      let valB = b[trackingSortField];
      if (typeof valA === 'string' && typeof valB === 'string') {
        return trackingSortDir === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }
      return trackingSortDir === 'asc' 
        ? (valA as number) - (valB as number) 
        : (valB as number) - (valA as number);
    });
  }, [completedTransactions, trackingSortField, trackingSortDir]);

  const daysCount = useMemo(() => {
    if (!filters?.startDate || !filters?.endDate) return 1;
    return Math.max(Math.round(Math.abs(new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1, 1);
  }, [filters]);

  const top5ChannelsList = useMemo(() => {
    if (!data?.channelsData?.rows) return [];
    const totalMap: Record<string, number> = {};
    data.channelsData.rows.forEach((r: any) => {
      const name = r.dimensionValues?.[1]?.value || '(not set)';
      const val = parseInt(r.metricValues?.[funnelBase === 'users' ? 1 : 0]?.value || '0');
      totalMap[name] = (totalMap[name] || 0) + val;
    });
    return Object.entries(totalMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
  }, [data, funnelBase]);

  const top5GeoList = useMemo(() => {
    if (!data?.geoData?.rows) return [];
    const totalMap: Record<string, number> = {};
    data.geoData.rows.forEach((r: any) => {
      const name = r.dimensionValues?.[1]?.value || '(não setado)';
      const val = parseInt(r.metricValues?.[funnelBase === 'users' ? 1 : 0]?.value || '0');
      totalMap[name] = (totalMap[name] || 0) + val;
    });
    return Object.entries(totalMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
  }, [data, funnelBase]);

  const top5OsList = useMemo(() => {
    if (!data?.deviceData?.rows) return [];
    const totalMap: Record<string, number> = {};
    data.deviceData.rows.forEach((r: any) => {
      const name = r.dimensionValues?.[1]?.value || '(not set)';
      const val = parseInt(r.metricValues?.[funnelBase === 'users' ? 1 : 0]?.value || '0');
      totalMap[name] = (totalMap[name] || 0) + val;
    });
    return Object.entries(totalMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
  }, [data, funnelBase]);

  const channelsChartData = useMemo(() => {
    if (!data?.channelsData?.rows || !getGA4GroupKey || !getGA4GroupDisplay) return [];
    const dateMap: Record<string, Record<string, number>> = {};
    data.channelsData.rows.forEach((r: any) => {
      const rawDate = r.dimensionValues?.[0]?.value || '';
      const name = r.dimensionValues?.[1]?.value || '(not set)';
      const rawHour = r.dimensionValues?.[2]?.value || '00';
      const val = parseInt(r.metricValues?.[funnelBase === 'users' ? 1 : 0]?.value || '0');
      if (!rawDate) return;
      
      const key = getGA4GroupKey(rawDate, chartInterval || 'day', rawHour);
      if (!dateMap[key]) {
        dateMap[key] = {};
        top5ChannelsList.forEach(ch => {
          dateMap[key][ch] = 0;
        });
      }
      if (top5ChannelsList.includes(name)) {
        dateMap[key][name] = (dateMap[key][name] || 0) + val;
      }
    });

    const sortedKeys = Object.keys(dateMap).sort((a, b) => {
      const [d1, h1] = a.split('_');
      const [d2, h2] = b.split('_');
      if (d1 !== d2) return d1.localeCompare(d2);
      if (h1 && h2) return parseInt(h1, 10) - parseInt(h2, 10);
      return a.localeCompare(b);
    });
    return sortedKeys.map(key => ({
      date: getGA4GroupDisplay(key, chartInterval || 'day'),
      ...dateMap[key]
    }));
  }, [data, funnelBase, top5ChannelsList, chartInterval, getGA4GroupKey, getGA4GroupDisplay]);

  const geoChartData = useMemo(() => {
    if (!data?.geoData?.rows || !getGA4GroupKey || !getGA4GroupDisplay) return [];
    const dateMap: Record<string, Record<string, number>> = {};
    data.geoData.rows.forEach((r: any) => {
      const rawDate = r.dimensionValues?.[0]?.value || '';
      const name = r.dimensionValues?.[1]?.value || '(não setado)';
      const rawHour = r.dimensionValues?.[3]?.value || '00';
      const val = parseInt(r.metricValues?.[funnelBase === 'users' ? 1 : 0]?.value || '0');
      if (!rawDate) return;
      
      const key = getGA4GroupKey(rawDate, chartInterval || 'day', rawHour);
      if (!dateMap[key]) {
        dateMap[key] = {};
        top5GeoList.forEach(g => {
          dateMap[key][g] = 0;
        });
      }
      if (top5GeoList.includes(name)) {
        dateMap[key][name] = (dateMap[key][name] || 0) + val;
      }
    });

    const sortedKeys = Object.keys(dateMap).sort((a, b) => {
      const [d1, h1] = a.split('_');
      const [d2, h2] = b.split('_');
      if (d1 !== d2) return d1.localeCompare(d2);
      if (h1 && h2) return parseInt(h1, 10) - parseInt(h2, 10);
      return a.localeCompare(b);
    });
    return sortedKeys.map(key => ({
      date: getGA4GroupDisplay(key, chartInterval || 'day'),
      ...dateMap[key]
    }));
  }, [data, funnelBase, top5GeoList, chartInterval, getGA4GroupKey, getGA4GroupDisplay]);

  const osChartData = useMemo(() => {
    if (!data?.deviceData?.rows || !getGA4GroupKey || !getGA4GroupDisplay) return [];
    const dateMap: Record<string, Record<string, number>> = {};
    data.deviceData.rows.forEach((r: any) => {
      const rawDate = r.dimensionValues?.[0]?.value || '';
      const name = r.dimensionValues?.[1]?.value || '(not set)';
      const rawHour = r.dimensionValues?.[2]?.value || '00';
      const val = parseInt(r.metricValues?.[funnelBase === 'users' ? 1 : 0]?.value || '0');
      if (!rawDate) return;
      
      const key = getGA4GroupKey(rawDate, chartInterval || 'day', rawHour);
      if (!dateMap[key]) {
        dateMap[key] = {};
        top5OsList.forEach(o => {
          dateMap[key][o] = 0;
        });
      }
      if (top5OsList.includes(name)) {
        dateMap[key][name] = (dateMap[key][name] || 0) + val;
      }
    });

    const sortedKeys = Object.keys(dateMap).sort((a, b) => {
      const [d1, h1] = a.split('_');
      const [d2, h2] = b.split('_');
      if (d1 !== d2) return d1.localeCompare(d2);
      if (h1 && h2) return parseInt(h1, 10) - parseInt(h2, 10);
      return a.localeCompare(b);
    });
    return sortedKeys.map(key => ({
      date: getGA4GroupDisplay(key, chartInterval || 'day'),
      ...dateMap[key]
    }));
  }, [data, funnelBase, top5OsList, chartInterval, getGA4GroupKey, getGA4GroupDisplay]);

  const execChannelsList = useMemo(() => {
    if (!data?.channelsData?.rows) return [];
    
    const txByChannel: Record<string, { orders: number, revenue: number }> = {};
    completedTransactions.forEach(tx => {
      const ch = tx.firstUserSourceMedium || '-';
      if (!txByChannel[ch]) txByChannel[ch] = { orders: 0, revenue: 0 };
      txByChannel[ch].orders += 1;
      txByChannel[ch].revenue += tx.revenue || 0;
    });

    const map: Record<string, { name: string, visitors: number, sessions: number }> = {};
    let totalVis = 0;
    let totalSess = 0;
    data.channelsData.rows.forEach((r: any) => {
      const name = r.dimensionValues?.[1]?.value || '(not set)';
      const sess = parseInt(r.metricValues?.[0]?.value || '0');
      const vis = parseInt(r.metricValues?.[1]?.value || '0');
      if (!map[name]) {
        map[name] = { name, visitors: 0, sessions: 0 };
      }
      map[name].visitors += vis;
      map[name].sessions += sess;
      totalVis += vis;
      totalSess += sess;
    });
    const list = Object.values(map).map(item => {
      const tx = txByChannel[item.name] || { orders: 0, revenue: 0 };
      const rate = item.sessions > 0 ? (tx.orders / item.sessions) * 100 : 0;
      return {
        ...item,
        soma: funnelBase === 'users' ? item.visitors : item.sessions,
        pct: funnelBase === 'users' 
          ? (totalVis > 0 ? (item.visitors / totalVis) * 100 : 0)
          : (totalSess > 0 ? (item.sessions / totalSess) * 100 : 0),
        avgDaily: funnelBase === 'users'
          ? (item.visitors / daysCount)
          : (item.sessions / daysCount),
        orders: tx.orders,
        rate,
        revenue: tx.revenue
      };
    });
    return list.sort((a, b) => {
      let valA = a[channelsSortField];
      let valB = b[channelsSortField];
      if (typeof valA === 'string') {
        return channelsSortDir === 'asc' 
          ? valA.localeCompare(valB as string) 
          : (valB as string).localeCompare(valA);
      }
      return channelsSortDir === 'asc' 
        ? (valA as number) - (valB as number) 
        : (valB as number) - (valA as number);
    });
  }, [data, funnelBase, daysCount, channelsSortField, channelsSortDir, completedTransactions]);

  const execGeoList = useMemo(() => {
    if (!data?.geoData?.rows) return [];
    
    const txByCity: Record<string, { orders: number, revenue: number }> = {};
    completedTransactions.forEach(tx => {
      const city = tx.city || '-';
      if (!txByCity[city]) txByCity[city] = { orders: 0, revenue: 0 };
      txByCity[city].orders += 1;
      txByCity[city].revenue += tx.revenue || 0;
    });

    const map: Record<string, { name: string, visitors: number, sessions: number }> = {};
    let totalVis = 0;
    let totalSess = 0;
    data.geoData.rows.forEach((r: any) => {
      const name = r.dimensionValues?.[1]?.value || '(não setado)';
      const sess = parseInt(r.metricValues?.[0]?.value || '0');
      const vis = parseInt(r.metricValues?.[1]?.value || '0');
      if (!map[name]) {
        map[name] = { name, visitors: 0, sessions: 0 };
      }
      map[name].visitors += vis;
      map[name].sessions += sess;
      totalVis += vis;
      totalSess += sess;
    });
    const list = Object.values(map).map(item => {
      const tx = txByCity[item.name] || { orders: 0, revenue: 0 };
      const rate = item.sessions > 0 ? (tx.orders / item.sessions) * 100 : 0;
      return {
        ...item,
        soma: funnelBase === 'users' ? item.visitors : item.sessions,
        pct: funnelBase === 'users'
          ? (totalVis > 0 ? (item.visitors / totalVis) * 100 : 0)
          : (totalSess > 0 ? (item.sessions / totalSess) * 100 : 0),
        avgDaily: funnelBase === 'users'
          ? (item.visitors / daysCount)
          : (item.sessions / daysCount),
        orders: tx.orders,
        rate,
        revenue: tx.revenue
      };
    });
    return list.sort((a, b) => {
      let valA = a[geoSortField];
      let valB = b[geoSortField];
      if (typeof valA === 'string') {
        return geoSortDir === 'asc' 
          ? valA.localeCompare(valB as string) 
          : (valB as string).localeCompare(valA);
      }
      return geoSortDir === 'asc' 
        ? (valA as number) - (valB as number) 
        : (valB as number) - (valA as number);
    });
  }, [data, funnelBase, daysCount, geoSortField, geoSortDir, completedTransactions]);

  const execOsList = useMemo(() => {
    if (!data?.deviceData?.rows) return [];
    
    const txByOs: Record<string, { orders: number, revenue: number }> = {};
    completedTransactions.forEach(tx => {
      const os = tx.operatingSystem || '-';
      if (!txByOs[os]) txByOs[os] = { orders: 0, revenue: 0 };
      txByOs[os].orders += 1;
      txByOs[os].revenue += tx.revenue || 0;
    });

    const map: Record<string, { name: string, visitors: number, sessions: number }> = {};
    let totalVis = 0;
    let totalSess = 0;
    data.deviceData.rows.forEach((r: any) => {
      const name = r.dimensionValues?.[1]?.value || '(not set)';
      const sess = parseInt(r.metricValues?.[0]?.value || '0');
      const vis = parseInt(r.metricValues?.[1]?.value || '0');
      if (!map[name]) {
        map[name] = { name, visitors: 0, sessions: 0 };
      }
      map[name].visitors += vis;
      map[name].sessions += sess;
      totalVis += vis;
      totalSess += sess;
    });
    const list = Object.values(map).map(item => {
      const tx = txByOs[item.name] || { orders: 0, revenue: 0 };
      const rate = item.sessions > 0 ? (tx.orders / item.sessions) * 100 : 0;
      return {
        ...item,
        soma: funnelBase === 'users' ? item.visitors : item.sessions,
        pct: funnelBase === 'users'
          ? (totalVis > 0 ? (item.visitors / totalVis) * 100 : 0)
          : (totalSess > 0 ? (item.sessions / totalSess) * 100 : 0),
        avgDaily: funnelBase === 'users'
          ? (item.visitors / daysCount)
          : (item.sessions / daysCount),
        orders: tx.orders,
        rate,
        revenue: tx.revenue
      };
    });
    return list.sort((a, b) => {
      let valA = a[osSortField];
      let valB = b[osSortField];
      if (typeof valA === 'string') {
        return osSortDir === 'asc' 
          ? valA.localeCompare(valB as string) 
          : (valB as string).localeCompare(valA);
      }
      return osSortDir === 'asc' 
        ? (valA as number) - (valB as number) 
        : (valB as number) - (valA as number);
    });
  }, [data, funnelBase, daysCount, osSortField, osSortDir, completedTransactions]);

  const conversionStats = useMemo(() => {
    const tableDataMap: Record<string, { name: string, conversions: number, revenue: number }> = {};
    const chartDataMap: Record<string, Record<string, number>> = {};

    completedTransactions.forEach((tx: any) => {
      let name = '(não setado)';
      if (conversionVar === 'origin') name = tx.firstUserSourceMedium;
      else if (conversionVar === 'city') name = tx.city;
      else if (conversionVar === 'state') name = tx.region;
      else if (conversionVar === 'device') name = tx.operatingSystem;

      if (!tableDataMap[name]) {
        tableDataMap[name] = { name, conversions: 0, revenue: 0 };
      }
      tableDataMap[name].conversions += 1;
      tableDataMap[name].revenue += tx.revenue;

      const rawDate = tx.rawDate || '';
      if (!chartDataMap[rawDate]) {
        chartDataMap[rawDate] = {};
      }
      chartDataMap[rawDate][name] = (chartDataMap[rawDate][name] || 0) + 1;
    });

    const sessionsMap: Record<string, number> = {};
    const normalizeKey = (str: string): string => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    };

    if (conversionVar === 'origin' && data?.channelsData?.rows) {
      data.channelsData.rows.forEach((r: any) => {
        const name = r.dimensionValues?.[1]?.value || '(not set)';
        const sess = parseInt(r.metricValues?.[0]?.value || '0', 10);
        const key = normalizeKey(name);
        sessionsMap[key] = (sessionsMap[key] || 0) + sess;
      });
    } else if (conversionVar === 'city' && data?.geoData?.rows) {
      data.geoData.rows.forEach((r: any) => {
        const name = r.dimensionValues?.[1]?.value || '(não setado)';
        const sess = parseInt(r.metricValues?.[0]?.value || '0', 10);
        const key = normalizeKey(name);
        sessionsMap[key] = (sessionsMap[key] || 0) + sess;
      });
    } else if (conversionVar === 'state' && data?.geoData?.rows) {
      const normalizeRegion = (name: string): string => {
        let clean = name.replace(/^State of\s+/i, '').trim();
        if (clean.toLowerCase() === 'federal district') return 'DF';
        clean = clean
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        
        const stateMapNormalized: Record<string, string> = {
          'acre': 'AC', 'alagoas': 'AL', 'amapa': 'AP', 'amazonas': 'AM',
          'bahia': 'BA', 'ceara': 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES',
          'goias': 'GO', 'maranhao': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
          'minas gerais': 'MG', 'para': 'PA', 'paraiba': 'PB', 'parana': 'PR',
          'pernambuco': 'PE', 'piaui': 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
          'rio grande do sul': 'RS', 'rondonia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC',
          'sao paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO'
        };
        return stateMapNormalized[clean] || name;
      };
      data.geoData.rows.forEach((r: any) => {
        const regionName = r.dimensionValues?.[2]?.value || '';
        const stateAbbr = normalizeRegion(regionName);
        const sess = parseInt(r.metricValues?.[0]?.value || '0', 10);
        const key = normalizeKey(stateAbbr);
        sessionsMap[key] = (sessionsMap[key] || 0) + sess;
      });
    } else if (conversionVar === 'device' && data?.deviceData?.rows) {
      data.deviceData.rows.forEach((r: any) => {
        const name = r.dimensionValues?.[1]?.value || '(not set)';
        const sess = parseInt(r.metricValues?.[0]?.value || '0', 10);
        const key = normalizeKey(name);
        sessionsMap[key] = (sessionsMap[key] || 0) + sess;
      });
    }

    const tableList = Object.values(tableDataMap).map(item => {
      const sess = sessionsMap[normalizeKey(item.name)] || 0;
      const rate = sess > 0 ? (item.conversions / sess) * 100 : 0;
      return {
        ...item,
        sessions: sess,
        rate
      };
    }).sort((a, b) => {
      let valA = a[conversionSortField];
      let valB = b[conversionSortField];
      if (typeof valA === 'string' && typeof valB === 'string') {
        return conversionSortDir === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }
      return conversionSortDir === 'asc' 
        ? (valA as number) - (valB as number) 
        : (valB as number) - (valA as number);
    });

    const topKeys = [...tableList]
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 5)
      .map(item => item.name);

    const chartList = Object.entries(chartDataMap)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([rawDate, values]) => {
        const formattedDate = rawDate.length === 8 ? `${rawDate.substring(6,8)}/${rawDate.substring(4,6)}` : 'Outro';
        const row: Record<string, any> = { date: formattedDate };
        topKeys.forEach(k => {
          row[k] = values[k] || 0;
        });
        return row;
      });

    return {
      tableList,
      chartList,
      topKeys
    };
  }, [completedTransactions, conversionVar, data, conversionSortField, conversionSortDir]);
  
  const handleFunnelLegendClick = (e: any) => {
    const dataKey = e.dataKey;
    if (!dataKey) return;
    setActiveFunnelLines(prev => prev.includes(dataKey) ? prev.filter(k => k !== dataKey) : [...prev, dataKey]);
  };
  const itemsPerPage = 10;

  const totalDays = React.useMemo(() => {
    if (!filters?.startDate || !filters?.endDate) return 1;
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // 0 diff = 1 day
  }, [filters]);

  const averagedChartData = React.useMemo(() => {
    if (!finalChartData) return [];
    if (!isAverageView) return finalChartData;
    
    return finalChartData.map(item => {
      let divisor = 1;
      if (chartInterval === 'week') divisor = 7;
      else if (chartInterval === 'month') {
        const d = item.rawDate ? new Date(item.rawDate) : new Date();
        divisor = !isNaN(d.getTime()) ? new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() : 30;
      }
      
      return {
        ...item,
        visitors: item.visitors ? Math.round(item.visitors / divisor) : 0,
        visitorsSessions: item.visitorsSessions ? Math.round(item.visitorsSessions / divisor) : 0,
        viewItem: item.viewItem ? Math.round(item.viewItem / divisor) : 0,
        viewItemSessions: item.viewItemSessions ? Math.round(item.viewItemSessions / divisor) : 0,
        cart: item.cart ? Math.round(item.cart / divisor) : 0,
        cartSessions: item.cartSessions ? Math.round(item.cartSessions / divisor) : 0,
        checkout: item.checkout ? Math.round(item.checkout / divisor) : 0,
        checkoutSessions: item.checkoutSessions ? Math.round(item.checkoutSessions / divisor) : 0,
        vtexOrders: item.vtexOrders ? Math.round(item.vtexOrders / divisor) : 0,
      };
    });
  }, [finalChartData, isAverageView, chartInterval]);

  const [conversionMode, setConversionMode] = useState<'total' | 'step'>('total');
  const [activeConvLines, setActiveConvLines] = useState<string[]>([]);
  const handleConvLegendClick = (e: any) => {
    const dataKey = e.dataKey;
    if (!dataKey) return;
    setActiveConvLines(prev => prev.includes(dataKey) ? prev.filter(k => k !== dataKey) : [...prev, dataKey]);
  };

  const conversionChartData = useMemo(() => {
    if (!averagedChartData || averagedChartData.length === 0) return [];
    return averagedChartData.map(row => {
      const baseVal = funnelBase === 'users' ? (row.visitors || 0) : (row.visitorsSessions || 0);
      const viewItemVal = funnelBase === 'users' ? (row.viewItem || 0) : (row.viewItemSessions || 0);
      const cartVal = funnelBase === 'users' ? (row.cart || 0) : (row.cartSessions || 0);
      const checkoutVal = funnelBase === 'users' ? (row.checkout || 0) : (row.checkoutSessions || 0);
      const ordersVal = row.vtexOrders || 0;

      if (conversionMode === 'total') {
        return {
          date: row.displayDate,
          viewItem: baseVal > 0 ? (viewItemVal / baseVal) * 100 : 0,
          cart: baseVal > 0 ? (cartVal / baseVal) * 100 : 0,
          checkout: baseVal > 0 ? (checkoutVal / baseVal) * 100 : 0,
          purchase: baseVal > 0 ? (ordersVal / baseVal) * 100 : 0
        };
      } else {
        return {
          date: row.displayDate,
          viewItem: baseVal > 0 ? (viewItemVal / baseVal) * 100 : 0,
          cart: viewItemVal > 0 ? (cartVal / viewItemVal) * 100 : 0,
          checkout: cartVal > 0 ? (checkoutVal / cartVal) * 100 : 0,
          purchase: checkoutVal > 0 ? (ordersVal / checkoutVal) * 100 : 0
        };
      }
    });
  }, [averagedChartData, funnelBase, conversionMode]);

  const dayOfWeekStats = useMemo(() => {
    if (!finalChartData || finalChartData.length === 0) return [];
    
    const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const daysOfWeekFull = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    
    const visitsByDay: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    const ordersByDay: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;

    finalChartData.forEach(row => {
      const dateStr = row.displayDate ? row.displayDate.split(' ')[0] : '';
      if (dateStr === todayStr) return; // Skip today's incomplete data
      
      const suffix = getDayOfWeekSuffix ? getDayOfWeekSuffix(dateStr) : '';
      if (!suffix) return;
      
      const dayIdx = daysOfWeekFull.indexOf(suffix);
      if (dayIdx === -1) return;
      
      const visits = funnelBase === 'users' ? (row.visitors || 0) : (row.visitorsSessions || 0);
      const orders = row.vtexOrders || 0;
      
      visitsByDay[dayIdx].push(visits);
      ordersByDay[dayIdx].push(orders);
    });
    
    return daysOfWeek.map((dayName, idx) => {
      const visitsList = visitsByDay[idx];
      const ordersList = ordersByDay[idx];
      
      const totalVisits = visitsList.reduce((a, b) => a + b, 0);
      const totalOrders = ordersList.reduce((a, b) => a + b, 0);
      
      const minVisits = visitsList.length > 0 ? Math.min(...visitsList) : 0;
      const maxVisits = visitsList.length > 0 ? Math.max(...visitsList) : 0;
      
      const avgVisits = visitsList.length > 0 ? totalVisits / visitsList.length : 0;
      const avgOrders = ordersList.length > 0 ? totalOrders / ordersList.length : 0;
      
      const avgConvRate = avgVisits > 0 ? (avgOrders / avgVisits) * 100 : 0;
      
      return {
        dayName,
        totalVisits,
        minVisits,
        maxVisits,
        avgVisits,
        avgOrders,
        avgConvRate
      };
    });
  }, [finalChartData, funnelBase, getDayOfWeekSuffix]);

  const conversionTableData = useMemo(() => {
    if (!finalChartData || finalChartData.length === 0) return [];
    
    let totalBase = 0;
    let totalViewItem = 0;
    let totalCart = 0;
    let totalCheckout = 0;
    let totalOrders = 0;

    finalChartData.forEach(row => {
      totalBase += funnelBase === 'users' ? (row.visitors || 0) : (row.visitorsSessions || 0);
      totalViewItem += funnelBase === 'users' ? (row.viewItem || 0) : (row.viewItemSessions || 0);
      totalCart += funnelBase === 'users' ? (row.cart || 0) : (row.cartSessions || 0);
      totalCheckout += funnelBase === 'users' ? (row.checkout || 0) : (row.checkoutSessions || 0);
      totalOrders += row.vtexOrders || 0;
    });

    let viewItemGeral = 0;
    let cartGeral = 0;
    let checkoutGeral = 0;
    let purchaseGeral = 0;

    if (conversionMode === 'total') {
      viewItemGeral = totalBase > 0 ? (totalViewItem / totalBase) * 100 : 0;
      cartGeral = totalBase > 0 ? (totalCart / totalBase) * 100 : 0;
      checkoutGeral = totalBase > 0 ? (totalCheckout / totalBase) * 100 : 0;
      purchaseGeral = totalBase > 0 ? (totalOrders / totalBase) * 100 : 0;
    } else {
      viewItemGeral = totalBase > 0 ? (totalViewItem / totalBase) * 100 : 0;
      cartGeral = totalViewItem > 0 ? (totalCart / totalViewItem) * 100 : 0;
      checkoutGeral = totalCart > 0 ? (totalCheckout / totalCart) * 100 : 0;
      purchaseGeral = totalCheckout > 0 ? (totalOrders / totalCheckout) * 100 : 0;
    }

    let sumViewItemDaily = 0;
    let sumCartDaily = 0;
    let sumCheckoutDaily = 0;
    let sumPurchaseDaily = 0;
    let validDaysCount = 0;

    conversionChartData.forEach(day => {
      sumViewItemDaily += day.viewItem || 0;
      sumCartDaily += day.cart || 0;
      sumCheckoutDaily += day.checkout || 0;
      sumPurchaseDaily += day.purchase || 0;
      validDaysCount++;
    });

    const viewItemMedia = validDaysCount > 0 ? sumViewItemDaily / validDaysCount : 0;
    const cartMedia = validDaysCount > 0 ? sumCartDaily / validDaysCount : 0;
    const checkoutMedia = validDaysCount > 0 ? sumCheckoutDaily / validDaysCount : 0;
    const purchaseMedia = validDaysCount > 0 ? sumPurchaseDaily / validDaysCount : 0;

    return [
      { name: '1. Viu Produto', geral: viewItemGeral, media: viewItemMedia, color: '#8B5CF6' },
      { name: '2. Carrinho', geral: cartGeral, media: cartMedia, color: '#F59E0B' },
      { name: '3. Checkout', geral: checkoutGeral, media: checkoutMedia, color: '#06B6D4' },
      { name: '4. Compras VTEX', geral: purchaseGeral, media: purchaseMedia, color: '#10B981' }
    ];
  }, [finalChartData, funnelBase, conversionMode, conversionChartData]);

  const handleChannelSort = (field: string) => {
    if (channelSortField === field) setChannelSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setChannelSortField(field); setChannelSortDir('desc'); }
  };

  const handleCampaignSort = (field: string) => {
    if (campaignSortField === field) setCampaignSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setCampaignSortField(field); setCampaignSortDir('desc'); }
  };

  const handleTrackingSort = (field: string) => {
    if (trackingSortField === field) setTrackingSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setTrackingSortField(field); setTrackingSortDir('desc'); }
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

  const list = Object.values(agg).map((c: any) => {
    c.engRate = c.count > 0 ? (c.engRateSum / c.count) * 100 : 0;
    c.avgTime = c.count > 0 ? (c.engTimeSum / c.count) : 0;
    c.convRate = c.sessions > 0 ? (c.conversions / c.sessions) * 100 : 0;
    if (c.sessions > maxSessions) maxSessions = c.sessions;
    return c;
  });
  
  const channelAgg = { list, maxSessions };


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
      {/* FILTROS AVANÇADOS DE TRÁFEGO */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterDropdown title="Origem / Mídia" options={ga4OriginOptions} selected={ga4Origins} onChange={setGa4Origins} isOpen={isOriginOpen} setIsOpen={setIsOriginOpen} />
        <FilterDropdown title="Estado" options={ga4StateOptions} selected={ga4States} onChange={setGa4States} isOpen={isStateOpen} setIsOpen={setIsStateOpen} />
        <FilterDropdown title="Cidade" options={ga4CityOptions} selected={ga4Cities} onChange={setGa4Cities} isOpen={isCityOpen} setIsOpen={setIsCityOpen} />
        <FilterDropdown title="Sistema" options={ga4OsOptions} selected={ga4Os} onChange={setGa4Os} isOpen={isOsOpen} setIsOpen={setIsOsOpen} />
      </div>

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

      {/* CAMADA 1.5: Mini Evoluções */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[180px]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Usuários Únicos</span>
            <span className="text-sm font-bold text-slate-800">{(totalUsers || 0).toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex-1 w-full min-h-0 mt-2">
            {finalChartData && finalChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={finalChartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="displayDate" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <Line type="linear" dataKey="visitors" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <RechartsTooltip contentStyle={{ fontSize: '12px' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[180px]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Sessões</span>
            <span className="text-sm font-bold text-slate-800">{(sessions || 0).toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex-1 w-full min-h-0 mt-2">
            {finalChartData && finalChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={finalChartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="displayDate" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <Line type="linear" dataKey="sessions" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <RechartsTooltip contentStyle={{ fontSize: '12px' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[180px]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Páginas Visitadas</span>
            <span className="text-sm font-bold text-slate-800">{(pageViews || 0).toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex-1 w-full min-h-0 mt-2">
            {finalChartData && finalChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={finalChartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="displayDate" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <Line type="linear" dataKey="pageViews" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <RechartsTooltip contentStyle={{ fontSize: '12px' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>
      </div>

      {/* CAMADA 2: Funil GA4 */}
      <div className="w-full flex justify-between items-end mb-2">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Funil de Conversão do E-commerce</h2>
        <div className="flex gap-2">
          <div className="flex bg-slate-100 p-1 rounded-md shrink-0">
            <button 
              onClick={() => setIsAverageView(false)}
              className={`px-2 py-1 text-[11px] sm:text-xs whitespace-nowrap font-semibold rounded-sm transition-all ${!isAverageView ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Totais Absolutos
            </button>
            <button 
              onClick={() => setIsAverageView(true)}
              className={`px-2 py-1 text-[11px] sm:text-xs whitespace-nowrap font-semibold rounded-sm transition-all flex items-center gap-1 ${isAverageView ? 'bg-indigo-50 shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Média Diária
            </button>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-md shrink-0">
            <button 
              onClick={() => setFunnelBase('users')}
              className={`px-2 py-1 text-[11px] sm:text-xs whitespace-nowrap font-semibold rounded-sm transition-all ${funnelBase === 'users' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Visitantes Únicos
            </button>
            <button 
              onClick={() => setFunnelBase('sessions')}
              className={`px-2 py-1 text-[11px] sm:text-xs whitespace-nowrap font-semibold rounded-sm transition-all ${funnelBase === 'sessions' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sessões
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full mb-2">
        {/* Tendência do Funil - Linhas */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[440px]">
          <h3 className="text-[14px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Tendência de Evolução</h3>
          <div className="flex-1 w-full min-h-0">
            {finalChartData && finalChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={averagedChartData} margin={{ top: 15, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="displayDate" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                    labelFormatter={(label) => {
                      const dow = getDayOfWeekSuffix ? getDayOfWeekSuffix(label) : '';
                      return dow ? `${label} (${dow})` : label;
                    }}
                  />
                  <Legend verticalAlign="top" height={30} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '9px', fontWeight: 'semibold', paddingBottom: '10px', cursor: 'pointer' }} onClick={handleFunnelLegendClick} />
                  <Line type="linear" dataKey={funnelBase === 'users' ? 'visitors' : 'visitorsSessions'} stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name={funnelBase === 'users' ? "1. Visitantes Únicos" : "1. Sessões Iniciais"} strokeOpacity={activeFunnelLines.length === 0 || activeFunnelLines.includes(funnelBase === 'users' ? 'visitors' : 'visitorsSessions') ? 1 : 0.2} onClick={(e) => e && handleFunnelLegendClick({ dataKey: funnelBase === 'users' ? 'visitors' : 'visitorsSessions' })} />
                  <Line type="linear" dataKey={funnelBase === 'users' ? 'viewItem' : 'viewItemSessions'} stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="2. Viu Produto" strokeOpacity={activeFunnelLines.length === 0 || activeFunnelLines.includes(funnelBase === 'users' ? 'viewItem' : 'viewItemSessions') ? 1 : 0.2} onClick={(e) => e && handleFunnelLegendClick({ dataKey: funnelBase === 'users' ? 'viewItem' : 'viewItemSessions' })} />
                  <Line type="linear" dataKey={funnelBase === 'users' ? 'cart' : 'cartSessions'} stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="3. Carrinho" strokeOpacity={activeFunnelLines.length === 0 || activeFunnelLines.includes(funnelBase === 'users' ? 'cart' : 'cartSessions') ? 1 : 0.2} onClick={(e) => e && handleFunnelLegendClick({ dataKey: funnelBase === 'users' ? 'cart' : 'cartSessions' })} />
                  <Line type="linear" dataKey={funnelBase === 'users' ? 'checkout' : 'checkoutSessions'} stroke="#06B6D4" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="4. Checkout" strokeOpacity={activeFunnelLines.length === 0 || activeFunnelLines.includes(funnelBase === 'users' ? 'checkout' : 'checkoutSessions') ? 1 : 0.2} onClick={(e) => e && handleFunnelLegendClick({ dataKey: funnelBase === 'users' ? 'checkout' : 'checkoutSessions' })} />
                  <Line type="linear" dataKey="vtexOrders" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="5. Compras VTEX" strokeOpacity={activeFunnelLines.length === 0 || activeFunnelLines.includes('vtexOrders') ? 1 : 0.2} onClick={(e) => e && handleFunnelLegendClick({ dataKey: 'vtexOrders' })} />
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
                const divisor = isAverageView ? totalDays : 1;
                const safeMax = (step.max || 0) / divisor;
                const safeValue = (step.value || 0) / divisor;
                const percentageOverall = safeMax > 0 ? (safeValue / safeMax) * 100 : 0;
                const prevValue = idx === 0 ? safeMax : ((arr[idx - 1].value || 0) / divisor);
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
                          <span className="text-sm font-bold text-slate-800 leading-none mb-1">
                            {Math.round(safeValue).toLocaleString('pt-BR')}
                            {isAverageView && <span className="text-[10px] text-slate-400 ml-1 font-normal">/dia</span>}
                          </span>
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

      {/* CAMADA 2.5: Taxas de Conversão do Funil */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full mb-4">
        {/* Gráfico - Taxas de Conversão */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[14px] font-semibold text-slate-500 uppercase tracking-wider">Taxas de Conversão do Funil (Evolução)</h3>
            <div className="flex bg-slate-100 p-0.5 rounded-md text-[11px] font-bold border border-slate-200">
              <button
                onClick={() => setConversionMode('total')}
                className={`px-3 py-1 rounded-[4px] transition-all ${conversionMode === 'total' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Base: Total
              </button>
              <button
                onClick={() => setConversionMode('step')}
                className={`px-3 py-1 rounded-[4px] transition-all ${conversionMode === 'step' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Base: Etapa Anterior
              </button>
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            {conversionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={conversionChartData} margin={{ top: 15, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelFormatter={(label) => {
                      const dow = getDayOfWeekSuffix ? getDayOfWeekSuffix(label) : '';
                      return dow ? `${label} (${dow})` : label;
                    }}
                    formatter={(value: any, name: string) => [`${parseFloat(value).toFixed(2)}%`, name]}
                  />
                  <Legend verticalAlign="top" height={30} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '9px', fontWeight: 'semibold', paddingBottom: '10px', cursor: 'pointer' }} onClick={handleConvLegendClick} />
                  <Line type="linear" dataKey="viewItem" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name="1. Viu Produto" strokeOpacity={activeConvLines.length === 0 || activeConvLines.includes('viewItem') ? 1 : 0.2} onClick={(e) => e && handleConvLegendClick({ dataKey: 'viewItem' })} />
                  <Line type="linear" dataKey="cart" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name="2. Carrinho" strokeOpacity={activeConvLines.length === 0 || activeConvLines.includes('cart') ? 1 : 0.2} onClick={(e) => e && handleConvLegendClick({ dataKey: 'cart' })} />
                  <Line type="linear" dataKey="checkout" stroke="#06B6D4" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name="3. Checkout" strokeOpacity={activeConvLines.length === 0 || activeConvLines.includes('checkout') ? 1 : 0.2} onClick={(e) => e && handleConvLegendClick({ dataKey: 'checkout' })} />
                  <Line type="linear" dataKey="purchase" stroke="#10B981" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} name="4. Compras VTEX" strokeOpacity={activeConvLines.length === 0 || activeConvLines.includes('purchase') ? 1 : 0.2} onClick={(e) => e && handleConvLegendClick({ dataKey: 'purchase' })} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sem dados</div>
            )}
          </div>
        </div>

        {/* Tabela - Métricas de Taxa de Conversão */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <h3 className="text-[14px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Métricas de Conversão</h3>
          <div className="flex-1 overflow-x-auto min-h-0">
            <table className="w-full text-left text-xs text-slate-600">
              <thead>
                <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  <th className="pb-3 font-bold text-left">Etapa</th>
                  <th className="pb-3 font-bold text-right">Taxa Geral</th>
                  <th className="pb-3 font-bold text-right">Média Diária</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {conversionTableData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 font-medium text-left flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </td>
                    <td className="py-3 font-bold text-slate-900 text-right">{item.geral.toFixed(2)}%</td>
                    <td className="py-3 font-semibold text-slate-800 text-right">{item.media.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 w-full mb-4">
        {/* Gráfico - Média de Visitas por Dia da Semana */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <h3 className="text-[14px] font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Média de {funnelBase === 'users' ? 'Visitas Únicas' : 'Sessões'} por Dia da Semana
          </h3>
          <div className="flex-1 w-full min-h-0">
            {dayOfWeekStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfWeekStats} margin={{ top: 15, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="dayName" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`${parseFloat(value as string).toFixed(1)} ${funnelBase === 'users' ? 'visitantes' : 'sessões'}`, 'Média']}
                  />
                  <Bar dataKey="avgVisits" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={30}>
                    <LabelList 
                      dataKey="avgVisits" 
                      position="top" 
                      formatter={(v: number) => Math.round(v).toLocaleString('pt-BR')} 
                      style={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }} 
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sem dados</div>
            )}
          </div>
        </div>

        {/* Tabela - Métricas por Dia da Semana */}
        <div className="lg:col-span-3 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <h3 className="text-[14px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Métricas por Dia da Semana</h3>
          <div className="flex-1 overflow-x-auto min-h-0 custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[9px] h-8 select-none">
                  <th className="pb-2 text-left">Dia da Semana</th>
                  <th className="pb-2 text-right">Total {funnelBase === 'users' ? 'Visitas' : 'Sessões'}</th>
                  <th className="pb-2 text-right">Menor</th>
                  <th className="pb-2 text-right">Maior</th>
                  <th className="pb-2 text-right">Média Visitas</th>
                  <th className="pb-2 text-right">Média Pedidos</th>
                  <th className="pb-2 text-right text-indigo-600">Taxa Conv. Média</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {dayOfWeekStats.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 font-semibold text-slate-950">{item.dayName}</td>
                    <td className="py-3 text-right font-mono font-bold text-slate-800">{item.totalVisits.toLocaleString('pt-BR')}</td>
                    <td className="py-3 text-right font-mono text-slate-500">{item.minVisits.toLocaleString('pt-BR')}</td>
                    <td className="py-3 text-right font-mono text-slate-800">{item.maxVisits.toLocaleString('pt-BR')}</td>
                    <td className="py-3 text-right font-mono font-bold text-indigo-500">{item.avgVisits.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                    <td className="py-3 text-right font-mono font-bold text-slate-900">{item.avgOrders.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                    <td className="py-3 text-right font-mono font-extrabold text-emerald-600">{item.avgConvRate.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CAMADA DE ANÁLISE DE CONVERSÃO POR DIMENSÃO (ORIGEM, CIDADE, ESTADO, DISPOSITIVO) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Desempenho de Conversão por Variável</h3>
            <p className="text-xs text-slate-500 mt-1">Selecione uma variável para ver a tabela de pedidos/faturamento e seu histórico diário de conversões.</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
            {[
              { id: 'origin', label: 'Origem/Mídia' },
              { id: 'city', label: 'Cidade' },
              { id: 'state', label: 'Estado' },
              { id: 'device', label: 'Dispositivo' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setConversionVar(tab.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  conversionVar === tab.id 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Tabela de Conversão */}
          <div className="lg:col-span-2 border border-slate-100 rounded-lg overflow-hidden flex flex-col h-[380px]">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 font-bold text-xs text-slate-700 uppercase tracking-wider">
              Detalhamento de Conversões
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-white shadow-xs z-10">
                  <tr className="text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[9px] h-8 select-none">
                    <th className="py-2 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleConversionSort('name')}>Item {conversionSortField === 'name' ? (conversionSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                    <th className="py-2 px-2 text-right cursor-pointer hover:text-slate-800" onClick={() => handleConversionSort('sessions')}>Sessões {conversionSortField === 'sessions' ? (conversionSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                    <th className="py-2 px-2 text-right cursor-pointer hover:text-slate-800" onClick={() => handleConversionSort('conversions')}>Pedidos {conversionSortField === 'conversions' ? (conversionSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                    <th className="py-2 px-2 text-right cursor-pointer hover:text-slate-800" onClick={() => handleConversionSort('rate')}>Taxa Conv. {conversionSortField === 'rate' ? (conversionSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                    <th className="py-2 px-4 text-right cursor-pointer hover:text-slate-800" onClick={() => handleConversionSort('revenue')}>Faturamento (Receita) {conversionSortField === 'revenue' ? (conversionSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {conversionStats.tableList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 truncate max-w-[150px]" title={item.name}>{item.name === '(not set)' ? '-' : item.name}</td>
                      <td className="py-3 px-2 text-right font-mono text-slate-600">{item.sessions.toLocaleString('pt-BR')}</td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-slate-800">{item.conversions.toLocaleString('pt-BR')}</td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-indigo-600">{item.rate.toFixed(2)}%</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">R$ {item.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  {conversionStats.tableList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">Nenhum pedido registrado no período.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráfico Histórico Diário */}
          <div className="lg:col-span-3 border border-slate-100 rounded-lg p-5 flex flex-col h-[380px]">
            <div className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-4">
              Histórico Diário de Conversões (Top 5)
            </div>
            <div className="flex-1 w-full min-h-0">
              {conversionStats.chartList.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={conversionStats.chartList} margin={{ top: 15, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value, name) => [`${value} pedidos`, name]}
                    />
                    <Legend verticalAlign="top" height={30} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '9px', fontWeight: 'semibold', paddingBottom: '10px' }} />
                    {conversionStats.topKeys.map((name, idx) => (
                      <Line 
                        key={name}
                        type="linear"
                        dataKey={name}
                        stroke={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                        strokeWidth={2.5}
                        dot={{ r: 1 }}
                        activeDot={{ r: 3 }}
                        name={name === '(not set)' ? 'Não Informado' : name}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  Sem dados históricos de conversão para exibir.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* EVOLUÇÃO DIÁRIA POR CANAL / ORIGEM */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full">
        {/* Gráfico Origem e Mídia */}
        <div className="lg:col-span-5 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[380px]">
          <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>Origem & Mídia (Evolução Diária)</span>
            <span className="text-[9px] text-slate-400 font-bold normal-case">{funnelBase === 'users' ? 'Usuários' : 'Sessões'} • Top 5</span>
          </h3>
          <div className="flex-1 w-full min-h-0">
            {channelsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={channelsChartData} margin={{ top: 15, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelFormatter={(label) => {
                      const dow = getDayOfWeekSuffix ? getDayOfWeekSuffix(label) : '';
                      return dow ? `${label} (${dow})` : label;
                    }}
                    formatter={(value, name) => [Number(value).toLocaleString('pt-BR'), name]}
                  />
                  <Legend verticalAlign="top" height={30} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '9px', fontWeight: 'semibold', paddingBottom: '10px', cursor: 'pointer' }} onClick={handleChannelsLegendClick} />
                  {top5ChannelsList.map((name, idx) => (
                    <Line 
                      key={name}
                      type="linear"
                      dataKey={name}
                      stroke={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                      name={name === '(not set)' ? 'Não Informado' : name}
                      strokeOpacity={activeChannelsLines.length === 0 || activeChannelsLines.includes(name) ? 1 : 0.2}
                      onClick={(e) => e && handleChannelsLegendClick({ dataKey: name })}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                {loading ? 'Carregando dados...' : 'Sem dados disponíveis.'}
              </div>
            )}
          </div>
        </div>

        {/* Tabela Origem e Mídia */}
        <div className="lg:col-span-7 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[380px]">
          <div className="mb-2 border-b border-slate-100 pb-2">
            <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span>Origem & Mídia</span>
              <span className="text-[9px] text-slate-400 font-bold normal-case">Período: {daysCount} {daysCount === 1 ? 'dia' : 'dias'}</span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 min-h-0 custom-scrollbar">
            <table className="w-full text-left text-[11px] text-slate-600 table-fixed">
              <thead>
                <tr className="text-[9px] text-slate-400 uppercase tracking-wider border-b border-slate-200 select-none">
                  <th className="pb-2 font-bold text-left cursor-pointer hover:text-indigo-600 w-[24%]" onClick={() => handleChannelsSort('name')}>
                    Canal {channelsSortField === 'name' ? (channelsSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[11%]" onClick={() => handleChannelsSort('soma')}>
                    Soma {channelsSortField === 'soma' ? (channelsSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[11%]" onClick={() => handleChannelsSort('pct')}>
                    Part. {channelsSortField === 'pct' ? (channelsSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[12%]" onClick={() => handleChannelsSort('avgDaily')}>
                    Média/D {channelsSortField === 'avgDaily' ? (channelsSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[12%]" onClick={() => handleChannelsSort('orders')}>
                    Pedidos {channelsSortField === 'orders' ? (channelsSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[14%] text-indigo-600" onClick={() => handleChannelsSort('rate')}>
                    Tx. Conv. {channelsSortField === 'rate' ? (channelsSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[16%] text-emerald-600" onClick={() => handleChannelsSort('revenue')}>
                    Faturamento {channelsSortField === 'revenue' ? (channelsSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {execChannelsList.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 h-8">
                    <td className="py-1 font-medium text-slate-800 text-left truncate" title={item.name}>{item.name === '(not set)' ? '-' : item.name}</td>
                    <td className="py-1 font-bold text-slate-900 text-right font-mono">{item.soma.toLocaleString('pt-BR')}</td>
                    <td className="py-1 text-slate-500 text-right font-mono">{item.pct.toFixed(1)}%</td>
                    <td className="py-1 text-slate-600 text-right font-mono">{item.avgDaily.toFixed(1)}</td>
                    <td className="py-1 font-semibold text-slate-800 text-right font-mono">{item.orders.toLocaleString('pt-BR')}</td>
                    <td className="py-1 font-bold text-indigo-600 text-right font-mono bg-indigo-50/20">{item.rate.toFixed(2)}%</td>
                    <td className="py-1 font-bold text-emerald-600 text-right font-mono bg-emerald-50/20">R$ {item.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* EVOLUÇÃO DIÁRIA POR CIDADE */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full">
        {/* Gráfico Cidades */}
        <div className="lg:col-span-5 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[380px]">
          <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>Cidades (Evolução Diária)</span>
            <span className="text-[9px] text-slate-400 font-bold normal-case">{funnelBase === 'users' ? 'Usuários' : 'Sessões'} • Top 5</span>
          </h3>
          <div className="flex-1 w-full min-h-0">
            {geoChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={geoChartData} margin={{ top: 15, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelFormatter={(label) => {
                      const dow = getDayOfWeekSuffix ? getDayOfWeekSuffix(label) : '';
                      return dow ? `${label} (${dow})` : label;
                    }}
                    formatter={(value, name) => [Number(value).toLocaleString('pt-BR'), name]}
                  />
                  <Legend verticalAlign="top" height={30} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '9px', fontWeight: 'semibold', paddingBottom: '10px', cursor: 'pointer' }} onClick={handleGeoLegendClick} />
                  {top5GeoList.map((name, idx) => (
                    <Line 
                      key={name}
                      type="linear"
                      dataKey={name}
                      stroke={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                      name={name === '(não setado)' ? 'Não Informado' : name}
                      strokeOpacity={activeGeoLines.length === 0 || activeGeoLines.includes(name) ? 1 : 0.2}
                      onClick={(e) => e && handleGeoLegendClick({ dataKey: name })}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                {loading ? 'Carregando dados...' : 'Sem dados disponíveis.'}
              </div>
            )}
          </div>
        </div>

        {/* Tabela Cidades */}
        <div className="lg:col-span-7 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[380px]">
          <div className="mb-2 border-b border-slate-100 pb-2">
            <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span>Cidades</span>
              <span className="text-[9px] text-slate-400 font-bold normal-case">Período: {daysCount} {daysCount === 1 ? 'dia' : 'dias'}</span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 min-h-0 custom-scrollbar">
            <table className="w-full text-left text-[11px] text-slate-600 table-fixed">
              <thead>
                <tr className="text-[9px] text-slate-400 uppercase tracking-wider border-b border-slate-200 select-none">
                  <th className="pb-2 font-bold text-left cursor-pointer hover:text-indigo-600 w-[24%]" onClick={() => handleGeoSort('name')}>
                    Cidade {geoSortField === 'name' ? (geoSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[11%]" onClick={() => handleGeoSort('soma')}>
                    Soma {geoSortField === 'soma' ? (geoSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[11%]" onClick={() => handleGeoSort('pct')}>
                    Part. {geoSortField === 'pct' ? (geoSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[12%]" onClick={() => handleGeoSort('avgDaily')}>
                    Média/D {geoSortField === 'avgDaily' ? (geoSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[12%]" onClick={() => handleGeoSort('orders')}>
                    Pedidos {geoSortField === 'orders' ? (geoSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[14%] text-indigo-600" onClick={() => handleGeoSort('rate')}>
                    Tx. Conv. {geoSortField === 'rate' ? (geoSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[16%] text-emerald-600" onClick={() => handleGeoSort('revenue')}>
                    Faturamento {geoSortField === 'revenue' ? (geoSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {execGeoList.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 h-8">
                    <td className="py-1 font-medium text-slate-800 text-left truncate" title={item.name}>{item.name === '(não setado)' ? '-' : item.name}</td>
                    <td className="py-1 font-bold text-slate-900 text-right font-mono">{item.soma.toLocaleString('pt-BR')}</td>
                    <td className="py-1 text-slate-500 text-right font-mono">{item.pct.toFixed(1)}%</td>
                    <td className="py-1 text-slate-600 text-right font-mono">{item.avgDaily.toFixed(1)}</td>
                    <td className="py-1 font-semibold text-slate-800 text-right font-mono">{item.orders.toLocaleString('pt-BR')}</td>
                    <td className="py-1 font-bold text-indigo-600 text-right font-mono bg-indigo-50/20">{item.rate.toFixed(2)}%</td>
                    <td className="py-1 font-bold text-emerald-600 text-right font-mono bg-emerald-50/20">R$ {item.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* EVOLUÇÃO DIÁRIA POR SISTEMA OPERACIONAL */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full">
        {/* Gráfico Sistema Operacional */}
        <div className="lg:col-span-5 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[380px]">
          <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>Sistema Operacional (Evolução Diária)</span>
            <span className="text-[9px] text-slate-400 font-bold normal-case">{funnelBase === 'users' ? 'Usuários' : 'Sessões'} • Top 5</span>
          </h3>
          <div className="flex-1 w-full min-h-0">
            {osChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={osChartData} margin={{ top: 15, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelFormatter={(label) => {
                      const dow = getDayOfWeekSuffix ? getDayOfWeekSuffix(label) : '';
                      return dow ? `${label} (${dow})` : label;
                    }}
                    formatter={(value, name) => [Number(value).toLocaleString('pt-BR'), name]}
                  />
                  <Legend verticalAlign="top" height={30} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '9px', fontWeight: 'semibold', paddingBottom: '10px', cursor: 'pointer' }} onClick={handleOsLegendClick} />
                  {top5OsList.map((name, idx) => (
                    <Line 
                      key={name}
                      type="linear"
                      dataKey={name}
                      stroke={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                      name={name === '(not set)' ? 'Não Informado' : name}
                      strokeOpacity={activeOsLines.length === 0 || activeOsLines.includes(name) ? 1 : 0.2}
                      onClick={(e) => e && handleOsLegendClick({ dataKey: name })}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                {loading ? 'Carregando dados...' : 'Sem dados disponíveis.'}
              </div>
            )}
          </div>
        </div>

        {/* Tabela Sistema Operacional */}
        <div className="lg:col-span-7 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[380px]">
          <div className="mb-2 border-b border-slate-100 pb-2">
            <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span>Sistema Operacional</span>
              <span className="text-[9px] text-slate-400 font-bold normal-case">Período: {daysCount} {daysCount === 1 ? 'dia' : 'dias'}</span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 min-h-0 custom-scrollbar">
            <table className="w-full text-left text-[11px] text-slate-600 table-fixed">
              <thead>
                <tr className="text-[9px] text-slate-400 uppercase tracking-wider border-b border-slate-200 select-none">
                  <th className="pb-2 font-bold text-left cursor-pointer hover:text-indigo-600 w-[24%]" onClick={() => handleOsSort('name')}>
                    SO {osSortField === 'name' ? (osSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[11%]" onClick={() => handleOsSort('soma')}>
                    Soma {osSortField === 'soma' ? (osSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[11%]" onClick={() => handleOsSort('pct')}>
                    Part. {osSortField === 'pct' ? (osSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[12%]" onClick={() => handleOsSort('avgDaily')}>
                    Média/D {osSortField === 'avgDaily' ? (osSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[12%]" onClick={() => handleOsSort('orders')}>
                    Pedidos {osSortField === 'orders' ? (osSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[14%] text-indigo-600" onClick={() => handleOsSort('rate')}>
                    Tx. Conv. {osSortField === 'rate' ? (osSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="pb-2 font-bold text-right cursor-pointer hover:text-indigo-600 w-[16%] text-emerald-600" onClick={() => handleOsSort('revenue')}>
                    Faturamento {osSortField === 'revenue' ? (osSortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {execOsList.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 h-8">
                    <td className="py-1 font-medium text-slate-800 text-left truncate" title={item.name}>{item.name === '(not set)' ? '-' : item.name}</td>
                    <td className="py-1 font-bold text-slate-900 text-right font-mono">{item.soma.toLocaleString('pt-BR')}</td>
                    <td className="py-1 text-slate-500 text-right font-mono">{item.pct.toFixed(1)}%</td>
                    <td className="py-1 text-slate-600 text-right font-mono">{item.avgDaily.toFixed(1)}</td>
                    <td className="py-1 font-semibold text-slate-800 text-right font-mono">{item.orders.toLocaleString('pt-BR')}</td>
                    <td className="py-1 font-bold text-indigo-600 text-right font-mono bg-indigo-50/20">{item.rate.toFixed(2)}%</td>
                    <td className="py-1 font-bold text-emerald-600 text-right font-mono bg-emerald-50/20">R$ {item.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CAMADA DE DETALHAMENTO DE PEDIDOS ATRIBUÍDOS (GA4 + VTEX) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Rastreamento de Pedidos e Atribuição (GA4 + VTEX)</h3>
          <p className="text-xs text-slate-500 mt-1">Lista completa de pedidos registrados no GA4 identificados e validados na VTEX com atribuição de canais e localidade.</p>
        </div>
        
        <div className="overflow-auto max-h-[400px] custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-white shadow-xs z-10">
              <tr className="text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[9px] h-8">
                <th className="py-2 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleTrackingSort('dateTime')}>Data e Horário {trackingSortField === 'dateTime' ? (trackingSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th className="py-2 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleTrackingSort('orderId')}>Número do Pedido {trackingSortField === 'orderId' ? (trackingSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th className="py-2 px-4 text-right cursor-pointer hover:text-slate-800" onClick={() => handleTrackingSort('revenue')}>Valor {trackingSortField === 'revenue' ? (trackingSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th className="py-2 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleTrackingSort('firstUserSourceMedium')}>Primeira Origem/Mídia {trackingSortField === 'firstUserSourceMedium' ? (trackingSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th className="py-2 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleTrackingSort('region')}>Estado {trackingSortField === 'region' ? (trackingSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th className="py-2 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleTrackingSort('city')}>Cidade {trackingSortField === 'city' ? (trackingSortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th className="py-2 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleTrackingSort('operatingSystem')}>Sistema Operacional {trackingSortField === 'operatingSystem' ? (trackingSortDir === 'desc' ? '▼' : '▲') : ''}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedTransactions.map((tx: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-mono">{tx.dateTime}</td>
                  <td className="py-3 px-4 font-bold text-blue-600 font-mono">{tx.orderId}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">R$ {tx.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{tx.firstUserSourceMedium === '(not set)' ? '-' : tx.firstUserSourceMedium}</td>
                  <td className="py-3 px-4 font-medium text-slate-600">{tx.region === '(not set)' ? '-' : tx.region}</td>
                  <td className="py-3 px-4 text-slate-600">{tx.city === '(not set)' ? '-' : tx.city}</td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-[10px]">{tx.operatingSystem === '(not set)' ? '-' : tx.operatingSystem}</td>
                </tr>
              ))}
              {completedTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Nenhum pedido correspondente identificado entre GA4 e VTEX no período selecionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>



    </div>
  );
}
