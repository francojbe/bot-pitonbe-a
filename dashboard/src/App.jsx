import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { Toaster, toast } from 'sonner'
LayoutDashboard, Users, PieChart, Settings,
  Search, Bell, Moon, Sun, Plus, MoreHorizontal,
  CheckSquare, Square, Trash2, X, FileText,
  CreditCard, Calendar, ChevronRight, Filter,
  ArrowUpRight, Clock, CheckCircle2, DollarSign,
  BarChart2, MoreVertical, LogOut, Menu,
  User, MapPin, Mail, Phone, ExternalLink, Image, MessageCircle
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart as RePieChart, Pie, Legend, AreaChart, Area, CartesianGrid
} from 'recharts'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

function App() {
  // --- STATE CORE ---
  const [orders, setOrders] = useState([])
  const [leads, setLeads] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [activeTab, setActiveTab] = useState('dashboard')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('dashboard_view_mode') || 'kanban')
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  // Drawer & Modals
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isEditingLead, setIsEditingLead] = useState(false)
  const [isCreatingLead, setIsCreatingLead] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [leadForm, setLeadForm] = useState({ name: '', phone_number: '', rut: '', address: '', email: '' })
  const [leadSearch, setLeadSearch] = useState('')

  // --- EFFECTS ---
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  useEffect(() => { localStorage.setItem('dashboard_view_mode', viewMode) }, [viewMode])

  useEffect(() => {
    fetchOrders()
    fetchLeads()
    const chLeads = supabase.channel('realtime leads').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchLeads).subscribe()
    const chOrders = supabase.channel('realtime orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders).subscribe()
    return () => { supabase.removeChannel(chLeads); supabase.removeChannel(chOrders) }
  }, [])

  // --- LOGIC ---
  async function fetchOrders() {
    const { data } = await supabase.from('orders').select('*, leads(name, phone_number, rut, address, email)').order('created_at', { ascending: false })
    setOrders(data || [])
  }
  async function fetchLeads() {
    const { data } = await supabase.from('leads').select('*').order('name', { ascending: true })
    setLeads(data || [])
  }
  async function deleteOrders(ids) {
    if (!ids.length) return
    const { error } = await supabase.from('orders').delete().in('id', ids)
    if (!error) {
      setOrders(prev => prev.filter(o => !ids.includes(o.id)))
      setSelectedIds(new Set())
      toast.success(`${ids.length} orden(es) eliminada(s)`)
    } else toast.error('Error al eliminar')
  }
  async function handleSaveLead() {
    try {
      const payload = { ...leadForm }; delete payload.id; delete payload.created_at
      const query = isCreatingLead ? supabase.from('leads').insert([payload]) : supabase.from('leads').update(payload).eq('id', selectedLead.id)
      const { error } = await query
      if (error) throw error
      toast.success('Cliente guardado')
      fetchLeads(); setIsCreatingLead(false); setIsEditingLead(false)
    } catch (e) { toast.error('Error guardando cliente') }
  }

  // --- DND LOGIC ---
  async function handleDragEnd(result) {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId;

    // Optimistic UI Update
    setOrders(prev => prev.map(o => o.id === draggableId ? { ...o, status: newStatus } : o));

    // DB Sync
    try {
      await supabase.from('orders').update({ status: newStatus }).eq('id', draggableId);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al mover la tarjeta');
      fetchOrders(); // Revert on error
    }
  }

  // --- UI RENDER ---
  return (
    <div className="flex h-screen bg-[var(--bg-main)] text-[var(--text-primary)] font-sans overflow-hidden transition-colors duration-300">
      <Toaster position="top-center" richColors theme={isDarkMode ? 'dark' : 'light'} />

      {/* LEFT SIDEBAR (Horizon Style) */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* CENTER PANEL */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* HEADER */}
        <header className="h-20 flex items-center justify-between px-6 pt-6 pb-2">
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)]">Pages / {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</p>
            <h1 className="text-2xl font-bold tracking-tight capitalize">{activeTab}</h1>
          </div>

          <div className="flex items-center gap-3 bg-[var(--bg-card)] p-3 rounded-full shadow-sm dark:shadow-none">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input type="text" placeholder="Search..." className="pl-9 pr-4 py-1.5 rounded-full bg-[var(--bg-main)] text-sm outline-none w-40 focus:w-64 transition-all" />
            </div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors">
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20">
              PB
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {activeTab === 'dashboard' && (
            <DashboardView
              orders={orders}
              viewMode={viewMode}
              setViewMode={setViewMode}
              onSelectOrder={setSelectedOrder}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onDelete={deleteOrders}
              onDragEnd={handleDragEnd}
            />
          )}
          {activeTab === 'clientes' && (
            <LeadsView
              leads={leads}
              orders={orders}
              search={leadSearch}
              setSearch={setLeadSearch}
              onEdit={(l) => { setSelectedLead(l); setLeadForm(l); setIsEditingLead(true) }}
              onCreate={() => { setLeadForm({}); setIsCreatingLead(true) }}
            />
          )}
          {activeTab === 'reportes' && <ReportsView orders={orders} />}
        </main>
      </div>

      {/* RIGHT SIDEBAR / DRAWER (Overlay) */}
      {selectedOrder && (
        <OrderDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          updateOrderLocal={(u) => setOrders(prev => prev.map(o => o.id === u.id ? u : o))}
        />
      )}

      {(isCreatingLead || isEditingLead) && (
        <LeadModal
          isOpen={true}
          isCreating={isCreatingLead}
          form={leadForm}
          setForm={setLeadForm}
          onClose={() => { setIsCreatingLead(false); setIsEditingLead(false) }}
          onSubmit={handleSaveLead}
        />
      )}
    </div>
  )
}

