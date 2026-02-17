import { Mail, Phone, Briefcase, MapPin, User, Copy, Edit3, ChevronDown, ChevronUp, History, ExternalLink, RefreshCw, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../supabase'

export function ContactInfoPanel({ lead, isDarkMode }) {
    const [expandedSections, setExpandedSections] = useState({
        attributes: true,
        previous: false
    })
    const [syncing, setSyncing] = useState(false)
    const BACKEND_URL = import.meta.env.VITE_API_URL

    const syncPicture = async () => {
        if (syncing || !lead?.id) return
        setSyncing(true)
        try {
            const res = await fetch(`${BACKEND_URL}/leads/sync_picture`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lead_id: lead.id })
            })
            const data = await res.json()
            if (data.status === 'success') {
                toast.success('Foto sincronizada desde WhatsApp')
                // No necesitamos recargar, Supabase Realtime debería actualizar el lead
                // Pero si no, podemos hacer una pequeña actualización manual si DashboardView/InboxView escuchan
            } else {
                toast.error(data.message || 'No se pudo obtener la foto')
            }
        } catch (err) {
            toast.error('Error de conexión con el servidor')
        } finally {
            setSyncing(false)
        }
    }

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
    }

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text)
        toast.success(`${label} copiado al portapapeles`)
    }

    if (!lead) return null

    return (
        <div className="w-80 border-l border-gray-100 dark:border-white/5 bg-white dark:bg-[#1e1e1e] flex flex-col overflow-y-auto hidden lg:flex">
            {/* Tabs */}
            <div className="flex p-2 gap-1 border-b border-gray-100 dark:border-white/5">
                <button className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-gray-100 dark:bg-white/5 text-indigo-600 dark:text-indigo-400">
                    Contacto
                </button>
                <button className="flex-1 py-1.5 text-xs font-bold rounded-lg text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    Copilot
                </button>
            </div>

            {/* Profile Header */}
            <div className="p-4 flex flex-col items-center text-center border-b border-gray-100 dark:border-white/5 bg-gray-50/20 relative group/avatar">
                <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-2xl mb-3 shadow-inner overflow-hidden border-2 border-white dark:border-white/10 relative">
                    {lead.profile_picture_url ? (
                        <img src={lead.profile_picture_url} alt={lead.name} className="w-full h-full object-cover" />
                    ) : (
                        lead.name?.charAt(0).toUpperCase()
                    )}
                    {syncing && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Loader2 size={24} className="text-white animate-spin" />
                        </div>
                    )}
                </div>

                <div className="absolute top-2 right-2 opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                    <button
                        onClick={syncPicture}
                        disabled={syncing}
                        className="p-1.5 bg-white dark:bg-[#2a2a2a] rounded-full shadow-md border border-gray-100 dark:border-white/10 text-gray-400 hover:text-indigo-500 transition-all hover:scale-110"
                        title="Sincronizar foto de WhatsApp"
                    >
                        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                    </button>
                </div>

                <h3 className="font-bold text-base text-[var(--text-main)] mb-0.5 flex items-center justify-center gap-2">
                    {lead.name}
                    <ExternalLink size={12} className="text-gray-400 cursor-pointer hover:text-indigo-500" />
                </h3>
                <p className="text-[11px] text-gray-500 font-medium mb-3">{lead.business_name || 'Cliente Particular'}</p>

                {/* Quick Actions */}
                <div className="flex gap-2">
                    {[Edit3, MessageSquare, History].map((Icon, i) => (
                        <button key={i} className="p-2 rounded-xl border border-gray-100 dark:border-white/5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all">
                            <Icon size={18} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Info List */}
            <div className="p-4 space-y-4 border-b border-gray-100 dark:border-white/5 text-sm">
                {/* Email */}
                {lead.email && (
                    <div className="group relative">
                        <div className="flex items-center gap-3 mb-1">
                            <Mail size={16} className="text-gray-400" />
                            <span className="text-sm text-[var(--text-main)] truncate font-medium">{lead.email}</span>
                            <button onClick={() => copyToClipboard(lead.email, 'Email')} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-all">
                                <Copy size={12} className="text-gray-400" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Phone */}
                <div className="group relative">
                    <div className="flex items-center gap-3 mb-1">
                        <Phone size={16} className="text-gray-400" />
                        <span className="text-sm text-[var(--text-main)] font-medium">{lead.phone_number}</span>
                        <button onClick={() => copyToClipboard(lead.phone_number, 'Teléfono')} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-all">
                            <Copy size={12} className="text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* RUT */}
                {lead.rut && (
                    <div className="flex items-center gap-3">
                        <User size={16} className="text-gray-400" />
                        <span className="text-sm text-[var(--text-main)] font-medium">{lead.rut}</span>
                    </div>
                )}

                {/* Business */}
                {lead.business_name && (
                    <div className="flex items-center gap-3">
                        <Briefcase size={16} className="text-gray-400" />
                        <span className="text-sm text-[var(--text-main)] font-medium">{lead.business_name}</span>
                    </div>
                )}

                {/* Location */}
                <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-gray-400" />
                    <span className="text-sm text-[var(--text-main)] font-medium truncate">{lead.address || 'Chile'}</span>
                </div>
            </div>

            {/* Expandable Sections (Style Chatwoot) */}
            <div className="flex-1 overflow-y-auto">
                <section className="border-b border-gray-100 dark:border-white/5">
                    <button
                        onClick={() => toggleSection('attributes')}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Atributos del Contacto</span>
                        {expandedSections.attributes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {expandedSections.attributes && (
                        <div className="px-4 pb-4 space-y-3">
                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Estado de IA</p>
                                <p className="text-xs font-bold text-indigo-600">{lead.ai_enabled ? 'Activada (Richard)' : 'Desactivada (Manual)'}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">ID Único</p>
                                <p className="text-[10px] font-mono text-gray-500 break-all">{lead.id}</p>
                            </div>
                        </div>
                    )}
                </section>

                <section className="border-b border-gray-100 dark:border-white/5">
                    <button
                        onClick={() => toggleSection('previous')}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Conversaciones Previas</span>
                        {expandedSections.previous ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {expandedSections.previous && (
                        <div className="px-4 pb-4">
                            <p className="text-xs text-center text-gray-400 py-4">No hay conversaciones archivadas.</p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}

// Simple internal component to fix the missing Icon in loop
const MessageSquare = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
)
