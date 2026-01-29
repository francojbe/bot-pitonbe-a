import { useState, useEffect } from 'react'
import { supabase } from './supabase'
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
  User
} from 'lucide-react'

function App() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filter, setFilter] = useState('TODOS')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ description: '', total_amount: 0 })
  const [activeTab, setActiveTab] = useState('dashboard')

  // Clientes State
  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [isEditingLead, setIsEditingLead] = useState(false)
  const [leadForm, setLeadForm] = useState({ name: '', phone_number: '', rut: '', address: '', email: '' })

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
  async function handleDeleteLead(id) {
    if (!confirm('¿Estás seguro de eliminar este cliente? Se borrarán sus datos permanentemente.')) return

    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) {
      alert('Error al eliminar: ' + error.message)
    } else {
      setLeads(leads.filter(l => l.id !== id))
      if (selectedLead?.id === id) setSelectedLead(null)
    }
  }

  async function handleLeadSubmit(e) {
    e.preventDefault()
    const { error } = await supabase
      .from('leads')
      .update(leadForm)
      .eq('id', selectedLead.id)

    if (error) {
      alert('Error al actualizar: ' + error.message)
    } else {
      setLeads(leads.map(l => l.id === selectedLead.id ? { ...l, ...leadForm } : l))
      setIsEditingLead(false)
      setSelectedLead(null)
    }
  }

  // --- ORDER ACTIONS ---
  async function updateOrderStatus(newStatus) {
    if (!selectedOrder) return
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', selectedOrder.id)

    if (error) {
      alert('Error al actualizar estado')
    } else {
      setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, status: newStatus } : o))
      setSelectedOrder({ ...selectedOrder, status: newStatus })

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'https://recuperadora-agente-pb.nojauc.easypanel.host'
        await fetch(`${apiUrl}/notify_update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: selectedOrder.id, new_status: newStatus })
        })
      } catch (err) { console.error(err) }
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    const { error } = await supabase.from('orders').update({
      description: editForm.description,
      total_amount: parseInt(editForm.total_amount)
    }).eq('id', selectedOrder.id)

    if (error) {
      alert('Error al actualizar')
    } else {
      setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, ...editForm } : o))
      setSelectedOrder({ ...selectedOrder, ...editForm })
      setIsEditing(false)
    }
  }

  async function handleDeleteOrder() {
    if (!selectedOrder || !confirm('¿Eliminar pedido?')) return
    const { error } = await supabase.from('orders').delete().eq('id', selectedOrder.id)
    if (error) alert('Error')
    else {
      setOrders(orders.filter(o => o.id !== selectedOrder.id))
      setSelectedOrder(null)
    }
  }

  const [isInvoicing, setIsInvoicing] = useState(false)
  async function generateInvoice() {
    if (!selectedOrder) return
    setIsInvoicing(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://recuperadora-agente-pb.nojauc.easypanel.host'
      const res = await fetch(`${apiUrl}/generate_invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: selectedOrder.id, new_status: selectedOrder.status })
      })
      const result = await res.json()
      alert(result.status === 'success' ? '✅ Enviada' : '❌ Error: ' + result.message)
    } catch (err) { alert('Error de conexión') }
    finally { setIsInvoicing(false) }
  }

  const statusColors = {
    'NUEVO': 'bg-[#FDF2F0] text-[#E96A51] border-[#FADCD6]',
    'DISEÑO': 'bg-[#F2EDFF] text-[#6338F1] border-[#E5DBFF]',
    'PRODUCCIÓN': 'bg-[#FFF8EC] text-[#FF9F0A] border-[#FFECCF]',
    'LISTO': 'bg-[#EBFBF2] text-[#34C759] border-[#D1F7E4]',
    'ENTREGADO': 'bg-[#F2F2F7] text-[#8E8E93] border-[#E5E5EA]'
  }

  const [viewMode, setViewMode] = useState(() => localStorage.getItem('dashboard_view_mode') || 'list')
  useEffect(() => { localStorage.setItem('dashboard_view_mode', viewMode) }, [viewMode])

  const filteredOrders = filter === 'TODOS' ? orders : orders.filter(o => o.status === filter)

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1C1C1E] font-sans">
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-100 h-20 flex items-center px-6">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-[#E96A51] w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#E96A51]/20"><Printer size={20} /></div>
            <div><span className="font-bold text-xl tracking-tight block">Pitron Beña</span><span className="text-[10px] uppercase tracking-widest text-[#8E8E93] font-bold">Workspace</span></div>
          </div>
          <div className="hidden sm:flex bg-[#F2F2F7] p-1 rounded-2xl">
            {['dashboard', 'clientes', 'reportes'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all capitalize ${activeTab === tab ? 'bg-white shadow-sm text-[#1C1C1E]' : 'text-[#8E8E93]'}`}>{tab}</button>
            ))}
          </div>
          <div className="w-10 h-10 rounded-full bg-[#F2F2F7] border-2 border-white overflow-hidden shadow-sm">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Franco" alt="avatar" />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
              <div><h1 className="text-4xl font-extrabold tracking-tight mb-2">Hola, Pitrón Beña 👋</h1><p className="text-[#8E8E93] font-medium text-lg">Tienes <span className="text-[#E96A51] font-bold">{orders.filter(o => o.status === 'NUEVO').length} pedidos</span> nuevos.</p></div>
              <div className="flex gap-3">
                <div className="flex bg-[#F2F2F7] p-1 rounded-2xl border border-[#E5E5EA]">
                  <button onClick={() => setViewMode('grid')} className={`p-2 rounded-xl ${viewMode === 'grid' ? 'bg-white shadow text-[#1C1C1E]' : 'text-[#8E8E93]'}`}><LayoutGrid size={20} /></button>
                  <button onClick={() => setViewMode('list')} className={`p-2 rounded-xl ${viewMode === 'list' ? 'bg-white shadow text-[#1C1C1E]' : 'text-[#8E8E93]'}`}><List size={20} /></button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mb-10 overflow-x-auto pb-2">
              {['TODOS', 'NUEVO', 'DISEÑO', 'PRODUCCIÓN', 'LISTO', 'ENTREGADO'].map(st => (
                <button key={st} onClick={() => setFilter(st)} className={`px-5 py-2 rounded-2xl text-[13px] font-bold border-2 ${filter === st ? 'bg-[#1C1C1E] text-white border-[#1C1C1E]' : 'bg-white text-[#8E8E93] border-[#F2F2F7]'}`}>{st}</button>
              ))}
            </div>
            {loading ? <div className="text-center py-20">Cargando...</div> : (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredOrders.map(order => (
                    <div key={order.id} onClick={() => { setSelectedOrder(order); setEditForm({ description: order.description, total_amount: order.total_amount }); setIsEditing(false); }} className="bg-white rounded-[2.5rem] border border-[#F2F2F7] shadow-sm hover:shadow-xl hover:shadow-[#E96A51]/5 transition-all p-7 cursor-pointer group hover:-translate-y-1">
                      <div className="flex justify-between mb-6"><span className={`px-4 py-1 rounded-2xl text-[11px] font-black tracking-widest uppercase border ${statusColors[order.status]}`}>{order.status}</span><span className="text-[9px] text-[#C7C7CC] font-bold">#{order.id.slice(0, 6)}</span></div>
                      <h3 className="text-xl font-bold mb-8 line-clamp-2 h-14">{order.description}</h3>
                      <div className="bg-[#F2F2F7]/50 rounded-3xl p-5 flex justify-between items-center group-hover:bg-[#E96A51]/5 transition-colors">
                        <div><span className="text-[10px] text-[#8E8E93] font-bold block">TOTAL</span><span className="text-2xl font-black">${order.total_amount?.toLocaleString()}</span></div>
                        <MoreHorizontal className="text-[#E96A51]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-[2.5rem] border border-[#F2F2F7] overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead><tr className="border-b border-[#F2F2F7]"><th className="px-8 py-6 text-[10px] font-black uppercase text-[#8E8E93]">Estado</th><th className="px-8 py-6 text-[10px] font-black uppercase text-[#8E8E93]">Descripción</th><th className="px-8 py-6 text-[10px] font-black uppercase text-[#8E8E93]">Cliente</th><th className="px-8 py-6 text-[10px] font-black uppercase text-[#8E8E93] text-right">Total</th></tr></thead>
                    <tbody className="divide-y divide-[#F2F2F7]">{filteredOrders.map(order => (
                      <tr key={order.id} onClick={() => { setSelectedOrder(order); setEditForm({ description: order.description, total_amount: order.total_amount }); setIsEditing(false); }} className="hover:bg-[#F2F2F7]/40 cursor-pointer transition-colors">
                        <td className="px-8 py-6"><span className={`px-4 py-1 rounded-2xl text-[10px] font-black border ${statusColors[order.status]}`}>{order.status}</span></td>
                        <td className="px-8 py-6"><p className="font-bold text-[15px]">{order.description}</p></td>
                        <td className="px-8 py-6 text-[#8E8E93] font-medium">{order.leads?.name || order.leads?.phone_number}</td>
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
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">Mis Clientes</h1>
            <div className="bg-white rounded-[2.5rem] border border-[#F2F2F7] overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead><tr className="border-b border-[#F2F2F7]"><th className="px-8 py-6 text-[10px] font-black uppercase text-[#8E8E93]">Cliente</th><th className="px-8 py-6 text-[10px] font-black uppercase text-[#8E8E93]">WhatsApp</th><th className="px-8 py-6 text-[10px] font-black uppercase text-[#8E8E93]">E-mail / RUT</th><th className="px-8 py-6 text-[10px] font-black uppercase text-[#8E8E93] text-right">Acciones</th></tr></thead>
                <tbody className="divide-y divide-[#F2F2F7]">{leads.map(client => (
                  <tr key={client.id} className="hover:bg-[#F2F2F7]/20 group transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#1C1C1E] text-white flex items-center justify-center font-black">{client.name?.slice(0, 1).toUpperCase()}</div>
                        <div><p className="font-bold text-[15px]">{client.name || 'Sin Nombre'}</p><p className="text-[10px] text-[#C7C7CC] font-bold">RUT: {client.rut || '---'}</p></div>
                      </div>
                    </td>
                    <td className="px-8 py-6 font-bold text-[#8E8E93]">{client.phone_number}</td>
                    <td className="px-8 py-6"><p className="text-xs font-bold">{client.email || '---'}</p></td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <a href={`https://wa.me/${client.phone_number}`} target="_blank" className="p-2 bg-[#EBFBF2] text-[#34C759] rounded-xl hover:bg-[#34C759] hover:text-white transition-all"><Phone size={14} /></a>
                        <button onClick={() => { setSelectedLead(client); setLeadForm({ name: client.name || '', phone_number: client.phone_number || '', rut: client.rut || '', address: client.address || '', email: client.email || '' }); setIsEditingLead(true); }} className="p-2 bg-[#F2EDFF] text-[#6338F1] rounded-xl hover:bg-[#6338F1] hover:text-white transition-all"><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteLead(client.id)} className="p-2 bg-[#FDF2F0] text-[#E96A51] rounded-xl hover:bg-[#E96A51] hover:text-white transition-all"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* --- EDIT LEAD MODAL --- */}
      {isEditingLead && (
        <div className="fixed inset-0 bg-[#1C1C1E]/40 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">Editar Cliente</h2>
              <button onClick={() => setIsEditingLead(false)} className="p-2 bg-[#F2F2F7] rounded-xl"><X size={20} /></button>
            </div>
            <form onSubmit={handleLeadSubmit} className="space-y-4">
              <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[#8E8E93]">Nombre Completo</label><input type="text" value={leadForm.name} onChange={e => setLeadForm({ ...leadForm, name: e.target.value })} className="w-full bg-[#F2F2F7] rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 ring-[#E96A51]/20" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[#8E8E93]">WhatsApp</label><input type="text" value={leadForm.phone_number} onChange={e => setLeadForm({ ...leadForm, phone_number: e.target.value })} className="w-full bg-[#F2F2F7] rounded-xl p-3 font-bold text-sm outline-none" /></div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[#8E8E93]">RUT</label><input type="text" value={leadForm.rut} onChange={e => setLeadForm({ ...leadForm, rut: e.target.value })} className="w-full bg-[#F2F2F7] rounded-xl p-3 font-bold text-sm outline-none" /></div>
              </div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[#8E8E93]">Email</label><input type="email" value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} className="w-full bg-[#F2F2F7] rounded-xl p-3 font-bold text-sm outline-none" /></div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase text-[#8E8E93]">Dirección</label><textarea value={leadForm.address} onChange={e => setLeadForm({ ...leadForm, address: e.target.value })} className="w-full bg-[#F2F2F7] rounded-xl p-3 font-bold text-sm outline-none h-20 resize-none" /></div>
              <button type="submit" className="w-full h-12 bg-[#1C1C1E] text-white rounded-xl font-bold mt-4 shadow-lg active:scale-95 transition-all">Guardar Cambios</button>
            </form>
          </div>
        </div>
      )}

      {/* --- ORDER MODAL (Side-by-Side iOS Style) --- */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-[#1C1C1E]/40 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in duration-300">
            <div className="px-8 py-5 flex justify-between items-center border-b border-[#F2F2F7]">
              <div className="flex gap-3"><div className="bg-[#E96A51]/10 p-2 rounded-xl text-[#E96A51]"><FileText size={20} /></div><div><h2 className="text-xl font-black">Orden #{selectedOrder.id.slice(0, 6)}</h2><p className="text-[10px] font-bold text-[#C7C7CC] uppercase">{new Date(selectedOrder.created_at).toLocaleDateString()}</p></div></div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 bg-[#F2F2F7] rounded-xl"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-[1fr,300px] gap-10">
              <div className="space-y-8">
                {isEditing ? (
                  <form onSubmit={handleEditSubmit} className="space-y-4">
                    <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="w-full p-4 bg-[#F2F2F7] rounded-2xl font-bold h-32 outline-none" />
                    <input type="number" value={editForm.total_amount} onChange={e => setEditForm({ ...editForm, total_amount: e.target.value })} className="w-full p-4 bg-[#F2F2F7] rounded-2xl font-bold outline-none" />
                    <button type="submit" className="w-full h-12 bg-[#1C1C1E] text-white rounded-xl font-bold">Actualizar</button>
                  </form>
                ) : (
                  <>
                    <div className="space-y-3"><span className="text-[10px] font-black uppercase text-[#C7C7CC]">DETALLE DEL TRABAJO</span><p className="text-lg font-bold leading-relaxed">{selectedOrder.description}</p></div>
                    <div className="bg-[#E96A51]/5 border border-[#E96A51]/10 p-6 rounded-3xl flex justify-between items-center">
                      <div><span className="text-[10px] font-black text-[#E96A51] opacity-60 uppercase">PRESUPUESTO</span><p className="text-4xl font-black text-[#E96A51] tracking-tighter">${selectedOrder.total_amount?.toLocaleString()}</p></div>
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-6">
                <div className="bg-[#F2F2F7]/50 p-6 rounded-[2rem] space-y-4">
                  <span className="text-[10px] font-black uppercase text-[#8E8E93]">ESTADO</span>
                  <div className="space-y-1.5">
                    {Object.keys(statusColors).map(s => (
                      <button key={s} onClick={() => updateOrderStatus(s)} className={`w-full p-2.5 rounded-xl text-[10px] font-black border-2 transition-all ${selectedOrder.status === s ? 'bg-[#1C1C1E] text-white border-[#1C1C1E]' : 'bg-white text-[#C7C7CC]'}`}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="bg-[#1C1C1E] text-white p-6 rounded-[2rem] space-y-4 shadow-xl">
                  <div className="flex items-center gap-2 pb-3 border-b border-white/10"><User size={14} /><h3 className="text-[10px] font-bold uppercase">FICHA CLIENTE</h3></div>
                  <div className="space-y-3">
                    <div><span className="text-[8px] font-bold text-[#8E8E93] uppercase">Nombre</span><p className="text-xs font-bold">{selectedOrder.leads?.name || '---'}</p></div>
                    <div><span className="text-[8px] font-bold text-[#8E8E93] uppercase">WhatsApp</span><p className="text-xs font-bold">{selectedOrder.leads?.phone_number}</p></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-8 border-t border-[#F2F2F7] flex gap-4">
              <button onClick={generateInvoice} disabled={isInvoicing} className="flex-1 h-14 bg-[#E96A51] text-white rounded-2xl font-black shadow-lg shadow-[#E96A51]/20 active:scale-95 transition-all text-sm uppercase">{isInvoicing ? 'Procesando...' : 'Generar Factura'}</button>
              <button onClick={() => setIsEditing(!isEditing)} className="px-8 h-14 bg-white border border-[#F2F2F7] rounded-2xl font-black text-sm uppercase">{isEditing ? 'Cancelar' : 'Editar'}</button>
              <button onClick={handleDeleteOrder} className="px-6 h-14 bg-[#FDF2F0] text-[#E96A51] rounded-2xl"><Trash2 size={20} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
