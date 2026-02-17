
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Search, Bot, UserCheck, MessageSquare, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChatWindow } from './ChatWindow'
import { ContactInfoPanel } from './ContactInfoPanel'

export function InboxView({ isDarkMode }) {
    const [leads, setLeads] = useState([])
    const [selectedLead, setSelectedLead] = useState(null)
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchLeads()

        // Realtime for lead updates (new messages update last_interaction)
        const channel = supabase.channel('inbox_leads')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchLeads)
            .subscribe()

        return () => supabase.removeChannel(channel)
    }, [])

    async function fetchLeads() {
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('last_interaction', { ascending: false })

            if (error) throw error
            setLeads(data || [])
            setLoading(false)
        } catch (err) {
            console.error('Error fetching inbox leads:', err)
        }
    }

    const filteredLeads = leads.filter(l =>
        !search ||
        l.name?.toLowerCase().includes(search.toLowerCase()) ||
        l.phone_number?.includes(search)
    )

    return (
        <div className="flex h-full bg-white dark:bg-[#1e1e1e] overflow-hidden border-t border-gray-100 dark:border-white/5">
            {/* Sidebar: Chat List */}
            <div className="w-full sm:w-72 md:w-80 border-r border-gray-100 dark:border-white/5 flex flex-col bg-gray-50/30 dark:bg-white/5">
                <div className="p-4 border-b border-gray-100 dark:border-white/5">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar conversación..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#2a2a2a] rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
                    ) : filteredLeads.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">No se encontraron chats.</div>
                    ) : (
                        <div className="divide-y divide-gray-50 dark:divide-white/5">
                            {filteredLeads.map(lead => (
                                <button
                                    key={lead.id}
                                    onClick={() => setSelectedLead(lead)}
                                    className={`w-full p-4 flex gap-3 transition-all hover:bg-white dark:hover:bg-white/10 text-left relative ${selectedLead?.id === lead.id ? 'bg-white dark:bg-white/10 ring-1 ring-inset ring-indigo-500/20' : ''}`}
                                >
                                    {selectedLead?.id === lead.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>}

                                    <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg flex-shrink-0">
                                        {lead.name?.charAt(0).toUpperCase() || '?'}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-[var(--text-main)] text-sm truncate">{lead.name || 'Desconocido'}</h4>
                                            {lead.last_interaction && (
                                                <span className="text-[9px] text-gray-400 flex items-center gap-1 whitespace-nowrap">
                                                    <Clock size={10} />
                                                    {formatDistanceToNow(new Date(lead.last_interaction), { locale: es })}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-gray-500 truncate">{lead.phone_number}</p>
                                            <div className="flex items-center gap-1">
                                                {lead.ai_enabled ? (
                                                    <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 scale-75 origin-right">
                                                        <Bot size={12} />
                                                        <span className="text-[10px] font-bold">IA</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-600 dark:text-amber-400 scale-75 origin-right">
                                                        <UserCheck size={12} />
                                                        <span className="text-[10px] font-bold">HUMAN</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {selectedLead ? (
                    <div className="flex flex-1 overflow-hidden">
                        <ChatWindow lead={selectedLead} isDarkMode={isDarkMode} />
                        <ContactInfoPanel lead={selectedLead} isDarkMode={isDarkMode} />
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4 opacity-30">
                        <MessageSquare size={80} strokeWidth={1} />
                        <h2 className="text-xl font-bold tracking-tight">Centro de Mensajería</h2>
                        <p className="text-sm">Selecciona un cliente de la lista para gestionar el chat.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
