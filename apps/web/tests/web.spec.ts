import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { fakeProvider } from './fake-provider';

const prose = (page: Page) => page.locator('.ox-prose');

async function openSample(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a sample' }).click();
  await expect(page.locator('.ox-ul').first()).toBeVisible();
}

async function newDoc(page: Page, text: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New document' }).first().click();
  // New documents open the goals dialog first.
  await page.getByRole('button', { name: 'Done' }).click();
  await prose(page).click();
  await page.keyboard.type(text);
}

test.describe('checking a document', () => {
  test('underlines mistakes and applies a fix from the card', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openSample(page);
    const card = page.locator('.ox-card', { hasText: 'Change the verb form' });
    await card.locator('.ox-card__row').click();
    await card.locator('.ox-fix', { hasText: 'are' }).click();
    await expect(prose(page)).toContainText('the results are really good');
    expect(errors).toEqual([]);
  });

  test('clicking an underline opens its card', async ({ page }) => {
    await openSample(page);
    await page.locator('.ox-ul', { hasText: 'tommorow' }).click();
    await expect(page.locator('.ox-card[data-open="true"]')).toContainText('tomorrow');
  });

  test('accepts all correctness fixes and undoes them', async ({ page }) => {
    await openSample(page);
    await page.getByRole('button', { name: 'Accept all' }).click();
    await expect(prose(page)).toContainText('Priya and I reviewed');
    await expect(prose(page)).toContainText('tomorrow');
    await page.locator('.ox-toast').getByRole('button', { name: 'Undo' }).click();
    await expect(prose(page)).toContainText('Me and Priya reviewed');
  });

  test('dismissing a suggestion keeps it hidden after reload', async ({ page }) => {
    await openSample(page);
    const card = page.locator('.ox-card', { hasText: 'utilize' });
    await card.locator('.ox-card__row').click();
    await card.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.locator('.ox-card', { hasText: 'utilize' })).toHaveCount(0);
    await expect(page.locator('.ox-save')).toHaveText('Saved on this computer');
    await page.reload();
    await expect(page.locator('.ox-card').first()).toBeVisible();
    await expect(page.locator('.ox-card', { hasText: 'utilize' })).toHaveCount(0);
  });

  test('underlines stay on the right words while typing', async ({ page }) => {
    await openSample(page);
    await prose(page).click();
    await page.keyboard.press('Control+Home');
    await page.keyboard.type('Quick note. ');
    const texts = await page.locator('.ox-ul').allInnerTexts();
    expect(texts).toContain('tommorow');
    expect(texts).toContain('Me and Priya');
  });
});

test.describe('documents', () => {
  test('saves automatically and lists the document', async ({ page }) => {
    await newDoc(page, 'Notes for the quarterly planning meeting.');
    await page.getByLabel('Document title').fill('Planning notes');
    await expect(page.locator('.ox-save')).toHaveText('Saved on this computer');
    await page.reload();
    await expect(prose(page)).toContainText('quarterly planning');
    await page.getByRole('link', { name: 'Documents' }).click();
    await expect(page.locator('.ox-doc-card', { hasText: 'Planning notes' })).toBeVisible();
  });

  test('formats text with the toolbar', async ({ page }) => {
    await newDoc(page, 'Important');
    await page.keyboard.press('Control+a');
    await page.getByRole('button', { name: 'Bold' }).click();
    await expect(prose(page).locator('strong')).toHaveText('Important');
    await page.getByRole('button', { name: 'Heading 1' }).click();
    await expect(prose(page).locator('h1')).toHaveText('Important');
  });

  test('moves a document to the trash and restores it', async ({ page }) => {
    await openSample(page);
    await page.getByRole('button', { name: 'Document menu' }).click();
    await page.getByRole('menuitem', { name: 'Move to trash' }).click();
    await expect(page.locator('.ox-doc-card', { hasText: 'Project update' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Trash' }).click();
    await page.getByRole('button', { name: 'Restore' }).click();
    await page.getByRole('link', { name: 'Documents', exact: true }).click();
    await expect(page.locator('.ox-doc-card', { hasText: 'Project update' })).toBeVisible();
  });

  test('downloads a Word file and opens it again', async ({ page }) => {
    await openSample(page);
    await page.getByRole('button', { name: 'Document menu' }).click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Download as Word (.docx)' }).click();
    const file = await (await downloading).path();
    expect((await readFile(file)).subarray(0, 2).toString()).toBe('PK');

    await page.goto('/');
    const choosing = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload' }).click();
    await (await choosing).setFiles({
      name: 'Imported.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: await readFile(file),
    });
    await expect(prose(page)).toContainText('Me and Priya reviewed it yesterday');
    await expect(page.getByLabel('Document title')).toHaveValue('Project update');
  });
});

test.describe('privacy', () => {
  test('makes no requests to other servers', async ({ page }) => {
    const outside: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://localhost:4870/') && !r.url().startsWith('data:'))
        outside.push(r.url());
    });
    await openSample(page);
    await page.getByRole('tab', { name: 'Insights' }).click();
    await page.getByRole('tab', { name: 'Rewrite' }).click();
    await page.getByRole('button', { name: 'Shorten it' }).click();
    await expect(page.locator('.ox-result')).not.toBeEmpty();
    expect(outside).toEqual([]);
  });

  test('the relay refuses requests without the secret token', async ({ request }) => {
    const res = await request.post('/relay', {
      headers: { 'x-oppenly-target': 'https://example.com/' },
      data: '{}',
    });
    expect(res.status()).toBe(403);
  });
});

test.describe('with an AI provider', () => {
  test('asks for consent, then checks and rewrites through the local relay', async ({ page }) => {
    const provider = await fakeProvider();
    try {
      await page.goto('/#/settings/ai');
      await page.locator('.os-provider', { hasText: 'OpenAI-compatible' }).click();
      await page.getByLabel('API address').fill(provider.url);
      const save = page.getByRole('button', { name: 'Save and use' });
      await expect(save).toBeDisabled();
      await page.locator('.os-consent input').check();
      await save.click();
      await expect(page.locator('.os-result--ok')).toContainText('fake-mini');
      await expect(page.getByText('Using OpenAI-compatible')).toBeVisible();

      await newDoc(page, 'The meeting went well and everyone agreed on the plan.');
      const card = page.locator('.ox-card', { hasText: 'Be more specific' });
      await expect(card).toBeVisible();
      await card.locator('.ox-card__row').click();
      await expect(card).toContainText('AI · OpenAI-compatible');
      await card.locator('.ox-fix', { hasText: 'went smoothly' }).click();
      await expect(prose(page)).toContainText('The meeting went smoothly and');

      await page.keyboard.press('Control+a');
      await page.locator('.ox-selbar__btn', { hasText: 'Improve' }).click();
      await expect(page.locator('.ox-pop .ox-result')).toHaveText('The new tool helps us decide.');
      await page.locator('.ox-pop').getByRole('button', { name: 'Replace' }).click();
      await expect(prose(page)).toHaveText('The new tool helps us decide.');
      expect(provider.requests).toContain('GET /v1/models');
      expect(
        provider.requests.filter((r) => r === 'POST /v1/chat/completions').length,
      ).toBeGreaterThan(1);
    } finally {
      provider.close();
    }
  });
});
