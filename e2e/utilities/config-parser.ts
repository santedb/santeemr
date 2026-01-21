import { UserConfig, UsersConfig } from "../setup/auth.setup";
import * as fs from 'fs';
import path from 'path';

/**
 * Read environment variables from file.
 */
// import dotenv from 'dotenv';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Read user configurations from a JSON file.
 */
export function retrieveUsersFromConfig(): UserConfig[] {
  try {
    const config: UsersConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../setup/users.json'), 'utf-8'));

    return config.users || [];
  } catch (error) {
    console.error('Error reading users.json:', error);
    
    return [];
  }
}
