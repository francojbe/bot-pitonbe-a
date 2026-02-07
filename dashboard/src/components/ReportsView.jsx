import { DollarSign, Clock, Users, BarChart2 } from 'lucide-react'
import { KpiCard } from './KpiCard'

export function ReportsView({ orders }) {
    const totalSales = orders.reduce((acc, o) => acc + (o.total_amount || 0), 0)
    const active = orders.filter(o => ['DISEÑO', 'PRODUCCIÓN'].includes(o.status)).length

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard title="Ventas Totales" val={`$${totalSales.toLocaleString()}`} icon={<DollarSign />} />
                <KpiCard title="Pedidos Activos" val={active} icon={<Clock />} />
                <KpiCard title="Tickets Promedio" val={`$${Math.round(totalSales / orders.length || 0).toLocaleString()}`} icon={<BarChart2 />} />
                <KpiCard title="Nuevos Clientes" val={orders.length} icon={<Users />} />
            </div>
        </div>
    )
}
