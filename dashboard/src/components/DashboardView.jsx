import { MoreVertical, ArrowUpRight, CheckCircle2, Trash2, X, Users, CheckSquare, ChevronLeft, ChevronRight, Filter, Calendar } from 'lucide-react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { StatusBadge } from './StatusBadge'
import { useState } from 'react'

function KanbanBoard({ orders, onSelectOrder }) {
    const columns = ['NUEVO', 'DISEÑO', 'PRODUCCIÓN', 'LISTO', 'ENTREGADO']

    return (
        <div className="flex gap-4 overflow-x-auto pb-6 h-full items-start w-full">
            {columns.map(col => {
                const items = orders.filter(o => o.status === col)
                return (
                    <Droppable key={col} droppableId={col}>
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`flex-1 min-w-[260px] flex flex-col rounded-2xl transition-colors ${snapshot.isDraggingOver ? 'bg-[var(--brand-primary)]/5 ring-2 ring-[var(--brand-primary)]/10' : ''}`}
                            >
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight whitespace-nowrap">{col}</h3>
                                    <span className="bg-[var(--bg-card)] text-[var(--brand-primary)] text-xs font-bold px-3 py-1 rounded-full shadow-sm">{items.length}</span>
                                </div>
                                <div className="space-y-4 min-h-[150px]">
                                    {items.map((order, index) => (
                                        <Draggable key={order.id} draggableId={order.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    onClick={() => onSelectOrder(order)}
                                                    style={{ ...provided.draggableProps.style }}
                                                    className={`dashboard-card cursor-grab active:cursor-grabbing group transition-all duration-300
                              hover:-translate-y-2 hover:shadow-[0px_20px_50px_rgba(112,144,176,0.2)] hover:z-20
                              ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-2xl z-50 ring-2 ring-[var(--brand-primary)]' : ''}`}
                                                >
                                                    <div className="flex justify-between items-start mb-3">
                                                        <StatusBadge status={order.status} mini />
                                                        <span className="text-[10px] font-bold text-[#A3AED0]">#{order.id.slice(0, 4)}</span>
                                                    </div>
                                                    <p className="text-sm font-bold text-[#2B3674] mb-4 whitespace-normal break-words line-clamp-3 leading-snug">{order.description || 'Sin descripción'}</p>

                                                    <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-white/5">
                                                        <div className="flex -space-x-2">
                                                            <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold border-2 border-white dark:border-[#111C44]">{order.leads?.name?.slice(0, 1)}</div>
                                                        </div>
                                                        <div className="flex flex-col text-right">
                                                            <p className="text-xs font-bold text-[#4318FF]">${(order.total_amount || 0).toLocaleString('es-CL')}</p>
                                                            {(order.total_amount - (order.deposit_amount || 0) > 0) && (
                                                                <p className="text-[9px] font-bold text-red-500">Debe: ${(order.total_amount - (order.deposit_amount || 0)).toLocaleString('es-CL')}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            </div>
                        )}
                    </Droppable>
                )
            })}
        </div>
    )
}

export function DashboardView({ orders, search, viewMode, setViewMode, onSelectOrder, selectedIds, setSelectedIds, onDelete, onDragEnd, currentPage, setCurrentPage, itemsPerPage, loading }) {
    // Advanced Filters State
    const [statusFilter, setStatusFilter] = useState('')
    const [dateFilter, setDateFilter] = useState('all') // 'all', 'today', 'week', 'month'

    // Filter Logic
    const filteredOrders = orders.filter(o => {
        // 1. Search Term
        if (search) {
            const term = search.toLowerCase()
            if (!o.description?.toLowerCase().includes(term) &&
                !o.id?.toLowerCase().includes(term) &&
                !o.leads?.name?.toLowerCase().includes(term)) {
                return false
            }
        }

        // 2. Status Filter
        if (statusFilter && o.status !== statusFilter) return false

        // 3. Date Filter
        if (dateFilter !== 'all') {
            const date = new Date(o.created_at)
            const now = new Date()
            if (dateFilter === 'today') {
                if (date.toDateString() !== now.toDateString()) return false
            } else if (dateFilter === 'week') {
                const oneWeekAgo = new Date(now.setDate(now.getDate() - 7))
                if (date < oneWeekAgo) return false
            } else if (dateFilter === 'month') {
                const oneMonthAgo = new Date(now.setMonth(now.getMonth() - 1))
                if (date < oneMonthAgo) return false
            }
        }

        return true
    })

    // Pagination Logic
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    if (loading) {
        return (
            <div className="space-y-6 h-full flex flex-col p-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="h-8 w-48 bg-gray-200 dark:bg-white/10 rounded animate-pulse"></div>
                    <div className="h-10 w-24 bg-gray-200 dark:bg-white/10 rounded animate-pulse"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-40 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse"></div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Section Header & Filters */}
            <div className="flex flex-col gap-4 shrink-0">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">Ordenes Recientes</h2>
                        <p className="text-sm text-[var(--text-secondary)]">Mostrando {paginatedOrders.length} de {filteredOrders.length} órdenes</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Status Filter */}
                        <div className="relative group">
                            <button className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${statusFilter ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'bg-white border-gray-200 text-[var(--text-secondary)] hover:bg-gray-50'}`}>
                                <Filter size={14} />
                                {statusFilter || 'Todos los Estados'}
                                {statusFilter && <X size={12} className="ml-1 hover:text-red-200" onClick={(e) => { e.stopPropagation(); setStatusFilter('') }} />}
                            </button>
                            {/* Invisible Bridge */}
                            <div className="absolute h-2 w-full top-full left-0 z-40"></div>
                            {/* Dropdown */}
                            <div className="absolute right-0 top-[calc(100%+8px)] mt-0 w-40 bg-white border border-gray-100 rounded-xl shadow-xl p-1 hidden group-hover:block z-50 animate-in fade-in zoom-in-95 duration-100">
                                {['NUEVO', 'DISEÑO', 'PRODUCCIÓN', 'LISTO', 'ENTREGADO'].map(s => (
                                    <button key={s} onClick={() => setStatusFilter(s)} className="w-full text-left px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-gray-50 rounded-lg">
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date Filter */}
                        <div className="relative group">
                            <button className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${dateFilter !== 'all' ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'bg-white border-gray-200 text-[var(--text-secondary)] hover:bg-gray-50'}`}>
                                <Calendar size={14} />
                                {dateFilter === 'all' ? 'Cualquier Fecha' : dateFilter === 'today' ? 'Hoy' : dateFilter === 'week' ? 'Esta Semana' : 'Este Mes'}
                                {dateFilter !== 'all' && <X size={12} className="ml-1 hover:text-red-200" onClick={(e) => { e.stopPropagation(); setDateFilter('all') }} />}
                            </button>
                            {/* Invisible Bridge */}
                            <div className="absolute h-2 w-full top-full left-0 z-40"></div>
                            {/* Dropdown */}
                            <div className="absolute right-0 top-[calc(100%+8px)] mt-0 w-40 bg-white border border-gray-100 rounded-xl shadow-xl p-1 hidden group-hover:block z-50 animate-in fade-in zoom-in-95 duration-100">
                                <button onClick={() => setDateFilter('all')} className="w-full text-left px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-gray-50 rounded-lg">Cualquier Fecha</button>
                                <button onClick={() => setDateFilter('today')} className="w-full text-left px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-gray-50 rounded-lg">Hoy</button>
                                <button onClick={() => setDateFilter('week')} className="w-full text-left px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-gray-50 rounded-lg">Última Semana</button>
                                <button onClick={() => setDateFilter('month')} className="w-full text-left px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-gray-50 rounded-lg">Último Mes</button>
                            </div>
                        </div>

                        <div className="h-6 w-px bg-gray-200 mx-1"></div>

                        <div className="flex bg-[var(--bg-card)] p-1 rounded-xl shadow-sm">
                            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[var(--brand-main)] text-[var(--brand-primary)] bg-[#F4F7FE]' : 'text-[var(--text-secondary)]'}`}><MoreVertical size={18} className="rotate-90" /></button>
                            <button onClick={() => setViewMode('kanban')} className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-[var(--brand-main)] text-[var(--brand-primary)] bg-[#F4F7FE]' : 'text-[var(--text-secondary)]'}`}><ArrowUpRight size={18} /></button>
                        </div>
                    </div>
                </div>
            </div>
            {/* Batch Action Floater */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#2B3674] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4 zoom-in duration-300">
                    <div className="text-sm font-bold flex items-center gap-2"><CheckCircle2 size={16} className="text-[#4318FF]" /> {selectedIds.size} Seleccionados</div>
                    <div className="h-4 w-px bg-white/20"></div>
                    <button onClick={() => onDelete(Array.from(selectedIds))} className="flex items-center gap-2 text-xs font-bold hover:text-red-400 transition-colors"><Trash2 size={16} /> Eliminar</button>
                    <button onClick={() => setSelectedIds(new Set())} className="hover:bg-white/10 p-1 rounded-full"><X size={16} /></button>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {viewMode === 'kanban' ? (
                    <DragDropContext onDragEnd={onDragEnd}>
                        <KanbanBoard orders={paginatedOrders} onSelectOrder={onSelectOrder} />
                    </DragDropContext>
                ) : (
                    <div className="dashboard-card overflow-hidden !p-0">
                        <table className="w-full">
                            <thead className="bg-[#F9FAFC] dark:bg-white/5 border-b border-transparent dark:border-white/5">
                                <tr>
                                    <th className="px-6 py-4 w-12"><input type="checkbox" className="accent-[#4318FF] w-4 h-4 rounded cursor-pointer" onChange={(e) => setSelectedIds(e.target.checked ? new Set(paginatedOrders.map(o => o.id)) : new Set())} checked={selectedIds.size === paginatedOrders.length && paginatedOrders.length > 0} /></th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Descripción</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Estado</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Finanzas</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Fecha</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {paginatedOrders.map(order => {
                                    const balance = (order.total_amount || 0) - (order.deposit_amount || 0)
                                    const isSel = selectedIds.has(order.id)
                                    return (
                                        <tr
                                            key={order.id}
                                            onClick={() => onSelectOrder(order)}
                                            className={`group transition-all duration-300 cursor-pointer relative
                          ${isSel ? 'bg-[#F4F7FE] dark:bg-white/5' : 'bg-white hover:bg-[#F4F7FE] dark:hover:bg-white/5'}
                          hover:scale-[1.01] hover:shadow-[0px_20px_40px_rgba(112,144,176,0.15)] hover:z-10
                        `}
                                        >
                                            <td className="px-6 py-4" onClick={(e) => { e.stopPropagation(); const n = new Set(selectedIds); n.has(order.id) ? n.delete(order.id) : n.add(order.id); setSelectedIds(n) }}>
                                                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${isSel ? 'bg-[#4318FF] border-[#4318FF] text-white' : 'border-gray-300'}`}>
                                                    {isSel && <CheckSquare size={14} />}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-bold text-[var(--text-primary)] mb-1">{order.description || 'Orden sin título'}</p>
                                                <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1"><Users size={12} /> {order.leads?.name || 'Cliente'}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={order.status} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-[var(--text-primary)]">${(order.total_amount || 0).toLocaleString('es-CL')}</span>
                                                    <span className={`text-[10px] font-bold ${balance <= 0 ? 'text-green-500' : 'text-red-500'}`}>{balance <= 0 ? 'PAGADO' : `Debe $${balance.toLocaleString('es-CL')}`}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs font-medium text-[var(--text-secondary)]">
                                                {new Date(order.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => onDelete([order.id])} className="p-2 rounded-lg hover:bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center pt-2 shrink-0 border-t border-gray-100 dark:border-white/5">
                    <p className="text-sm text-[var(--text-secondary)]">Página {currentPage} de {totalPages}</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[var(--text-primary)]"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[var(--text-primary)]"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
