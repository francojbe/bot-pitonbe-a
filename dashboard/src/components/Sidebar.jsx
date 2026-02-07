import { LayoutDashboard, Users, BarChart2, Brain, ChevronLeft, ChevronRight } from 'lucide-react'

export function Sidebar({ activeTab, setActiveTab, collapsed, setCollapsed }) {
    const menuItems = [
        { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
        { id: 'clientes', icon: <Users size={20} />, label: 'Clientes' },
        { id: 'reportes', icon: <BarChart2 size={20} />, label: 'Reportes' },
        { id: 'mejoras', icon: <Brain size={20} />, label: 'Mejoras' },
    ]

    return (
        <aside className={`${collapsed ? 'w-20' : 'w-72'} bg-[var(--bg-card)] hidden md:flex flex-col h-full p-4 border-r border-transparent dark:border-white/5 transition-all duration-300 relative`}>
            <div className={`flex items-center gap-3 px-2 mb-10 ${collapsed ? 'justify-center' : ''}`}>
                <div className="bg-gradient-to-br from-[#4318FF] to-[#868CFF] min-w-[32px] w-8 h-8 rounded-lg flex items-center justify-center text-white"><LayoutDashboard size={18} /></div>
                {!collapsed && <div className="text-[var(--text-primary)] font-black text-xl tracking-tighter uppercase whitespace-nowrap overflow-hidden">PITRÓN</div>}
            </div>

            <div className="space-y-2 flex-1">
                {menuItems.map(item => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            title={collapsed ? item.label : ''}
                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all relative group ${isActive ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)]'} ${collapsed ? 'justify-center' : ''}`}
                        >
                            {isActive && !collapsed && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[var(--brand-primary)] rounded-l-lg"></div>}
                            <span className={`${isActive ? 'text-[var(--brand-primary)]' : ''} transition-colors group-hover:scale-110 duration-200`}>{item.icon}</span>
                            {!collapsed && <span className="whitespace-nowrap overflow-hidden">{item.label}</span>}
                        </button>
                    )
                })}
            </div>

            {/* Aesthetic Bottom Toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[var(--text-secondary)] font-medium hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-all mt-auto ${collapsed ? 'justify-center' : ''}`}
            >
                {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                {!collapsed && <span className="whitespace-nowrap overflow-hidden">Contraer Menú</span>}
            </button>
        </aside>
    )
}
