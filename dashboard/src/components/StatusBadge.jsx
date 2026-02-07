export function StatusBadge({ status, mini }) {
    const styles = {
        'NUEVO': 'text-orange-500 bg-orange-500/10',
        'DISEÑO': 'text-purple-500 bg-purple-500/10',
        'PRODUCCIÓN': 'text-yellow-500 bg-yellow-500/10',
        'LISTO': 'text-green-500 bg-green-500/10',
        'ENTREGADO': 'text-gray-500 bg-gray-500/10',
    }
    const colorClass = styles[status] || 'text-gray-500 bg-gray-100'
    return (
        <span className={`rounded-full font-bold flex items-center justify-center ${colorClass} ${mini ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-xs'} gap-1.5`}>
            {!mini && <span className="w-1.5 h-1.5 rounded-full bg-current"></span>}
            {status}
        </span>
    )
}
