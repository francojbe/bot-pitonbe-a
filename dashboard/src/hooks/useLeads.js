import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useLeads() {
    const [leads, setLeads] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchLeads()

        // Configurar suscripción realtime
        const channel = supabase.channel('realtime_leads')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchLeads)
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    async function fetchLeads() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('name', { ascending: true })

            if (error) throw error
            setLeads(data || [])
        } catch (err) {
            console.error('Error fetching leads:', err)
            setError(err)
        } finally {
            setLoading(false)
        }
    }

    const refetch = fetchLeads

    return { leads, loading, error, refetch, setLeads }
}
