
import { DollarSign, Clock, Users, BarChart2, TrendingUp, TrendingDown, Activity, ArrowUpRight } from 'lucide-react'
import { KpiCard } from './KpiCard'
import { motion } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'

export function HomeView({ orders }) {
    // 1. Calculate KPIs (Real Data)
    const totalSales = orders.reduce((acc, o) => acc + (o.total_amount || 0), 0)
    const active = orders.filter(o => !['ENTREGADO', 'CANCELADO'].includes(o.status)).length
    const completed = orders.filter(o => o.status === 'ENTREGADO').length
    const totalOrders = orders.length
    const avgTicket = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0

    // 2. Prepare Chart Data (Sales by Day - Last 7 Days)
    const chartData = processChartData(orders)

    return (
        <div className="space-y-8 pb-10">
            {/* Header Section */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-[var(--text-main)]">Resumen General</h2>
                    <p className="text-[var(--text-secondary)] mt-1">Bienvenido de nuevo. Aquí tienes lo que está pasando en tu negocio hoy.</p>
                </div>
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-[var(--text-secondary)]">Última actualización</p>
                    <p className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2 justify-end">
                        <Activity size={18} className="text-green-500 animate-pulse" />
                        En tiempo real
                    </p>
                </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard
                    title="Ventas Totales"
                    val={`$${totalSales.toLocaleString()}`}
                    icon={<DollarSign size={24} className="text-emerald-500" />}
                    trend="+12% vs mes anterior"
                    color="emerald"
                />
                <KpiCard
                    title="Pedidos Activos"
                    val={active}
                    icon={<Clock size={24} className="text-indigo-500" />}
                    trend={`${active} en proceso`}
                    color="indigo"
                />
                <KpiCard
                    title="Ticket Promedio"
                    val={`$${avgTicket.toLocaleString()}`}
                    icon={<BarChart2 size={24} className="text-blue-500" />}
                    trend="Estable"
                    color="blue"
                />
                <KpiCard
                    title="Órdenes Totales"
                    val={totalOrders}
                    icon={<Users size={24} className="text-purple-500" />}
                    trend={`${completed} entregadas`}
                    color="purple"
                />
            </div>

            {/* Main Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Sales Chart (Big - 2/3 width) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="lg:col-span-2 bg-white dark:bg-[#242424] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-white/5"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-[var(--text-main)]">Tendencia de Ventas</h3>
                        <select className="bg-[var(--bg-subtle)] text-[var(--text-secondary)] text-sm rounded-lg px-3 py-1 outline-none border-none">
                            <option>Últimos 7 días</option>
                            <option>Este Mes</option>
                        </select>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.1} />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                    tickFormatter={(val) => `$${val / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorSales)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Status Distribution (Small - 1/3 width) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-[#242424] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-white/5"
                >
                    <h3 className="text-xl font-bold text-[var(--text-main)] mb-6">Estado de Órdenes</h3>
                    <div className="h-[300px] w-full">
                        {/* Simple Bar Chart for Status */}
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={processStatusData(orders)} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    width={100}
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}
                                />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>

            {/* Recent Activity Table (Simplified) */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white dark:bg-[#242424] rounded-3xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden"
            >
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-[var(--text-main)]">Actividad Reciente</h3>
                    <button className="text-sm font-medium text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
                        Ver todo <ArrowUpRight size={16} />
                    </button>
                </div>
                <div className="p-0">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[var(--bg-subtle)] text-[var(--text-secondary)] text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Cliente</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4">Monto</th>
                                <th className="px-6 py-4">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {orders.slice(0, 5).map((order) => (
                                <tr key={order.id} className="hover:bg-[var(--bg-subtle)] transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold overflow-hidden border border-gray-100 dark:border-white/10">
                                                {order.leads?.profile_picture_url ? (
                                                    <img src={order.leads.profile_picture_url} alt={order.leads?.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    order.leads?.name?.charAt(0) || '?'
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-[var(--text-main)]">{order.leads?.name || 'Cliente'}</p>
                                                <p className="text-[10px] text-[var(--text-secondary)]">#{(order.id || '').slice(0, 4)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-[var(--text-main)] font-mono">
                                        ${(order.total_amount || 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-[var(--text-secondary)] text-sm">
                                        {new Date(order.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    )
}

// --- Helper Functions ---

function getStatusColor(status) {
    const colors = {
        'COTIZANDO': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
        'DISEÑO': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300',
        'PRODUCCIÓN': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300',
        'ENTREGADO': 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300',
        'CANCELADO': 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'
    }
    return colors[status] || 'bg-gray-100 text-gray-600'
}

function processChartData(orders) {
    // Generate last 7 days keys
    const days = []
    for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        days.push(d.toISOString().slice(0, 10))
    }

    return days.map(day => {
        const dailyTotal = orders
            .filter(o => o.created_at.startsWith(day))
            .reduce((sum, o) => sum + (o.total_amount || 0), 0)
        return {
            date: day.slice(5), // MM-DD
            amount: dailyTotal
        }
    })
}

function processStatusData(orders) {
    const statusCounts = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1
        return acc
    }, {})

    return Object.keys(statusCounts).map(key => ({
        name: key,
        value: statusCounts[key]
    })).sort((a, b) => b.value - a.value) // Top statuses first
}
