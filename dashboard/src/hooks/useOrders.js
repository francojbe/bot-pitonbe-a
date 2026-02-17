import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useOrders() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchOrders()

        // Configurar suscripción realtime
        const channel = supabase.channel('realtime_orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    async function fetchOrders() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('orders')
                .select('*, leads(id, name, phone_number, rut, address, email)')
                .order('created_at', { ascending: false })

            if (error) throw error
            setOrders(data || [])
        } catch (err) {
            console.error('Error fetching orders:', err)
            setError(err)
        } finally {
            setLoading(false)
        }
    }

    // Permite recargar manualmente
    const refetch = fetchOrders

    return { orders, loading, error, refetch, setOrders }
}
