# Plan de Mejoras del Dashboard

## 1. Arquitectura y Mantenimiento (Prioridad Alta)
- [x] **Centralizar URL del Backend:** Mover `https://recuperadora-agente-pb.nojauc.easypanel.host` a una variable de entorno `VITE_API_URL` en un archivo `.env` para facilitar cambios entre desarrollo y producción.
- [x] **Refactorización de `App.jsx`:** Separar componentes (`DashboardView`, `ReportsView`, `Sidebar`, `OrderDrawer`) en archivos individuales dentro de `src/components/` o `src/views/`.
- [x] **Hooks Personalizados:** Crear `useOrders` y `useLeads` para encapsular la lógica de carga y suscripción a Supabase.

## 2. Experiencia de Usuario (UI/UX)
- [x] **Feedback de Carga:** Implementar Skeletons o Spinners mientras cargan los datos.
- [x] **Buscador Global:** Mejorar la funcionalidad de búsqueda para filtrar órdenes y clientes en tiempo real.
- [x] **Filtros Avanzados:** Agregar filtros por rango de fechas y estado.
- [x] **Localización:** Traducir interfaz al español y configurar `lang="es"` en HTML.

## 3. Seguridad y Datos
- [ ] **Autenticación:** Implementar Login con Supabase Auth si se expone a internet.
- [x] **Validación de Formularios:** Añadir validación robusta para RUT y Teléfono.
- [x] **Constantes para Estados:** Definir objeto `ORDER_STATUS` para evitar errores de tipo.

## 4. Funcionalidades Potenciales
- [x] **Historial de Cambios (Audit Log):** Mostrar cronología de cambios de estado y pagos en el `OrderDrawer`.
- [x] **Vista Móvil:** Adaptar el Kanban o forzar vista de lista en dispositivos móviles.
