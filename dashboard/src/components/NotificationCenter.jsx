import { useState, useRef, useEffect } from 'react'
import { Bell, X, Check, Trash2, Info, AlertTriangle, FileText, Magnet } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { useNotifications } from '../hooks/useNotifications'

export function NotificationCenter({ isDarkMode, onOpenChat }) {
    const [isOpen, setIsOpen] = useState(false)
    const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications()
    const containerRef = useRef(null)

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const getIcon = (type) => {
        switch (type) {
            case 'intent': return <Magnet className="text-[var(--color-secondary)]" size={18} />
            case 'file': return <FileText className="text-[var(--color-primary)]" size={18} />
            case 'urgent': return <AlertTriangle className="text-red-500" size={18} />
            default: return <Info className="text-[var(--color-accent)]" size={18} />
        }
    }

    return (
        <div className="relative" ref={containerRef}>
            {/* Bell Icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-[#242424]">
                        {unreadCount > 9 ? '+9' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-4 w-80 sm:w-96 bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden z-[100]"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                            <h3 className="font-bold text-[var(--text-main)]">Notificaciones</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs font-bold text-[var(--color-primary)] hover:brightness-90 transition-colors"
                                >
                                    Marcar todo leído
                                </button>
                            )}
                        </div>

                        {/* Notifications List */}
                        <div className="max-h-[400px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-10 text-center text-gray-400">
                                    <Bell size={40} className="mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">No tienes notificaciones pendientes</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50 dark:divide-white/5">
                                    {notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            className={`p-4 flex gap-3 group transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${!notif.is_read ? 'bg-[var(--color-primary)]/10 dark:bg-[var(--color-primary)]/5' : ''}`}
                                        >
                                            <div className="mt-1 shrink-0 relative">
                                                <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center overflow-hidden border border-gray-100 dark:border-white/10">
                                                    {notif.leads?.profile_picture_url ? (
                                                        <img src={notif.leads.profile_picture_url} alt={notif.leads.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="text-xs font-bold text-[var(--color-accent)] dark:text-[var(--color-primary)] uppercase">
                                                            {notif.leads?.name?.charAt(0) || '?'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-[#1e1e1e] rounded-full p-0.5 shadow-sm border border-gray-100 dark:border-white/10">
                                                    {getIcon(notif.type)}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <p className={`text-sm font-bold truncate ${!notif.is_read ? 'text-[var(--text-main)]' : 'text-gray-500'}`}>
                                                        {notif.leads?.name ? `${notif.leads.name}: ${notif.title}` : notif.title}
                                                    </p>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {!notif.is_read && (
                                                            <button
                                                                onClick={() => markAsRead(notif.id)}
                                                                className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                                                title="Leído"
                                                            >
                                                                <Check size={14} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => deleteNotification(notif.id)}
                                                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                                                    {notif.message}
                                                </p>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-[10px] text-gray-400">
                                                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: es })}
                                                    </span>
                                                    {(notif.type === 'intent' || notif.type === 'file') && (
                                                        <button
                                                            onClick={() => {
                                                                setIsOpen(false);
                                                                onOpenChat(notif.leads);
                                                            }}
                                                            className="text-[10px] font-bold text-[var(--color-primary)] hover:underline"
                                                        >
                                                            Ver detalles
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-3 bg-gray-50/50 dark:bg-white/5 text-center border-t border-gray-100 dark:border-white/5">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                Cerrar centro de alertas
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
