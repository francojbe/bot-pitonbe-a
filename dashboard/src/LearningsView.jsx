import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Brain, AlertTriangle, Play, Loader2 } from 'lucide-react';

export default function LearningsView() {
    const [learnings, setLearnings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [auditing, setAuditing] = useState(false);

    // Use relative path for production (same domain) or localhost for dev if needed
    // Assuming the dashboard is served from the same domain or configured similarly to other components.
    // Based on App.jsx, I should check how the backend URL is handled. 
    // In App.jsx it seems hardcoded or relative? 
    // Let's assume production URL logic or relative path if proxied.
    // Actually, looking at App.jsx from previous turns, it used explicit full URL: "https://recuperadora-agente-pb.nojauc.easypanel.host"
    const BACKEND_URL = import.meta.env.VITE_API_URL || "https://recuperadora-agente-pb.nojauc.easypanel.host";

    const fetchLearnings = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${BACKEND_URL}/learnings`);
            if (res.ok) {
                const data = await res.json();
                setLearnings(data);
            }
        } catch (error) {
            console.error("Error fetching learnings:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLearnings();
    }, []);

    const handleAction = async (id, action) => { // action: 'approve' | 'reject'
        try {
            const res = await fetch(`${BACKEND_URL}/learnings/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            if (res.ok) {
                // Optimistic update
                setLearnings(learnings.map(l =>
                    l.id === id ? { ...l, status: action === 'approve' ? 'approved' : 'rejected' } : l
                ));
            } else {
                alert("Error al procesar la acción");
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión");
        }
    };

    const runAuditNow = async () => {
        setAuditing(true);
        try {
            const res = await fetch(`${BACKEND_URL}/learnings/run_audit`, { method: 'POST' });
            if (res.ok) {
                alert("Auditoría iniciada. Los resultados aparecerán en unos momentos.");
                // Retraso para dar tiempo al backend
                setTimeout(fetchLearnings, 3000);
            } else {
                alert("Error al iniciar auditoría");
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión");
        } finally {
            setAuditing(false);
        }
    };

    const pending = learnings.filter(l => l.status === 'pending');
    const history = learnings.filter(l => l.status !== 'pending');

    return (
        <div className="p-6 bg-[var(--bg-subtle)] min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <header>
                    <h1 className="text-3xl font-bold text-[var(--text-main)] flex items-center gap-2">
                        <Brain className="w-8 h-8 text-[var(--color-primary)]" />
                        Centro de Mejora Continua
                    </h1>
                    <p className="text-gray-500 mt-2">
                        Aquí revisas las lecciones que el Agente "Richard" ha aprendido de sus errores.
                    </p>
                </header>
                <button
                    onClick={runAuditNow}
                    disabled={auditing}
                    className="px-4 py-2 bg-[var(--color-primary)] text-[var(--text-main)] rounded-lg flex items-center gap-2 hover:bg-[#9bd64b] transition-all font-bold shadow-[var(--shadow-card)] border-2 border-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {auditing ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                    {auditing ? 'Auditando...' : 'Ejecutar Auditoría Ahora'}
                </button>
            </div>

            {/* PENDING SECTION */}
            <section className="mb-10">
                <h2 className="text-xl font-semibold text-[var(--text-main)] mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[var(--color-secondary)]" />
                    Propuestas Pendientes ({pending.length})
                </h2>

                {loading ? (
                    <p className="text-slate-400">Cargando...</p>
                ) : pending.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 text-center">
                        <p className="text-slate-500">🎉 No hay errores pendientes de revisión hoy.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {pending.map(item => (
                            <div key={item.id} className="dashboard-card p-5 !rounded-xl !border-l-4 !border-l-[var(--color-primary)] transition-all hover:shadow-lg bg-white dark:bg-[#242424]">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wide">
                                            Error Detectado
                                        </span>
                                        <h3 className="text-lg font-medium text-[var(--text-main)] mt-1 mb-2">
                                            {item.error_description}
                                        </h3>
                                        <div className="bg-[var(--bg-subtle)] p-3 rounded-lg border border-gray-200 dark:border-white/10">
                                            <span className="text-xs font-bold text-gray-500 uppercase">Nueva Regla Propuesta:</span>
                                            <p className="text-[var(--text-main)] mt-1 font-mono text-sm leading-relaxed">
                                                "{item.proposed_rule}"
                                            </p>
                                        </div>
                                        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                                            <span>Cliente: {item.source_phone}</span>
                                            <span>Confianza: {(item.confidence_score * 100).toFixed(0)}%</span>
                                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 ml-4">
                                        <button
                                            onClick={() => handleAction(item.id, 'approve')}
                                            className="px-4 py-2 bg-[#8DC63F]/20 text-[#4F6128] hover:bg-[#8DC63F]/30 rounded-lg flex items-center gap-2 font-medium transition-colors"
                                        >
                                            <CheckCircle size={18} /> Aprobar
                                        </button>
                                        <button
                                            onClick={() => handleAction(item.id, 'reject')}
                                            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg flex items-center gap-2 font-medium transition-colors"
                                        >
                                            <XCircle size={18} /> Rechazar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* HISTORY TABLE */}
            <section>
                <h2 className="text-xl font-semibold text-[var(--text-main)] mb-4">Historial de Decisiones</h2>
                <div className="bg-white dark:bg-[#242424] rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--bg-subtle)] dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                            <tr>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Fecha</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Error</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Regla</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {history.map(item => (
                                <tr key={item.id} className="hover:bg-[var(--bg-subtle)] dark:hover:bg-white/5">
                                    <td className="p-4 text-sm text-gray-500">
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-sm text-[var(--text-main)] w-1/3">
                                        {item.error_description}
                                    </td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400 w-1/3 font-mono text-xs">
                                        {item.proposed_rule}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.status === 'approved' ? 'bg-[#8DC63F]/20 text-[#4F6128]' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {item.status.toUpperCase()}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {history.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-400 italic">
                                        Aún no hay historial.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
