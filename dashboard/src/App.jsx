import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { Toaster, toast } from 'sonner'
import {
  ClipboardList,
  Search,
  Filter,
  Printer,
  MoreHorizontal,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  X,
  LayoutGrid,
  List,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Trash2,
  Save,
  Edit2,
  User,
  UserPlus,
  Users,
  Briefcase,
  DollarSign,
  BarChart2,
  PieChart,
  Moon,
  Sun
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart as RePieChart, Pie } from 'recharts'

function App() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filter, setFilter] = useState('TODOS')
  const [searchTerm, setSearchTerm] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ description: '', total_amount: 0 })
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  // Clientes State
  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [isEditingLead, setIsEditingLead] = useState(false)
  const [isCreatingLead, setIsCreatingLead] = useState(false)
  const [leadForm, setLeadForm] = useState({ name: '', phone_number: '', rut: '', address: '', email: '' })

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  useEffect(() => {
    fetchOrders()
    fetchLeads()

    const channelLeads = supabase
      .channel('realtime leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads()
      })
      .subscribe()

    const channelOrders = supabase
      .channel('realtime orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders()
      })
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

  // --- LEAD ACTIONS ---
  // --- LEAD ACTIONS ---
  function handleDeleteLead(id) {
    toast('¿Eliminar este cliente?', {
      description: 'Esta acción borrará sus datos y pedidos permanentemente.',
      action: {
        label: 'Eliminar',
        onClick: () => deleteLeadConfirmed(id),
      },
      cancel: {
        label: 'Cancelar',
      },
    })
  }

  async function deleteLeadConfirmed(id) {
    const promise = supabase.from('leads').delete().eq('id', id)

    toast.promise(promise, {
      loading: 'Eliminando cliente...',
      success: () => {
        setLeads(leads.filter(l => l.id !== id))
        if (selectedLead?.id === id) setSelectedLead(null)
        return 'Cliente eliminado correctamente'
      },
      error: (err) => {
        return 'Error al eliminar: ' + err.message
      }
    })
  }

  async function handleLeadSubmit(e) {
    e.preventDefault()

    if (isCreatingLead) {
      const promise = supabase.from('leads').insert([leadForm])
      toast.promise(promise, {
        loading: 'Creando cliente...',
        success: () => {
          setIsCreatingLead(false)
          setLeadForm({ name: '', phone_number: '', rut: '', address: '', email: '' })
          fetchLeads()
          return 'Cliente creado exitosamente'
        },
        error: (err) => 'Error al crear: ' + err.message
      })
    } else {
      const promise = supabase.from('leads').update(leadForm).eq('id', selectedLead.id)
      toast.promise(promise, {
        loading: 'Actualizando cliente...',
        success: () => {
          setLeads(leads.map(l => l.id === selectedLead.id ? { ...l, ...leadForm } : l))
          setIsEditingLead(false)
          setSelectedLead(null)
          return 'Cliente actualizado correctamente'
        },
        error: (err) => 'Error al actualizar: ' + err.message
      })
    }
  }

  // --- ORDER ACTIONS ---
  async function updateOrderStatus(newStatus) {
    if (!selectedOrder) return
    const promise = supabase.from('orders').update({ status: newStatus }).eq('id', selectedOrder.id)

    toast.promise(promise, {
      loading: 'Actualizando estado...',
      success: () => {
        setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, status: newStatus } : o))
        setSelectedOrder({ ...selectedOrder, status: newStatus })

        // Trigger notification silently or with a separate toast
        const apiUrl = import.meta.env.VITE_API_URL || 'https://recuperadora-agente-pb.nojauc.easypanel.host'
        fetch(`${apiUrl}/notify_update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: selectedOrder.id, new_status: newStatus })
        }).catch(console.error)

        return `Estado actualizado a ${newStatus}`
      },
      error: 'Error al actualizar estado'
    })
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    const promise = supabase.from('orders').update({
      description: editForm.description,
      total_amount: parseInt(editForm.total_amount)
    }).eq('id', selectedOrder.id)

    toast.promise(promise, {
      loading: 'Guardando cambios...',
      success: () => {
        setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, ...editForm } : o))
        setSelectedOrder({ ...selectedOrder, ...editForm })
        setIsEditing(false)
        return 'Orden actualizada'
      },
      error: 'Error al actualizar'
    })
  }

  function handleDeleteOrder() {
    if (!selectedOrder) return
    toast('¿Eliminar este pedido?', {
      description: 'Esta acción no se puede deshacer.',
      action: {
        label: 'Eliminar',
        onClick: () => deleteOrderConfirmed(),
      },
      cancel: {
        label: 'Cancelar',
      },
    })
  }

  async function deleteOrderConfirmed() {
    const promise = supabase.from('orders').delete().eq('id', selectedOrder.id)

    toast.promise(promise, {
      loading: 'Eliminando pedido...',
      success: () => {
        setOrders(orders.filter(o => o.id !== selectedOrder.id))
        setSelectedOrder(null)
        return 'Pedido eliminado'
      },
      error: 'Error al eliminar pedido'
    })
  }

  const [isInvoicing, setIsInvoicing] = useState(false)
  async function generateInvoice() {
    if (!selectedOrder) return
    setIsInvoicing(true)

    const promise = (async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://recuperadora-agente-pb.nojauc.easypanel.host'
      const res = await fetch(`${apiUrl}/generate_invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: selectedOrder.id, new_status: selectedOrder.status })
      })
      const result = await res.json()
      if (result.status !== 'success') throw new Error(result.message)
      return result
    })()

    toast.promise(promise, {
      loading: 'Generando factura...',
      success: 'Factura enviada exitosamente',
      error: (err) => 'Error: ' + err.message,
      finally: () => setIsInvoicing(false)
    })
  }

  const statusColors = {
    'NUEVO': 'bg-[#FDF2F0] text-[#E96A51] border-[#FADCD6] dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30',
    'DISEÑO': 'bg-[#F2EDFF] text-[#6338F1] border-[#E5DBFF] dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/30',
    'PRODUCCIÓN': 'bg-[#FFF8EC] text-[#FF9F0A] border-[#FFECCF] dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-900/30',
    'LISTO': 'bg-[#EBFBF2] text-[#34C759] border-[#D1F7E4] dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/30',
    'ENTREGADO': 'bg-[#F2F2F7] text-[#8E8E93] border-[#E5E5EA] dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
  }

  const [viewMode, setViewMode] = useState(() => localStorage.getItem('dashboard_view_mode') || 'list')
  useEffect(() => { localStorage.setItem('dashboard_view_mode', viewMode) }, [viewMode])


  // --- FILTERS & SEARCH ---
  const filteredOrders = orders.filter(o => {
    const matchesStatus = filter === 'TODOS' ? true : o.status === filter
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = o.description?.toLowerCase().includes(searchLower) ||
      o.leads?.name?.toLowerCase().includes(searchLower) ||
      o.id?.toLowerCase().includes(searchLower)
    return matchesStatus && matchesSearch
  })

  // --- KPI CALCULATIONS ---
  const kpiSales = orders.filter(o => o.status === 'LISTO' || o.status === 'ENTREGADO').reduce((acc, o) => acc + (o.total_amount || 0), 0)
  const kpiActive = orders.filter(o => o.status === 'DISEÑO' || o.status === 'PRODUCCIÓN').length
  const kpiAvgTicket = orders.length > 0 ? (orders.reduce((acc, o) => acc + (o.total_amount || 0), 0) / orders.length) : 0
  const kpiNewLeads = leads.filter(l => {
    const today = new Date().toDateString()
    return new Date(l.created_at).toDateString() === today
  }).length

  // --- CHARTS DATA ---
  const ordersByStatus = Object.keys(statusColors).map(status => ({
    name: status,
    value: orders.filter(o => o.status === status).length,
    color: status === 'NUEVO' ? '#E96A51' : status === 'DISEÑO' ? '#6338F1' : status === 'PRODUCCIÓN' ? '#FF9F0A' : status === 'LISTO' ? '#34C759' : '#8E8E93'
  })).filter(d => d.value > 0)


  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${isDarkMode ? 'bg-[#09090b] text-[#FAFAFA]' : 'bg-[#FDFDFD] text-[#1C1C1E]'}`}>
      <Toaster position="top-center" richColors theme={isDarkMode ? 'dark' : 'light'} />
      <nav className={`sticky top-0 z-40 border-b h-20 flex items-center px-6 backdrop-blur-md transition-colors ${isDarkMode ? 'bg-[#09090b]/80 border-white/5' : 'bg-white/80 border-gray-100'}`}>
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-[#E96A51] w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#E96A51]/20"><Printer size={20} /></div>
            <div><span className="font-bold text-xl tracking-tight block">Pitron Beña</span><span className="text-[10px] uppercase tracking-widest font-bold opacity-60">Workspace</span></div>
          </div>
          <div className={`hidden sm:flex p-1 rounded-2xl ${isDarkMode ? 'bg-white/5' : 'bg-[#F2F2F7]'}`}>
            {['dashboard', 'clientes', 'reportes'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all capitalize ${activeTab === tab ? (isDarkMode ? 'bg-[#27272a] shadow text-white' : 'bg-white shadow text-[#1C1C1E]') : 'opacity-60 hover:opacity-100'}`}>{tab}</button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-white/10 text-yellow-300 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden shadow-sm">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Franco" alt="avatar" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 pb-32 sm:pb-10">
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
              <div><h1 className="text-4xl font-extrabold tracking-tight mb-2">Hola, Pitrón Beña 👋</h1><p className="font-medium text-lg opacity-60">Tienes <span className="text-[#E96A51] font-bold">{orders.filter(o => o.status === 'NUEVO').length} pedidos</span> nuevos.</p></div>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar pedido..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`pl-10 pr-4 py-2.5 rounded-2xl text-sm font-bold w-full md:w-64 outline-none focus:ring-2 ring-[#E96A51]/20 transition-all placeholder:opacity-40 ${isDarkMode ? 'bg-white/5 focus:bg-white/10' : 'bg-[#F2F2F7] focus:bg-white'}`}
                  />
                </div>
                <div className={`flex p-1 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-[#F2F2F7] border-[#E5E5EA]'}`}>
                  <button onClick={() => setViewMode('grid')} className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? (isDarkMode ? 'bg-[#27272a] shadow' : 'bg-white shadow') : 'opacity-40'}`}><LayoutGrid size={20} /></button>
                  <button onClick={() => setViewMode('list')} className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? (isDarkMode ? 'bg-[#27272a] shadow' : 'bg-white shadow') : 'opacity-40'}`}><List size={20} /></button>
                </div>
              </div>
            </div>

            {/* --- KPI CARDS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <div className={`p-6 rounded-[2rem] border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-[#18181b] border-white/5' : 'bg-white border-[#F2F2F7]'}`}>
                <div><span className="text-[10px] font-black opacity-40 uppercase block mb-1">Ventas Totales</span><p className="text-2xl font-black">${kpiSales.toLocaleString()}</p></div>
                <div className="bg-[#E96A51]/10 p-3 rounded-2xl text-[#E96A51]"><DollarSign size={20} /></div>
              </div>
              <div className={`p-6 rounded-[2rem] border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-[#18181b] border-white/5' : 'bg-white border-[#F2F2F7]'}`}>
                <div><span className="text-[10px] font-black opacity-40 uppercase block mb-1">Órdenes Activas</span><p className="text-2xl font-black">{kpiActive}</p></div>
                <div className={`p-3 rounded-2xl text-[#6338F1] ${isDarkMode ? 'bg-purple-900/20' : 'bg-[#F2EDFF]'}`}><Briefcase size={20} /></div>
              </div>
              <div className={`p-6 rounded-[2rem] border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-[#18181b] border-white/5' : 'bg-white border-[#F2F2F7]'}`}>
                <div><span className="text-[10px] font-black opacity-40 uppercase block mb-1">Ticket Promedio</span><p className="text-2xl font-black">${Math.round(kpiAvgTicket).toLocaleString()}</p></div>
                <div className={`p-3 rounded-2xl text-[#34C759] ${isDarkMode ? 'bg-green-900/20' : 'bg-[#EBFBF2]'}`}><CreditCard size={20} /></div>
              </div>
              <div className={`p-6 rounded-[2rem] border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-[#18181b] border-white/5' : 'bg-white border-[#F2F2F7]'}`}>
                <div><span className="text-[10px] font-black opacity-40 uppercase block mb-1">Nuevos Leads (24h)</span><p className="text-2xl font-black">{kpiNewLeads}</p></div>
                <div className={`p-3 rounded-2xl text-[#FF9F0A] ${isDarkMode ? 'bg-orange-900/20' : 'bg-[#FFF8EC]'}`}><Users size={20} /></div>
              </div>
            </div>

            <div className="flex gap-2 mb-10 overflow-x-auto pb-2">
              {['TODOS', 'NUEVO', 'DISEÑO', 'PRODUCCIÓN', 'LISTO', 'ENTREGADO'].map(st => (
                <button key={st} onClick={() => setFilter(st)} className={`px-5 py-2 rounded-2xl text-[13px] font-bold border-2 transition-all ${filter === st ? (isDarkMode ? 'bg-white text-black border-white' : 'bg-[#1C1C1E] text-white border-[#1C1C1E]') : (isDarkMode ? 'bg-transparent border-white/10 hover:border-white/30 text-zinc-400' : 'bg-white text-[#8E8E93] border-[#F2F2F7]')}`}>{st}</button>
              ))}
            </div>
            {loading ? <div className="text-center py-20 opacity-50">Cargando...</div> : (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredOrders.map(order => (
                    <div key={order.id} onClick={() => { setSelectedOrder(order); setEditForm({ description: order.description, total_amount: order.total_amount }); setIsEditing(false); }} className={`rounded-[2.5rem] border shadow-sm hover:shadow-xl transition-all p-7 cursor-pointer group hover:-translate-y-1 ${isDarkMode ? 'bg-[#18181b] border-white/5 hover:shadow-orange-500/5' : 'bg-white border-[#F2F2F7] hover:shadow-[#E96A51]/5'}`}>
                      <div className="flex justify-between mb-6"><span className={`px-4 py-1 rounded-2xl text-[11px] font-black tracking-widest uppercase border ${statusColors[order.status]}`}>{order.status}</span><span className="text-[9px] font-bold opacity-30">#{order.id.slice(0, 6)}</span></div>
                      <h3 className="text-xl font-bold mb-8 line-clamp-2 h-14">{order.description}</h3>
                      <div className={`rounded-3xl p-5 flex justify-between items-center transition-colors ${isDarkMode ? 'bg-white/5 group-hover:bg-white/10' : 'bg-[#F2F2F7]/50 group-hover:bg-[#E96A51]/5'}`}>
                        <div><span className="text-[10px] font-bold block opacity-40">TOTAL</span><span className="text-2xl font-black">${order.total_amount?.toLocaleString()}</span></div>
                        <MoreHorizontal className="text-[#E96A51]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`rounded-[2.5rem] border overflow-hidden shadow-sm ${isDarkMode ? 'bg-[#18181b] border-white/5' : 'bg-white border-[#F2F2F7]'}`}>
                  <table className="w-full text-left">
                    <thead><tr className={`border-b ${isDarkMode ? 'border-white/5' : 'border-[#F2F2F7]'}`}><th className="px-8 py-6 text-[10px] font-black uppercase opacity-40">Estado</th><th className="px-8 py-6 text-[10px] font-black uppercase opacity-40">Descripción</th><th className="px-8 py-6 text-[10px] font-black uppercase opacity-40">Cliente</th><th className="px-8 py-6 text-[10px] font-black uppercase opacity-40 text-right">Total</th></tr></thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-[#F2F2F7]'}`}>{filteredOrders.map(order => (
                      <tr key={order.id} onClick={() => { setSelectedOrder(order); setEditForm({ description: order.description, total_amount: order.total_amount }); setIsEditing(false); }} className={`cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-[#F2F2F7]/40'}`}>
                        <td className="px-8 py-6"><span className={`px-4 py-1 rounded-2xl text-[10px] font-black border ${statusColors[order.status]}`}>{order.status}</span></td>
                        <td className="px-8 py-6"><p className="font-bold text-[15px]">{order.description}</p></td>
                        <td className="px-8 py-6 font-medium opacity-60">{order.leads?.name || order.leads?.phone_number}</td>
                        <td className="px-8 py-6 text-right font-black text-lg">${order.total_amount?.toLocaleString()}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}

        {/* --- CLIENTES TAB --- */}
        {activeTab === 'clientes' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="flex justify-between items-end">
              <div><h1 className="text-4xl font-extrabold tracking-tight mb-2">Mis Clientes</h1><p className="font-medium text-lg opacity-60">Directorio de contactos ({leads.length}).</p></div>
              <button
                onClick={() => { setLeadForm({ name: '', phone_number: '', rut: '', address: '', email: '' }); setIsCreatingLead(true); }}
                className="bg-[#E96A51] text-white h-12 px-6 rounded-2xl text-sm font-bold flex items-center gap-2 shadow-xl shadow-[#E96A51]/20 active:scale-95 transition-all"
              >
                <UserPlus size={18} /> Nuevo Cliente
              </button>
            </div>
            {/* --- CLIENT LIST - SAAS CLEAN LOOK --- */}
            <div className={`rounded-xl border shadow-sm transition-all overflow-hidden ${isDarkMode ? 'bg-[#18181b] border-white/5 shadow-none' : 'bg-white border-gray-100 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]'}`}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-gray-100 bg-gray-50/50'}`}>
                    <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Cliente</th>
                    <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>WhatsApp</th>
                    <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Detalles</th>
                    <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider text-right ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Acciones</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-gray-100'}`}>
                  {leads.map(client => {
                    // Logic for pastel avatars
                    const colors = [
                      'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
                      'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
                      'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
                      'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
                      'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
                      'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-300'
                    ]
                    const colorIndex = (client.name?.charCodeAt(0) || 0) % colors.length
                    const avatarColor = colors[colorIndex]

                    // Logic for nice phone format (+56 9 XXXX XXXX)
                    const rawPhone = client.phone_number?.replace(/\D/g, '') || ''
                    const formattedPhone = rawPhone.length > 8
                      ? `+${rawPhone.slice(0, 2)} ${rawPhone.slice(2, 3)} ${rawPhone.slice(3, 7)} ${rawPhone.slice(7)}`
                      : client.phone_number

                    return (
                      <tr key={client.id} className={`group transition-colors ${isDarkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'}`}>
                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${avatarColor}`}>
                              {client.name?.slice(0, 1).toUpperCase() || <User size={16} />}
                            </div>
                            <div>
                              <p className={`font-medium text-sm ${isDarkMode ? 'text-zinc-100' : 'text-gray-900'}`}>{client.name || 'Sin Nombre'}</p>
                              <p className={`text-xs ${isDarkMode ? 'text-zinc-500' : 'text-gray-400'}`}>ID: {client.id?.slice(0, 4)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-full ${isDarkMode ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600'}`}>
                              <Phone size={12} strokeWidth={2.5} />
                            </div>
                            <span className={`text-sm font-medium ${isDarkMode ? 'text-zinc-300' : 'text-gray-600'}`}>{formattedPhone}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs uppercase font-semibold tracking-wider ${isDarkMode ? 'text-zinc-600' : 'text-gray-400'}`}>EMAIL</span>
                              <span className={`text-xs ${client.email ? (isDarkMode ? 'text-zinc-300' : 'text-gray-600') : (isDarkMode ? 'text-zinc-700' : 'text-gray-300 italic')}`}>
                                {client.email || 'No registrado'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs uppercase font-semibold tracking-wider ${isDarkMode ? 'text-zinc-600' : 'text-gray-400'}`}>RUT</span>
                              <span className={`text-xs ${client.rut ? (isDarkMode ? 'text-zinc-300' : 'text-gray-600') : (isDarkMode ? 'text-zinc-700' : 'text-gray-300 italic')}`}>
                                {client.rut || 'No registrado'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-middle text-right">
                          <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <a
                              href={`https://wa.me/${client.phone_number}`}
                              target="_blank"
                              title="Abrir WhatsApp"
                              className={`p-2 rounded-lg transition-all ${isDarkMode ? 'hover:bg-green-500/10 text-zinc-400 hover:text-green-400' : 'hover:bg-green-50 text-gray-400 hover:text-green-600'}`}
                            >
                              <Phone size={16} />
                            </a>
                            <button
                              onClick={() => { setSelectedLead(client); setLeadForm({ name: client.name || '', phone_number: client.phone_number || '', rut: client.rut || '', address: client.address || '', email: client.email || '' }); setIsEditingLead(true); }}
                              title="Editar Cliente"
                              className={`p-2 rounded-lg transition-all ${isDarkMode ? 'hover:bg-blue-500/10 text-zinc-400 hover:text-blue-400' : 'hover:bg-blue-50 text-gray-400 hover:text-blue-600'}`}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteLead(client.id)}
                              title="Eliminar Cliente"
                              className={`p-2 rounded-lg transition-all ${isDarkMode ? 'hover:bg-red-500/10 text-zinc-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-600'}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- REPORTES TAB --- */}
        {activeTab === 'reportes' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">Reportes</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className={`p-8 rounded-[2.5rem] border shadow-sm ${isDarkMode ? 'bg-[#18181b] border-white/5' : 'bg-white border-[#F2F2F7]'}`}>
                <h3 className="text-lg font-black mb-6 flex items-center gap-2"><PieChart size={20} className="text-[#6338F1]" /> Distribución de Estados</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie data={ordersByStatus} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {ordersByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: isDarkMode ? '#27272a' : '#fff' }}
                        itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-4 justify-center mt-4">
                  {ordersByStatus.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                      <span className="text-xs font-bold opacity-60">{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`p-8 rounded-[2.5rem] border shadow-sm flex flex-col items-center justify-center text-center space-y-4 ${isDarkMode ? 'bg-[#18181b] border-white/5' : 'bg-white border-[#F2F2F7]'}`}>
                <div className={`p-6 rounded-full ${isDarkMode ? 'bg-white/5' : 'bg-[#F2F2F7] text-[#C7C7CC]'}`}><BarChart2 size={40} className="opacity-40" /></div>
                <h3 className="text-lg font-black opacity-40">Próximamente</h3>
                <p className="text-sm font-medium opacity-40 max-w-xs">Estamos recopilando más datos históricos para generar el gráfico de evolución de ventas.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- MOBILE TAB BAR --- */}
      <div className={`sm:hidden fixed bottom-0 left-0 right-0 h-20 border-t flex justify-around items-center px-6 z-50 backdrop-blur-xl ${isDarkMode ? 'bg-[#09090b]/90 border-white/10' : 'bg-white/90 border-gray-200'}`}>
        {['dashboard', 'clientes', 'reportes'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center gap-1 transition-all ${activeTab === tab ? 'text-[#E96A51] scale-110' : 'opacity-40 text-current'}`}>
            {tab === 'dashboard' && <LayoutGrid size={24} strokeWidth={2.5} />}
            {tab === 'clientes' && <Users size={24} strokeWidth={2.5} />}
            {tab === 'reportes' && <PieChart size={24} strokeWidth={2.5} />}
            <span className="text-[9px] font-black tracking-wide capitalize">{tab}</span>
          </button>
        ))}
      </div>


      {/* --- CREATE/EDIT LEAD MODAL --- */}
      {(isCreatingLead || isEditingLead) && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-300 ${isDarkMode ? 'bg-[#18181b] text-white' : 'bg-white text-[#1C1C1E]'}`}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">{isCreatingLead ? 'Nuevo Cliente' : 'Editar Cliente'}</h2>
              <button onClick={() => { setIsCreatingLead(false); setIsEditingLead(false); }} className={`p-2 rounded-xl ${isDarkMode ? 'bg-white/10' : 'bg-[#F2F2F7]'}`}><X size={20} /></button>
            </div>
            <form onSubmit={handleLeadSubmit} className="space-y-4">
              {/* Inputs con soporte Dark Mode */}
              <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-40">Nombre Completo</label><input type="text" required value={leadForm.name} onChange={e => setLeadForm({ ...leadForm, name: e.target.value })} className={`w-full rounded-xl p-3 font-bold text-sm outline-none px-4 ${isDarkMode ? 'bg-white/5 focus:bg-white/10' : 'bg-[#F2F2F7] focus:bg-white'}`} placeholder="Ej: Juan Pérez" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-40">WhatsApp</label><input type="text" required value={leadForm.phone_number} onChange={e => setLeadForm({ ...leadForm, phone_number: e.target.value })} className={`w-full rounded-xl p-3 font-bold text-sm outline-none px-4 ${isDarkMode ? 'bg-white/5 focus:bg-white/10' : 'bg-[#F2F2F7] focus:bg-white'}`} placeholder="569..." /></div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-40">RUT</label><input type="text" value={leadForm.rut} onChange={e => setLeadForm({ ...leadForm, rut: e.target.value })} className={`w-full rounded-xl p-3 font-bold text-sm outline-none px-4 ${isDarkMode ? 'bg-white/5 focus:bg-white/10' : 'bg-[#F2F2F7] focus:bg-white'}`} placeholder="12.345.678-9" /></div>
              </div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-40">Email</label><input type="email" value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} className={`w-full rounded-xl p-3 font-bold text-sm outline-none px-4 ${isDarkMode ? 'bg-white/5 focus:bg-white/10' : 'bg-[#F2F2F7] focus:bg-white'}`} placeholder="correo@ejemplo.com" /></div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase opacity-40">Dirección</label><textarea value={leadForm.address} onChange={e => setLeadForm({ ...leadForm, address: e.target.value })} className={`w-full rounded-xl p-4 font-bold text-sm outline-none h-24 resize-none px-4 ${isDarkMode ? 'bg-white/5 focus:bg-white/10' : 'bg-[#F2F2F7] focus:bg-white'}`} placeholder="Calle Ejemplo 123, Comuna" /></div>
              <button type="submit" className={`w-full h-12 rounded-xl font-bold mt-4 shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs ${isDarkMode ? 'bg-white text-black' : 'bg-[#1C1C1E] text-white'}`}>
                {isCreatingLead ? 'Crear Cliente' : 'Guardar Cambios'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- ORDER MODAL --- */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in duration-300 ${isDarkMode ? 'bg-[#18181b] text-white' : 'bg-white text-[#1C1C1E]'}`}>
            <div className={`px-8 py-5 flex justify-between items-center border-b ${isDarkMode ? 'border-white/5' : 'border-[#F2F2F7]'}`}>
              <div className="flex gap-3"><div className="bg-[#E96A51]/10 p-2 rounded-xl text-[#E96A51]"><FileText size={20} /></div><div><h2 className="text-xl font-black">Orden #{selectedOrder.id.slice(0, 6)}</h2><p className="text-[10px] font-bold opacity-40 uppercase">{new Date(selectedOrder.created_at).toLocaleDateString()}</p></div></div>
              <button onClick={() => setSelectedOrder(null)} className={`p-2 rounded-xl ${isDarkMode ? 'bg-white/10' : 'bg-[#F2F2F7]'}`}><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-[1fr,300px] gap-10">
              <div className="space-y-8">
                {isEditing ? (
                  <form onSubmit={handleEditSubmit} className="space-y-4">
                    <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className={`w-full p-4 rounded-2xl font-bold h-32 outline-none ${isDarkMode ? 'bg-white/5' : 'bg-[#F2F2F7]'}`} />
                    <input type="number" value={editForm.total_amount} onChange={e => setEditForm({ ...editForm, total_amount: e.target.value })} className={`w-full p-4 rounded-2xl font-bold outline-none ${isDarkMode ? 'bg-white/5' : 'bg-[#F2F2F7]'}`} />
                    <button type="submit" className={`w-full h-12 rounded-xl font-bold ${isDarkMode ? 'bg-white text-black' : 'bg-[#1C1C1E] text-white'}`}>Actualizar</button>
                  </form>
                ) : (
                  <>
                    <div className="space-y-3"><span className="text-[10px] font-black uppercase opacity-40">DETALLE DEL TRABAJO</span><p className="text-lg font-bold leading-relaxed">{selectedOrder.description}</p></div>
                    <div className="bg-[#E96A51]/5 border border-[#E96A51]/10 p-6 rounded-3xl flex justify-between items-center">
                      <div><span className="text-[10px] font-black text-[#E96A51] opacity-60 uppercase">PRESUPUESTO</span><p className="text-4xl font-black text-[#E96A51] tracking-tighter">${selectedOrder.total_amount?.toLocaleString()}</p></div>
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-6">
                <div className={`p-6 rounded-[2rem] space-y-4 ${isDarkMode ? 'bg-white/5' : 'bg-[#F2F2F7]/50'}`}>
                  <span className="text-[10px] font-black uppercase opacity-40">ESTADO</span>
                  <div className="space-y-1.5">
                    {Object.keys(statusColors).map(s => (
                      <button key={s} onClick={() => updateOrderStatus(s)} className={`w-full p-2.5 rounded-xl text-[10px] font-black border-2 transition-all ${selectedOrder.status === s ? (isDarkMode ? 'bg-white text-black border-white' : 'bg-[#1C1C1E] text-white border-[#1C1C1E]') : (isDarkMode ? 'bg-transparent text-gray-400 border-transparent hover:border-white/20' : 'bg-white text-[#C7C7CC]')}`}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className={`p-6 rounded-[2rem] space-y-4 shadow-xl ${isDarkMode ? 'bg-white text-black' : 'bg-[#1C1C1E] text-white'}`}>
                  <div className={`flex items-center gap-2 pb-3 border-b ${isDarkMode ? 'border-black/10' : 'border-white/10'}`}><User size={14} /><h3 className="text-[10px] font-bold uppercase">FICHA CLIENTE</h3></div>
                  <div className="space-y-3">
                    <div><span className="text-[8px] font-bold opacity-40 uppercase">Nombre</span><p className="text-xs font-bold">{selectedOrder.leads?.name || '---'}</p></div>
                    <div><span className="text-[8px] font-bold opacity-40 uppercase">WhatsApp</span><p className="text-xs font-bold">{selectedOrder.leads?.phone_number}</p></div>
                  </div>
                </div>
              </div>
            </div>
            <div className={`p-8 border-t flex gap-4 ${isDarkMode ? 'border-white/5' : 'border-[#F2F2F7]'}`}>
              <button onClick={generateInvoice} disabled={isInvoicing} className="flex-1 h-14 bg-[#E96A51] text-white rounded-2xl font-black shadow-lg shadow-[#E96A51]/20 active:scale-95 transition-all text-sm uppercase">{isInvoicing ? 'Procesando...' : 'Generar Factura'}</button>
              <button onClick={() => setIsEditing(!isEditing)} className={`px-8 h-14 border rounded-2xl font-black text-sm uppercase ${isDarkMode ? 'bg-transparent border-white/20 hover:bg-white/5' : 'bg-white border-[#F2F2F7]'}`}>{isEditing ? 'Cancelar' : 'Editar'}</button>
              <button onClick={handleDeleteOrder} className={`px-6 h-14 rounded-2xl ${isDarkMode ? 'bg-red-900/20 text-red-400' : 'bg-[#FDF2F0] text-[#E96A51]'}`}><Trash2 size={20} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
