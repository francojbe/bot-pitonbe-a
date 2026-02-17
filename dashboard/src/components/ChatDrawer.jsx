
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, Send, Phone, User, X, MessageSquare, Image, FileText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function ChatDrawer({ lead, onClose, isDarkMode }) {
    const [messages, setMessages] = useState([])
    const [loading, setLoading] = useState(true)
    const [newMessage, setNewMessage] = useState('')
    const messagesEndRef = useRef(null)

    // 1. Fetch History
    useEffect(() => {
        if (!lead?.id) return

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

    // 4. Send Message Handler (Optional for future, currently just visual or backend hook)
    const handleSendMessage = async (e) => {
        e.preventDefault()
        if (!newMessage.trim()) return

        // Optimistic UI Update
        const tempId = Date.now()
        const optimisticMsg = {
            id: tempId,
            lead_id: lead.id,
            role: 'assistant', // Assumed as operator/assistant
            content: newMessage,
            created_at: new Date().toISOString(),
            is_optimistic: true // Flag for UI
        }

        setMessages(prev => [...prev, optimisticMsg])
        setNewMessage('')

        // TODO: Call Backend API to actually send via WhatsApp (Future Feature)
        // For now, we simulate success or remove strict send implementation to avoid breaking changes without backend support
        // await sendMessageToBackend(...) 
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
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={20} />
                </button>
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
                    messages.map((msg, idx) => {
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
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area (Disabled for now, visual only until Backend Endpoint exists) */}
            <div className="p-4 bg-white dark:bg-[#1e1e1e] border-t border-gray-100 dark:border-white/5">
                <form onSubmit={handleSendMessage} className="flex items-end gap-2 bg-gray-50 dark:bg-[#2a2a2a] p-2 rounded-xl border border-gray-200 dark:border-white/5 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                    <button type="button" className="p-2 text-gray-400 hover:text-[var(--text-main)] transition-colors">
                        <Image size={20} />
                    </button>
                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escribe un mensaje (Próximamente)..." // Placeholder warning
                        className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-main)] resize-none py-2 max-h-32"
                        rows={1}
                        disabled // Disabled until backend is ready
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </form>
                <p className="text-[10px] text-center text-gray-400 mt-2">
                    * El envío de mensajes estará disponible en la próxima actualización. Por ahora es solo lectura.
                </p>
            </div>
        </motion.div>
    )
}
