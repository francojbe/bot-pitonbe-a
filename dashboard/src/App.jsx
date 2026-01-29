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
  Edit2
} from 'lucide-react'

function App() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filter, setFilter] = useState('TODOS')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ description: '', total_amount: 0 })

  useEffect(() => {
    fetchOrders()

    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel('realtime orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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

  async function updateOrderStatus(newStatus) {
    if (!selectedOrder) return

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', selectedOrder.id)

    if (error) {
      console.error('Error updating status:', error)
      alert('Error al actualizar el estado')
    } else {
      // 1. Actualizar estado local
      setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, status: newStatus } : o))
      setSelectedOrder({ ...selectedOrder, status: newStatus })

      // 2. Notificar al Cliente por WhatsApp (Backend)
      try {
        // Usar variable de entorno o el dominio final de producción
        const apiUrl = import.meta.env.VITE_API_URL || 'https://recuperadora-agente-pb.nojauc.easypanel.host'

        await fetch(`${apiUrl}/notify_update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: selectedOrder.id,
            new_status: newStatus
          })
        })
        // Opcional: Mostrar toast de "Notificación Enviada"
        console.log('Notificación de cambio de estado enviada.')
      } catch (err) {
        console.error('Error enviando notificación:', err)
      }
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    if (!selectedOrder) return

    const { error } = await supabase
      .from('orders')
      .update({
        description: editForm.description,
        total_amount: parseInt(editForm.total_amount)
      })
      .eq('id', selectedOrder.id)

    if (error) {
      console.error('Error updating order:', error)
      alert('Error al actualizar el pedido')
    } else {
      setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, ...editForm } : o))
      setSelectedOrder({ ...selectedOrder, ...editForm })
      setIsEditing(false)
    }
  }

  async function handleDeleteOrder() {
    if (!selectedOrder) return
    if (!confirm('¿Estás seguro de que deseas eliminar este pedido? Esta acción no se puede deshacer.')) return

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', selectedOrder.id)

    if (error) {
      console.error('Error deleting order:', error)
      alert('Error al eliminar el pedido')
    } else {
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
      const response = await fetch(`${apiUrl}/generate_invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: selectedOrder.id, new_status: selectedOrder.status })
      })

      const result = await response.json()
      if (result.status === 'success') {
        alert('✅ Factura generada y enviada por WhatsApp con éxito.')
      } else {
        alert('❌ Error: ' + result.message)
      }
    } catch (err) {
      console.error('Error generating invoice:', err)
      alert('Error al conectar con la API de facturación.')
    } finally {
      setIsInvoicing(false)
    }
  }

  const statusColors = {
    'NUEVO': 'bg-[#FDF2F0] text-[#E96A51] border-[#FADCD6]',
    'DISEÑO': 'bg-[#F2EDFF] text-[#6338F1] border-[#E5DBFF]',
    'PRODUCCIÓN': 'bg-[#FFF8EC] text-[#FF9F0A] border-[#FFECCF]',
    'LISTO': 'bg-[#EBFBF2] text-[#34C759] border-[#D1F7E4]',
    'ENTREGADO': 'bg-[#F2F2F7] text-[#8E8E93] border-[#E5E5EA]'
  }

  // Estado de vista con persistencia
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('dashboard_view_mode') || 'list'
  })

  // Guardar preferencia de vista cuando cambie
  useEffect(() => {
    localStorage.setItem('dashboard_view_mode', viewMode)
  }, [viewMode])

  const filteredOrders = filter === 'TODOS'
    ? orders
    : orders.filter(o => o.status === filter)

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1C1C1E] font-sans selection:bg-[#E96A51]/20">
      {/* Navbar Minimalista */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-[#E96A51] w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#E96A51]/20">
              <Printer size={20} weight="bold" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight block leading-tight">Pitron Beña</span>
              <span className="text-[10px] uppercase tracking-widest text-[#8E8E93] font-bold">Workspace App</span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1 bg-[#F2F2F7] p-1 rounded-2xl">
            <button className="px-4 py-1.5 rounded-xl text-xs font-bold bg-white shadow-sm text-[#1C1C1E]">Dashboard</button>
            <button className="px-4 py-1.5 rounded-xl text-xs font-bold text-[#8E8E93] hover:text-[#1C1C1E]">Leads</button>
            <button className="px-4 py-1.5 rounded-xl text-xs font-bold text-[#8E8E93] hover:text-[#1C1C1E]">Reportes</button>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#F2F2F7] border-2 border-white overflow-hidden shadow-sm">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Franco" alt="avatar" />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10 scale-[0.98] sm:scale-100 origin-top transition-transform">

        {/* iOS Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">Hola, Pitrón Beña 👋</h1>
            <p className="text-[#8E8E93] font-medium text-lg">Tienes <span className="text-[#E96A51] font-bold">{orders.filter(o => o.status === 'NUEVO').length} pedidos nuevos</span> esperando revisión.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-[#F2F2F7] p-1 rounded-2xl border border-[#E5E5EA]">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white shadow-lg text-[#1C1C1E]' : 'text-[#8E8E93] hover:text-[#1C1C1E]'}`}
              >
                <LayoutGrid size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white shadow-lg text-[#1C1C1E]' : 'text-[#8E8E93] hover:text-[#1C1C1E]'}`}
              >
                <List size={20} />
              </button>
            </div>

            <button className="bg-[#E96A51] text-white h-[46px] px-6 rounded-2xl text-sm font-bold hover:bg-[#D55F49] transition-all shadow-xl shadow-[#E96A51]/30 flex items-center gap-2 active:scale-95">
              <ClipboardList size={18} /> Nuevo Trabajo
            </button>
          </div>
        </div>

        {/* Filters - Pill Style */}
        <div className="flex gap-2 mb-10 overflow-x-auto pb-4 scrollbar-hide">
          {['TODOS', 'NUEVO', 'DISEÑO', 'PRODUCCIÓN', 'LISTO', 'ENTREGADO'].map(st => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-5 py-2.5 rounded-2xl text-[13px] font-bold transition-all whitespace-nowrap border-2
                ${filter === st
                  ? 'bg-[#1C1C1E] text-white border-[#1C1C1E] shadow-xl'
                  : 'bg-white text-[#8E8E93] border-[#F2F2F7] hover:border-[#8E8E93]/20 hover:text-[#1C1C1E]'}`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Cargando pedidos...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-500">No hay pedidos en esta categoría.</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* iOS CARDS (Bento Style) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredOrders.map(order => (
              <div
                key={order.id}
                onClick={() => {
                  setSelectedOrder(order)
                  setEditForm({ description: order.description, total_amount: order.total_amount })
                  setIsEditing(false)
                }}
                className="bg-white rounded-[2.5rem] border border-[#F2F2F7] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_60px_-15px_rgba(233,106,81,0.1)] transition-all duration-500 cursor-pointer overflow-hidden group hover:-translate-y-2 p-1"
              >
                <div className="p-7">
                  <div className="flex justify-between items-start mb-6">
                    <span className={`px-4 py-1 rounded-2xl text-[11px] font-black tracking-widest uppercase border ${statusColors[order.status]}`}>
                      {order.status}
                    </span>
                    <span className="text-[10px] text-[#C7C7CC] font-bold tracking-tighter uppercase">ID · {order.id.slice(0, 8)}</span>
                  </div>

                  <h3 className="text-xl font-bold text-[#1C1C1E] mb-2 leading-snug line-clamp-2 h-14">{order.description}</h3>

                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-8 h-8 rounded-full bg-[#1C1C1E] flex items-center justify-center text-white text-[10px] font-bold uppercase">
                      {order.leads?.name?.slice(0, 2) || 'CL'}
                    </div>
                    <p className="text-sm text-[#8E8E93] font-semibold">{order.leads?.name || order.leads?.phone_number}</p>
                  </div>

                  <div className="bg-[#F2F2F7]/50 rounded-3xl p-5 flex justify-between items-center transition-colors group-hover:bg-[#E96A51]/5">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-[#8E8E93] font-bold block mb-1">Monto Total</span>
                      <span className="text-2xl font-black text-[#1C1C1E] tracking-tight">
                        ${order.total_amount?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div className="bg-white w-10 h-10 rounded-2xl flex items-center justify-center text-[#E96A51] shadow-sm transform group-hover:rotate-12 transition-transform">
                      <MoreHorizontal size={20} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* VISTA LISTA (TABLA) */
          <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID / Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="relative px-6 py-3"><span className="sr-only">Ver</span></th>
                </tr>
              </thead>
          /* iOS LIST VIEW */
          <div className="bg-white rounded-[2.5rem] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] border border-[#F2F2F7] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#F2F2F7]">
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-[#8E8E93]">Estado</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-[#8E8E93]">Descripción del Trabajo</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-[#8E8E93]">Cliente</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-[#8E8E93] text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F2F7]">
                  {filteredOrders.map(order => (
                    <tr
                      key={order.id}
                      onClick={() => {
                        setSelectedOrder(order)
                        setEditForm({ description: order.description, total_amount: order.total_amount })
                        setIsEditing(false)
                      }}
                      className="hover:bg-[#F2F2F7]/30 cursor-pointer transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <span className={`px-4 py-1 rounded-2xl text-[10px] font-black tracking-widest uppercase border ${statusColors[order.status]}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <p className="font-bold text-[#1C1C1E] text-[15px] line-clamp-1">{order.description}</p>
                        <p className="text-[10px] text-[#C7C7CC] font-bold uppercase mt-1 tracking-tighter">Orden {order.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="font-semibold text-[#8E8E93] text-sm">{order.leads?.name || order.leads?.phone_number}</p>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <p className="font-black text-[#1C1C1E] text-lg">${order.total_amount?.toLocaleString() || '0'}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* iOS STYLE MODAL */}
      {selectedOrder && (
                                    <img src={url} alt="thumbnail" className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                                    <FileText size={20} />
                                  </div>
                                )}
                                <div className="overflow-hidden">
                                  <p className="text-xs font-medium text-gray-700 truncate max-w-[150px]">{fileName}</p>
                                  <p className="text-[10px] text-gray-400 uppercase">{isImage ? 'Imagen' : 'Documento'}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                                  title="Ver original"
                                >
                                  <ExternalLink size={16} />
                                </a>
                                <button
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(url);
                                      const blob = await response.blob();
                                      const blobUrl = window.URL.createObjectURL(blob);
                                      const link = document.createElement('a');
                                      link.href = blobUrl;
                                      link.download = fileName;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      window.URL.revokeObjectURL(blobUrl);
                                    } catch (err) {
                                      console.error("Error descaga:", err);
                                      window.open(url, '_blank');
                                    }
                                  }}
                                  className="p-2 text-gray-400 hover:text-green-600 hover:bg-white rounded-lg transition-all"
                                  title="Descargar"
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            </div >
                          );
})}
                      </div >
                    ) : (
  <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200">
    No hay archivos adjuntos para este pedido.
  </p>
)}
                  </div >
                </div >

  {/* Clients & Files Grid */ }
  < div className = "space-y-8" >
    {/* Archivos Adjuntos */ }
    < div >
    <h3 className="text-[11px] font-black uppercase tracking-widest text-[#C7C7CC] mb-4">Archivos del Proyecto</h3>
{
  selectedOrder.files_url && selectedOrder.files_url.length > 0 ? (
    <div className="grid grid-cols-1 gap-3">
      {selectedOrder.files_url.map((url, idx) => {
        const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)/i);
        const fileName = url.split('/').pop();

        return (
          <div key={idx} className="group bg-[#F2F2F7]/40 border border-[#F2F2F7] rounded-3xl p-4 flex items-center justify-between hover:bg-[#E96A51]/5 hover:border-[#E96A51]/20 transition-all">
            <div className="flex items-center gap-4 overflow-hidden">
              {isImage ? (
                <div className="w-12 h-12 rounded-2xl bg-white flex-shrink-0 overflow-hidden border border-[#F2F2F7] shadow-sm">
                  <img src={url} alt="thumbnail" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-white flex-shrink-0 flex items-center justify-center text-[#E96A51] border border-[#F2F2F7] shadow-sm">
                  <FileText size={20} />
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-[13px] font-bold text-[#1C1C1E] truncate max-w-[180px]">{fileName}</p>
                <p className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-tight">{isImage ? 'Imagen' : 'Documento'}</p>
              </div>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => window.open(url, '_blank')}
                className="p-2.5 bg-white text-[#1C1C1E] rounded-xl shadow-sm hover:scale-110 transition-transform"
                title="Ver"
              >
                <ExternalLink size={16} />
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const blobUrl = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(blobUrl);
                  } catch (err) {
                    console.error("Error descarga:", err);
                    window.open(url, '_blank');
                  }
                }}
                className="p-2.5 bg-white text-[#E96A51] rounded-xl shadow-sm hover:scale-110 transition-transform"
                title="Descargar"
              >
                <Download size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  ) : (
  <div className="bg-[#F2F2F7]/30 border-2 border-dashed border-[#F2F2F7] rounded-[2rem] p-8 text-center">
    <p className="text-[13px] text-[#C7C7CC] font-bold italic">Sin archivos adjuntos</p>
  </div>
)
}
                    </div >
                  </div >

  {/* Datos Cliente */ }
  < div className = "bg-[#F2F2F7]/40 p-8 rounded-[2.5rem] border border-[#F2F2F7] space-y-6 self-start" >
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-[#1C1C1E] flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-[#E96A51]"></div> Ficha del Cliente
                    </h3>

                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#8E8E93]">Nombre</span>
                        <p className="font-bold text-[#1C1C1E] text-sm">{selectedOrder.leads?.name || '---'}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#8E8E93]">Teléfono</span>
                        <p className="font-bold text-[#1C1C1E] text-sm flex items-center gap-2">
                           {selectedOrder.leads?.phone_number}
                           <a href={`https://wa.me/${selectedOrder.leads?.phone_number}`} target="_blank" className="p-1.5 bg-green-500/10 text-green-600 rounded-lg hover:bg-green-500 hover:text-white transition-all">
                              <Phone size={12} />
                           </a>
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#8E8E93]">RUT</span>
                        <p className="font-bold text-[#1C1C1E] text-sm">{selectedOrder.leads?.rut || '--'}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#8E8E93]">Dirección / Email</span>
                        <p className="font-bold text-[#1C1C1E] text-[13px] leading-relaxed">
                          {selectedOrder.leads?.address || 'Sin Dirección'} <br/>
                          <span className="text-[#8E8E93] font-medium">{selectedOrder.leads?.email || '--'}</span>
                        </p>
                      </div>
                    </div>
                  </div >
                </div >

  {/* Footer Modal */ }
{
  !isEditing && (
    <div className="pt-8 border-t border-[#F2F2F7] flex flex-col sm:flex-row gap-4">
      <button
        onClick={() => setIsInvoicing(false) || generateInvoice()}
        disabled={isInvoicing}
        className={`flex-1 h-14 bg-[#E96A51] text-white rounded-2xl font-bold text-sm shadow-xl shadow-[#E96A51]/20 flex items-center justify-center gap-3 active:scale-95 transition-all ${isInvoicing ? 'opacity-50' : 'hover:bg-[#D55F49]'}`}
      >
        {isInvoicing ? (
          <>
            <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
            Generando...
          </>
        ) : (
          <>
            <FileText size={20} /> Generar Factura PDF
          </>
        )}
      </button>
      <button
        onClick={() => setIsEditing(true)}
        className="px-8 h-14 bg-white border-2 border-[#F2F2F7] text-[#1C1C1E] rounded-2xl font-bold text-sm hover:bg-[#F2F2F7] transition-all flex items-center justify-center gap-2"
      >
        <Edit2 size={18} /> Editar Orden
      </button>
    </div>
  )
}
              </div >
            </div >
          </div >
        </div >
      )}
    </div >
  )
}

export default App
