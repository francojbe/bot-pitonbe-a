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
  X
} from 'lucide-react'

function App() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filter, setFilter] = useState('TODOS')

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

  const statusColors = {
    'NUEVO': 'bg-blue-100 text-blue-800 border-blue-200',
    'DISEÑO': 'bg-purple-100 text-purple-800 border-purple-200',
    'PRODUCCIÓN': 'bg-orange-100 text-orange-800 border-orange-200',
    'LISTO': 'bg-green-100 text-green-800 border-green-200',
    'ENTREGADO': 'bg-gray-100 text-gray-800 border-gray-200'
  }

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
              <span className="text-sm text-gray-500">v1.0</span>
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
            <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
              <Filter size={16} /> Filtrar
            </button>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-2">
              <ClipboardList size={16} /> Nuevo Pedido Manual
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map(order => (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
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
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[selectedOrder.status]}`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Columna Izquierda: Datos del Trabajo */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Detalle del Trabajo</h3>
                    <p className="text-lg text-gray-800 font-medium">{selectedOrder.description}</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-2">${selectedOrder.total_amount?.toLocaleString()}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Archivos Adjuntos</h3>
                    {selectedOrder.files_url && selectedOrder.files_url.length > 0 ? (
                      <div className="flex gap-2">
                        {/* Placeholder de archivos */}
                        <div className="bg-gray-100 p-3 rounded-lg flex items-center gap-2 text-sm text-gray-600">
                          <FileText size={16} /> {selectedOrder.files_url.length} archivos
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No hay archivos adjuntos.</p>
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
              <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end gap-3">
                <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm">
                  Editar
                </button>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm shadow-sm">
                  Generar Factura PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
