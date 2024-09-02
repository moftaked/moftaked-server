import { Inject, Injectable } from "@nestjs/common";
import { Connection } from "mysql2/promise";

@Injectable()
export class DatabaseService {
    constructor(@Inject('DATABASE_CONNECTION') private connection: Connection) {}

    async executeQuery(queryText: string, values: any[] = []) {
        return this.connection.execute(queryText, values);
    }
}