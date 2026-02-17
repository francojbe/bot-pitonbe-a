
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, Send, Phone, User, MessageSquare, Image, FileText, Bot, UserCheck, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

export function ChatWindow({ lead, isDarkMode }) {
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
            setMessages([])
            return
        }

        const fetchMessages = async () => {
            setLoading(true)
            const { data, error } = await supabase
                .from('message_logs')
                .select('*')
                .eq('lead_id', lead.id)
                .order('created_at', { ascending: true })

            if (!error && data) {
                setMessages(data)
            }
            setLoading(false)
        }

        fetchMessages()
        setIsAIEnabled(lead?.ai_enabled ?? true)

        // 2. Realtime Subscription
        const subscription = supabase
            .channel(`chat_window:${lead.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'message_logs',
                filter: `lead_id=eq.${lead.id}`
            }, (payload) => {
                setMessages(prev => {
                    if (prev.some(m => m.id === payload.new.id)) return prev
                    return [...prev, payload.new]
                })
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [lead?.id])

    // 3. Auto Scroll (Instant jump, no sliding)
    useEffect(() => {
        if (!loading) {
            messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
        }
    }, [messages, loading])

    // 4. Handlers
    const handleSendMessage = async (e) => {
        e.preventDefault()
        if (!newMessage.trim() || isSending || !lead?.id) return

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
                toast.error("Error al enviar mensaje")
                setNewMessage(content)
            }
        } catch (error) {
            toast.error("Error de conexión")
            setNewMessage(content)
        } finally {
            setIsSending(false)
        }
    }

    const handleToggleAI = async () => {
        if (isToggling || !lead?.id) return
        setIsToggling(true)

        const newValue = !isAIEnabled
        try {
            const response = await fetch(`${BACKEND_URL}/leads/toggle_ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lead_id: lead.id, enabled: newValue })
            })

            const data = await response.json()
            if (data.status === 'success') {
                setIsAIEnabled(newValue)
                toast.success(newValue ? "IA Richard reactivado" : "Control manual activo")
            }
        } catch (error) {
            toast.error("Error al cambiar estado")
        } finally {
            setIsToggling(false)
        }
    }

    if (!lead) return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
            <MessageSquare size={64} className="opacity-10" />
            <p className="font-medium">Selecciona una conversación para comenzar</p>
        </div>
    )

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-[#1e1e1e] overflow-hidden">
            {/* Header Mini */}
            <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                        {lead.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-bold text-[var(--text-main)] text-sm">{lead.name}</h3>
                        <p className="text-[10px] text-gray-500">{lead.phone_number}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <div className="flex items-center gap-1.5 min-w-[70px]">
                        {isAIEnabled ? <Bot size={14} className="text-indigo-600 animate-pulse" /> : <UserCheck size={14} className="text-amber-500" />}
                        <span className={`text-[9px] font-bold uppercase ${isAIEnabled ? 'text-indigo-600' : 'text-amber-600'}`}>
                            {isAIEnabled ? 'IA Activa' : 'Manual'}
                        </span>
                    </div>
                    <button
                        onClick={handleToggleAI}
                        disabled={isToggling}
                        className={`w-8 h-4 rounded-full relative transition-colors ${isAIEnabled ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                        <motion.div animate={{ x: isAIEnabled ? 16 : 0 }} className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm" />
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-[#121212] relative">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2"><Loader2 className="animate-spin" /></div>
                ) : (
                    <>
                        {!isAIEnabled && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 p-3 rounded-xl flex items-center gap-3 mb-4">
                                <AlertCircle size={16} className="text-amber-600" />
                                <p className="text-[10px] text-amber-800 dark:text-amber-300 font-medium">Modo Humano: Richard está en silencio.</p>
                            </div>
                        )}
                        {messages.map((msg, idx) => (
                            <div key={msg.id || idx} className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.role === 'assistant' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-[#2a2a2a] text-[var(--text-main)] rounded-bl-none border border-gray-100 dark:border-white/5'}`}>
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                    <p className={`text-[9px] mt-1 text-right opacity-70 ${msg.role === 'assistant' ? 'text-indigo-100' : 'text-gray-400'}`}>
                                        {msg.created_at ? format(new Date(msg.created_at), 'HH:mm', { locale: es }) : '...'}
                                    </p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input */}
            <div className="p-4 bg-white dark:bg-[#1e1e1e] border-t border-gray-100 dark:border-white/5">
                <form onSubmit={handleSendMessage} className="flex items-end gap-2 bg-gray-50 dark:bg-[#2a2a2a] p-2 rounded-xl border border-gray-200 dark:border-white/5">
                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={isAIEnabled ? "Activa Manual para responder..." : "Escribe un mensaje..."}
                        className="flex-1 bg-transparent border-none outline-none text-sm p-2 resize-none max-h-32"
                        rows={1}
                        disabled={isAIEnabled || isSending}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                    />
                    <button type="submit" disabled={!newMessage.trim() || isAIEnabled || isSending} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </form>
            </div>
        </div>
    )
}
