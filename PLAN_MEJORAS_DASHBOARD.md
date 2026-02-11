# Plan de Mejoras del Dashboard - Fase 2

Este documento detalla las mejoras implementadas y la hoja de ruta para convertir el Dashboard de PitonB en una plataforma de gestión premium y automatizada.

## ✅ Logros Recientes (Fase 1 Completada)
- [x] **Arquitectura:** Código factorizado en componentes modulares y uso de variables de entorno.
- [x] **PitronB Drive:** Explorador de archivos con jerarquía Cliente/Orden, subida manual y previsualización.
- [x] **Gestión Pro activa:** Sistema Kanban para órdenes con sincronización en tiempo real.
- [x] **CRUD de Archivos:** Implementación de subida, visualización y borrado seguro (Soft Delete).
- [x] **UX Pulida:** Notificaciones elegantes con Sonner y manejo de errores robusto.

---

## 🚀 Hoja de Ruta - Próximas Mejoras (Fase 2)

### 1. Visualización y Experiencia Premium (UI/UX)
- [ ] **Visor de Documentos Integrado:** Implementar previsualización para archivos PDF y documentos Office sin necesidad de descarga.
- [ ] **Pulido de Modo Oscuro:** Revisión exhaustiva de contrastes, modales y sombras para una experiencia nocturna 100% premium.
- [ ] **Animaciones Fluídas:** Integrar `framer-motion` para transiciones de estado, apertura de modales y reordenamiento del Kanban.
- [ ] **Dashboard Home:** Crear una sección de "Resumen General" con gráficas de ventas, órdenes del día y actividad de clientes.

### 2. Operaciones Avanzadas
- [ ] **Live Chat View:** Añadir una pestaña para visualizar la conversación de WhatsApp en tiempo real, permitiendo ver el contexto del chat mientras se gestiona la orden.
- [ ] **Centro de Notificaciones:** Sistema de alertas internas cuando un cliente sube un nuevo archivo o el agente detecta una intención de compra.
- [ ] **Generador de Reportes:** Botón para exportar resúmenes financieros y listado de órdenes en formato PDF y Excel (Especial para cierres de mes).
- [ ] **Registro de Actividad (Audit Log):** Sistema detallado para ver quién y cuándo realizó cambios críticos (cambios de precio, estado de pago, etc.).

### 3. Inteligencia Artificial Aplicada (AI-Drive)
- [ ] **Etiquetado Automático de Archivos:** Usar la IA para analizar imágenes/PDFs subidos y asignarles tags automáticamente (ej: "Transferencia", "Factura", "Producto").
- [ ] **Resumen Inteligente de Documentos:** Generar un pequeño resumen tipo "sticky-note" cuando se sube un archivo (ej: "Este PDF es un comprobante de $45.000 del Banco Estado").
- [ ] **Detección de Urgencia:** IA que prioriza automáticamente ciertas órdenes en el Kanban según el tono del chat del cliente.

### 4. Seguridad y Escalabilidad
- [ ] **Sistema de Autenticación:** Implementar Supabase Auth para proteger el acceso al dashboard con Login/Password.
- [ ] **Gestores de Roles:** Diferenciar permisos (ej: Admin puede borrar archivos, Operador solo puede mover estados del Kanban).
