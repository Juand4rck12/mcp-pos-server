import mysql from 'mysql2/promise';

// Logger que siempre usa stderr
const log = {
    error: (msg: string, ...args: any[]) => console.error(`[DB ERROR]`, msg, ...args),
    info: (msg: string, ...args: any[]) => console.error(`[DB INFO]`, msg, ...args),
};

export interface DatabaseConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export class DatabaseManager {
    private pool: mysql.Pool;

    constructor(config: DatabaseConfig) {
        log.info(`Creando pool de conexiones para ${config.database}`);

        this.pool = mysql.createPool({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            typeCast: true
        });
    }


    async executeReadOnlyQuery(sql: string, params: any[] = []): Promise<any[]> {
        const normalizedSql = sql.trim().toUpperCase();

        if (!normalizedSql.startsWith('SELECT') &&
            !normalizedSql.startsWith('SHOW') &&
            !normalizedSql.startsWith('DESCRIBE')) {
            const error = 'Solo se permiten consultas de lectura (SELECT, SHOW, DESCRIBE)';
            log.error(error);
            throw new Error(error);
        }

        const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE'];
        if (dangerousKeywords.some(keyword => normalizedSql.includes(keyword))) {
            const error = 'Consulta no permitida: contiene operaciones de escritura';
            log.error(error, { sql });
            throw new Error(error);
        }

        try {
            const connection = await this.pool.getConnection();

            try {
                await connection.query('SET SESSION TRANSACTION READ ONLY');
                const [rows] = await connection.query(sql + ' LIMIT 100 ', params);
                return rows as any[];
            } finally {
                connection.release();
            }
        } catch (error) {
            log.error('Error ejecutando consulta:', error);
            throw new Error(`Error en consulta: ${error}`);
        }
    }

    async getTableSchema(tableName: string): Promise<any[]> {
        return this.executeReadOnlyQuery('DESCRIBE ??', [tableName]);
    }

    async listTables(): Promise<string[]> {
        const rows = await this.executeReadOnlyQuery('SHOW TABLES');
        return rows.map(row => Object.values(row)[0] as string);
    }

    async close(): Promise<void> {
        log.info('Cerrando pool de conexiones');
        await this.pool.end();
    }
}