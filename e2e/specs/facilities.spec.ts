import { test } from '@playwright/test';

test.use({ 
  storageState: 'e2e/storage-state/admin-administrator.json',
  baseURL: 'http://127.0.0.1:64005'
});

test("Can administrator add new facility.", async ({ page }) => {
  await page.goto('#!/');

  await page.goto('#!/data/facility');

});

test('', async () => {

});
