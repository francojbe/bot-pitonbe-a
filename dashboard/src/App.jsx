import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { Toaster, toast } from 'sonner'
import LearningsView from './LearningsView'
import { Sidebar } from './components/Sidebar'
import { DashboardView } from './components/DashboardView'
import { LeadsView } from './components/LeadsView'
import { ReportsView } from './components/ReportsView'
import { OrderDrawer, LeadModal } from './components/Modals'
import {
  Search, Moon, Sun, Trash2, CheckSquare, Menu, Folder
} from 'lucide-react'
import FileExplorer from './components/FileExplorer'

import { useOrders } from './hooks/useOrders'
import { useLeads } from './hooks/useLeads'

// Constants
const ITEMS_PER_PAGE = 10

function App() {
  // --- STATE CORE ---
  const { orders, setOrders, loading: loadingOrders } = useOrders()
  const { leads, setLeads, loading: loadingLeads } = useLeads()
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('active_tab') || 'dashboard')
  const [globalSearch, setGlobalSearch] = useState('')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('dashboard_view_mode') || 'kanban')
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Drawer & Modals
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isEditingLead, setIsEditingLead] = useState(false)
  const [isCreatingLead, setIsCreatingLead] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [leadForm, setLeadForm] = useState({ name: '', phone_number: '', rut: '', address: '', email: '' })
  const [leadSearch, setLeadSearch] = useState('')
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set())
  const [deleteContext, setDeleteContext] = useState('orders') // 'orders' or 'leads'

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)

  // Delete Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, ids: [], dontAskAgain: false })

  // --- EFFECTS ---
  useEffect(() => {
    console.log('App mounted. Dark Mode:', isDarkMode)
    if (isDarkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  useEffect(() => { localStorage.setItem('dashboard_view_mode', viewMode) }, [viewMode])
  useEffect(() => { localStorage.setItem('active_tab', activeTab) }, [activeTab])
  useEffect(() => { localStorage.setItem('sidebar_collapsed', isSidebarCollapsed) }, [isSidebarCollapsed])

  useEffect(() => { localStorage.setItem('sidebar_collapsed', isSidebarCollapsed) }, [isSidebarCollapsed])

  // --- LOGIC (Delete & Save) ---
  async function deleteOrders(ids) {
    if (!ids.length) return
    const skipConfirm = localStorage.getItem('skip_delete_confirmation') === 'true'
    setDeleteContext('orders')

    if (skipConfirm) {
      performDelete(ids, 'orders')
    } else {
      setDeleteConfirmation({ isOpen: true, ids, dontAskAgain: false })
    }
  }

  async function deleteLeads(ids) {
    if (!ids.length) return
    const skipConfirm = localStorage.getItem('skip_delete_confirmation') === 'true'
    setDeleteContext('leads')

    if (skipConfirm) {
      performDelete(ids, 'leads')
    } else {
      setDeleteConfirmation({ isOpen: true, ids, dontAskAgain: false })
    }
  }

  async function performDelete(ids, context = deleteContext) {
    const table = context === 'orders' ? 'orders' : 'leads'
    const { error } = await supabase.from(table).delete().in('id', ids)
    if (!error) {
      if (context === 'orders') {
        setOrders(prev => prev.filter(o => !ids.includes(o.id)))
        setSelectedIds(new Set())
        toast.success(`${ids.length} orden(es) eliminada(s)`)
      } else {
        setLeads(prev => prev.filter(l => !ids.includes(l.id)))
        setSelectedLeadIds(new Set())
        toast.success(`${ids.length} cliente(s) eliminado(s)`)
      }
      setDeleteConfirmation({ isOpen: false, ids: [], dontAskAgain: false })
    } else {
      toast.error('Error al eliminar: ' + (error.message || 'Desconocido'))
    }
  }

  function confirmDelete() {
    if (deleteConfirmation.dontAskAgain) {
      localStorage.setItem('skip_delete_confirmation', 'true')
    }
    performDelete(deleteConfirmation.ids)
  }
  async function handleSaveLead() {
    try {
      const payload = { ...leadForm }; delete payload.id; delete payload.created_at
      const query = isCreatingLead ? supabase.from('leads').insert([payload]) : supabase.from('leads').update(payload).eq('id', selectedLead.id)
      const { error } = await query
      if (error) throw error
      toast.success('Cliente guardado')
      // No need to fetchLeads() as subscription handles it, but optimistic update or refetch could go here if needed
      setIsCreatingLead(false); setIsEditingLead(false)
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

    // Call Backend (Notify) instead of direct DB update
    try {
      const BACKEND_URL = import.meta.env.VITE_API_URL;

      const response = await fetch(`${BACKEND_URL}/orders/update_status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: draggableId, new_status: newStatus })
      });

      const data = await response.json();
      if (data.status !== 'success') {
        toast.error("Error notificando cambio de estado");
      } else if (data.notified) {
        toast.success("Cliente notificado del cambio de estado");
      }

    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error de conexión');
      // fetchOrders(); // Revert on error - handled by hook state
    }
  }

  // --- UI RENDER ---
  return (
    <div className="flex h-screen bg-white dark:bg-[#1a1a1a] text-[var(--text-main)] font-sans overflow-hidden transition-colors duration-300">
      <Toaster position="top-center" richColors theme={isDarkMode ? 'dark' : 'light'} />

      {/* LEFT SIDEBAR (Horizon Style) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={isSidebarCollapsed}
        setCollapsed={setIsSidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* CENTER PANEL */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* HEADER */}
        <header className="h-20 flex items-center justify-between px-6 pt-6 pb-2">

          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-gray-500 hover:text-[var(--text-main)]"
            >
              <Menu size={24} />
            </button>
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)]">Páginas / {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</p>
              <h1 className="text-2xl font-bold tracking-tight capitalize">{activeTab}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white dark:bg-[#242424] p-3 rounded-full shadow-sm dark:shadow-none">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar orden o cliente..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="pl-9 pr-4 py-1.5 rounded-full bg-[var(--bg-subtle)] text-sm outline-none w-40 focus:w-64 transition-all"
              />
            </div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-gray-500 hover:text-[var(--color-primary)] transition-colors">
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
              loading={loadingOrders}
              search={globalSearch}
              viewMode={viewMode}
              setViewMode={setViewMode}
              onSelectOrder={setSelectedOrder}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onDelete={deleteOrders}
              onDragEnd={handleDragEnd}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          )}
          {activeTab === 'clientes' && (
            <LeadsView
              leads={leads}
              orders={orders}
              search={globalSearch}
              setSearch={setGlobalSearch}
              onEdit={(l) => { setSelectedLead(l); setLeadForm(l); setIsEditingLead(true) }}
              onCreate={() => { setLeadForm({}); setIsCreatingLead(true) }}
              selectedIds={selectedLeadIds}
              setSelectedIds={setSelectedLeadIds}
              onDelete={deleteLeads}
            />
          )}
          {activeTab === 'reportes' && <ReportsView orders={orders} />}
          {activeTab === 'archivos' && <FileExplorer />}
          {activeTab === 'mejoras' && <LearningsView />}
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

      {/* Delete Confirmation Modal */}
      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0B1437]/50 backdrop-blur-sm transition-opacity" onClick={() => setDeleteConfirmation({ ...deleteConfirmation, isOpen: false })}></div>
          <div className="relative bg-white dark:bg-[#1B254B] rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in duration-200 border border-gray-100 dark:border-white/5 flex flex-col items-center text-center">

            <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
              <Trash2 size={24} />
            </div>

            <h3 className="text-lg font-bold text-[var(--text-main)] mb-2">¿Eliminar {deleteConfirmation.ids.length} {deleteContext === 'orders' ? 'orden(es)' : 'cliente(s)'}?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Esta acción no se puede deshacer. Los datos se borrarán permanentemente.</p>

            <div className="flex items-center gap-2 mb-6 cursor-pointer group" onClick={() => setDeleteConfirmation(prev => ({ ...prev, dontAskAgain: !prev.dontAskAgain }))}>
              <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${deleteConfirmation.dontAskAgain ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white' : 'border-gray-300 dark:border-gray-600 group-hover:border-[var(--color-primary)]'}`}>
                {deleteConfirmation.dontAskAgain && <CheckSquare size={14} />}
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 group-hover:text-[var(--text-main)] transition-colors">No volver a preguntar</span>
            </div>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => setDeleteConfirmation({ ...deleteConfirmation, isOpen: false })}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-[var(--text-main)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 ring-1 ring-red-100 dark:ring-red-500/20 text-sm font-bold transition-all"
              >
                Eliminar
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default App
