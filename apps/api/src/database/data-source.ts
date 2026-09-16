import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

import { RequestOrmEntity } from '../requests/infrastructure/request.orm-entity';

/**
 * process.cwd() depends on where the process was started, not where this
 * package lives, so it is the wrong anchor for a default file path: running
 * from the repo root vs. from apps/api would put the database in two
 * different places. __dirname is this file's own location, which is the
 * same relative distance from the package root whether ts-node runs it from
 * src/ or the compiled output runs it from dist/, so it anchors correctly
 * either way.
 */
const DEFAULT_DATABASE_PATH = join(__dirname, '..', '..', 'data', 'app.sqlite');
const databasePath = process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH;

// The sqlite driver opens a file but never creates the directory it lives
// in, so a first run on a clean checkout would otherwise fail to open it.
mkdirSync(dirname(databasePath), { recursive: true });

export const dataSourceOptions: DataSourceOptions = {
  type: 'sqlite',
  database: databasePath,
  entities: [RequestOrmEntity],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  migrationsRun: false,
};

/**
 * Used by the TypeORM CLI (migration:generate, migration:run). The app
 * itself registers dataSourceOptions directly via TypeOrmModule.forRoot, so
 * there is one definition of the schema connection, not two.
 */
export default new DataSource(dataSourceOptions);
