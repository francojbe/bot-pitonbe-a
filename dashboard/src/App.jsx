import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { Toaster, toast } from 'sonner'
import {
  ClipboardList, Search, Filter, Printer, MoreHorizontal, Phone,
  MapPin, CreditCard, FileText, X, LayoutGrid, List,
  Download, ExternalLink, Image as ImageIcon, Trash2, Save,
  Edit2, User, UserPlus, Users, Briefcase, DollarSign,
  BarChart2, PieChart, Moon, Sun, CheckCircle2, Clock,
  AlertTriangle, ChevronRight, Send, Paperclip
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart as RePieChart, Pie, Legend } from 'recharts'

function App() {
  const [orders, setOrders] = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('dashboard_view_mode') || 'kanban') // 'kanban' or 'list'
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  // Leads Management State
  const [isEditingLead, setIsEditingLead] = useState(false)
  const [isCreatingLead, setIsCreatingLead] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [leadForm, setLeadForm] = useState({ name: '', phone_number: '', rut: '', address: '', email: '' })

  // Theme Toggle
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  // Persist View Mode
  useEffect(() => {
    localStorage.setItem('dashboard_view_mode', viewMode)
  }, [viewMode])

  // Data Fetching
  useEffect(() => {
    fetchOrders()
    fetchLeads()

    const channelLeads = supabase.channel('realtime leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchLeads)
      .subscribe()

    const channelOrders = supabase.channel('realtime orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()

    return () => {
      supabase.removeChannel(channelLeads)
      supabase.removeChannel(channelOrders)
    }
  }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*, leads(name, phone_number, rut, address, email)')
      .order('created_at', { ascending: false })

    if (error) console.error('Error fetching orders:', error)
    else setOrders(data || [])
    setLoading(false)
  }

  async function fetchLeads() {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('name', { ascending: true })

    if (error) console.error('Error fetching leads:', error)
    else setLeads(data || [])
  }

  // --- ACTIONS ---
  async function updateOrderStatus(id, newStatus) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o))

    // DB Update
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id)
    if (error) {
      toast.error('Error actualizando estado')
      fetchOrders() // Revert
    } else {
      // Notify Backend for WhatsApp
      const apiUrl = import.meta.env.VITE_API_URL || 'https://recuperadora-agente-pb.nojauc.easypanel.host'
      fetch(`${apiUrl}/notify_update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: id, new_status: newStatus })
      }).catch(console.error)
    }
  }

  // --- VIEWS ---
  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${isDarkMode ? 'bg-[#09090b] text-[#FAFAFA]' : 'bg-[#FDFDFD] text-[#1C1C1E]'}`}>
      <Toaster position="top-center" richColors theme={isDarkMode ? 'dark' : 'light'} />

      {/* NAVBAR */}
      <nav className={`sticky top-0 z-40 border-b h-16 flex items-center px-4 sm:px-6 backdrop-blur-md transition-colors ${isDarkMode ? 'bg-[#09090b]/80 border-white/5' : 'bg-white/80 border-gray-100'}`}>
        <div className="flex-1 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-[#E96A51] to-[#e75336] w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#E96A51]/20"><Printer size={18} /></div>
            <div>
              <span className="font-bold text-lg tracking-tight block leading-tight">Pitron Beña</span>
              <span className="text-[10px] uppercase tracking-widest font-bold opacity-50">Manager</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`hidden md:flex p-1 rounded-xl mx-4 ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
              {['dashboard', 'clientes', 'reportes'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${activeTab === tab ? (isDarkMode ? 'bg-[#27272a] shadow text-white' : 'bg-white shadow text-black') : 'opacity-60 hover:opacity-100'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* View Mode Toggle (Only on Dashboard) */}
            {activeTab === 'dashboard' && (
              <div className={`flex p-1 rounded-lg border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
                <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? (isDarkMode ? 'bg-zinc-700 text-white' : 'bg-gray-100 text-black shadow-sm') : 'opacity-40 hover:opacity-100'}`} title="Vista Kanban"><LayoutGrid size={16} /></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? (isDarkMode ? 'bg-zinc-700 text-white' : 'bg-gray-100 text-black shadow-sm') : 'opacity-40 hover:opacity-100'}`} title="Vista Lista"><List size={16} /></button>
              </div>
            )}

            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-white/10 text-yellow-300' : 'bg-gray-100 text-gray-600'}`}>
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="h-[calc(100vh-4rem)] p-4 sm:p-6 overflow-hidden">
        {activeTab === 'dashboard' && (
          viewMode === 'kanban'
            ? <KanbanBoard orders={orders} onSelectOrder={setSelectedOrder} isDarkMode={isDarkMode} />
            : <ListView orders={orders} onSelectOrder={setSelectedOrder} isDarkMode={isDarkMode} />
        )}
        {activeTab === 'clientes' && <LeadsView leads={leads} onEdit={(l) => { setSelectedLead(l); setLeadForm(l); setIsEditingLead(true) }} isDarkMode={isDarkMode} openCreate={() => { setLeadForm({}); setIsCreatingLead(true) }} />}
        {activeTab === 'reportes' && <ReportsView orders={orders} isDarkMode={isDarkMode} />}
      </main>

      {/* DRAWER & MODALS */}
      {selectedOrder && (
        <OrderDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          isDarkMode={isDarkMode}
          updateOrderLocal={(updated) => setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))}
        />
      )}

      {(isCreatingLead || isEditingLead) && (
        <LeadModal
          isOpen={true}
          isCreating={isCreatingLead}
          form={leadForm}
          setForm={setLeadForm}
          onClose={() => { setIsCreatingLead(false); setIsEditingLead(false); }}
          onSubmit={async () => { /* reuse logic */ fetchLeads(); setIsCreatingLead(false); setIsEditingLead(false); }}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  )
}

