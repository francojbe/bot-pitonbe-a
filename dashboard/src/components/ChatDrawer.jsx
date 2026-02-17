
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, Send, Phone, User, X, MessageSquare, Image, FileText, Bot, UserCheck, Settings, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

export function ChatDrawer({ lead, onClose, isDarkMode }) {
    const [messages, setMessages] = useState([])
    const [loading, setLoading] = useState(true)
    const [newMessage, setNewMessage] = useState('')
    const [isAIEnabled, setIsAIEnabled] = useState(lead?.ai_enabled ?? true)
    const [isToggling, setIsToggling] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const messagesEndRef = useRef(null)

    const BACKEND_URL = import.meta.env.VITE_API_URL

    // 1. Fetch History
    useEffect(() => {
        if (!lead?.id) {
            setLoading(false)
            return
        }

        const fetchMessages = async () => {
            setLoading(true)
            const { data, error } = await supabase
                .from('message_logs')
                .select('*')
                .eq('lead_id', lead.id)
                .order('created_at', { ascending: true }) // Oldest first for chat flow

            if (!error && data) {
                setMessages(data)
            }
            setLoading(false)
        }

        fetchMessages()
        setIsAIEnabled(lead?.ai_enabled ?? true)

        // 2. Realtime Subscription (New Messages)
        const subscription = supabase
            .channel(`chat:${lead.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'message_logs',
                filter: `lead_id=eq.${lead.id}`
            }, (payload) => {
                setMessages(prev => [...prev, payload.new])
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [lead?.id])

    // 3. Auto Scroll to Bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, loading])

    // 4. Send Message Handler
    const handleSendMessage = async (e) => {
        e.preventDefault()
        if (!newMessage.trim() || isSending) return

        const content = newMessage.trim()
        setIsSending(true)
        setNewMessage('')

        try {
            const response = await fetch(`${BACKEND_URL}/chat/send_manual`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: lead.id,
                    content: content
                })
            })

            const data = await response.json()
            if (data.status !== 'success') {
                toast.error("Error al enviar mensaje por WhatsApp")
                setNewMessage(content) // Restore if failed
            }
        } catch (error) {
            console.error("Error sending message:", error)
            toast.error("Error de conexión al enviar mensaje")
            setNewMessage(content)
        } finally {
            setIsSending(false)
        }
    }

    // 5. Toggle AI Handler
    const handleToggleAI = async () => {
        if (isToggling) return
        setIsToggling(true)

        const newValue = !isAIEnabled
        try {
            const response = await fetch(`${BACKEND_URL}/leads/toggle_ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: lead.id,
                    enabled: newValue
                })
            })

            const data = await response.json()
            if (data.status === 'success') {
                setIsAIEnabled(newValue)
                toast.success(newValue ? "Agente IA Richard reactivado 🤖" : "IA en silencio. ¡Tú tienes el control! 👤")
            } else {
                toast.error("No se pudo cambiar el estado de la IA")
            }
        } catch (error) {
            console.error("Error toggling AI:", error)
            toast.error("Error de conexión al cambiar estado de IA")
        } finally {
            setIsToggling(false)
        }
    }

    if (!lead) return null

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[450px] bg-white dark:bg-[#1e1e1e] shadow-2xl border-l border-gray-200 dark:border-white/10 flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 bg-white/50 dark:bg-[#1e1e1e]/50 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                        {lead.name ? lead.name.charAt(0).toUpperCase() : <User size={20} />}
                    </div>
                    <div>
                        <h3 className="font-bold text-[var(--text-main)]">{lead.name || 'Cliente Nuevo'}</h3>
                        <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                            <Phone size={12} /> {lead.phone_number}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Bot Toggle Switch */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 mr-2">
                        <div className="flex items-center gap-1.5 min-w-[80px]">
                            {isAIEnabled ? (
                                <Bot size={14} className="text-indigo-600 animate-pulse" />
                            ) : (
                                <UserCheck size={14} className="text-amber-500" />
                            )}
                            <span className={`text-[10px] font-bold tracking-wider uppercase ${isAIEnabled ? 'text-indigo-600' : 'text-amber-600'}`}>
                                {isAIEnabled ? 'IA Activa' : 'Humano'}
                            </span>
                        </div>
                        <button
                            onClick={handleToggleAI}
                            disabled={isToggling}
                            className={`w-8 h-4 rounded-full relative transition-colors ${isAIEnabled ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                            <motion.div
                                animate={{ x: isAIEnabled ? 16 : 0 }}
                                className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm"
                            />
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-[#121212] relative">
                {/* Wallpaper Pattern Overlay (Optional Aesthetic) */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                        <Loader2 className="animate-spin" size={32} />
                        <p className="text-sm">Cargando historial...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4 opacity-60">
                        <MessageSquare size={48} strokeWidth={1.5} />
                        <p>No hay mensajes previos.</p>
                    </div>
                ) : (
                    <>
                        {/* Status Alert for Human Takeover */}
                        {!isAIEnabled && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 p-3 rounded-xl flex items-center gap-3 mb-6"
                            >
                                <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg">
                                    <AlertCircle size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Modo Intervención Humana</p>
                                    <p className="text-[10px] text-amber-700 dark:text-amber-400">La IA Richard no responderá automáticamente. Todos los mensajes deben ser manuales.</p>
                                </div>
                            </motion.div>
                        )}
                        {messages.map((msg, idx) => {
                            const isUser = msg.role === 'user' // User = Client (Left), Assistant/System = Operator (Right)
                            // In WhatsApp context: User -> Client (Left, white), Assistant -> Bot/Operator (Right, green)

                            // BUT common chat UI: Me (Right), Them (Left). 
                            // Since 'assistant' is the Bot (us), let's put 'assistant' on Right (Green) and 'user' (client) on Left (White).

                            return (
                                <motion.div
                                    key={msg.id || idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`
                                        max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm text-sm relative group
                                        ${msg.role === 'assistant'
                                                ? 'bg-indigo-600 text-white rounded-br-none'
                                                : 'bg-white dark:bg-[#2a2a2a] text-[var(--text-main)] rounded-bl-none border border-gray-100 dark:border-white/5'
                                            }
                                    `}
                                    >
                                        {/* Message Content */}
                                        <div className="whitespace-pre-wrap leading-relaxed">
                                            {msg.content}
                                        </div>

                                        {/* Attachments / Metadata (Future Proofing) */}
                                        {msg.metadata?.media_url && (
                                            <div className="mt-2 rounded-lg overflow-hidden border border-white/20">
                                                {msg.metadata.type === 'image' ? (
                                                    <img src={msg.metadata.media_url} alt="Media" className="max-w-full h-auto" />
                                                ) : (
                                                    <div className="flex items-center gap-2 bg-black/10 p-2">
                                                        <FileText size={16} /> <span>Archivo adjunto</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Timestamp */}
                                        <p className={`
                                        text-[10px] mt-1 text-right opacity-70 font-medium
                                        ${msg.role === 'assistant' ? 'text-indigo-100' : 'text-gray-400'}
                                    `}>
                                            {msg.created_at ? format(new Date(msg.created_at), 'HH:mm', { locale: es }) : '...'}
                                        </p>
                                    </div>
                                </motion.div>
                            )
                        })}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-[#1e1e1e] border-t border-gray-100 dark:border-white/5">
                <form onSubmit={handleSendMessage} className="flex items-end gap-2 bg-gray-50 dark:bg-[#2a2a2a] p-2 rounded-xl border border-gray-200 dark:border-white/5 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                    <button type="button" className="p-2 text-gray-400 hover:text-[var(--text-main)] transition-colors">
                        <Image size={20} />
                    </button>
                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={isAIEnabled ? "Active el Modo Humano para responder..." : "Escribe tu mensaje aquí..."}
                        className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-main)] resize-none py-2 max-h-32"
                        rows={1}
                        disabled={isAIEnabled || isSending}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSendMessage(e)
                            }
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || isAIEnabled || isSending}
                        className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-400 transition-colors"
                    >
                        {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </form>
                <div className="flex items-center justify-between mt-2 px-1">
                    <p className="text-[9px] text-gray-400">
                        Los mensajes se envían vía WhatsApp Realtime.
                    </p>
                    {isAIEnabled && (
                        <button
                            onClick={handleToggleAI}
                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700 underline"
                        >
                            Activar control manual
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    )
}
