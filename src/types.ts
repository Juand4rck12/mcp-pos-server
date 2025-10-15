export interface QueryRequest {
    sql: string;
    params?: any[];
}

export interface QueryResult {
    rows: any[];
    rowCount: number;
    executionTime: number;
}

export interface TableInfo {
    tableName: string;
    columnCount: number;
    schema: any[];
}