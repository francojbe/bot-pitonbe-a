import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useNotifications() {
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchNotifications()

        const channel = supabase.channel('realtime_notifications')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notifications'
            }, () => {
                fetchNotifications()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    async function fetchNotifications() {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*, leads(*)')
                .eq('is_archived', false)
                .order('created_at', { ascending: false })
                .limit(20)

            if (error) throw error

            setNotifications(data || [])
            setUnreadCount((data || []).filter(n => !n.is_read).length)
        } catch (err) {
            console.error('Error fetching notifications:', err)
        } finally {
            setLoading(false)
        }
    }

    const markAsRead = async (id) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id)
        if (!error) fetchNotifications()
    }

    const markAllAsRead = async () => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('is_read', false)
        if (!error) fetchNotifications()
    }

    const deleteNotification = async (id) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_archived: true })
            .eq('id', id)
        if (!error) fetchNotifications()
    }

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refetch: fetchNotifications
    }
}
