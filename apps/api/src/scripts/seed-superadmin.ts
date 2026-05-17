import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as readline from 'node:readline/promises';

import { AppModule } from '../app.module';
import { PasswordService } from '../modules/auth/password.service';
import {
  isSuperadminEmailTakenError,
  seedSuperadmin,
} from '../modules/auth/seed-superadmin';
import { UsersService } from '../modules/users/users.service';

const logger = new Logger('seed-superadmin');

const CTRL_C = '\x03';
const CTRL_D = '\x04';
const BACKSPACE = '\x7f';

/**
 * Lee una línea oculta (sin echo) desde un TTY, manualmente. Usar solo
 * cuando `process.stdin.isTTY === true`.
 */
function readHiddenLine(question: string): Promise<string> {
  const stdin = process.stdin;
  const stdout = process.stdout;
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  return new Promise<string>((resolve, reject) => {
    let buffer = '';
    const cleanup = (): void => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
    };
    const onData = (chunk: string): void => {
      for (const ch of chunk) {
        if (ch === '\n' || ch === '\r') {
          cleanup();
          stdout.write('\n');
          resolve(buffer);
          return;
        }
        if (ch === CTRL_C || ch === CTRL_D) {
          cleanup();
          stdout.write('\n');
          reject(new Error('Input cancelado por el usuario.'));
          return;
        }
        if (ch === BACKSPACE || ch === '\b') {
          buffer = buffer.slice(0, -1);
          continue;
        }
        buffer += ch;
      }
    };
    stdin.on('data', onData);
  });
}

/**
 * Drena todo stdin a un string. Usado en modo no-TTY (piped input) para
 * evitar el bug de `readline.question` cuando stdin EOFa entre prompts.
 */
async function readAllStdin(): Promise<string> {
  process.stdin.setEncoding('utf8');
  let data = '';
  for await (const chunk of process.stdin) data += chunk as string;
  return data;
}

interface Credentials {
  email: string;
  password: string;
}

async function readCredentials(): Promise<Credentials> {
  const stdout = process.stdout;
  if (process.stdin.isTTY === true) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: stdout,
    });
    try {
      const email = (await rl.question('Email del SUPERADMIN: ')).trim();
      rl.close();
      const password = await readHiddenLine('Password (no se muestra): ');
      return { email, password };
    } catch (err) {
      rl.close();
      throw err;
    }
  }

  // Modo no-TTY: 2 líneas en stdin (primera email, segunda password).
  // No se hace echo: el caller ya sabe qué pipeó.
  const all = await readAllStdin();
  const [email, password] = all.split(/\r?\n/);
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new Error(
      'En modo piped el script espera dos líneas en stdin: email y password.',
    );
  }
  return { email: email.trim(), password };
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const usersService = app.get(UsersService);
    const passwordService = app.get(PasswordService);

    const { email, password } = await readCredentials();
    const user = await seedSuperadmin(usersService, passwordService, {
      email,
      password,
    });
    logger.log(`SUPERADMIN creado OK (id=${user.id}, email=${user.email!}).`);
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  if (isSuperadminEmailTakenError(err)) {
    logger.error('Ya existe un SUPERADMIN con ese email. No se creó nada.');
    process.exit(2);
  }
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`Seed falló: ${message}`);
  process.exit(1);
});
