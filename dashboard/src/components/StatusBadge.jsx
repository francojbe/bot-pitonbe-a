import { ORDER_STATUS } from '../constants'

export function StatusBadge({ status, mini = false }) {
    const styles = {
        [ORDER_STATUS.NEW]: 'bg-blue-100 text-blue-600',
        [ORDER_STATUS.DESIGN]: 'bg-purple-100 text-purple-600',
        [ORDER_STATUS.PRODUCTION]: 'bg-orange-100 text-orange-600',
        [ORDER_STATUS.READY]: 'bg-indigo-100 text-indigo-600',
        [ORDER_STATUS.DELIVERED]: 'bg-green-100 text-green-600',
    }
    const colorClass = styles[status] || 'text-gray-500 bg-gray-100'
    return (
        <span className={`rounded-full font-bold flex items-center justify-center ${colorClass} ${mini ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-xs'} gap-1.5`}>
            {!mini && <span className="w-1.5 h-1.5 rounded-full bg-current"></span>}
            {status}
        </span>
    )
}
