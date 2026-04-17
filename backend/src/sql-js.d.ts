declare module 'sql.js/dist/sql-asm.js' {
  interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  interface Statement {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    get(): unknown[];
    free(): boolean;
  }

  interface Database {
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    close(): void;
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export type { Database, Statement, QueryExecResult };
  export default function initSqlJs(): Promise<SqlJsStatic>;
}
