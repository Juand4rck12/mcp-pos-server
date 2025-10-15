# BD MCP Server

Servidor MCP (Model Context Protocol - Anthropic) para bases de datos — expone herramientas para consultar una base de datos MySQL en modo solo-lectura desde un agente/cliente MCP. Proyecto construido con Node.js + TypeScript y gestionado con pnpm.

## Resumen

Este repo contiene una implementación del MCP Server que:
- Expone herramientas (tools) para:
  - Ejecutar consultas SELECT/SHOW/DESCRIBE seguras.
  - Listar tablas.
  - Describir esquema de tablas.
- Usa `mysql2/promise` con pool de conexiones.
- Aplica restricciones de seguridad:
  - Solo consultas de lectura permitidas.
  - Prevención de keywords de escritura.
  - Agrega `LIMIT` solamente a SELECT sin `LIMIT`.
- Logging hacia stderr y soporte de DEBUG (DEBUG=true).

## Requisitos

- Node.js >= 18
- pnpm
- MySQL accesible desde el host donde se ejecute el servidor

## Variables de entorno

Configurar las siguientes variables (ejemplo .env no incluido en repo):

#### SE RECOMIENDA CREAR USUARIO CON PERMISOS DE SOLO LECTURA:

```sql
-- Conecta como root a MySQL
CREATE USER 'mcp_readonly_user'@'localhost' IDENTIFIED BY 'passmcp_readonly_password';

-- Otorga SOLO permisos de lectura
GRANT SELECT, SHOW VIEW ON your_database(s).* TO 'mcp_readonly_user'@'localhost';

-- Aplica los cambios
FLUSH PRIVILEGES;
```

- MYSQL_HOST (por defecto: localhost)
- MYSQL_PORT (por defecto: 3306)
- MYSQL_USER
- MYSQL_PASSWORD
- MYSQL_DATABASE
- DEBUG (opcional, `true` para logs DEBUG)

Ejemplo Windows PowerShell:
```powershell
$env:MYSQL_HOST="db.example.com"
$env:MYSQL_USER="developer"
$env:MYSQL_PASSWORD="secret"
$env:MYSQL_DATABASE="mcp_pos"
$env:DEBUG="true"
```

## Instalación

Usando pnpm:
```bash
pnpm install
```

Compilar TypeScript:
```bash
pnpm build
```

## Ejecución

Modo desarrollo (directo con ts-node, si está configurado) o con el build:

Con el build:
```bash
pnpm build
node dist/index.js
```

Logs y salida:
- Todos los logs van a stderr. El protocolo MCP se comunica por stdin/stdout (stdio transport).

## Herramientas (tools) expuestas

- list_tables
  - Input: {}
  - Output: lista de tablas del schema configurado.

- describe_table
  - Input: { tableName: string }
  - Output: esquema/columnas de la tabla.

- query_pos_database (o query tool)
  - Input: { sql: string, params?: any[] }
  - Restricciones: solo SELECT/SHOW/DESCRIBE. `LIMIT 100` se añade solo a SELECT sin LIMIT.
  - Output: filas retornadas, conteo y tiempo de ejecución.

## Ejemplos de uso (payloads MCP)

Listar tablas:
```json
{
  "tool": "list_tables",
  "input": {}
}
```

Describir tabla:
```json
{
  "tool": "describe_table",
  "input": { "tableName": "users" }
}
```

Ejecutar SELECT:
```json
{
  "tool": "query_pos_database",
  "input": { "sql": "SELECT id, name FROM users WHERE active = 1", "params": [] }
}
```

Nota: las llamadas deben respetar el protocolo MCP que use tu cliente/agent.

## Troubleshooting

- Error SQL syntax near 'LIMIT 100': ocurría al añadir LIMIT a `SHOW`/`DESCRIBE`. Solución: ahora el servidor solo añade `LIMIT` a SELECT sin cláusula LIMIT.
- Conexión rechazada: verificar credenciales y que el host/puerto sean accesibles.
- Si no aparecen tablas: comprobar que `MYSQL_DATABASE` apunta al schema correcto.

## Contribución

Fork -> feature branch -> PR hacia `dev` -> revisión -> merge a `main`. Seguir checklist del PR (build, pruebas manuales, variables de entorno configuradas).

## Licencia

MIT
