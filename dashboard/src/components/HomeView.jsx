
import { DollarSign, Clock, Users, BarChart2, Activity, ArrowUpRight, Plus, Rocket, MessageSquare, ShieldCheck, Zap, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'

export function HomeView({ orders }) {
    // 1. Calculate KPIs (Real Data)
    const totalSales = orders.reduce((acc, o) => acc + (o.total_amount || 0), 0)
    const active = orders.filter(o => !['ENTREGADO', 'CANCELADO'].includes(o.status)).length
    const completed = orders.filter(o => o.status === 'ENTREGADO').length
    const totalOrders = orders.length
    const avgTicket = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0

    return (
        <div className="h-full space-y-6 overflow-y-auto pr-2 custom-scrollbar pb-6">
            {/* Hero / Greeting (Glassmorphism Style) */}
            <div className="relative p-10 rounded-[40px] border border-gray-100 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden transition-all hover:shadow-[0_25px_60px_rgba(0,0,0,0.1)]">
                {/* Dynamic background glows */}
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-[var(--color-primary)] opacity-10 dark:opacity-[0.05] rounded-full blur-[80px] animate-pulse"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-400 opacity-10 dark:opacity-[0.05] rounded-full blur-[60px]"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-primary)]">Sincronizado en vivo</span>
                    </div>

                    <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-tight text-[var(--text-main)]">
                        Panel de <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-emerald-600">Control</span>
                    </h2>

                    <p className="text-[var(--text-secondary)] font-medium mt-4 text-xl max-w-xl leading-relaxed">
                        Hola Franco, el sistema reporta <span className="text-[var(--text-main)] font-black">{active} pedidos</span> en curso que requieren validación.
                    </p>

                    <div className="flex flex-wrap gap-4 mt-10">
                        <button className="flex items-center gap-3 px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-[var(--color-primary)] text-[var(--color-accent)] hover:rotate-1 transition-all shadow-[0_10px_25px_-5px_rgba(162,213,171,0.5)] active:scale-95">
                            <Plus size={18} strokeWidth={4} /> Nueva Orden
                        </button>
                        <button className="flex items-center gap-3 px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[var(--text-main)] hover:bg-gray-50 dark:hover:bg-white/10 transition-all shadow-sm">
                            <MessageSquare size={18} /> Chat Activo
                        </button>
                    </div>
                </div>

                {/* Decorative Elements */}
                <Zap className="absolute top-10 right-10 text-[var(--color-primary)] opacity-20" size={40} />
                <Activity className="absolute bottom-10 right-10 text-[var(--text-secondary)] opacity-10" size={100} />
            </div>

            {/* Practical KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MiniStats title="Ventas Hoy" value={`$${(totalSales > 0 ? totalSales / 10 : 0).toLocaleString()}`} icon={<DollarSign size={16} />} color="text-green-500" />
                <MiniStats title="Pedidos" value={active} icon={<Clock size={16} />} color="text-blue-500" />
                <MiniStats title="Clientes" value={totalOrders} icon={<Users size={16} />} color="text-purple-500" />
                <MiniStats title="Ticket Prom" value={`$${avgTicket.toLocaleString()}`} icon={<ShieldCheck size={16} />} color="text-orange-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Recent Activity (Left) */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-sm font-black uppercase italic tracking-widest text-[var(--text-secondary)]">Actividad Reciente</h3>
                        <button className="text-[10px] font-black uppercase text-[var(--color-accent)] hover:underline">Ver Todo</button>
                    </div>

                    <div className="bg-white dark:bg-[#242424] rounded-[24px] border border-gray-100 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5 overflow-hidden shadow-sm">
                        {orders.slice(0, 5).map((order, i) => (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                key={order.id}
                                className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center font-bold text-[var(--color-accent)]">
                                    {(order.leads?.name || '?').charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{order.leads?.name || 'Cliente'}</p>
                                    <p className="text-[10px] text-gray-500">Orden #{order.id.slice(0, 4)} • {new Date(order.created_at).toLocaleDateString()}</p>
                                </div>
                                <div className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${getStatusColor(order.status)}`}>
                                    {order.status}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Shortcuts & Quick Glance (Right) */}
                <div className="lg:col-span-5 space-y-4">
                    <h3 className="text-sm font-black uppercase italic tracking-widest text-[var(--text-secondary)] px-2">Accesos Rápidos</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <ShortcutCard icon={<Rocket className="text-orange-500" />} label="Lanzar Copilot" />
                        <ShortcutCard icon={<TrendingUp className="text-green-500" />} label="Ir a Reportes" />
                        <ShortcutCard icon={<Users className="text-blue-500" />} label="Gestionar Leads" />
                        <ShortcutCard icon={<Activity className="text-purple-500" />} label="Monitor Stock" />
                    </div>

                    <div className="bg-white dark:bg-[#242424] p-6 rounded-[24px] border border-gray-100 dark:border-white/5 shadow-sm">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Pulso del Día</h4>
                        <div className="space-y-4">
                            <PulseItem label="Pedidos por entregar" count={active} progress={65} color="bg-blue-500" />
                            <PulseItem label="Conversaciones hoy" count={12} progress={80} color="bg-green-500" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ActionButton({ icon, label, color }) {
    return (
        <button className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${color} backdrop-blur-md border border-white/10`}>
            {icon}
            {label}
        </button>
    )
}

function MiniStats({ title, value, icon, color }) {
    return (
        <div className="bg-white dark:bg-[#242424] p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{title}</p>
                <p className="text-lg font-black text-[var(--text-main)] mt-0.5">{value}</p>
            </div>
            <div className={`${color} opacity-80 bg-gray-50 dark:bg-white/5 p-2 rounded-lg`}>
                {icon}
            </div>
        </div>
    )
}

function ShortcutCard({ icon, label }) {
    return (
        <button className="bg-white dark:bg-[#242424] p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:border-[var(--color-primary)]/40 transition-all flex flex-col items-center justify-center gap-2 group text-center">
            <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <span className="text-[10px] font-black uppercase tracking-tight text-[var(--text-secondary)]">{label}</span>
        </button>
    )
}

function PulseItem({ label, count, progress, color }) {
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold">
                <span className="text-gray-500 uppercase">{label}</span>
                <span className="text-[var(--text-main)]">{count}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full`} style={{ width: `${progress}%` }}></div>
            </div>
        </div>
    )
}

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
