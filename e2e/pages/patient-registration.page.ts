// login.page.ts
import { Page } from '@playwright/test';

export class PatientRegistrationPage {
  constructor(public page: Page) {
  }

  async navigate() {
    await this.page.goto('/#!/patient/register');
  }

  async fillDemographicsDetails(patient) {
  }
}
