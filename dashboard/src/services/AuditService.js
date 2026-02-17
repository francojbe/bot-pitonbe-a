
import { supabase } from '../supabase'

export const AuditService = {
    // Log a status change
    async logStatusChange(orderId, oldStatus, newStatus, changedBy = 'system') {
        const { error } = await supabase.from('audit_logs').insert([{
            order_id: orderId,
            old_status: oldStatus,
            new_status: newStatus,
            change_type: 'STATUS_CHANGE',
            changed_by: changedBy,
            details: `Estado cambiado de ${oldStatus} a ${newStatus}`
        }])
        if (error) console.error("Error logging status change:", error)
    },

    // Log a payment update
    async logPaymentUpdate(orderId, oldAmount, newAmount, type = 'DEPOSIT', changedBy = 'system') {
        const { error } = await supabase.from('audit_logs').insert([{
            order_id: orderId,
            old_amount: oldAmount,
            new_amount: newAmount,
            change_type: type === 'DEPOSIT' ? 'PAYMENT_DEPOSIT' : 'PAYMENT_TOTAL_UPDATE',
            changed_by: changedBy,
            details: type === 'DEPOSIT'
                ? `Abono actualizado: $${oldAmount} -> $${newAmount}`
                : `Total actualizado: $${oldAmount} -> $${newAmount}`
        }])
        if (error) console.error("Error logging payment update:", error)
    },

    // Fetch logs for an order
    async getLogs(orderId) {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('order_id', orderId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error("Error fetching logs:", error)
            return []
        }
        return data
    },

    // 3. Fetch All Logs
    async getAllLogs(limit = 1000) {
        const { data, error } = await supabase
            .from('audit_logs')
            .select(`
                *,
                orders (
                    description,
                    leads (
                        name
                    )
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) {
            console.error("Error fetching all logs:", error)
            return []
        }
        return data
    }
}

