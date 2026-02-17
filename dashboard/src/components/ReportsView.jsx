
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

export function ReportsView({ orders, leads }) {
    const [timeRange, setTimeRange] = useState('30') // days

    // Filtered data based on time range
    const filteredOrders = useMemo(() => {
        const cutoff = subDays(new Date(), parseInt(timeRange))
        return orders.filter(o => isAfter(new Date(o.created_at), cutoff))
    }, [orders, timeRange])

    // Stats calculation
    const stats = useMemo(() => {
        const totalSales = filteredOrders.reduce((acc, curr) => acc + (curr.total_amount || 0), 0)
        const totalOrders = filteredOrders.length
        const totalLeads = leads.length
        const pendingBalance = filteredOrders.reduce((acc, curr) =>
            acc + ((curr.total_amount || 0) - (curr.deposit_amount || 0)), 0)

        // Previous period for comparison (simulated simplified)
        return { totalSales, totalOrders, totalLeads, pendingBalance }
    }, [filteredOrders, leads])

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

    const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

    return (
        <div className="space-y-8 pb-10">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[var(--text-main)] mb-1">Centro de Reportes</h2>
                    <p className="text-sm text-[var(--text-secondary)]">Analiza el rendimiento de tu negocio en tiempo real.</p>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-[#242424] p-1.5 rounded-xl shadow-sm border border-gray-100 dark:border-white/5">
                    {['7', '30', '90'].map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${timeRange === range
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                        >
                            Últimos {range} días
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Ventas Totales"
                    value={`$${stats.totalSales.toLocaleString('es-CL')}`}
                    icon={<DollarSign className="text-indigo-500" />}
                    trend="+12%"
                    isUp
                />
                <StatCard
                    title="Órdenes Creadas"
                    value={stats.totalOrders}
                    icon={<ShoppingBag className="text-blue-500" />}
                    trend="+5%"
                    isUp
                />
                <StatCard
                    title="Clientes Activos"
                    value={stats.totalLeads}
                    icon={<Users className="text-purple-500" />}
                    trend="+8%"
                    isUp
                />
                <StatCard
                    title="Saldo a Cobrar"
                    value={`$${stats.pendingBalance.toLocaleString('es-CL')}`}
                    icon={<TrendingUp className="text-green-500" />}
                    trend="-2%"
                    isUp={false}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Sales Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="lg:col-span-2 bg-white dark:bg-[#242424] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-white/5"
                >
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
                            <TrendingUp size={18} className="text-indigo-500" /> Rendimiento de Ventas
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => ReportService.generatePDF(filteredOrders, 'Reporte de Ventas', stats)}
                                className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition-colors"
                            >
                                <FileText size={18} />
                            </button>
                            <button
                                onClick={() => ReportService.generateExcel(filteredOrders)}
                                className="p-2 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 transition-colors"
                            >
                                <Table size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(v) => `$${v / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    formatter={(value) => [`$${value.toLocaleString('es-CL')}`, 'Ventas']}
                                />
                                <Area type="monotone" dataKey="sales" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Status Distribution */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-[#242424] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-white/5 flex flex-col"
                >
                    <h3 className="font-bold text-[var(--text-main)] mb-6 flex items-center gap-2">
                        Distribución de Órdenes
                    </h3>
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 w-full">
                            {statusData.map((s, i) => (
                                <div key={s.name} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">{s.name}</span>
                                    <span className="text-xs font-bold text-[var(--text-main)]">{s.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Quick Export List */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-[#242424] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-white/5"
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-[var(--text-main)]">Exportaciones Rápidas</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <ExportItem
                        title="Inventario de Clientes"
                        desc="Listado completo de leads con datos de contacto."
                        onExport={() => ReportService.generateExcel(leads)}
                    />
                    <ExportItem
                        title="Resumen Financiero Mensual"
                        desc="Consolidado de ventas y pagos del mes."
                        onExport={() => ReportService.generatePDF(filteredOrders, 'Cierre Mensual', stats)}
                    />
                    <ExportItem
                        title="Historial de Auditoría"
                        desc="Registro de todos los cambios críticos realizados."
                        onExport={() => toast.info('Función en desarrollo...')}
                        disabled
                    />
                </div>
            </motion.div>
        </div>
    )
}

function StatCard({ title, value, icon, trend, isUp }) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-[#242424] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-white/5"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-2xl">
                    {icon}
                </div>
                <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${isUp ? 'text-green-600 bg-green-50 dark:bg-green-500/10' : 'text-red-600 bg-red-50 dark:bg-red-500/10'}`}>
                    {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {trend}
                </div>
            </div>
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{title}</p>
            <h4 className="text-2xl font-black text-[var(--text-main)]">{value}</h4>
        </motion.div>
    )
}

function ExportItem({ title, desc, onExport, disabled }) {
    return (
        <div className={`p-4 rounded-2xl border border-gray-100 dark:border-white/5 flex items-center justify-between gap-4 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}>
            <div className="min-w-0">
                <h5 className="text-sm font-bold text-[var(--text-main)] truncate">{title}</h5>
                <p className="text-[10px] text-gray-500 truncate">{desc}</p>
            </div>
            <button
                onClick={onExport}
                disabled={disabled}
                className="p-2 text-indigo-500 hover:bg-white dark:hover:bg-[#1a1a1a] rounded-xl shadow-sm border border-transparent hover:border-gray-100 transition-all"
            >
                <Download size={18} />
            </button>
        </div>
    )
}
