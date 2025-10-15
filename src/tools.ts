import { z } from 'zod';

// Esquema de entrada para ejecutar consultas SQL
export const QueryToolSchema = z.object({
    sql: z.string().describe('Consulta SQL SELECT para ejecutar'),
    params: z.array(z.any()).optional().describe('Parámetros para la consulta preparada')
});

// Esquema para listar tablas
export const ListTablesSchema = z.object({});

// Esquema para describir una tabla
export const DescribeTableSchema = z.object({
    tableName: z.string().describe('Nombre de la tabla a describir')
});

export type QueryToolInput = z.infer<typeof QueryToolSchema>;
export type ListTablesInput = z.infer<typeof ListTablesSchema>;
export type DescribeTableInput = z.infer<typeof DescribeTableSchema>;