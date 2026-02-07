export function KpiCard({ title, val, icon }) {
    return (
        <div className="dashboard-card flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#F4F7FE] dark:bg-white/5 text-[#4318FF] flex items-center justify-center">
                {icon}
            </div>
            <div>
                <p className="text-sm text-[var(--text-secondary)] font-medium">{title}</p>
                <h4 className="text-2xl font-bold text-[var(--text-primary)]">{val}</h4>
            </div>
        </div>
    )
}