// --- COMPONENTS ---

function KanbanBoard({ orders, onSelectOrder, isDarkMode }) {
  const columns = ['NUEVO', 'DISEÑO', 'PRODUCCIÓN', 'LISTO', 'ENTREGADO']

  return (
    <div className="h-full flex gap-4 overflow-x-auto pb-4 no-scrollbar items-start animate-in fade-in zoom-in duration-300">
      {columns.map(status => {
        const colOrders = orders.filter(o => o.status === status)
        return (
          <div key={status} className={`min-w-[300px] w-[320px] max-w-[320px] flex flex-col h-full rounded-3xl border transition-colors ${isDarkMode ? 'bg-[#121214] border-white/5' : 'bg-gray-50/50 border-gray-100'}`}>
            {/* Header */}
            <div className={`p-4 flex justify-between items-center border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${getStatusColor(status)}`}></span>
                <span className="text-xs font-black tracking-widest opacity-60">{status}</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-white/10' : 'bg-gray-200/50'}`}>{colOrders.length}</span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {colOrders.map(order => (
                <OrderCard key={order.id} order={order} onClick={() => onSelectOrder(order)} isDarkMode={isDarkMode} />
              ))}
              {colOrders.length === 0 && (
                <div className="h-24 flex items-center justify-center opacity-20 text-xs font-bold uppercase border-2 border-dashed rounded-2xl mx-2">Vacío</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ListView({ orders, onSelectOrder, isDarkMode }) {
  return (
    <div className={`h-full overflow-hidden rounded-3xl border flex flex-col animate-in fade-in zoom-in duration-300 ${isDarkMode ? 'bg-[#121214] border-white/5' : 'bg-white border-gray-100'}`}>
      <div className={`flex items-center px-6 py-4 border-b gap-4 ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-gray-100 bg-gray-50'}`}>
        <div className="flex-1 text-[10px] uppercase font-black opacity-40">Descripción / Cliente</div>
        <div className="w-32 text-[10px] uppercase font-black opacity-40">Estado</div>
        <div className="w-32 text-right text-[10px] uppercase font-black opacity-40">Monto</div>
        <div className="w-32 text-right text-[10px] uppercase font-black opacity-40">Saldo</div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {orders.map(order => {
          const balance = (order.total_amount || 0) - (order.deposit_amount || 0)
          return (
            <div key={order.id} onClick={() => onSelectOrder(order)} className={`flex items-center px-6 py-4 border-b cursor-pointer transition-colors ${isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'}`}>
              <div className="flex-1">
                <div className="font-bold text-sm mb-0.5">{order.description || 'Sin descripción'}</div>
                <div className="text-xs opacity-60 flex items-center gap-2">
                  <span>#{order.id.slice(0, 4)}</span>
                  <span>•</span>
                  <span>{order.leads?.name || 'Cliente'}</span>
                </div>
              </div>
              <div className="w-32">
                <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${getStatusColor(order.status).replace('bg-', 'bg-opacity-20 text-').replace('text-[#', 'text-gray-')}`}>
                  {order.status}
                </span>
              </div>
              <div className="w-32 text-right font-mono font-bold text-sm">
                ${order.total_amount?.toLocaleString()}
              </div>
              <div className="w-32 text-right">
                {balance <= 0
                  ? <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-md">PAGADO</span>
                  : <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded-md">-${balance.toLocaleString()}</span>
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OrderCard({ order, onClick, isDarkMode }) {
  const balance = (order.total_amount || 0) - (order.deposit_amount || 0)
  const isPaid = balance <= 0
  return (
    <div onClick={onClick} className={`p-4 rounded-2xl border shadow-sm cursor-pointer group hover:-translate-y-1 transition-all duration-200 ${isDarkMode ? 'bg-[#18181b] border-white/5 hover:border-[#E96A51]/50' : 'bg-white border-gray-100 hover:border-[#E96A51]/30 hover:shadow-md'}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-mono opacity-40">#{order.id.slice(0, 4)}</span>
        {order.status === 'URGENTE' && <span className="text-[9px] font-bold bg-amber-500/10 text-amber-500 px-1.5 rounded">URG</span>}
      </div>
      <h4 className={`text-sm font-bold leading-tight mb-3 line-clamp-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{order.description || 'Sin descripción'}</h4>
      <div className="flex justify-between items-end">
        <div className="flex items-center gap-1.5">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${isDarkMode ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {order.leads?.name?.slice(0, 1) || '?'}
          </div>
          <span className="text-xs opacity-60 truncate max-w-[80px]">{order.leads?.name?.split(' ')[0] || 'Cliente'}</span>
        </div>
        <div className="text-right">
          <div className={`text-[10px] font-bold ${isPaid ? 'text-green-500' : 'text-red-500'}`}>
            {isPaid ? 'PAGADO' : `Faltan $${balance.toLocaleString()}`}
          </div>
        </div>
      </div>
    </div>
  )
}

function ReportsView({ orders, isDarkMode }) {
  // KPI Calculations
  const totalSales = orders.reduce((acc, o) => acc + (o.total_amount || 0), 0)
  const activeOrders = orders.filter(o => ['DISEÑO', 'PRODUCCIÓN'].includes(o.status)).length
  const completedOrders = orders.filter(o => ['LISTO', 'ENTREGADO'].includes(o.status)).length
  const avgTicket = orders.length > 0 ? totalSales / orders.length : 0

  const statusData = [
    { name: 'Nuevo', value: orders.filter(o => o.status === 'NUEVO').length, color: '#E96A51' },
    { name: 'Diseño', value: orders.filter(o => o.status === 'DISEÑO').length, color: '#6338F1' },
    { name: 'Producción', value: orders.filter(o => o.status === 'PRODUCCIÓN').length, color: '#FF9F0A' },
    { name: 'Listo', value: orders.filter(o => o.status === 'LISTO').length, color: '#34C759' },
  ].filter(d => d.value > 0)

  return (
    <div className="h-full overflow-y-auto animate-in fade-in zoom-in duration-300 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KpiCard title="Ventas Totales" value={`$${totalSales.toLocaleString()}`} icon={<DollarSign size={20} />} isDarkMode={isDarkMode} />
        <KpiCard title="En Proceso" value={activeOrders} icon={<Clock size={20} />} isDarkMode={isDarkMode} />
        <KpiCard title="Completadas" value={completedOrders} icon={<CheckCircle2 size={20} />} isDarkMode={isDarkMode} />
        <KpiCard title="Ticket Promedio" value={`$${Math.round(avgTicket).toLocaleString()}`} icon={<BarChart2 size={20} />} isDarkMode={isDarkMode} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-96">
        <div className={`p-6 rounded-3xl border shadow-sm flex flex-col ${isDarkMode ? 'bg-[#121214] border-white/5' : 'bg-white border-gray-100'}`}>
          <h3 className="text-sm font-bold opacity-60 uppercase mb-4">Estado de Pedidos</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={statusData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: isDarkMode ? '#27272a' : '#fff' }} />
                <Legend verticalAlign="bottom" height={36} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`p-6 rounded-3xl border shadow-sm flex flex-col items-center justify-center text-center space-y-4 ${isDarkMode ? 'bg-[#121214] border-white/5' : 'bg-white border-gray-100'}`}>
          <div className={`p-4 rounded-full ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}><BarChart2 size={32} className="opacity-40" /></div>
          <p className="text-sm font-bold opacity-40">Gráfico de Ventas Mensuales<br />(Próximamente con más datos)</p>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ title, value, icon, isDarkMode }) {
  return (
    <div className={`p-6 rounded-3xl border shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-1 ${isDarkMode ? 'bg-[#121214] border-white/5' : 'bg-white border-gray-100'}`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-white/5 text-white' : 'bg-gray-100 text-black'}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase opacity-40">{title}</p>
        <p className="text-2xl font-black tracking-tight">{value}</p>
      </div>
    </div>
  )
}

// Helpers reused
function getStatusColor(status) {
  const colors = {
    'NUEVO': 'bg-[#E96A51]', 'DISEÑO': 'bg-[#6338F1]', 'PRODUCCIÓN': 'bg-[#FF9F0A]', 'LISTO': 'bg-[#34C759]', 'ENTREGADO': 'bg-[#8E8E93]'
  }
  return colors[status] || 'bg-gray-500'
}

// Stub components...
function OrderDrawer({ order, onClose, isDarkMode, updateOrderLocal }) {
  const [formData, setFormData] = useState({ ...order })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (JSON.stringify(formData) !== JSON.stringify(order)) {
        setSaving(true)
        const { error } = await supabase.from('orders').update(formData).eq('id', order.id)
        if (!error) {
          updateOrderLocal(formData)
          console.log("Auto-saved")
        }
        setSaving(false)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [formData])

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }))

  const neto = Math.round((formData.total_amount || 0) / 1.19)
  const iva = (formData.total_amount || 0) - neto
  const balance = (formData.total_amount || 0) - (formData.deposit_amount || 0)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-2xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ${isDarkMode ? 'bg-[#09090b] border-l border-white/5' : 'bg-white border-l'}`}>
        <div className={`h-16 flex items-center justify-between px-6 border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-black tracking-tight">Orden #{order.id.slice(0, 6)}</h2>
            {saving && <span className="text-xs text-green-500 animate-pulse">Guardando...</span>}
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg hover:bg-gray-100 ${isDarkMode ? 'hover:bg-white/10' : ''}`}><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
              <label className="text-[10px] uppercase font-black opacity-40 mb-2 block">Estado</label>
              <select value={formData.status} onChange={(e) => handleChange('status', e.target.value)} className={`w-full bg-transparent font-bold outline-none text-sm ${getStatusColor(formData.status).replace('bg-', 'text-')}`}>
                {['NUEVO', 'DISEÑO', 'PRODUCCIÓN', 'LISTO', 'ENTREGADO'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
              <label className="text-[10px] uppercase font-black opacity-40 mb-2 block">Cliente</label>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold">{order.leads?.name?.slice(0, 1)}</div>
                <div className="text-sm font-bold truncate">{order.leads?.name}</div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase opacity-40 flex items-center gap-2"><ClipboardList size={14} /> Especificaciones Técnicas</h3>
            <div className={`rounded-3xl p-6 border grid grid-cols-2 gap-6 ${isDarkMode ? 'bg-[#18181b] border-white/5' : 'bg-white border-gray-100'}`}>
              <div className="col-span-2">
                <label className="text-[11px] font-bold opacity-60 mb-1.5 block">Material / Papel</label>
                <select value={formData.material || ''} onChange={(e) => handleChange('material', e.target.value)} className={`w-full p-3 rounded-xl outline-none font-medium text-sm transition-all ${isDarkMode ? 'bg-black/20 border border-white/10 focus:border-[#E96A51]' : 'bg-gray-50 border border-gray-200 focus:border-[#E96A51]'}`}>
                  <option value="">Seleccionar Material...</option>
                  <option value="Couché 300g">Couché 300g (Tarjetas/Flyers Gruesos)</option>
                  <option value="Couché 170g">Couché 170g (Flyers Standard)</option>
                  <option value="Couché 130g">Couché 130g (Volantes Económicos)</option>
                  <option value="Bond 80g">Bond 80g (Documentos/Planos)</option>
                  <option value="Adhesivo PVC">Adhesivo PVC (Stickers/Etiquetas)</option>
                  <option value="Adhesivo Papel">Adhesivo Papel</option>
                  <option value="Tela PVC">Tela PVC (Pendones)</option>
                  <option value="Sintético">Sintético (Trovi)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold opacity-60 mb-1.5 block">Medidas</label>
                <input type="text" placeholder="Ej: 9x5.5 cm" value={formData.dimensions || ''} onChange={(e) => handleChange('dimensions', e.target.value)} className={`w-full p-3 rounded-xl outline-none font-medium text-sm ${isDarkMode ? 'bg-black/20 border border-white/10' : 'bg-gray-50 border border-gray-200'}`} />
              </div>
              <div>
                <label className="text-[11px] font-bold opacity-60 mb-1.5 block">Cantidad</label>
                <input type="number" value={formData.quantity || ''} onChange={(e) => handleChange('quantity', parseInt(e.target.value))} className={`w-full p-3 rounded-xl outline-none font-medium text-sm ${isDarkMode ? 'bg-black/20 border border-white/10' : 'bg-gray-50 border border-gray-200'}`} />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                <span className="text-[10px] font-bold opacity-60 uppercase">Color</span>
                <button onClick={() => handleChange('is_color', !formData.is_color)} className={`relative w-10 h-5 rounded-full transition-colors ${formData.is_color ? 'bg-indigo-500' : 'bg-gray-400'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${formData.is_color ? 'left-5.5' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                <span className="text-[10px] font-bold opacity-60 uppercase">Caras</span>
                <select className="bg-transparent text-xs font-bold outline-none" value={formData.print_sides || '1 Tiro'} onChange={(e) => handleChange('print_sides', e.target.value)}>
                  <option value="1 Tiro">1 Tiro</option>
                  <option value="2 T/R">2 T/R</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[11px] font-bold opacity-60 mb-1.5 block">Terminaciones</label>
                <div className="flex flex-wrap gap-2">
                  {['Corte', 'Troquelado', 'Polilaminado Mate', 'Polilaminado Brillante', 'Plegado', 'Ojetillos'].map(term => {
                    const active = formData.finishings?.includes(term)
                    return <button key={term} onClick={() => { const current = formData.finishings || []; handleChange('finishings', active ? current.filter(t => t !== term) : [...current, term]) }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${active ? 'bg-indigo-500 text-white border-indigo-500' : (isDarkMode ? 'border-white/10 hover:border-white/30' : 'border-gray-200 hover:border-gray-300')}`}>{term}</button>
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase opacity-40 flex items-center gap-2"><DollarSign size={14} /> Finanzas</h3>
            <div className={`rounded-3xl p-6 border grid grid-cols-2 gap-6 relative overflow-hidden ${isDarkMode ? 'bg-[#18181b] border-white/5' : 'bg-white border-gray-100'}`}>
              <div className="col-span-2 md:col-span-1">
                <label className="text-[11px] font-bold opacity-60 mb-1.5 block">Precio Total (IVA Inc)</label>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-50">$</span><input type="number" value={formData.total_amount || 0} onChange={(e) => handleChange('total_amount', parseInt(e.target.value))} className={`w-full pl-6 pr-3 py-2 rounded-xl font-black text-lg outline-none ${isDarkMode ? 'bg-black/20' : 'bg-gray-50'}`} /></div>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-[11px] font-bold opacity-60 mb-1.5 block">Abono</label>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-50">$</span><input type="number" value={formData.deposit_amount || 0} onChange={(e) => handleChange('deposit_amount', parseInt(e.target.value))} className={`w-full pl-6 pr-3 py-2 rounded-xl font-black text-lg outline-none ${isDarkMode ? 'bg-black/20' : 'bg-gray-50'}`} /></div>
              </div>
              <div className="col-span-2 pt-4 border-t border-dashed border-gray-200 dark:border-white/10 flex justify-between items-center">
                <div className="text-xs opacity-60 space-y-1"><div>Neto: ${neto.toLocaleString()}</div><div>IVA (19%): ${iva.toLocaleString()}</div></div>
                <div className={`text-right px-4 py-2 rounded-xl border ${balance <= 0 ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}><div className="text-[9px] font-black uppercase">Saldo Pendiente</div><div className="text-xl font-black tracking-tight">${balance.toLocaleString()}</div></div>
              </div>
            </div>
          </div>
          <div className="space-y-4 pb-20">
            <h3 className="text-xs font-black uppercase opacity-40 flex items-center gap-2"><Send size={14} /> Entrega & Archivos</h3>
            <div className={`p-4 rounded-3xl border flex items-center gap-4 ${isDarkMode ? 'bg-[#18181b] border-white/5' : 'bg-white border-gray-100'}`}>
              <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center"><FileText size={24} /></div>
              <div className="flex-1"><p className="text-xs font-bold opacity-60">Archivo de Impresión</p>{order.file_url ? (<a href={order.file_url} target="_blank" className="font-bold underline hover:text-[#E96A51] truncate block max-w-[200px]">Ver PDF Adjunto</a>) : (<span className="text-sm font-bold opacity-40 italic">No hay archivo adjunto</span>)}</div>
            </div>
          </div>
        </div>
        <div className={`p-6 border-t ${isDarkMode ? 'border-white/5 bg-[#09090b]' : 'border-gray-100 bg-white'}`}>
          <button onClick={() => alert('Función de WhatsApp Template en desarrollo')} className="w-full py-4 rounded-xl bg-[#25D366] hover:bg-[#1ebd59] text-white font-bold flex items-center justify-center gap-2 transition-all"><Send size={18} /> Enviar Aviso por WhatsApp</button>
        </div>
      </div>
    </div>
  )
}

function LeadsView({ leads, onEdit, isDarkMode, openCreate }) {
  return (
    <div className="h-full overflow-y-auto animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-end mb-6">
        <div><h1 className="text-2xl font-black tracking-tight mb-1">Mis Clientes</h1><p className="font-medium opacity-60 text-sm">Directorio de contactos ({leads.length}).</p></div>
        <button onClick={openCreate} className="bg-[#E96A51] text-white h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg hover:shadow-[#E96A51]/20 active:scale-95 transition-all"><UserPlus size={16} /> Nuevo Cliente</button>
      </div>
      <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-[#121214] border-white/5' : 'bg-white border-gray-100'}`}>
        <table className="w-full text-left">
          <thead className={`border-b ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-gray-50 bg-gray-50'}`}>
            <tr>
              <th className="px-6 py-4 text-[10px] uppercase font-black opacity-40">Cliente</th>
              <th className="px-6 py-4 text-[10px] uppercase font-black opacity-40">Contacto</th>
              <th className="px-6 py-4 text-[10px] uppercase font-black opacity-40 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-gray-100'}`}>
            {leads.map(lead => (
              <tr key={lead.id} className={`group hover:bg-gray-50 ${isDarkMode ? 'hover:bg-white/5' : ''}`}>
                <td className="px-6 py-4">
                  <div className="font-bold text-sm">{lead.name}</div>
                  <div className="text-xs opacity-60">ID: {lead.id.slice(0, 4)}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-xs font-medium"><Phone size={12} /> {lead.phone_number}</div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => onEdit(lead)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><Edit2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LeadModal({ isOpen, isCreating, form, setForm, onClose, onSubmit, isDarkMode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className={`relative w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 ${isDarkMode ? 'bg-[#18181b] text-white' : 'bg-white text-black'}`}>
        <h2 className="text-2xl font-black mb-6">{isCreating ? 'Nuevo Cliente' : 'Editar Cliente'}</h2>
        <div className="space-y-4">
          <div className="space-y-1.5"><label className="text-[10px] font-black uppercase opacity-40">Nombre</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={`w-full p-3 rounded-xl font-bold text-sm outline-none ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`} /></div>
          <div className="space-y-1.5"><label className="text-[10px] font-black uppercase opacity-40">WhatsApp</label><input type="text" value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} className={`w-full p-3 rounded-xl font-bold text-sm outline-none ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`} /></div>
        </div>
        <button onClick={onSubmit} className={`w-full py-4 mt-8 rounded-xl font-black text-xs uppercase tracking-widest ${isDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}>{isCreating ? 'Crear' : 'Guardar'}</button>
      </div>
    </div>
  )
}

export default App