// --- SUB-VIEWS ---

function Sidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { id: 'clientes', icon: <Users size={20} />, label: 'Clientes' },
    { id: 'reportes', icon: <BarChart2 size={20} />, label: 'Reportes' },
  ]

  return (
    <aside className="w-72 bg-[var(--bg-card)] hidden md:flex flex-col h-full p-6 border-r border-transparent dark:border-white/5 transition-colors duration-300">
      <div className="flex items-center gap-3 px-2 mb-10">
        <div className="bg-gradient-to-br from-[#4318FF] to-[#868CFF] w-8 h-8 rounded-lg flex items-center justify-center text-white"><LayoutDashboard size={18} /></div>
        <div className="text-[var(--text-primary)] font-black text-xl tracking-tighter uppercase">PITRÓN BEÑA</div>
      </div>

      <div className="space-y-2 flex-1">
        {menuItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all relative ${isActive ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)]'}`}
            >
              {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[var(--brand-primary)] rounded-l-lg"></div>}
              <span className={isActive ? 'text-[var(--brand-primary)]' : ''}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function DashboardView({ orders, viewMode, setViewMode, onSelectOrder, selectedIds, setSelectedIds, onDelete, onDragEnd }) {
  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Section Header */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Ordenes Recientes</h2>
          <p className="text-sm text-[var(--text-secondary)]">Gestión activa de producción.</p>
        </div>
        <div className="flex bg-[var(--bg-card)] p-1 rounded-xl shadow-sm">
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[var(--brand-main)] text-[var(--brand-primary)] bg-[#F4F7FE]' : 'text-[var(--text-secondary)]'}`}><MoreVertical size={18} className="rotate-90" /></button>
          <button onClick={() => setViewMode('kanban')} className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-[var(--brand-main)] text-[var(--brand-primary)] bg-[#F4F7FE]' : 'text-[var(--text-secondary)]'}`}><ArrowUpRight size={18} /></button>
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

      {viewMode === 'kanban' ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <KanbanBoard orders={orders} onSelectOrder={onSelectOrder} />
        </DragDropContext>
      ) : (
        <div className="dashboard-card overflow-hidden !p-0">
          <table className="w-full">
            <thead className="bg-[#F9FAFC] dark:bg-white/5 border-b border-transparent dark:border-white/5">
              <tr>
                <th className="px-6 py-4 w-12"><input type="checkbox" className="accent-[#4318FF] w-4 h-4 rounded cursor-pointer" onChange={(e) => setSelectedIds(e.target.checked ? new Set(orders.map(o => o.id)) : new Set())} checked={selectedIds.size === orders.length && orders.length > 0} /></th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Descripción</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Finanzas</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {orders.map(order => {
                const balance = (order.total_amount || 0) - (order.deposit_amount || 0)
                const isSel = selectedIds.has(order.id)
                return (
                  <tr key={order.id} onClick={() => onSelectOrder(order)} className={`group hover:bg-[#F4F7FE] dark:hover:bg-white/5 cursor-pointer transition-colors ${isSel ? 'bg-[#F4F7FE] dark:bg-white/5' : ''}`}>
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
  )
}

function KanbanBoard({ orders, onSelectOrder }) {
  const columns = ['NUEVO', 'DISEÑO', 'PRODUCCIÓN', 'LISTO', 'ENTREGADO']

  return (
    <div className="flex gap-6 overflow-x-auto pb-6 h-full items-start">
      {columns.map(col => {
        const items = orders.filter(o => o.status === col)
        return (
          <Droppable key={col} droppableId={col}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-w-[300px] w-[300px] flex flex-col rounded-2xl transition-colors ${snapshot.isDraggingOver ? 'bg-[var(--brand-primary)]/5 ring-2 ring-[var(--brand-primary)]/10' : ''}`}
              >
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">{col}</h3>
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
                          className={`dashboard-card cursor-grab active:cursor-grabbing group hover:-translate-y-1 hover:shadow-lg hover:shadow-[#4318FF]/10 ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-2xl z-50 ring-2 ring-[var(--brand-primary)]' : ''}`}
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

function ReportsView({ orders }) {
  // ... Same Layout ...
  const totalSales = orders.reduce((acc, o) => acc + (o.total_amount || 0), 0)
  const active = orders.filter(o => ['DISEÑO', 'PRODUCCIÓN'].includes(o.status)).length
  const statusData = ['NUEVO', 'DISEÑO', 'PRODUCCIÓN', 'LISTO'].map(s => ({ name: s, value: orders.filter(o => o.status === s).length })).filter(d => d.value > 0)
  const COLORS = ['#4318FF', '#6AD2FF', '#EFF4FB', '#FFB547'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Ventas Totales" val={`$${totalSales.toLocaleString()}`} icon={<DollarSign />} />
        <KpiCard title="Pedidos Activos" val={active} icon={<Clock />} />
        <KpiCard title="Tickets Promedio" val={`$${Math.round(totalSales / orders.length || 0).toLocaleString()}`} icon={<BarChart2 />} />
        <KpiCard title="Nuevos Clientes" val={orders.length} icon={<Users />} />
      </div>
      {/* Charts would go here as before */}
    </div>
  )
}

// --- SHARED COMPONENTS ---

function KpiCard({ title, val, icon }) {
  return (
    <div className="dashboard-card flex items-center gap-4">
      <div className="w-14 h-14 rounded-full bg-[#F4F7FE] dark:bg-white/5 text-[#4318FF] flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-sm text-[var(--text-secondary)] font-medium">{title}</p>
        <h4 className="text-2xl font-bold text-[var(--text-primary)]">{val}</h4>
      </div>
    </div>
  )
}

function StatusBadge({ status, mini }) {
  const styles = {
    'NUEVO': 'text-orange-500 bg-orange-500/10',
    'DISEÑO': 'text-purple-500 bg-purple-500/10',
    'PRODUCCIÓN': 'text-yellow-500 bg-yellow-500/10',
    'LISTO': 'text-green-500 bg-green-500/10',
    'ENTREGADO': 'text-gray-500 bg-gray-500/10',
  }
  const colorClass = styles[status] || 'text-gray-500 bg-gray-100'
  return (
    <span className={`rounded-full font-bold flex items-center justify-center ${colorClass} ${mini ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-xs'} gap-1.5`}>
      {!mini && <span className="w-1.5 h-1.5 rounded-full bg-current"></span>}
      {status}
    </span>
  )
}

function OrderDrawer({ order, onClose, updateOrderLocal }) {
  // RESTORED FULL FUNCTIONALITY DRAWER
  const [form, setForm] = useState({ ...order })
  const isPaid = (form.total_amount || 0) <= (form.deposit_amount || 0)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (JSON.stringify(form) !== JSON.stringify(order)) {
        const { leads, ...clean } = form
        const { error } = await supabase.from('orders').update(clean).eq('id', order.id)
        if (!error) updateOrderLocal(form)
      }
    }, 1000); return () => clearTimeout(t)
  }, [form])

  // Send WhatsApp with Quote Logic
  const sendWhatsApp = async () => {
    const phone = order.leads?.phone_number;
    if (!phone) return toast.error("Cliente sin teléfono");
    const msg = `Hola ${order.leads?.name}! 👋\n\nTu pedido *${order.id.slice(0, 5)}* está en estado: *${order.status}*\n${order.description}\n\nGracias por preferirnos! ✨`;
    // In production use a real backend endpoint or wa.me
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-[#0B1437]/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative w-full max-w-2xl h-full bg-[var(--bg-card)] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-white/5">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Orden #{order.id.slice(0, 6)}</h2>
            <p className="text-sm text-[var(--text-secondary)]">Creada el {new Date(order.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-[var(--text-secondary)]"><X size={24} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Status Tracker */}
          <div className="flex justify-between items-center bg-[#F4F7FE] dark:bg-white/5 p-4 rounded-xl">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--text-secondary)] uppercase">Estado Actual</span>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                className="bg-transparent text-lg font-bold text-[var(--brand-primary)] outline-none cursor-pointer mt-1"
              >
                {['NUEVO', 'DISEÑO', 'PRODUCCIÓN', 'LISTO', 'ENTREGADO'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <StatusBadge status={form.status} />
          </div>

          {/* Client Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="dashboard-card !shadow-none border border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><User size={18} /></div>
                <h3 className="font-bold text-[var(--text-primary)]">Cliente</h3>
              </div>
              <div className="space-y-3">
                <p className="font-bold text-lg">{order.leads?.name || 'Cliente Desconocido'}</p>
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Phone size={14} /> <a href={`tel:${order.leads?.phone_number}`} className="hover:underline">{order.leads?.phone_number || 'Sin Teléfono'}</a>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Mail size={14} /> <span>{order.leads?.email || 'Sin Email'}</span>
                </div>
              </div>
            </div>

            <div className="dashboard-card !shadow-none border border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-50 text-green-600 rounded-lg"><DollarSign size={18} /></div>
                <h3 className="font-bold text-[var(--text-primary)]">Pagos</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--text-secondary)] font-medium">Total Estimado</span>
                  <input type="number" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: Number(e.target.value) })} className="text-right font-bold w-32 bg-transparent outline-none border-b border-transparent focus:border-[var(--brand-primary)] transition-colors" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--text-secondary)] font-medium">Abonado</span>
                  <input type="number" value={form.deposit_amount || 0} onChange={e => setForm({ ...form, deposit_amount: Number(e.target.value) })} className="text-right font-bold w-32 bg-transparent outline-none border-b border-transparent focus:border-[var(--brand-primary)] transition-colors text-green-600" />
                </div>
                <div className="h-px bg-gray-100 dark:bg-white/10"></div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[var(--text-primary)]">Saldo Pendiente</span>
                  <span className={`font-black text-lg ${isPaid ? 'text-green-500' : 'text-red-500'}`}>
                    {isPaid ? 'PAGADO' : `$${(form.total_amount - form.deposit_amount).toLocaleString('es-CL')}`}
                  </span>
                </div>
              </div>
            </div>
            {/* Details Section Structured */}
            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-3 block">Especificaciones del Pedido</label>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Material</label>
                  <select
                    value={form.material || ''}
                    onChange={e => setForm({ ...form, material: e.target.value })}
                    className="w-full p-3 rounded-xl bg-[#F4F7FE] dark:bg-white/5 border-none outline-none text-[var(--text-primary)] font-bold text-sm cursor-pointer"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Couché 300g">Couché 300g</option>
                    <option value="Couché 170g">Couché 170g</option>
                    <option value="Bond 80g">Bond 80g</option>
                    <option value="Adhesivo Papel">Adhesivo Papel</option>
                    <option value="Adhesivo PVC">Adhesivo PVC</option>
                    <option value="Opalina">Opalina</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Medidas</label>
                  <div className="relative">
                    <select
                      className="w-full p-3 rounded-xl bg-[#F4F7FE] dark:bg-white/5 border-none outline-none text-[var(--text-primary)] font-bold text-sm cursor-pointer"
                      onChange={e => setForm({ ...form, dimensions: e.target.value })}
                      value={['9x5 cm', '10x15 cm', 'A4', 'A3', 'Carta', 'Oficio'].includes(form.dimensions) ? form.dimensions : 'custom'}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="9x5 cm">9x5 cm (Tarjeta)</option>
                      <option value="10x15 cm">10x15 cm</option>
                      <option value="Carta">Carta</option>
                      <option value="Oficio">Oficio</option>
                      <option value="A4">A4</option>
                      <option value="A3">A3</option>
                      <option value="custom">Personalizado...</option>
                    </select>
                    {!['9x5 cm', '10x15 cm', 'A4', 'A3', 'Carta', 'Oficio', ''].includes(form.dimensions) && (
                      <input
                        type="text"
                        placeholder="Ej: 50x50 cm"
                        value={form.dimensions || ''}
                        onChange={e => setForm({ ...form, dimensions: e.target.value })}
                        className="mt-2 w-full p-2 rounded-lg bg-[#F4F7FE] dark:bg-white/5 border-none text-sm font-bold"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Cantidad</label>
                  <input
                    type="number"
                    value={form.quantity || ''}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                    className="w-full p-3 rounded-xl bg-[#F4F7FE] dark:bg-white/5 border-none outline-none text-[var(--text-primary)] font-bold text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Lados de Impresión</label>
                  <select
                    value={form.print_sides || '1 Tiro'}
                    onChange={e => setForm({ ...form, print_sides: e.target.value })}
                    className="w-full p-3 rounded-xl bg-[#F4F7FE] dark:bg-white/5 border-none outline-none text-[var(--text-primary)] font-bold text-sm cursor-pointer"
                  >
                    <option value="1 Tiro">1 Tiro (Solo Frente)</option>
                    <option value="2 Tiros">2 Tiros (Frente y Dorso)</option>
                  </select>
                </div>
              </div>

              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2 block">Notas Adicionales / Descripción</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full p-4 rounded-xl bg-[#F4F7FE] dark:bg-white/5 border-none outline-none text-[var(--text-primary)] font-medium resize-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all leading-relaxed mb-6"
                placeholder="Detalles extra..."
              ></textarea>
            </div>

            {/* Files Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Archivos Adjuntos</label>
                {/* Allow upload trigger here later */}
              </div>
              {order.files_url && order.files_url.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {order.files_url.map((file, i) => (
                    <a key={i} href={file} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-[#F4F7FE] dark:hover:bg-white/5 transition-colors group">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        {file.match(/\.(jpg|jpeg|png|gif)$/i) ? <Image size={18} /> : <FileText size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">Archivo {i + 1}</p>
                        <p className="text-xs text-[var(--text-secondary)] uppercase">{file.split('.').pop()}</p>
                      </div>
                      <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="p-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl flex flex-col items-center justify-center text-[var(--text-secondary)] gap-2">
                  <FileText size={32} className="opacity-20" />
                  <p className="text-sm font-medium">No hay archivos adjuntos</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-[var(--bg-card)] flex gap-4">
            <button onClick={sendWhatsApp} className="flex-1 py-3 bg-[var(--brand-primary)] text-white rounded-xl font-bold shadow-lg shadow-[#4318FF]/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
              <MessageCircle size={18} /> Enviar WhatsApp
            </button>
            {!isPaid && (
              <button onClick={() => setForm({ ...form, deposit_amount: form.total_amount })} className="px-6 py-3 bg-green-500/10 text-green-600 rounded-xl font-bold hover:bg-green-500/20 transition-colors flex items-center gap-2">
                <CheckCircle2 size={18} /> Registrar Pago Total
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LeadsView({ leads, search, setSearch, onEdit, onCreate }) {
  return (
    <div className="dashboard-card h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-[var(--text-primary)]">Directorio de Clientes</h3>
        <button onClick={onCreate} className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-full font-bold shadow-lg shadow-[#4318FF]/20">Nuevo Cliente</button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left">
          <thead className="bg-[#F9FAFC] dark:bg-white/5">
            <tr><th className="px-6 py-3 text-xs font-bold text-[var(--text-secondary)]">NOMBRE</th><th className="px-6 py-3 text-xs font-bold text-[var(--text-secondary)]">CONTACTO</th><th className="px-6 py-3"></th></tr>
          </thead>
          <tbody>
            {leads.filter(l => l.name?.toLowerCase().includes(search.toLowerCase())).map(l => (
              <tr key={l.id} className="border-b border-gray-50 dark:border-white/5 hover:bg-[#F4F7FE] dark:hover:bg-white/5">
                <td className="px-6 py-4 font-bold text-[var(--text-primary)]">{l.name}</td>
                <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{l.phone_number}</td>
                <td className="px-6 py-4 text-right"><button onClick={() => onEdit(l)} className="text-[var(--brand-primary)] font-bold text-xs">EDITAR</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LeadModal({ isOpen, isCreating, form, setForm, onClose, onSubmit }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0B1437]/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="dashboard-card w-full max-w-md relative animate-in zoom-in duration-200">
        <h2 className="text-xl font-bold mb-6 text-[var(--text-primary)]">{isCreating ? 'Crear Cliente' : 'Editar Cliente'}</h2>
        <input className="dashboard-input mb-4" placeholder="Nombre Completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input className="dashboard-input mb-4" placeholder="Teléfono" value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} />
        <button onClick={onSubmit} className="w-full py-3 bg-[var(--brand-primary)] text-white rounded-xl font-bold shadow-lg shadow-[#4318FF]/20 mt-4">Guardar Cambios</button>
      </div>
    </div>
  )
}

export default App
