import { retrieveUsersFromConfig } from '../utilities/config-parser';
import { test as setup } from '@playwright/test';

export interface UserConfig {
  username: string;
  password: string;
  url: string;
  app: string;
}

export interface UsersConfig {
  users: UserConfig[];
}

const users: UserConfig[] = retrieveUsersFromConfig();

for (const user of users) {
  setup(`User ${user.username} authentication. App - ${user.app}`, async ({ request }) => {
    await request.post(user.url, {
      form: {
        'client_id': 'org.santedb.debug',
        'username': user.username,
        'password': user.password,
        'grant_type': 'password'
      }
    });
    
    await request.storageState({ path: `e2e/storage-state/${user.app}-${user.username}.json` });
  });
}
  