# Plan Estratégico de Migración a Arquitectura SaaS (Multi-Tenant)

Este documento detalla la hoja de ruta técnica para transformar el sistema actual (hardcoded para "PB Imprenta") en una plataforma SaaS escalable donde cada cliente (imprenta) gestiona su propia configuración, precios y datos.

## 🎯 Objetivo
Desacoplar la identidad del bot y las reglas de negocio del código fuente, almacenándolos en la base de datos para permitir múltiples instancias con personalidades, precios y datos bancarios únicos.

---

## 🛠️ Fase 1: Arquitectura de Base de Datos (Cimientos)

Antes de tocar el código, necesitamos preparar Supabase para manejar configuraciones dinámicas.

### 1.1. Tabla `organizations` (Empresas)
El contenedor principal para cada cliente del SaaS.
```sql
create table organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null, -- Ej: "PB Imprenta"
  slug text unique not null, -- Ej: "pb-imprenta"
  phone_instance_id text, -- ID de la instancia de WhatsApp (Evolution API)
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

### 1.2. Tabla `bot_settings` (Configuración del Agente)
Aquí vivirán los datos que hoy están en el código de `server.py` y `knowledge_base.md`.
```sql
create table bot_settings (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organizations(id) not null,
  bot_name text default 'Asistente', -- Ej: "Richard"
  welcome_message text, -- El saludo inicial
  bank_details jsonb, -- Estructura JSON con banco, cuenta, rut, email
  system_prompt_template text, -- El "cerebro" base personalizable
  primary_color text, -- Para el dashboard (branding)
  unique(org_id)
);
```

### 1.3. Tabla `products` (Motor de Precios Dinámico)
Reemplazo del diccionario `precios_pendon` y lógica 'if/else' en `calculate_quote`.
```sql
create table products (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organizations(id) not null,
  name text not null, -- Ej: "Pendón Roller"
  category text, -- Ej: "Gran Formato"
  base_price integer not null, -- Precio base
  dimensions jsonb, -- Ej: ["80x200", "90x200"] con sus multiplicadores o precios fijos
  rules jsonb, -- Reglas lógicas (ej: "iva_incluido": true/false)
  is_active boolean default true
);
```

---

## 🧠 Fase 2: Backend Dinámico (El Cerebro)

Refactorización de `server.py` para que deje de comportarse como "Richard de PB" y pase a ser un "Agente Genérico" que adopta una identidad.

### 2.1. Inyección de Contexto (Context Injection)
Al recibir un mensaje (webhook), el servidor deberá:
1.  Identificar el número de teléfono de la instancia receptora.
2.  Consultar `organizations` para saber qué empresa es.
3.  Cargar la `bot_settings` de esa empresa.
4.  **Caché:** Guardar esta config en memoria (RAM) por 10-30 minutos para no saturar la BD con cada mensaje.

### 2.2. Prompt Dinámico
El `system_prompt` dejará de ser una cadena fija. Será un f-string que se rellena al vuelo:
```python
# ANTES
system_prompt = "Eres Richard de PB Imprenta..."

# DESPUÉS (Concepto)
config = get_org_config(instance_id)
system_prompt = f"""
Eres *{config.bot_name}*, el asistente de *{config.org_name}*.
Tus datos bancarios son:
{format_bank_details(config.bank_details)}
...
"""
```

### 2.3. Tool `calculate_quote` Conectada a BD
La herramienta ya no tendrá precios fijos.
*   **Acción:** La función hará una *query* a la tabla `products` filtrando por `org_id`.
*   **Beneficio:** El dueño de la imprenta podrá cambiar el precio del "Pendón Roller" desde su panel un domingo por la noche sin llamarte para editar código.

---

## 💻 Fase 3: Dashboard de Administración (El Control)

Crearemos una nueva sección "Configuración" en el Dashboard.

### 3.1. Panel "Identidad"
*   Inputs para editar: Nombre del Bot, Mensaje de Bienvenida.
*   Formulario para: Datos Bancarios (Banco, RUT, Cuenta, Email).

### 3.2. Panel "Catálogo de Productos"
*   CRUD (Crear, Leer, Actualizar, Borrar) de productos.
*   Tabla editable donde el usuario define: "Nombre del producto", "Precio unitario", "Reglas".

---

## 🛡️ Plan de Implementación (Seguro)

Para no romper lo que ya funciona (PB Imprenta), seguiremos este orden:

1.  **Migración de Datos (Seed):** Crearemos la organización "PB Imprenta" en la BD y llenaremos las tablas con los datos actuales (hardcoded) mediante un script.
2.  **Modo Híbrido:** Modificar `server.py` para que intente leer de la BD primero. Si falla o no encuentra nada, usar los valores *hardcoded* (fallback) que tenemos ahora. Esto garantiza **Cero Downtime**.
3.  **Switch Off:** Una vez validado que Richard lee bien su nombre y cuenta desde la BD, eliminamos el código hardcoded.
4.  **Expansión:** Crear la organización #2 (ej: "Imprenta Demo") y probar que el mismo código sirve a ambas con datos distintos.

---

## 📝 Tareas para Mañana ("To-Do List")

1.  [ ] Crear tablas SQL (`organizations`, `bot_settings`, `products`) en Supabase.
2.  [ ] Crear script Python para insertar los datos actuales de PB Imprenta en esas tablas.
3.  [ ] Crear funciones `get_org_config()` en `server.py` con caché simple.
4.  [ ] Actualizar construcción del `system_prompt` usando las variables de la BD.
5.  [ ] Probar flujo de conversación: ¿Saluda correctamente? ¿Da la cuenta correcta?

