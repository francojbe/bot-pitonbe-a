import { Trash2, Plus, CheckSquare, ChevronRight, Users, MessageCircle } from 'lucide-react'

// --- HELPER FUNCTION ---
const formatPhone = (phone) => {
    if (!phone) return 'Sin Teléfono'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.startsWith('569') && cleaned.length === 11) {
        return `+56 9 ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`
    }
    if (cleaned.length === 8) {
        return `+56 9 ${cleaned.slice(0, 4)} ${cleaned.slice(4)}`
    }
    return phone
}

export function LeadsView({ leads, search, onEdit, onCreate, selectedIds, setSelectedIds, onDelete, onOpenChat }) {
    const filtered = leads.filter(l =>
        !search ||
        l.name?.toLowerCase().includes(search.toLowerCase()) ||
        l.phone_number?.includes(search) ||
        l.rut?.includes(search)
    )

    const toggleAll = () => {
        if (selectedIds.size === filtered.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(filtered.map(l => l.id)))
    }

    const toggleOne = (id) => {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    return (
        <div className="dashboard-card h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h3 className="text-xl font-bold text-[var(--text-main)]">Directorio de Clientes</h3>
                    <p className="text-sm text-gray-500 font-medium">Total: {leads.length} clientes registrados</p>
                </div>
                <div className="flex gap-3">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={() => onDelete(Array.from(selectedIds))}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-full font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/20 transition-all animate-in fade-in zoom-in duration-200"
                        >
                            <Trash2 size={16} /> Eliminar ({selectedIds.size})
                        </button>
                    )}
                    <button onClick={onCreate} className="px-4 py-2 bg-[var(--color-primary)] text-[var(--text-main)] rounded-full font-bold shadow-[var(--shadow-card)] flex items-center gap-2">
                        <Plus size={18} /> Nuevo Cliente
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                    <thead className="sticky top-0 bg-[#F9FAFC] dark:bg-white/5 border-b border-gray-100 dark:border-white/5 z-20">
                        <tr>
                            <th className="px-6 py-4 w-14">
                                <div onClick={toggleAll} className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${selectedIds.size === filtered.length && filtered.length > 0 ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--text-main)]' : 'border-gray-300'}`}>
                                    {selectedIds.size === filtered.length && filtered.length > 0 && <CheckSquare size={14} />}
                                </div>
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider w-[30%]">Nombre</th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider w-[25%]">Contacto</th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Empresa</th>
                            <th className="px-6 py-4 w-32"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {filtered.map(l => (
                            <tr
                                key={l.id}
                                className={`group transition-all duration-300 cursor-pointer relative
                                    ${selectedIds.has(l.id) ? 'bg-[var(--bg-subtle)] dark:bg-white/10' : 'bg-white dark:bg-[#242424] hover:bg-[var(--bg-subtle)] dark:hover:bg-white/5'}
                                    hover:shadow-[0px_4px_0px_rgba(79,97,40,0.2)] hover:z-10 hover:-translate-y-0.5
                                `}
                                onClick={() => onEdit(l)}
                            >
                                <td className="px-6 py-4" onClick={(e) => { e.stopPropagation(); toggleOne(l.id); }}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${selectedIds.has(l.id) ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--text-main)]' : 'border-gray-300'}`}>
                                        {selectedIds.has(l.id) && <CheckSquare size={14} />}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex-shrink-0 flex items-center justify-center font-bold text-xs">
                                            {l.name?.charAt(0) || '?'}
                                        </div>
                                        <span className="font-bold text-[var(--text-primary)] truncate" title={l.name}>{l.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-sm font-bold text-[var(--text-primary)] whitespace-nowrap">{formatPhone(l.phone_number)}</span>
                                        <span className="text-xs text-[var(--text-secondary)] truncate" title={l.email}>{l.email || 'Sin email'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-sm font-medium text-[var(--text-secondary)] truncate" title={l.business_name}>{l.business_name || '-'}</p>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onOpenChat(l); }}
                                            className="p-2 rounded-xl text-indigo-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-100 dark:hover:bg-white/5"
                                            title="Ver chat"
                                        >
                                            <MessageCircle size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onEdit(l); }}
                                            className="p-2 rounded-xl text-gray-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-50 dark:hover:bg-white/5"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filtered.length === 0 && (
                    <div className="py-20 text-center">
                        <Users size={48} className="mx-auto text-[var(--text-secondary)] opacity-10 mb-4" />
                        <p className="text-[var(--text-secondary)] font-medium">No se encontraron clientes</p>
                    </div>
                )}
            </div>
        </div>
    )
}
