export function KpiCard({ title, val, icon }) {
    return (
        <div className="dashboard-card flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[var(--bg-subtle)] dark:bg-white/5 text-[var(--color-primary)] flex items-center justify-center">
                {icon}
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">{title}</p>
                <h4 className="text-2xl font-bold text-[var(--text-main)]">{val}</h4>
            </div>
        </div>
    )
}
