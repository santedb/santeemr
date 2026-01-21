// login.page.ts
import { Page } from '@playwright/test';
import { UserConfig } from '../setup/auth.setup';

export class LoginPage {
  constructor(public page: Page) {
  }

  async navigate() {
    await this.page.goto('/#!/login');
  }

  async login(user: UserConfig) {
    await this.page.fill('input[name="username"]', user.username);
    await this.page.fill('input[name="password"]', user.password);
    await this.page.click('button[type="submit"]');
  }
}
