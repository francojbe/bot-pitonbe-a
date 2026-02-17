
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, Send, Phone, User, X, MessageSquare, Image, FileText, Bot, UserCheck, Settings, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

import { ChatWindow } from './ChatWindow'

export function ChatDrawer({ lead, onClose, isDarkMode }) {
    if (!lead) return null

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-[60] w-full sm:w-[450px] bg-white dark:bg-[#1e1e1e] shadow-2xl border-l border-gray-200 dark:border-white/10 flex flex-col"
        >
            {/* Wrapper Header (Drawer specific) */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 bg-white/50 dark:bg-[#1e1e1e]/50 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg overflow-hidden border border-gray-100 dark:border-white/10">
                        {lead.profile_picture_url ? (
                            <img src={lead.profile_picture_url} alt={lead.name} className="w-full h-full object-cover" />
                        ) : (
                            lead.name ? lead.name.charAt(0).toUpperCase() : <User size={20} />
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-[var(--text-main)] truncate max-w-[150px]">{lead.name || 'Cliente'}</h3>
                        <p className="text-[10px] text-gray-500 font-medium">{lead.phone_number}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Core Chat Window */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <ChatWindow lead={lead} isDarkMode={isDarkMode} />
            </div>
        </motion.div>
    )
}
