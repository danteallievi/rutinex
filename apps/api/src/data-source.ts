import 'reflect-metadata';
import 'dotenv/config';

import { DataSource } from 'typeorm';
import { getDataSourceOptions } from './config/database';

/**
 * DataSource para la CLI de TypeORM (migration:generate / run / revert).
 * En runtime de NestJS, las options las consume `TypeOrmModule.forRootAsync`.
 */
const dataSource = new DataSource(getDataSourceOptions());

export default dataSource;
