import { Mail, Phone, Briefcase, MapPin, User, Copy, Edit3, ChevronDown, ChevronUp, History, ExternalLink, RefreshCw, Loader2, MessageSquare } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '../supabase'
import { LeadModal } from './Modals'

export function ContactInfoPanel({ lead, isDarkMode }) {
    const [expandedSections, setExpandedSections] = useState({
        attributes: true,
        previous: false
    })
    const [syncing, setSyncing] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [activeInternalTab, setActiveInternalTab] = useState('contacto') // 'contacto' or 'copilot'
    const [stats, setStats] = useState({ inProgress: 0, completed: 0, total: 0 })
    const [loadingStats, setLoadingStats] = useState(true)
    const BACKEND_URL = import.meta.env.VITE_API_URL

    useEffect(() => {
        if (lead?.id) {
            fetchStats()
        }
    }, [lead?.id])

    async function fetchStats() {
        setLoadingStats(true)
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('status')
                .eq('lead_id', lead.id)

            if (data) {
                const inProgress = data.filter(o => o.status !== 'ENTREGADO').length
                const completed = data.filter(o => o.status === 'ENTREGADO').length
                setStats({ inProgress, completed, total: data.length })
            }
        } catch (err) {
            console.error('Error fetching lead stats:', err)
        } finally {
            setLoadingStats(false)
        }
    }

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

    const handleUpdateLead = async (formData) => {
        try {
            const { error } = await supabase
                .from('leads')
                .update({
                    name: formData.name,
                    email: formData.email,
                    phone_number: formData.phone_number,
                    rut: formData.rut,
                    business_name: formData.business_name,
                    address: formData.address
                })
                .eq('id', lead.id)

            if (error) throw error
            toast.success('Información del cliente actualizada')
            setIsEditModalOpen(false)
        } catch (err) {
            console.error('Error updating lead:', err)
            toast.error('Error al actualizar el cliente')
        }
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
                <button
                    onClick={() => setActiveInternalTab('contacto')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeInternalTab === 'contacto' ? 'bg-[var(--color-primary)]/10 text-[var(--color-accent)] dark:text-[var(--color-primary)]' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                >
                    Contacto
                </button>
                <button
                    onClick={() => setActiveInternalTab('copilot')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeInternalTab === 'copilot' ? 'bg-[var(--color-primary)]/10 text-[var(--color-accent)] dark:text-[var(--color-primary)]' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                >
                    Copilot
                </button>
            </div>

            {activeInternalTab === 'contacto' ? (
                <>
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
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="p-2 rounded-xl border border-gray-100 dark:border-white/5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all border-dashed"
                                title="Editar cliente"
                            >
                                <Edit3 size={18} />
                            </button>
                            <button className="p-2 rounded-xl border border-gray-100 dark:border-white/5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all border-dashed">
                                <MessageSquare size={18} />
                            </button>
                            <button className="p-2 rounded-xl border border-gray-100 dark:border-white/5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all border-dashed">
                                <History size={18} />
                            </button>
                        </div>

                        {/* Projects Stats */}
                        <div className="w-full grid grid-cols-2 gap-2 px-2">
                            <div className="bg-[var(--color-primary)]/10 dark:bg-[var(--color-primary)]/5 p-2 rounded-xl border border-[var(--color-primary)]/20 dark:border-[var(--color-primary)]/10">
                                <p className="text-[9px] text-[var(--color-accent)] dark:text-[var(--color-primary)] uppercase font-black mb-1">En curso</p>
                                <p className="text-xl font-black text-[var(--color-accent)] dark:text-[var(--color-primary)] leading-none">
                                    {loadingStats ? '...' : stats.inProgress}
                                </p>
                            </div>
                            <div className="bg-[var(--color-secondary)]/10 dark:bg-[var(--color-secondary)]/5 p-2 rounded-xl border border-[var(--color-secondary)]/20 dark:border-[var(--color-secondary)]/10">
                                <p className="text-[9px] text-[var(--color-secondary)] uppercase font-black mb-1">Cerrados</p>
                                <p className="text-xl font-black text-[var(--color-secondary)] leading-none">
                                    {loadingStats ? '...' : stats.completed}
                                </p>
                            </div>
                        </div>

                        <LeadModal
                            isOpen={isEditModalOpen}
                            isCreating={false}
                            form={lead}
                            onClose={() => setIsEditModalOpen(false)}
                            onSubmit={handleUpdateLead}
                        />
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
                                        <p className="text-xs font-bold text-[var(--color-primary)]">{lead.ai_enabled ? 'Activada (Richard)' : 'Desactivada (Manual)'}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">ID Único</p>
                                        <p className="text-[10px] font-mono text-gray-500 break-all">{lead.id}</p>
                                    </div>
                                </div>
                            )}
                        </section>

                    </div>
                </>
            ) : (
                <div className="p-4 flex-1 flex flex-col gap-6 overflow-y-auto">
                    {/* Copilot Tab Content */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
                                <Briefcase size={18} />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-wider italic">Análisis Personalizado</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10 rounded-2xl p-4">
                                <p className="text-[10px] text-[var(--color-accent)] font-black uppercase mb-2">Resumen del Cliente</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                    Cliente interesado en <span className="text-[var(--color-accent)] font-bold dark:text-[var(--color-primary)]">proyectos de producción inmediata</span>. Ha mostrado interés recurrente en temas de diseño y logística.
                                </p>
                            </div>

                            <div className="bg-[var(--color-secondary)]/5 border border-[var(--color-secondary)]/10 rounded-2xl p-4">
                                <p className="text-[10px] text-[var(--color-secondary)] font-black uppercase mb-2">Richard Insights</p>
                                <ul className="space-y-2">
                                    <li className="flex gap-2 text-xs text-gray-600 dark:text-gray-400 capitalize">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] mt-1 shrink-0" />
                                        <span>Sentimiento positivo en la última charla.</span>
                                    </li>
                                    <li className="flex gap-2 text-xs text-gray-600 dark:text-gray-400 capitalize">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] mt-1 shrink-0" />
                                        <span>Alta probabilidad de cierre este mes.</span>
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-3 px-2">Acciones Sugeridas</p>
                                <div className="space-y-2">
                                    <button className="w-full p-3 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-xs text-left hover:bg-[var(--color-primary)]/5 hover:border-[var(--color-primary)]/30 transition-all font-medium">
                                        Generar propuesta de presupuesto
                                    </button>
                                    <button className="w-full p-3 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-xs text-left hover:bg-[var(--color-primary)]/5 hover:border-[var(--color-primary)]/30 transition-all font-medium">
                                        Agendar llamada de seguimiento
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-gray-100 dark:border-white/5 italic opacity-50 text-[10px] text-center">
                        Desarrollado por Richard IA
                    </div>
                </div>
            )}
        </div>
    )
}

