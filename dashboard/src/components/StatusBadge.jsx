import { ORDER_STATUS } from '../constants'

export function StatusBadge({ status, mini = false }) {
    const styles = {
        [ORDER_STATUS.NEW]: 'bg-blue-100/50 text-blue-700 border-2 border-blue-200',
        [ORDER_STATUS.DESIGN]: 'bg-purple-100/50 text-purple-700 border-2 border-purple-200',
        [ORDER_STATUS.PRODUCTION]: 'bg-[var(--color-secondary)]/20 text-[var(--color-secondary)] border-2 border-[var(--color-secondary)]/30',
        [ORDER_STATUS.READY]: 'bg-[var(--color-primary)]/20 text-[var(--color-accent)] border-2 border-[var(--color-primary)]/30',
        [ORDER_STATUS.DELIVERED]: 'bg-gray-100 ring-2 ring-gray-200 text-gray-600 border-2 border-gray-300',
    }
    const colorClass = styles[status] || 'text-gray-500 bg-gray-100 border-2 border-gray-200'
    return (
        <span className={`rounded-lg font-bold flex items-center justify-center ${colorClass} ${mini ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-xs'} gap-1.5 shadow-sm`}>
            {!mini && <span className="w-1.5 h-1.5 rounded-full bg-current"></span>}
            {status}
        </span>
    )
}
