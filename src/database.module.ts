import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createConnection } from 'mysql2/promise';
import { DatabaseService } from "./database.service";

const databaseConnectionFactory = async (configService: ConfigService) => {
    const connection =  await createConnection({
        host: configService.get('DATABASE_HOST'),
        user: configService.get('DATABASE_USER'),
        database: configService.get('DATABASE_NAME'),
        password: configService.get('DATABASE_PASSWORD'),
        port: configService.get('DATABASE_PORT')
    });

    return connection;
}

@Module({
    providers: [
        {
            provide: 'DATABASE_CONNECTION',
            inject: [ConfigService],
            useFactory: databaseConnectionFactory
        },
        DatabaseService
    ],
    exports: [DatabaseService],
})
export class DatabaseModule {}