import { Trash2, Plus, CheckSquare, ChevronRight, Users } from 'lucide-react'

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

export function LeadsView({ leads, search, onEdit, onCreate, selectedIds, setSelectedIds, onDelete }) {
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
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)]">Directorio de Clientes</h3>
                    <p className="text-sm text-[var(--text-secondary)] font-medium">Total: {leads.length} clientes registrados</p>
                </div>
                <div className="flex gap-3">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={() => onDelete(Array.from(selectedIds))}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full font-bold text-sm hover:bg-red-100 transition-all animate-in fade-in zoom-in duration-200"
                        >
                            <Trash2 size={16} /> Eliminar ({selectedIds.size})
                        </button>
                    )}
                    <button onClick={onCreate} className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-full font-bold shadow-lg shadow-[#4318FF]/20 flex items-center gap-2">
                        <Plus size={18} /> Nuevo Cliente
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <table className="w-full text-left table-fixed">
                    <thead className="sticky top-0 bg-[#F9FAFC] dark:bg-white/5 border-b border-gray-100 dark:border-white/5 z-20">
                        <tr>
                            <th className="px-6 py-4 w-14">
                                <div onClick={toggleAll} className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${selectedIds.size === filtered.length && filtered.length > 0 ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white' : 'border-gray-300'}`}>
                                    {selectedIds.size === filtered.length && filtered.length > 0 && <CheckSquare size={14} />}
                                </div>
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider w-[30%]">Nombre</th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider w-[25%]">Contacto</th>
                            <th className="px-6 py-4 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Empresa</th>
                            <th className="px-6 py-4 w-20"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {filtered.map(l => (
                            <tr
                                key={l.id}
                                className={`group transition-all duration-300 cursor-pointer relative
                  ${selectedIds.has(l.id) ? 'bg-[#F4F7FE]' : 'bg-white hover:bg-[#F4F7FE] dark:hover:bg-white/5'}
                  hover:shadow-[0px_10px_30px_rgba(112,144,176,0.12)] hover:z-10
                `}
                                onClick={() => onEdit(l)}
                            >
                                <td className="px-6 py-4" onClick={(e) => { e.stopPropagation(); toggleOne(l.id); }}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${selectedIds.has(l.id) ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white' : 'border-gray-300'}`}>
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
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit(l); }}
                                        className="p-2 rounded-xl text-[var(--brand-primary)] opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-50 dark:hover:bg-white/5"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
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
