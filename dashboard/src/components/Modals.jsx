import { useState, useEffect } from 'react'
import { X, User, Phone, Mail, DollarSign, Image, FileText, ExternalLink, MessageCircle, CheckCircle2, MapPin, CreditCard, ChevronRight, AlertCircle, Save } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../supabase'
import { StatusSelect } from './StatusSelect'
import { validateRut, formatRut, validatePhone, formatPhone as formatPhoneValidation } from '../utils/validation'

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

export function OrderDrawer({ order, onClose, updateOrderLocal }) {
    const [form, setForm] = useState({ ...order })

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
            const BACKEND_URL = import.meta.env.VITE_API_URL || "https://recuperadora-agente-pb.nojauc.easypanel.host";

            const response = await fetch(`${BACKEND_URL}/orders/update_status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: order.id, new_status: newStatus })
            });

            const data = await response.json();
            if (data.status === 'success') {
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
            const BACKEND_URL = import.meta.env.VITE_API_URL || "https://recuperadora-agente-pb.nojauc.easypanel.host";
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

    return (
        <div className="fixed inset-0 z-[60] flex justify-end">
            <div className="absolute inset-0 bg-[#0B1437]/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl h-full bg-[var(--bg-card)] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-white/5">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Orden #{order.id.slice(0, 6)}</h2>
                        <p className="text-sm text-[var(--text-secondary)]">Creada el {new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-[var(--text-secondary)]"><X size={24} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Status Tracker */}
                    {/* Status Tracker */}
                    <div className="flex justify-between items-center bg-[#F4F7FE] dark:bg-white/5 p-4 rounded-xl">
                        <div className="flex flex-col w-full">
                            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2">Estado Actual</span>
                            <StatusSelect
                                value={form.status}
                                onChange={handleStatusChange}
                                options={['NUEVO', 'DISEÑO', 'PRODUCCIÓN', 'LISTO', 'ENTREGADO']}
                            />
                        </div>
                    </div>

                    {/* Client Info Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="dashboard-card !shadow-none border border-gray-100 dark:border-white/5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><User size={18} /></div>
                                <h3 className="font-bold text-[var(--text-primary)]">Cliente</h3>
                            </div>
                            <div className="space-y-3">
                                <p className="font-bold text-lg">{order.leads?.name || 'Cliente Desconocido'}</p>
                                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                                    <Phone size={14} /> <a href={`tel:${order.leads?.phone_number}`} className="hover:underline">{formatPhone(order.leads?.phone_number)}</a>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                                    <Mail size={14} /> <span>{order.leads?.email || 'Sin Email'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="dashboard-card !shadow-none border border-gray-100 dark:border-white/5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-green-50 text-green-600 rounded-lg"><DollarSign size={18} /></div>
                                <h3 className="font-bold text-[var(--text-primary)]">Pagos</h3>
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
                                            className="text-right font-bold w-32 bg-transparent outline-none border-b border-gray-200 dark:border-white/10 focus:border-[var(--brand-primary)] transition-colors text-[#A3AED0] pl-4"
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
                                            className="text-right font-bold w-32 bg-transparent outline-none border-b border-gray-200 dark:border-white/10 focus:border-[var(--brand-primary)] transition-colors text-[#A3AED0] pl-4"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="h-px bg-gray-100 dark:bg-white/10 my-2"></div>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-[var(--text-primary)] text-lg">Saldo Pendiente</span>
                                    <span className={`font-black text-2xl ${isPaid ? 'text-green-500' : 'text-red-500'}`}>
                                        {isPaid ? 'PAGADO' : `$${balance.toLocaleString('es-CL')}`}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {/* Details Section Structured */}
                        <div>
                            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-3 block">Especificaciones del Pedido</label>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Material</label>
                                    <select
                                        value={form.material || ''}
                                        onChange={e => setForm({ ...form, material: e.target.value })}
                                        className="w-full p-3 rounded-xl bg-[#F4F7FE] dark:bg-white/5 border border-transparent focus:border-[var(--brand-primary)] outline-none text-[var(--text-primary)] font-bold text-sm cursor-pointer transition-all"
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
                                            className="w-full p-3 rounded-xl bg-[#F4F7FE] dark:bg-white/5 border border-transparent focus:border-[var(--brand-primary)] outline-none text-[var(--text-primary)] font-bold text-sm cursor-pointer transition-all"
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
                                        className="w-full p-3 rounded-xl bg-[#F4F7FE] dark:bg-white/5 border border-transparent focus:border-[var(--brand-primary)] outline-none text-[var(--text-primary)] font-bold text-sm transition-all"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 block">Lados de Impresión</label>
                                    <select
                                        value={form.print_sides || '1 Tiro'}
                                        onChange={e => setForm({ ...form, print_sides: e.target.value })}
                                        className="w-full p-3 rounded-xl bg-[#F4F7FE] dark:bg-white/5 border border-transparent focus:border-[var(--brand-primary)] outline-none text-[var(--text-primary)] font-bold text-sm cursor-pointer transition-all appearance-none"
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
                                className="w-full p-4 rounded-xl bg-[#F4F7FE] dark:bg-white/5 border-none outline-none text-[var(--text-primary)] font-medium resize-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all leading-relaxed mb-6"
                                placeholder="Detalles extra..."
                            ></textarea>
                        </div>

                        {/* Files Section */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">Archivos Adjuntos</label>
                                {/* Allow upload trigger here later */}
                            </div>
                            {order.files_url && order.files_url.length > 0 ? (
                                <div className="grid grid-cols-2 gap-4">
                                    {order.files_url.map((file, i) => (
                                        <a key={i} href={file} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-[#F4F7FE] dark:hover:bg-white/5 transition-colors group">
                                            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                                {file.match(/\.(jpg|jpeg|png|gif)$/i) ? <Image size={18} /> : <FileText size={18} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate">Archivo {i + 1}</p>
                                                <p className="text-xs text-[var(--text-secondary)] uppercase">{file.split('.').pop()}</p>
                                            </div>
                                            <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </a>
                                    ))}
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
                    <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-[var(--bg-card)] flex gap-4">
                        <button onClick={sendWhatsApp} className="flex-1 btn-primary-soft flex items-center justify-center gap-2">
                            <MessageCircle size={18} /> Enviar WhatsApp
                        </button>
                        {!isPaid && (
                            <button
                                onClick={() => handlePaymentUpdate(form.total_amount, undefined)}
                                className="px-6 py-3 bg-green-500/10 text-green-600 rounded-xl font-bold hover:bg-green-500/20 transition-colors flex items-center gap-2"
                            >
                                <CheckCircle2 size={18} /> Registrar Pago Total
                            </button>
                        )}
                    </div>
                </div>
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

                <div className="p-6 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3 mt-auto bg-[var(--bg-card)] rounded-b-2xl">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 font-bold text-[var(--text-secondary)] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">Cancelar</button>
                    <button onClick={handleSubmit} className="px-8 py-2.5 bg-[var(--brand-primary)] text-white rounded-xl font-bold shadow-lg shadow-[#4318FF]/20 hover:scale-105 transition-transform flex items-center gap-2">
                        <Save size={18} />
                        Guardar Datos
                    </button>
                </div>
            </div>
        </div>
    )
}
```
