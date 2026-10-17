const { test, expect } = require('@playwright/test');

const COMMANDER = { email: 'commander@browser.test', password: 'BrowserTest123!' };

async function login(page, credentials = COMMANDER) {
  await page.goto('/login');
  const form = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Sign in' }) });
  await form.getByPlaceholder('Email').fill(credentials.email);
  await form.getByPlaceholder('Password').fill(credentials.password);
  await form.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
}

test.describe('@smoke @auth', () => {
  test('landing → login → protected dashboard → logout', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'BlackBox home' })).toBeVisible();
    await page.getByRole('button', { name: /Open operations console/i }).click();
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    await login(page);
    await expect(page.getByText('Browser Commander')).toBeVisible();
    await expect(page.getByText('ONLINE', { exact: true })).toBeVisible();
    await page.getByRole('banner').getByRole('button', { name: /Browser Commander/ }).click();
    await page.getByRole('button', { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test('invalid credentials show a visible error and valid login survives refresh', async ({ page }) => {
    await page.goto('/login');
    const form = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Sign in' }) });
    await form.getByPlaceholder('Email').fill(COMMANDER.email);
    await form.getByPlaceholder('Password').fill('wrong-password');
    await form.getByRole('button', { name: 'Sign in' }).click();
    await expect(form.getByRole('alert')).toContainText(/invalid email or password/i);
    await login(page);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  });

  test('mission fixture loads through the UI and exposes real task/team/replay routes', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Missions' }).click();
    await expect(page).toHaveURL(/\/missions$/);
    await expect(page.getByRole('main').getByText('Browser Acceptance Mission').first()).toBeVisible();
    await page.getByRole('link', { name: 'Open' }).first().click();
    await expect(page).toHaveURL(/\/missions\/[a-f0-9]{24}$/);
    await expect(page.getByText('Browser Acceptance Mission').first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: 'Tasks' }).click();
    await expect(page.getByText('Browser Fixture Task')).toBeVisible();
    await page.getByRole('tab', { name: 'Team' }).click();
    await expect(page.getByText('Browser Operator')).toBeVisible();
    await page.getByRole('main').getByRole('link', { name: 'Replay' }).click();
    await expect(page).toHaveURL(/\/missions\/[a-f0-9]{24}\/replay\?mission=/);
    await expect(page.getByRole('heading', { name: 'Mission replay', level: 1 })).toBeVisible();
  });
});

module.exports = { login, COMMANDER };
