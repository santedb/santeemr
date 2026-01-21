import { expect, test } from '@playwright/test';

// Pages
import { PatientRegistrationPage } from '../pages/patient-registration.page';

test.use({ 
  storageState: 'e2e/storage-state/iis-fujiman.json',
  baseURL: 'http://127.0.0.1:64005'
});

// Success
// New patient - newborn
// New patient - person under 19
// New patient - person over 19

// Fail
// New patient - newborn with missing parent information


test('Can register new patient.', async ({ page }) => {
  const patientRegistrationPage = new PatientRegistrationPage(page);
  
  await patientRegistrationPage.navigate();
  await patientRegistrationPage.fillDemographicsDetails({});

  
  await page.locator('input[name="patientIdentifieridDL_MHMS_HIS_BRN0"]').click();
  await page.locator('input[name="patientIdentifieridDL_MHMS_HIS_BRN0"]').fill('211112');

  await page.locator('input[name="patientNamename0given"]').click();
  await page.locator('input[name="patientNamename0given"]').fill('2 New');
  await page.locator('input[name="patientNamename0family"]').click();
  await page.locator('input[name="patientNamename0family"]').fill('2 Baby');
  await page.locator('select[name="birthGender"]').click();
  await page.locator('select[name="birthGender"]').selectOption('f4e3a6bb-612e-46b2-9f77-ff844d971198');
  await page.locator('#address-accordion-HomeAddress').getByText('Search by name').click();
  await page.getByText('- ( Honeycrisp, Apple Islands').click();

  await page.getByTestId('entity-search-primary-facility').locator('..').locator('.select2-selection__rendered').click();

  await page.getByRole('treeitem', { name: '  Fuji Community Hospital' }).click();
  await page.locator('input[name="mothersNamename0given"]').click();
  await page.locator('input[name="mothersNamename0given"]').fill('2 Mom');
  await page.locator('input[name="mothersNamename0family"]').click();
  await page.locator('input[name="mothersNamename0family"]').fill('2 Baby');
  await page.getByRole('spinbutton').click();
  await page.getByRole('spinbutton').fill('29');
  await page.locator('input[name="mothersTelecomtelMobileContact0"]').click();
  await page.locator('input[name="mothersTelecomtelMobileContact0"]').fill('111111');
  await page.getByRole('button', { name: ' Save' }).click();

  await expect(page.getByText('2 New 2 Baby')).toBeVisible();
});

test('test', async ({ page }) => {
  const patientRegistrationPage = new PatientRegistrationPage(page);
  
  await patientRegistrationPage.navigate();

  console.log(page.getByTestId('entity-search-primary-facility').locator('..').locator('.select2-selection__rendered'));

  await expect(page.getByTestId('entity-search-primary-facility').locator('..').locator('.select2-selection__rendered')).toBeVisible();

  // page.getByTestId('entity-search-primary-facility').locator('..').locator('.select2-selection__rendered').click();
  await page.getByTestId('entity-search-primary-facility').locator('..').locator('.select2-selection__rendered').click();


})
