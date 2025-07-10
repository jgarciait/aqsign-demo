# Instrucciones para Remover Creación Automática de "Sin Categorizar"

Este documento explica los cambios realizados para eliminar la creación automática de carpetas "Sin Categorizar" en el sistema de case-files.

## Cambios Realizados

### 1. Base de Datos
- **Archivo SQL**: `remove-sin-categorizar-auto-creation.sql`
- **Objetivo**: Eliminar triggers y funciones que crean automáticamente categorías "Sin Categorizar"

### 2. Código del Backend
- **Archivo**: `app/actions/filing-system-actions.ts`
- **Cambio**: La función `uploadMultipleFilesToCaseFile` ya no busca una categoría "Sin Categorizar" por defecto
- **Resultado**: Los documentos subidos tendrán `category_id = null` (sin categoría)

### 3. Código del Frontend
- **Archivos actualizados**:
  - `components/enhanced-case-file-documents.tsx`
  - `components/compact-case-file-documents.tsx`
- **Cambios**:
  - Referencias a "Sin Categorizar" cambiadas a "Sin categoría"
  - Opción de mover a "Sin Categorizar" cambiada a "Quitar categoría"
  - Mensajes actualizados para reflejar que los documentos quedan "sin categoría"

## Cómo Aplicar los Cambios

### Paso 1: Ejecutar Script SQL
```bash
psql -h localhost -U postgres -d tu_base_de_datos -f remove-sin-categorizar-auto-creation.sql
```

### Paso 2: (Opcional) Limpiar Categorías Existentes
Si deseas eliminar las categorías "Sin Categorizar" existentes, descomenta las líneas en el script SQL:

```sql
-- First, set all documents in "Sin Categorizar" categories to have no category
UPDATE documents 
SET category_id = NULL, updated_at = NOW()
WHERE category_id IN (
  SELECT id FROM document_categories WHERE name = 'Sin Categorizar'
);

-- Then delete all "Sin Categorizar" categories
DELETE FROM document_categories WHERE name = 'Sin Categorizar';
```

### Paso 3: Verificar los Cambios
El script SQL incluye verificaciones que mostrarán:
1. Status de la desactivación
2. Triggers relacionados con categorías por defecto (debería estar vacío)
3. Número de categorías "Sin Categorizar" restantes

## Comportamiento Después de los Cambios

### Nuevos Case Files
- Al crear un nuevo case file, NO se creará automáticamente una carpeta "Sin Categorizar"
- Los usuarios pueden crear sus propias categorías según necesiten

### Documentos Subidos
- Los documentos subidos a case files tendrán `category_id = null`
- En la interfaz aparecerán como "Sin categoría"
- Los usuarios pueden asignar categorías manualmente

### Gestión de Categorías
- Los usuarios pueden crear, editar y eliminar categorías libremente
- Al eliminar una categoría, los documentos quedan "sin categoría" (no se mueven a una categoría por defecto)

## Ventajas del Nuevo Comportamiento

1. **Flexibilidad**: Los usuarios no están forzados a usar una categoría por defecto
2. **Limpieza**: No se crean carpetas automáticas que podrían no ser necesarias
3. **Control del Usuario**: Cada usuario decide su propio sistema de organización
4. **Menos Clutter**: Reduce el número de categorías duplicadas o innecesarias

## Revertir los Cambios (Si Necesario)

Si necesitas revertir a la funcionalidad anterior, puedes ejecutar:
```sql
-- Volver a crear el trigger (usar el código de add-default-uncategorized-category.sql)
```

O contactar al equipo de desarrollo para restaurar la funcionalidad anterior. 