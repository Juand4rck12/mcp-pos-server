import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from "./database.js";
import {
    QueryToolSchema,
    ListTablesSchema,
    DescribeTableSchema,
    QueryToolInput,
    ListTablesInput,
    DescribeTableInput
} from './tools.js';
import { text } from "stream/consumers";


// Utilidad de loggin segura para STDIO
class Logger {
    // Todos los logs van a stderr, nunca a stdout
    static info(message: string, ...args: any[]): void {
        console.error(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    }

    static error(message: string, error?: any): void {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');

    }

    static warn(message: string, ...args: any[]): void {
        console.error(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
    }

    static debug(message: string, ...args: any[]): void {
        if (process.env.DEBUG === 'true') {
            console.error(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
        }
    }
}


// Configuración desde variables de entorno
const dbConfig = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'developer',
    password: process.env.MYSQL_PASSWORD || 'developer',
    database: process.env.MYSQL_DATABASE || ''
};


class POSMCPServer {
    private server: Server;
    private db: DatabaseManager;

    constructor() {
        Logger.info('Inicializando POS MCP Server...');

        this.server = new Server(
            {
                name: 'pos-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        try {
            this.db = new DatabaseManager(dbConfig);
            Logger.info('Conexión a base de datos establecida');
        } catch (error) {
            Logger.error('Error al conectar con la base de datos', error);
            throw error;
        }

        this.setupHandlers();
        this.setupErrorHandlers();
    }

    private setupHandlers(): void {
        // Handler para listar herramientas disponibles
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            Logger.debug('Solicitud de herramientas recibida');

            return {
                tools: [
                    {
                        name: 'query_pos_database',
                        description: 'Ejecuta una consulta SELECT en la base de datos del POS. Solo permite operaciones de lectura.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                sql: {
                                    type: 'string',
                                    description: 'Consulta SQL SELECT para ejecutar'
                                },
                                params: {
                                    type: 'array',
                                    description: 'Parámetros opcionales para consultas preparadas',
                                    items: { type: 'string' }
                                }
                            },
                            required: ['sql']
                        }
                    },
                    {
                        name: 'list_tables',
                        description: 'Lista todas las tablas disponibles en la base de datos del POS',
                        inputSchema: {
                            type: 'object',
                            properties: {}
                        }
                    },
                    {
                        name: 'describe_table',
                        description: 'Muestra la estructura (columnas, tipos) de una tabla específica',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                tableName: {
                                    type: 'string',
                                    description: 'Nombre de la tabla a describir'
                                }
                            },
                            required: ['tableName']
                        }
                    }
                ],
            };
        });

        // Handler para ejecutar herramientas
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            Logger.info(`Ejecutando herramienta: ${name}`);
            Logger.debug('Argumentos:', args);

            try {
                let result;

                switch (name) {
                    case 'query_pos_database':
                        result = await this.handleQueryTool(args as QueryToolInput);
                        break;

                    case 'list_tables':
                        result = await this.handleListTables();
                        break;

                    case 'describe_table':
                        result = await this.handleDescribeTable(args as DescribeTableInput);
                        break;

                    default:
                        Logger.error(`Herramienta desconocida: ${name}`);
                        throw new Error(`Herramienta desconocida; ${name}`);
                }

                Logger.info(`Herramienta ${name} ejecutada exitosamente`);
                return result;

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
                Logger.error(`Error al ejecutar ${name}:`, errorMessage);

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        });
    }

    private async handleQueryTool(args: QueryToolInput) {
        Logger.debug(`Ejecutando SQL: ${args.sql}`);

        const startTime = Date.now();
        const rows = await this.db.executeReadOnlyQuery(args.sql, args.params || []);
        const executionTime = Date.now() - startTime;

        Logger.info(`Consulta ejecutada en ${executionTime}ms, ${rows.length} filas retornadas`);

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        rowCount: rows.length,
                        executionTime: `${executionTime}ms`,
                        data: rows
                    }, null, 2)
                }
            ]
        };
    }

    private async handleListTables() {
        Logger.debug('Listando tablas de la base de datos');

        const tables = await this.db.listTables();

        Logger.info(`${tables.length} tablas encontradas`);

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        tableCount: tables.length,
                        tables: tables
                    }, null, 2)
                }
            ]
        };
    }

    private async handleDescribeTable(args: DescribeTableInput) {
        Logger.debug(`Describiendo tabla: ${args.tableName}`);

        const schema = await this.db.getTableSchema(args.tableName);

        Logger.info(`Tabla ${args.tableName} tiene ${schema.length} columnas`);

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        tableName: args.tableName,
                        columnCount: schema.length,
                        schema: schema
                    }, null, 2)
                }
            ]
        };
    }

    private setupErrorHandlers(): void {
        // Capturar errores del servidor MCP
        this.server.onerror = (error) => {
            Logger.error('Error en el servidor MCP:', error);
        };

        // Cerrar limpiamente con Ctrl+C
        process.on('SIGINT', async () => {
            Logger.info('Recibida señal SIGINT, cerrando servidor...');
            await this.shutdown();
            process.exit(0);
        });

        // Cerrar limpiamente con SIGTERM
        process.on('SIGTERM', async () => {
            Logger.info('Recibida señal SIGTERM, cerrando servidor...');
            await this.shutdown();
            process.exit(0);
        });

        // Capturar errores no manejados
        process.on('unhandledRejection', (reason, promise) => {
            Logger.error('Promesa rechazada no manejada:', reason);
        });

        process.on('uncaughtException', (error) => {
            Logger.error('Excepción no capturada:', error);
            this.shutdown().then(() => process.exit(1));
        });
    }

    private async shutdown(): Promise<void> {
        Logger.info('Cerrando conexiones...');
        try {
            await this.db.close();
            Logger.info('Conexiones cerradas correctamente');
        } catch (error) {
            Logger.error('Error al cerrar conexiones:', error);
        }
    }

    async run(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);

        Logger.info('POS MCP Server ejecutándose en modo stdio');
        Logger.info(`Conectado a base de datos ${dbConfig.database}@${dbConfig.host}`);
    }
}


// Iniciar el servidor
const server = new POSMCPServer();
server.run().catch((error) => {
    Logger.error('Error fatal al iniciar el servidor:', error);
    process.exit(1);
});