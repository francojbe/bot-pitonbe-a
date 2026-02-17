# Plan de Mejoras del Dashboard - Fase 2

Este documento detalla las mejoras implementadas y la hoja de ruta para convertir el Dashboard de PitonB en una plataforma de gestión premium y automatizada.

## ✅ Logros Recientes (Fase 1 Completada)
- [x] **Arquitectura:** Código factorizado en componentes modulares y uso de variables de entorno.
- [x] **PitronB Drive:** Explorador de archivos con jerarquía Cliente/Orden, subida manual y previsualización.
- [x] **Gestión Pro activa:** Sistema Kanban para órdenes con sincronización en tiempo real.
- [x] **CRUD de Archivos:** Implementación de subida, visualización y borrado seguro (Soft Delete).
- [x] **UX Pulida:** Notificaciones elegantes con Sonner y manejo de errores robusto.
- [x] **Automatización Backend:** Configurada tarea programada (cron) para ejecutar el análisis de Mejora Continua diariamente a las 03:00 AM.

---

## 🚀 Hoja de Ruta - Próximas Mejoras (Fase 2)

### 1. Visualización y Experiencia Premium (UI/UX)
- [x] **Visor de Documentos Integrado:** Implementación robusta de previsualización PDF en modales (sin descargas ni redirecciones 404).
- [x] **Estabilidad del Backend:** Corrección de lógica de movimiento de archivos y manejo de permisos en Supabase (Fix 404/400 errors).
- [x] **Pulido de Modo Oscuro:** Revisión exhaustiva de contrastes, modales y drop-downs para una experiencia nocturna 100% premium (Fixed PDF Viewer & Dropdowns).
- [x] **Animaciones Fluídas:** Integrar `framer-motion` para transiciones de estado, apertura de modales, reordenamiento del Kanban y **transiciones de página**.
- [x] **Dashboard Home:** Crear una sección de "Resumen General" con gráficas de ventas, órdenes del día y actividad de clientes.

### 2. Operaciones Avanzadas
- [x] **Live Chat View:** Añadir una pestaña para visualizar la conversación de WhatsApp en tiempo real, permitiendo ver el contexto del chat mientras se gestiona la orden.
- [ ] **Human Takeover & Control (Intervención Humana):** Implementar un switch de "Toma de Mando" para pausar al agente IA Richard y permitir al humano responder directamente desde el dashboard. Todo el historial se guarda para que la IA retome el contexto al reactivarse.
- [x] **Centro de Notificaciones:** Sistema de alertas internas e inteligentes que detectan intenciones de compra y subida de archivos en tiempo real. Almacenadas en DB y gestionables.
- [ ] **Generador de Reportes:** Botón para exportar resúmenes financieros y listado de órdenes en formato PDF y Excel (Especial para cierres de mes).
- [ ] **Registro de Actividad (Audit Log):** Sistema detallado para ver quién y cuándo realizó cambios críticos (cambios de precio, estado de pago, etc.).

### 3. Inteligencia Artificial Aplicada (AI-Drive)
- [ ] **Etiquetado Automático de Archivos:** Usar la IA para analizar imágenes/PDFs subidos y asignarles tags automáticamente (ej: "Transferencia", "Factura", "Producto").
- [ ] **Resumen Inteligente de Documentos:** Generar un pequeño resumen tipo "sticky-note" cuando se sube un archivo (ej: "Este PDF es un comprobante de $45.000 del Banco Estado").
- [ ] **Detección de Urgencia:** IA que prioriza automáticamente ciertas órdenes en el Kanban según el tono del chat del cliente.

### 4. Seguridad y Escalabilidad
- [ ] **Sistema de Autenticación:** Implementar Supabase Auth para proteger el acceso al dashboard con Login/Password.
- [ ] **Gestores de Roles:** Diferenciar permisos (ej: Admin puede borrar archivos, Operador solo puede mover estados del Kanban).
- la parte de usaurio queiro que sea lo mas parecido a un crm   