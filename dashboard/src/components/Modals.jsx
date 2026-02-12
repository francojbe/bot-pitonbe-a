import { useState, useEffect } from 'react'
import { X, User, Phone, Mail, DollarSign, Image, FileText, ExternalLink, MessageCircle, CheckCircle2, MapPin, CreditCard, ChevronRight, AlertCircle, Save, MessageSquarePlus } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../supabase'
import { StatusSelect } from './StatusSelect'
import { validateRut, formatRut, validatePhone, formatPhone as formatPhoneValidation } from '../utils/validation'
import { ORDER_STATUS_LIST } from '../constants'

// Helper
const formatPhone = (phone) => {
    if (!phone) return 'Sin Teléfono'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.startsWith('569') && cleaned.length === 11) {
        return `+56 9 ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`
    }
    if (cleaned.length === 8) {
        return `+56 9 ${cleaned.slice(0, 4)} ${cleaned.slice(4)}`
    }
    return phone
}

import { AuditService } from '../services/AuditService'

// Imports for PDF Viewer
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

export function OrderDrawer({ order, onClose, updateOrderLocal }) {
    const [form, setForm] = useState({ ...order })
    const [activeTab, setActiveTab] = useState('specs') // 'specs' or 'history'
    const [auditLogs, setAuditLogs] = useState([])
    const [isLoadingLogs, setIsLoadingLogs] = useState(false)

    // PDF Preview State
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null)
    const defaultLayoutPluginInstance = defaultLayoutPlugin()

    // ... (rest of the component state)

    // Load logs when activeTab becomes 'history'
    useEffect(() => {
        if (activeTab === 'history') {
            setIsLoadingLogs(true)
            AuditService.getLogs(order.id).then(logs => {
                setAuditLogs(logs)
                setIsLoadingLogs(false)
            })
        }
    }, [activeTab, order.id])

    // Safe Calculations
    const total = Number(form.total_amount) || 0
    const deposit = Number(form.deposit_amount) || 0
    const balance = total - deposit
    const isPaid = balance <= 0

    useEffect(() => {
        const t = setTimeout(async () => {
            if (JSON.stringify(form) !== JSON.stringify(order)) {
                const { leads, ...clean } = form
                const { error } = await supabase.from('orders').update(clean).eq('id', order.id)
                if (!error) updateOrderLocal(form)
            }
        }, 1000); return () => clearTimeout(t)
    }, [form])

    // Handle Status Change with Notification
    const handleStatusChange = async (newStatus) => {
        // 1. Optimistic Update
        setForm({ ...form, status: newStatus });

        // 2. Call Backend to Notify
        try {
            const BACKEND_URL = import.meta.env.VITE_API_URL;

            const response = await fetch(`${BACKEND_URL}/orders/update_status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: order.id, new_status: newStatus })
            });

            const data = await response.json();
            if (data.status === 'success') {
                AuditService.logStatusChange(order.id, form.status, newStatus)
                if (data.notified) toast.success(`Estado actualizado a ${newStatus} y cliente notificado.`);
                else toast.success(`Estado actualizado a ${newStatus} (Cliente sin teléfono).`);
            } else {
                toast.error("Error al notificar al cliente, pero el estado se guardó.");
            }
        } catch (e) {
            console.error("Error updating status:", e);
            toast.error("Error de conexión al notificar.");
        }
    };

    // Handle Payment Update with Notification
    const handlePaymentUpdate = async (newDeposit, newTotal) => {
        try {
            const BACKEND_URL = import.meta.env.VITE_API_URL;
            const actualDeposit = newDeposit !== undefined ? newDeposit : form.deposit_amount;
            const actualTotal = newTotal !== undefined ? newTotal : form.total_amount;

            // Optimistic Update
            setForm({ ...form, deposit_amount: actualDeposit, total_amount: actualTotal });

            const response = await fetch(`${BACKEND_URL}/orders/update_payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: order.id,
                    deposit_amount: Number(actualDeposit),
                    total_amount: Number(actualTotal)
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                updateOrderLocal({ ...form, deposit_amount: actualDeposit, total_amount: actualTotal });
                AuditService.logPaymentUpdate(order.id, form.deposit_amount, actualDeposit, 'DEPOSIT')
                if (form.total_amount !== actualTotal) {
                    AuditService.logPaymentUpdate(order.id, form.total_amount, actualTotal, 'TOTAL')
                }

                if (data.notified) toast.success("Pago registrado y cliente notificado. ✅");
                else toast.success("Pago guardado.");
            } else {
                toast.error("Error al registrar pago en el servidor.");
            }
        } catch (e) {
            console.error("Error updating payment:", e);
            toast.error("Error de conexión al registrar pago.");
        }
    };

    // Send WhatsApp with Quote Logic
    const sendWhatsApp = async () => {
        const phone = order.leads?.phone_number;
        if (!phone) return toast.error("Cliente sin teléfono");

        // Construct Specs List
        const specs = [
            form.material,
            form.dimensions,
            form.quantity ? `${form.quantity} un.` : null,
            form.print_sides
        ].filter(Boolean).join(', ');

        const specText = specs ? `\nEspecificaciones: ${specs}.` : '';

        const msg = `Hola ${order.leads?.name || 'Cliente'}! 👋\nTu pedido *${order.id.slice(0, 5)}* está en estado: *${order.status}*\n${order.description}${specText}\nGracias por preferirnos! ✨`;

        window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    // --- STATE PARA MODAL DE MENSAJE ---
    const [isMsgModalOpen, setIsMsgModalOpen] = useState(false)

    return (
        <div className="fixed inset-0 z-[60] flex justify-end">
            <div className="absolute inset-0 bg-[#0B1437]/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl h-full bg-white dark:bg-[#242424] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-white/5">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">Orden #{order.id.slice(0, 6)}</h2>
                        <p className="text-sm text-gray-500">Creada el {new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-500"><X size={24} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Status Tracker */}
                    <div className="flex justify-between items-center bg-[var(--bg-subtle)] dark:bg-white/5 p-4 rounded-xl">
                        <div className="flex flex-col w-full">
                            <span className="text-xs font-bold text-gray-500 uppercase mb-2">Estado Actual</span>
                            <StatusSelect
                                value={form.status}
                                onChange={handleStatusChange}
                                options={ORDER_STATUS_LIST}
                            />
                        </div>
                    </div>

                    {/* Client Info Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="dashboard-card !shadow-none border border-gray-100 dark:border-white/5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><User size={18} /></div>
                                <h3 className="font-bold text-[var(--text-main)]">Cliente</h3>
                            </div>
                            <div className="space-y-3">
                                <p className="font-bold text-lg">{order.leads?.name || 'Cliente Desconocido'}</p>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Phone size={14} /> <a href={`tel:${order.leads?.phone_number}`} className="hover:underline">{formatPhone(order.leads?.phone_number)}</a>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Mail size={14} /> <span>{order.leads?.email || 'Sin Email'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="dashboard-card !shadow-none border border-gray-100 dark:border-white/5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-green-50 text-green-600 rounded-lg"><DollarSign size={18} /></div>
                                <h3 className="font-bold text-[var(--text-main)]">Pagos</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-[var(--text-secondary)] font-medium">Total Estimado</span>
                                    <div className="relative">
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[#A3AED0] font-bold text-sm pointer-events-none">$</span>
                                        <input
                                            type="text"
                                            value={form.total_amount ? Number(form.total_amount).toLocaleString('es-CL') : ''}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                setForm({ ...form, total_amount: val ? Number(val) : 0 })
                                            }}
                                            onBlur={() => {
                                                if (form.total_amount !== order.total_amount) {
                                                    handlePaymentUpdate(undefined, form.total_amount);
                                                }
                                            }}
                                            className="text-right font-bold w-32 bg-transparent outline-none border-b border-gray-200 dark:border-white/10 focus:border-[var(--color-primary)] transition-colors text-[#A3AED0] pl-4"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-[var(--text-secondary)] font-medium">Abonado</span>
                                    <div className="relative">
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[#A3AED0] font-bold text-sm pointer-events-none">$</span>
                                        <input
                                            type="text"
                                            value={form.deposit_amount ? Number(form.deposit_amount).toLocaleString('es-CL') : ''}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                setForm({ ...form, deposit_amount: val ? Number(val) : 0 })
                                            }}
                                            onBlur={() => {
                                                if (form.deposit_amount !== order.deposit_amount) {
                                                    handlePaymentUpdate(form.deposit_amount, undefined);
                                                }
                                            }}
                                            className="text-right font-bold w-32 bg-transparent outline-none border-b border-gray-200 dark:border-white/10 focus:border-[var(--color-primary)] transition-colors text-[#A3AED0] pl-4"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="h-px bg-gray-100 dark:bg-white/10 my-2"></div>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-[var(--text-main)] text-lg">Saldo Pendiente</span>
                                    <span className={`font-black text-2xl ${isPaid ? 'text-green-500' : 'text-red-500'}`}>
                                        {isPaid ? 'PAGADO' : `$${balance.toLocaleString('es-CL')}`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TABS HEADER */}
                    <div className="flex border-b border-gray-100 dark:border-white/5 mb-4">
                        <button
                            onClick={() => setActiveTab('specs')}
                            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'specs' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 hover:text-[var(--text-main)]'}`}
                        >
                            Especificaciones
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 hover:text-[var(--text-main)]'}`}
                        >
                            Historial
                        </button>
                    </div>

                    {/* SPECS TAB */}
                    {activeTab === 'specs' && (
                        <div>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Material</label>
                                    <select
                                        value={form.material || ''}
                                        onChange={e => setForm({ ...form, material: e.target.value })}
                                        className="w-full p-3 rounded-xl bg-[var(--bg-subtle)] dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none text-[var(--text-main)] font-bold text-sm cursor-pointer transition-all"
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="Couché 300g">Couché 300g</option>
                                        <option value="Couché 170g">Couché 170g</option>
                                        <option value="Bond 80g">Bond 80g</option>
                                        <option value="Adhesivo Papel">Adhesivo Papel</option>
                                        <option value="Adhesivo PVC">Adhesivo PVC</option>
                                        <option value="Opalina">Opalina</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Medidas</label>
                                    <div className="relative">
                                        <select
                                            className="w-full p-3 rounded-xl bg-[var(--bg-subtle)] dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none text-[var(--text-main)] font-bold text-sm cursor-pointer transition-all"
                                            onChange={e => setForm({ ...form, dimensions: e.target.value })}
                                            value={['9x5 cm', '10x15 cm', 'A4', 'A3', 'Carta', 'Oficio'].includes(form.dimensions) ? form.dimensions : 'custom'}
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="9x5 cm">9x5 cm (Tarjeta)</option>
                                            <option value="10x15 cm">10x15 cm</option>
                                            <option value="Carta">Carta</option>
                                            <option value="Oficio">Oficio</option>
                                            <option value="A4">A4</option>
                                            <option value="A3">A3</option>
                                            <option value="custom">Personalizado...</option>
                                        </select>
                                        {!['9x5 cm', '10x15 cm', 'A4', 'A3', 'Carta', 'Oficio', ''].includes(form.dimensions) && (
                                            <input
                                                type="text"
                                                placeholder="Ej: 50x50 cm"
                                                value={form.dimensions || ''}
                                                onChange={e => setForm({ ...form, dimensions: e.target.value })}
                                                className="mt-2 w-full p-2 rounded-lg bg-[#F4F7FE] dark:bg-white/5 border-none text-sm font-bold animate-in fade-in"
                                            />
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Cantidad</label>
                                    <input
                                        type="number"
                                        value={form.quantity || ''}
                                        onChange={e => setForm({ ...form, quantity: e.target.value })}
                                        className="w-full p-3 rounded-xl bg-[var(--bg-subtle)] dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none text-[var(--text-main)] font-bold text-sm transition-all"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Lados de Impresión</label>
                                    <select
                                        value={form.print_sides || '1 Tiro'}
                                        onChange={e => setForm({ ...form, print_sides: e.target.value })}
                                        className="w-full p-3 rounded-xl bg-[var(--bg-subtle)] dark:bg-white/5 border border-transparent focus:border-[var(--color-primary)] outline-none text-[var(--text-main)] font-bold text-sm cursor-pointer transition-all appearance-none"
                                    >
                                        <option value="1 Tiro">1 Tiro (Solo Frente)</option>
                                        <option value="2 Tiros">2 Tiros (Frente y Dorso)</option>
                                    </select>
                                </div>
                            </div>

                            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2 block">Notas Adicionales / Descripción</label>
                            <textarea
                                rows={3}
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                className="w-full p-4 rounded-xl bg-[var(--bg-subtle)] dark:bg-white/5 border-none outline-none text-[var(--text-main)] font-medium resize-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all leading-relaxed mb-6"
                                placeholder="Detalles extra..."
                            ></textarea>
                        </div>
                    )}

                    {/* HISTORY TAB */}
                    {activeTab === 'history' && (
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {isLoadingLogs ? (
                                <div className="text-center py-8 text-[var(--text-secondary)]">Cargando historial...</div>
                            ) : auditLogs.length === 0 ? (
                                <div className="text-center py-8 text-[var(--text-secondary)] italic">No hay historial registrado aún.</div>
                            ) : (
                                <div className="relative border-l-2 border-gray-100 dark:border-white/10 ml-3 space-y-6 pb-2">
                                    {auditLogs.map((log) => (
                                        <div key={log.id} className="relative pl-6">
                                            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white dark:border-[#111C44] ${log.change_type.includes('STATUS') ? 'bg-blue-500' :
                                                log.change_type.includes('PAYMENT') ? 'bg-green-500' : 'bg-gray-400'
                                                }`}></div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-0.5">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </span>
                                                <span className="text-sm font-bold text-[var(--text-primary)]">
                                                    {log.change_type === 'STATUS_CHANGE' ? 'Cambio de Estado' :
                                                        log.change_type.includes('PAYMENT') ? 'Actualización de Pago' : 'Evento'}
                                                </span>
                                                <p className="text-xs text-[var(--text-secondary)] mt-1 bg-[#F4F7FE] dark:bg-white/5 p-2 rounded-lg">
                                                    {log.details}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Files Section */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Archivos Adjuntos</label>
                            {/* Allow upload trigger here later */}
                        </div>
                        {order.files_url && order.files_url.length > 0 ? (
                            <div className="grid grid-cols-2 gap-4">
                                {order.files_url.map((file, i) => {
                                    const isPdf = file.toLowerCase().endsWith('.pdf');
                                    const fileName = decodeURIComponent(file.split('/').pop());

                                    return (
                                        <a
                                            key={i}
                                            href={file}
                                            onClick={(e) => {
                                                if (isPdf) {
                                                    e.preventDefault();
                                                    setPdfPreviewUrl(file);
                                                }
                                            }}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-[#F4F7FE] dark:hover:bg-white/5 transition-colors group cursor-pointer"
                                            title={isPdf ? "Click para previsualizar PDF" : "Descargar archivo"}
                                        >
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isPdf ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {isPdf ? <FileText size={18} /> : (file.match(/\.(jpg|jpeg|png|gif)$/i) ? <Image size={18} /> : <FileText size={18} />)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate">{fileName}</p>
                                                <p className="text-xs text-[var(--text-secondary)] uppercase">{file.split('.').pop()}</p>
                                            </div>
                                            <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </a>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl flex flex-col items-center justify-center text-[var(--text-secondary)] gap-2">
                                <FileText size={32} className="opacity-20" />
                                <p className="text-sm font-medium">No hay archivos adjuntos</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#242424] flex gap-4">
                    {/* Botón WhatsApp Web (Existente) - Estilo Secundario */}
                    {order.leads?.phone_number && (
                        <button
                            onClick={sendWhatsApp}
                            title="Abrir WhatsApp Web"
                            className="px-4 py-3 bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                        >
                            <ExternalLink size={18} />
                        </button>
                    )}

                    {/* NUEVO: Botón Mensaje Vía Agente (Principal) */}
                    <button
                        onClick={() => setIsMsgModalOpen(true)}
                        className="flex-1 btn-primary-paper flex items-center justify-center gap-2"
                    >
                        <MessageSquarePlus size={18} /> Enviar Mensaje
                    </button>

                    {!isPaid && (
                        <button
                            onClick={() => handlePaymentUpdate(form.total_amount, undefined)}
                            className="px-6 py-3 bg-green-500/10 text-green-600 rounded-xl font-bold hover:bg-green-500/20 transition-colors flex items-center gap-2"
                        >
                            <CheckCircle2 size={18} /> Pago Total
                        </button>
                    )}
                </div>

                {/* MODAL DE MENSAJE */}
                <MessageModal
                    isOpen={isMsgModalOpen}
                    onClose={() => setIsMsgModalOpen(false)}
                    customerName={order.leads?.name || 'Cliente'}
                    phoneNumber={order.leads?.phone_number}
                    leadId={order.leads?.id}
                />

                {/* PDF PREVIEW MODAL */}
                {pdfPreviewUrl && (
                    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPdfPreviewUrl(null)}>
                        <div className="bg-white w-full h-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                                <h3 className="font-bold flex items-center gap-2"><FileText size={18} className="text-red-500" /> Previsualización PDF {decodeURIComponent(pdfPreviewUrl.split('/').pop())}</h3>
                                <button onClick={() => setPdfPreviewUrl(null)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} /></button>
                            </div>
                            <div className="flex-1 overflow-auto bg-gray-100">
                                <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
                                    <Viewer
                                        fileUrl={pdfPreviewUrl}
                                        plugins={[defaultLayoutPluginInstance]}
                                    />
                                </Worker>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export function LeadModal({ isOpen, isCreating, form: initialForm, onClose, onSubmit }) {
    const [formData, setFormData] = useState(initialForm || {})
    const [errors, setErrors] = useState({})

    useEffect(() => {
        setFormData(initialForm || {})
        setErrors({})
    }, [initialForm, isOpen])

    if (!isOpen) return null

    const handleChange = (field, value) => {
        let finalValue = value
        let newErrors = { ...errors }

        if (field === 'rut') {
            finalValue = formatRut(value)
            // Validar RUT
            if (!validateRut(finalValue)) {
                newErrors.rut = 'RUT inválido'
            } else {
                delete newErrors.rut
            }
        }

        if (field === 'phone_number') {
            // Solo permitir números y +
            finalValue = value
            if (value.replace(/\D/g, '').length < 8) {
                newErrors.phone_number = 'Teléfono incompleto'
            } else {
                delete newErrors.phone_number
            }
        }

        setFormData(prev => ({ ...prev, [field]: finalValue }))
        setErrors(newErrors)
    }

    const handleSubmit = (e) => {
        e.preventDefault() // Prevenir recarga

        // Validación Final al Guardar
        const newErrors = {}
        if (!formData.name) newErrors.name = 'El nombre es obligatorio'
        if (formData.rut && !validateRut(formData.rut)) newErrors.rut = 'RUT inválido'

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            toast.error("Por favor corrige los errores antes de guardar")
            return
        }

        onSubmit(formData)
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0B1437]/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="dashboard-card w-full max-w-2xl relative animate-in zoom-in duration-200 p-0 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-white/5">
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">{isCreating ? 'Nuevo Cliente' : 'Ficha de Cliente'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-[var(--text-secondary)]"><X size={24} /></button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Col 1 */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Nombre Completo *</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        className={`dashboard-input w-full pl-9 ${errors.name ? 'border-red-500 bg-red-50/10' : ''}`}
                                        placeholder="Ej: Juan Pérez"
                                        value={formData.name || ''}
                                        onChange={e => handleChange('name', e.target.value)}
                                    />
                                </div>
                                {errors.name && <p className="text-[10px] text-red-500 mt-1 font-bold flex items-center gap-1"><AlertCircle size={10} /> {errors.name}</p>}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">RUT / DNI</label>
                                <div className="relative">
                                    <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        className={`dashboard-input w-full pl-9 ${errors.rut ? 'border-red-500 bg-red-50/10' : ''}`}
                                        placeholder="Ej: 12.345.678-K"
                                        value={formData.rut || ''}
                                        onChange={e => handleChange('rut', e.target.value)}
                                        maxLength={12}
                                    />
                                </div>
                                {errors.rut && <p className="text-[10px] text-red-500 mt-1 font-bold flex items-center gap-1"><AlertCircle size={10} /> {errors.rut}</p>}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Teléfono (WhatsApp)</label>
                                <div className="relative">
                                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        className={`dashboard-input w-full pl-9 ${errors.phone_number ? 'border-red-500 bg-red-50/10' : ''}`}
                                        placeholder="Ej: +56912345678"
                                        value={formData.phone_number || ''}
                                        onChange={e => handleChange('phone_number', e.target.value)}
                                    />
                                </div>
                                <p className="text-[10px] text-[var(--text-secondary)] mt-1 ml-1 opacity-70">Formato: +569...</p>
                                {errors.phone_number && <p className="text-[10px] text-red-500 mt-1 font-bold flex items-center gap-1"><AlertCircle size={10} /> {errors.phone_number}</p>}
                            </div>
                        </div>

                        {/* Col 2 */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Email</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input className="dashboard-input w-full pl-9" placeholder="cliente@email.com" value={formData.email || ''} onChange={e => handleChange('email', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Nombre Empresa / Fantasía</label>
                                <input className="dashboard-input w-full" placeholder="Ej: Distribuidora XP" value={formData.business_name || ''} onChange={e => handleChange('business_name', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Dirección / Comuna</label>
                                <div className="relative">
                                    <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input className="dashboard-input w-full pl-9" placeholder="Ej: Av. Providencia 1234" value={formData.address || ''} onChange={e => handleChange('address', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3 mt-auto bg-white dark:bg-[#242424] rounded-b-2xl">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">Cancelar</button>
                    <button onClick={handleSubmit} className="px-8 py-2.5 bg-[var(--color-primary)] text-[var(--text-main)] rounded-xl font-bold shadow-[var(--shadow-card)] hover:scale-105 transition-transform flex items-center gap-2">
                        <Save size={18} />
                        Guardar Datos
                    </button>
                </div>
            </div>
        </div>
    )
}

export function MessageModal({ isOpen, onClose, customerName, phoneNumber, leadId }) {
    const [message, setMessage] = useState('')
    const [isSending, setIsSending] = useState(false)

    if (!isOpen) return null

    const handleSend = async () => {
        if (!message.trim()) return toast.error("El mensaje no puede estar vacío");

        setIsSending(true);
        try {
            const BACKEND_URL = import.meta.env.VITE_API_URL;

            const response = await fetch(`${BACKEND_URL}/send_custom_message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone_number: phoneNumber,
                    message: message,
                    lead_id: leadId
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                toast.success("Mensaje enviado y registrado correctamente 💬");
                setMessage('');
                onClose();
            } else {
                toast.error("Error al enviar mensaje: " + (data.message || "Error desconocido"));
            }

        } catch (error) {
            console.error("Error sending message:", error);
            toast.error("Error de conexión al enviar mensaje");
        } finally {
            setIsSending(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0B1437]/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="dashboard-card w-full max-w-md relative animate-in zoom-in duration-200 p-0 flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-white/5 bg-[var(--color-primary)] text-white rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <MessageCircle size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Mensaje Vía Agente</h2>
                            <p className="text-xs text-white/80">Para: {customerName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"><X size={20} /></button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 bg-white dark:bg-[#1B254B]">
                    <div className="bg-blue-50 dark:bg-blue-500/10 p-3 rounded-xl border border-blue-100 dark:border-blue-500/20">
                        <p className="text-xs text-blue-600 dark:text-blue-300 flex gap-2">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            <span>
                                <b>Nota:</b> Este mensaje se enviará a través del Agente y quedará registrado en el historial de la conversación.
                            </span>
                        </p>
                    </div>

                    <div>
                        <textarea
                            autoFocus
                            rows={6}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Escribe tu mensaje aquí..."
                            className="w-full p-4 rounded-xl bg-gray-50 dark:bg-[#111C44] border border-transparent focus:border-[var(--color-primary)] outline-none text-[var(--text-main)] resize-none transition-all placeholder:text-gray-400"
                        ></textarea>
                        <div className="flex justify-between mt-2">
                            <span className="text-xs text-gray-400">Se usará formato WhatsApp (*negrita*, etc.)</span>
                            <span className={`text-xs font-bold ${message.length > 500 ? 'text-red-500' : 'text-gray-400'}`}>{message.length} car.</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#111C44] rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSending}
                        className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={isSending || !message.trim()}
                        className="btn-primary-paper px-6 py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSending ? (
                            <>
                                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                                Enviando...
                            </>
                        ) : (
                            <>
                                <MessageCircle size={18} />
                                Enviar Mensaje
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
