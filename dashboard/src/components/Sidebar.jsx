import { LayoutDashboard, Users, BarChart2, Brain, ChevronLeft, ChevronRight, Folder } from 'lucide-react'

export function Sidebar({ activeTab, setActiveTab, collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
    const menuItems = [
        { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
        { id: 'clientes', icon: <Users size={20} />, label: 'Clientes' },
        { id: 'reportes', icon: <BarChart2 size={20} />, label: 'Reportes' },
        { id: 'archivos', icon: <Folder size={20} />, label: 'Archivos' },
        { id: 'mejoras', icon: <Brain size={20} />, label: 'Mejoras' },
    ]

    const handleItemClick = (id) => {
        setActiveTab(id)
        if (setMobileOpen) setMobileOpen(false)
    }

    return (
        <>
            {/* Mobile Backdrop */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setMobileOpen && setMobileOpen(false)}
                ></div>
            )}

            <aside className={`
                fixed inset-y-0 left-0 z-50 h-full bg-white dark:bg-[#242424] border-r border-transparent dark:border-white/5 transition-transform duration-300 md:translate-x-0 md:static md:flex flex-col p-4
                ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
                ${collapsed ? 'md:w-20' : 'md:w-72 w-64'}
            `}>
                <div className={`flex items-center gap-3 px-2 mb-10 ${collapsed ? 'justify-center' : ''}`}>
                    <img
                        src="/logo.png"
                        alt="Logo Pitón"
                        className={`${collapsed ? 'w-10 h-10' : 'h-24 w-auto scale-110'} object-contain transition-all duration-300`}
                    />
                </div>

                <div className="space-y-2 flex-1">
                    {menuItems.map(item => {
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleItemClick(item.id)}
                                title={collapsed ? item.label : ''}
                                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all relative group ${isActive ? 'font-bold text-[var(--text-main)]' : 'text-gray-500 font-medium hover:text-[var(--text-main)]'} ${collapsed ? 'justify-center' : ''}`}
                            >
                                {isActive && !collapsed && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[var(--color-primary)] rounded-l-lg"></div>}
                                <span className={`${isActive ? 'text-[var(--color-primary)]' : ''} transition-colors group-hover:scale-110 duration-200`}>{item.icon}</span>
                                {!collapsed && <span className="whitespace-nowrap overflow-hidden">{item.label}</span>}
                            </button>
                        )
                    })}
                </div>

                {/* Aesthetic Bottom Toggle */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={`hidden md:flex w-full items-center gap-4 px-4 py-3 rounded-xl text-gray-500 font-medium hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all mt-auto ${collapsed ? 'justify-center' : ''}`}
                >
                    {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    {!collapsed && <span className="whitespace-nowrap overflow-hidden">Contraer Menú</span>}
                </button>
            </aside>
        </>
    )
}
