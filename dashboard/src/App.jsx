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

  const statusColors = {
    'NUEVO': 'bg-blue-100 text-blue-800 border-blue-200',
    'DISEÑO': 'bg-purple-100 text-purple-800 border-purple-200',
    'PRODUCCIÓN': 'bg-orange-100 text-orange-800 border-orange-200',
    'LISTO': 'bg-green-100 text-green-800 border-green-200',
    'ENTREGADO': 'bg-gray-100 text-gray-800 border-gray-200'
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
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg text-white">
                <Printer size={24} />
              </div>
              <span className="font-bold text-xl tracking-tight text-indigo-900">Pitrón Beña</span>
              <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-full text-gray-500">Admin</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">v1.1</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header Stats / Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Pedidos</h1>
            <p className="text-gray-500">Administra tus trabajos de impresión en tiempo real.</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <List size={18} />
              </button>
            </div>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-2">
              <ClipboardList size={16} /> Nuevo Pedido
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['TODOS', 'NUEVO', 'DISEÑO', 'PRODUCCIÓN', 'LISTO', 'ENTREGADO'].map(st => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap
                ${filter === st
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-transparent'}`}
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
          /* VISTA GRID (TARJETAS) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map(order => (
              <div
                key={order.id}
                onClick={() => {
                  setSelectedOrder(order)
                  setEditForm({ description: order.description, total_amount: order.total_amount })
                  setIsEditing(false)
                }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden group"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                      {order.status}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">#{order.id.slice(0, 8)}</span>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{order.description}</h3>
                  <p className="text-sm text-gray-500 mb-4 flex items-center gap-1">
                    <Phone size={12} /> {order.leads?.name || order.leads?.phone_number}
                  </p>

                  <div className="border-t border-gray-100 pt-3 flex justify-between items-center text-sm">
                    <span className="font-bold text-gray-900">
                      ${order.total_amount?.toLocaleString() || '0'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="bg-gray-50 px-5 py-2 text-xs text-indigo-600 font-medium flex justify-between items-center group-hover:bg-indigo-50 transition-colors">
                  Ver detalles
                  <MoreHorizontal size={16} />
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
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map(order => (
                  <tr
                    key={order.id}
                    onClick={() => {
                      setSelectedOrder(order)
                      setEditForm({ description: order.description, total_amount: order.total_amount })
                      setIsEditing(false)
                    }}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono text-gray-500">#{order.id.slice(0, 6)}</span>
                        <span className={`mt-1 inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[order.status]}`}>
                          {order.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 line-clamp-1 max-w-xs" title={order.description}>
                        {order.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.leads?.name || 'Cliente'}</div>
                      <div className="text-xs text-gray-500">{order.leads?.phone_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      ${order.total_amount?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-indigo-600 hover:text-indigo-900">
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal Detalle */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">Orden #{selectedOrder.id.slice(0, 8)}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-gray-500">Estado:</span>
                    <select
                      value={selectedOrder.status}
                      onChange={(e) => updateOrderStatus(e.target.value)}
                      className={`
                        px-3 py-1 rounded-full text-xs font-bold border outline-none cursor-pointer
                        appearance-none pr-8 bg-no-repeat bg-[right_0.5rem_center]
                        ${statusColors[selectedOrder.status]}
                        hover:opacity-80 transition-opacity
                      `}
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                    >
                      {['NUEVO', 'DISEÑO', 'PRODUCCIÓN', 'LISTO', 'ENTREGADO'].map(st => (
                        <option key={st} value={st} className="bg-white text-gray-900">
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDeleteOrder}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors mr-2"
                    title="Eliminar Pedido"
                  >
                    <Trash2 size={20} />
                  </button>
                  <button onClick={() => { setSelectedOrder(null); setIsEditing(false); }} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Columna Izquierda: Datos del Trabajo */}
                <div className="space-y-6">
                  {isEditing ? (
                    <form onSubmit={handleEditSubmit} className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase">Descripción</label>
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          rows="3"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase">Monto Total ($)</label>
                        <input
                          type="number"
                          value={editForm.total_amount}
                          onChange={(e) => setEditForm({ ...editForm, total_amount: e.target.value })}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm">
                          <Save size={16} /> Guardar Cambios
                        </button>
                        <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium text-sm">
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Detalle del Trabajo</h3>
                      <p className="text-lg text-gray-800 font-medium">{selectedOrder.description}</p>
                      <p className="text-2xl font-bold text-indigo-600 mt-2">${selectedOrder.total_amount?.toLocaleString()}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Archivos Adjuntos</h3>
                    {selectedOrder.files_url && selectedOrder.files_url.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        {selectedOrder.files_url.map((url, idx) => {
                          const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)/i);
                          const fileName = url.split('/').pop();

                          return (
                            <div key={idx} className="group relative bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between hover:border-indigo-300 transition-colors">
                              <div className="flex items-center gap-3 overflow-hidden">
                                {isImage ? (
                                  <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden border border-gray-100">
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
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200">
                        No hay archivos adjuntos para este pedido.
                      </p>
                    )}
                  </div>
                </div>

                {/* Columna Derecha: Datos Cliente */}
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <CreditCard size={16} className="text-gray-400" /> Datos del Cliente
                  </h3>

                  <div className="space-y-1">
                    <span className="text-xs text-gray-400 uppercase">Nombre</span>
                    <p className="font-medium text-gray-800">{selectedOrder.leads?.name || 'Sin Nombre'}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-gray-400 uppercase">RUT</span>
                    <p className="font-medium text-gray-800">{selectedOrder.leads?.rut || '--'}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-gray-400 uppercase">Teléfono</span>
                    <p className="font-medium text-gray-800 font-mono">{selectedOrder.leads?.phone_number}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-gray-400 uppercase">Dirección</span>
                    <p className="font-medium text-gray-800 text-sm">{selectedOrder.leads?.address || 'Retiro en tienda'}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-gray-400 uppercase">Email</span>
                    <p className="font-medium text-gray-800 text-sm break-all">{selectedOrder.leads?.email || '--'}</p>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              {!isEditing && (
                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end gap-3">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm flex items-center gap-2"
                  >
                    <Edit2 size={16} /> Editar
                  </button>
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm shadow-sm">
                    Generar Factura PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
