
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
    Download,
    FileText,
    Table,
    TrendingUp,
    Users,
    ShoppingBag,
    DollarSign,
    Calendar,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts'
import { format, subDays, isAfter } from 'date-fns'
import { es } from 'date-fns/locale'
import { ReportService } from '../services/ReportService'
import { AuditService } from '../services/AuditService'
import { toast } from 'sonner'

export function ReportsView({ orders, leads }) {
    const [timeRange, setTimeRange] = useState('30') // days

    // Filtered data based on time range
    const filteredOrders = useMemo(() => {
        const cutoff = subDays(new Date(), parseInt(timeRange))
        return orders.filter(o => isAfter(new Date(o.created_at), cutoff))
    }, [orders, timeRange])

    // Stats calculation with real trends
    const stats = useMemo(() => {
        const days = parseInt(timeRange)
        const cutoff = subDays(new Date(), days)
        const prevCutoff = subDays(cutoff, days)

        const currentOrders = orders.filter(o => isAfter(new Date(o.created_at), cutoff))
        const previousOrders = orders.filter(o => {
            const date = new Date(o.created_at)
            return isAfter(date, prevCutoff) && !isAfter(date, cutoff)
        })

        const totalSales = currentOrders.reduce((acc, curr) => acc + (curr.total_amount || 0), 0)
        const prevSales = previousOrders.reduce((acc, curr) => acc + (curr.total_amount || 0), 0)

        const totalOrders = currentOrders.length
        const prevTotalOrders = previousOrders.length

        const totalLeads = leads.length
        const currentNewLeads = leads.filter(l => isAfter(new Date(l.created_at), cutoff)).length
        const prevNewLeads = leads.filter(l => {
            const date = new Date(l.created_at)
            return isAfter(date, prevCutoff) && !isAfter(date, cutoff)
        }).length

        const pendingBalance = currentOrders.reduce((acc, curr) =>
            acc + ((curr.total_amount || 0) - (curr.deposit_amount || 0)), 0)
        const prevPendingBalance = previousOrders.reduce((acc, curr) =>
            acc + ((curr.total_amount || 0) - (curr.deposit_amount || 0)), 0)

        const calculateTrend = (curr, prev) => {
            if (!prev || prev === 0) return curr > 0 ? '+100%' : '0%'
            const diff = ((curr - prev) / prev) * 100
            return `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`
        }

        return {
            totalSales,
            salesTrend: calculateTrend(totalSales, prevSales),
            salesIsUp: totalSales >= prevSales,
            totalOrders,
            ordersTrend: calculateTrend(totalOrders, prevTotalOrders),
            ordersIsUp: totalOrders >= prevTotalOrders,
            totalLeads,
            leadsTrend: calculateTrend(currentNewLeads, prevNewLeads),
            leadsIsUp: currentNewLeads >= prevNewLeads,
            pendingBalance,
            balanceTrend: calculateTrend(pendingBalance, prevPendingBalance),
            balanceIsUp: pendingBalance <= prevPendingBalance // Is "up" (good) if pending balance is lower
        }
    }, [orders, leads, timeRange])

    // Chart Data: Sales by Day
    const chartData = useMemo(() => {
        const last30Days = [...Array(parseInt(timeRange))].map((_, i) => {
            const date = subDays(new Date(), i)
            const dateStr = format(date, 'yyyy-MM-dd')
            const daySales = filteredOrders
                .filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === dateStr)
                .reduce((acc, curr) => acc + (curr.total_amount || 0), 0)

            return {
                name: format(date, 'dd MMM', { locale: es }),
                sales: daySales
            }
        }).reverse()
        return last30Days
    }, [filteredOrders, timeRange])

    // Pie Chart: Status Distribution
    const statusData = useMemo(() => {
        const counts = filteredOrders.reduce((acc, curr) => {
            acc[curr.status] = (acc[curr.status] || 0) + 1
            return acc
        }, {})
        return Object.entries(counts).map(([name, value]) => ({ name, value }))
    }, [filteredOrders])

    const handleExportAudit = async () => {
        const loadingToast = toast.loading('Generando historial de auditoría...')
        try {
            const logs = await AuditService.getAllLogs()
            if (logs && logs.length > 0) {
                ReportService.generateAuditExcel(logs)
                toast.success('Auditoría exportada correctamente', { id: loadingToast })
            } else {
                toast.error('No hay registros de auditoría para exportar', { id: loadingToast })
            }
        } catch (error) {
            console.error(error)
            toast.error('Error al exportar auditoría', { id: loadingToast })
        }
    }

    const COLORS = ['#A2D5AB', '#4A6D55', '#F3C99F', '#EF4444', '#8B5CF6']

    return (
        <div className="h-full flex flex-col space-y-3 overflow-y-auto pr-1 custom-scrollbar">
            {/* Header & Filters (Compact) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                    <h2 className="text-lg font-black text-[var(--text-main)] italic uppercase">Reportes <span className="text-[var(--color-primary)]">Reales</span></h2>
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-[#242424] p-1 rounded-xl shadow-sm border border-gray-100 dark:border-white/5">
                    {['7', '30', '90', 'all'].map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${timeRange === range
                                ? 'bg-[var(--color-primary)] text-[var(--color-accent)] shadow-md'
                                : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                        >
                            {range === 'all' ? 'Todo' : `${range}D`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Compact Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
                <StatCard
                    title="Ventas"
                    value={`$${stats.totalSales.toLocaleString('es-CL')}`}
                    icon={<DollarSign size={16} />}
                    trend={stats.salesTrend}
                    isUp={stats.salesIsUp}
                />
                <StatCard
                    title="Órdenes"
                    value={stats.totalOrders}
                    icon={<ShoppingBag size={16} />}
                    trend={stats.ordersTrend}
                    isUp={stats.ordersIsUp}
                />
                <StatCard
                    title="Clientes"
                    value={stats.totalLeads}
                    icon={<Users size={16} />}
                    trend={stats.leadsTrend}
                    isUp={stats.leadsIsUp}
                />
                <StatCard
                    title="Deuda"
                    value={`$${stats.pendingBalance.toLocaleString('es-CL')}`}
                    icon={<TrendingUp size={16} />}
                    trend={stats.balanceTrend}
                    isUp={stats.balanceIsUp}
                />
            </div>

            {/* Compact Charts Section */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
                {/* Main Sales Chart */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="lg:col-span-8 bg-white dark:bg-[#242424] p-3.5 rounded-3xl border border-gray-100 dark:border-white/5 flex flex-col shadow-sm"
                >
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[10px] font-black uppercase italic tracking-wider flex items-center gap-2">
                            <TrendingUp size={12} className="text-[var(--color-primary)]" /> Ventas
                        </h3>
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => ReportService.generatePDF(filteredOrders, 'Reporte de Ventas', stats)}
                                className="p-1 text-gray-400 hover:text-[var(--color-primary)] transition-colors"
                            >
                                <FileText size={14} />
                            </button>
                            <button
                                onClick={() => ReportService.generateOrdersExcel(filteredOrders)}
                                className="p-1 text-gray-400 hover:text-[var(--color-primary)] transition-colors"
                            >
                                <Table size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 min-h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.2} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#9CA3AF', fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#9CA3AF', fontWeight: 'bold' }} tickFormatter={(v) => `$${v / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '9px' }}
                                    formatter={(value) => [`$${value.toLocaleString('es-CL')}`, 'Ventas']}
                                />
                                <Area type="monotone" dataKey="sales" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Status & Exports (Combined Column) */}
                <div className="lg:col-span-4 flex flex-col gap-3 overflow-hidden">
                    {/* Status Distribution */}
                    <div className="flex-1 bg-white dark:bg-[#242424] p-3.5 rounded-3xl border border-gray-100 dark:border-white/5 flex flex-col shadow-sm min-h-0">
                        <h3 className="text-[9px] font-black uppercase tracking-widest mb-3">Distribución</h3>
                        <div className="flex-1 min-h-[100px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={statusData} innerRadius={35} outerRadius={45} paddingAngle={4} dataKey="value">
                                        {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5">
                            {statusData.slice(0, 4).map((s, i) => (
                                <div key={s.name} className="flex items-center gap-1 truncate">
                                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                    <span className="text-[8px] font-bold text-gray-500 uppercase truncate">{s.name}</span>
                                    <span className="text-[8px] font-black text-[var(--text-main)] ml-auto">{s.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Compact Exports */}
                    <div className="bg-white dark:bg-[#242424] p-3.5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm shrink-0">
                        <h3 className="text-[9px] font-black uppercase tracking-widest mb-2">Acciones</h3>
                        <div className="flex flex-col gap-1.5">
                            <button onClick={() => ReportService.generateLeadsExcel(leads)} className="w-full flex items-center justify-between p-1.5 rounded-xl bg-gray-50 dark:bg-white/5 text-[9px] font-bold hover:bg-[var(--color-primary)]/10 transition-all border border-transparent hover:border-[var(--color-primary)]/20">
                                <span>CLIENTES (EXCEL)</span>
                                <Download size={12} />
                            </button>
                            <button onClick={handleExportAudit} className="w-full flex items-center justify-between p-1.5 rounded-xl bg-gray-50 dark:bg-white/5 text-[9px] font-bold hover:bg-[var(--color-primary)]/10 transition-all border border-transparent hover:border-[var(--color-primary)]/20">
                                <span>AUDITORÍA (CSV)</span>
                                <Download size={12} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatCard({ title, value, icon, trend, isUp }) {
    return (
        <motion.div
            whileHover={{ y: -1 }}
            className="bg-white dark:bg-[#242424] p-3 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm relative overflow-hidden group transition-all hover:border-[var(--color-primary)]/30"
        >
            <div className="absolute -top-1 -right-1 w-10 h-10 bg-[var(--color-primary)]/5 rounded-full flex items-center justify-center transition-all group-hover:scale-110">
                <div className="text-[var(--color-accent)] opacity-20 transform -translate-x-1 translate-y-1">{icon}</div>
            </div>

            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{title}</p>
            <h4 className="text-base font-black text-[var(--text-main)] mb-1.5 truncate">{value}</h4>

            <div className={`inline-flex items-center gap-0.5 text-[8px] font-black px-1 py-0.5 rounded ${isUp ? 'text-green-600 bg-green-50 dark:bg-green-500/10' : 'text-red-600 bg-red-50 dark:bg-red-500/10'}`}>
                {isUp ? <ArrowUpRight size={8} /> : <ArrowDownRight size={8} />}
                {trend}
            </div>
        </motion.div>
    );
}

function ExportItem({ title, desc, onExport, disabled }) {
    return (
        <div className={`p-3 rounded-2xl border border-gray-100 dark:border-white/5 flex items-center justify-between gap-3 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}>
            <div className="min-w-0">
                <h5 className="text-xs font-bold text-[var(--text-main)] truncate">{title}</h5>
                <p className="text-[8px] text-gray-500 truncate">{desc}</p>
            </div>
            <button
                onClick={onExport}
                disabled={disabled}
                className="p-1.5 text-indigo-500 hover:bg-white dark:hover:bg-[#1a1a1a] rounded-lg shadow-sm border border-transparent hover:border-gray-100 transition-all"
            >
                <Download size={14} />
            </button>
        </div>
    );
}
