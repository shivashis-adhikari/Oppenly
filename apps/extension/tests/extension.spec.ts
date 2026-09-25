import { expect, layer, test, trackErrors, waitForUnderlines } from './fixtures';

test.describe('checking text on a page', () => {
  test('underlines mistakes in a textarea and applies a fix', async ({ context, site }) => {
    const page = await context.newPage();
    const errors = trackErrors(page);
    await page.goto(site);
    await page.click('#body');
    await waitForUnderlines(page, 4);

    await layer(page).locator('.op-fab').click();
    const item = layer(page).locator('.op-item', { hasText: 'seen' });
    await item.locator('.op-item__row').click();
    await item.locator('.op-fix', { hasText: 'saw' }).click();

    await expect(page.locator('#body')).toHaveValue(/I saw the report yesterday/);
    expect(errors).toEqual([]);
  });

  test('underlines mistakes in a rich text editor and applies a fix', async ({ context, site }) => {
    const page = await context.newPage();
    await page.goto(site);
    await page.click('#rich');
    await waitForUnderlines(page, 1);

    await layer(page).locator('.op-fab').click();
    const item = layer(page).locator('.op-item', { hasText: 'then' });
    await item.locator('.op-item__row').click();
    await item.locator('.op-fix', { hasText: 'than' }).click();

    await expect(page.locator('#rich')).toContainText('than we expected');
    // The formatting around the fix is untouched.
    await expect(page.locator('#rich b')).toHaveText('it was reviewed');
  });

  test('keeps underlines aligned with the words they mark', async ({ context, site }) => {
    const page = await context.newPage();
    await page.goto(site);
    await page.click('#body');
    await waitForUnderlines(page, 4);
    // Every underline sits inside the field it belongs to, on a line of text (not stacked or offset).
    const stray = await page.evaluate(() => {
      const shadow = document.querySelector('oppenly-layer')!.shadowRoot!;
      const out: string[] = [];
      for (const clip of shadow.querySelectorAll('.op-clip')) {
        const box = clip.getBoundingClientRect();
        for (const u of clip.querySelectorAll('.op-ul')) {
          const r = u.getBoundingClientRect();
          const visible = r.bottom > box.top && r.top < box.bottom;
          if (visible && (r.left < box.left - 1 || r.right > box.right + 1 || r.width < 4))
            out.push(JSON.stringify(r));
        }
      }
      return out;
    });
    expect(stray).toEqual([]);
    const field = await page.locator('#body').boundingBox();
    const firstLine = await layer(page).locator('.op-ul').first().boundingBox();
    expect(firstLine!.y).toBeGreaterThan(field!.y);
    expect(firstLine!.y).toBeLessThan(field!.y + field!.height);
  });

  test('rewrites a selection on this device', async ({ context, site }) => {
    const page = await context.newPage();
    await page.goto(site);
    await page.click('#body');
    await waitForUnderlines(page, 1);
    const before = await page.inputValue('#body');
    await page.evaluate(() => {
      const field = document.querySelector<HTMLTextAreaElement>('#body')!;
      const start = field.value.indexOf('We should');
      field.focus();
      field.setSelectionRange(start, field.value.indexOf('decision.') + 'decision.'.length);
      document.dispatchEvent(new Event('selectionchange'));
    });

    await layer(page).locator('.op-selbar__btn', { hasText: 'Shorten' }).click();
    await expect(layer(page).locator('.op-result')).not.toBeEmpty();
    await layer(page).locator('.op-rewrite button', { hasText: 'Replace' }).click();

    const after = await page.inputValue('#body');
    expect(after).not.toEqual(before);
    expect(after).not.toContain('in order to');
  });
});

test.describe('the Oppenly button', () => {
  test('turns Oppenly off for a site and stays off after reload', async ({ context, site }) => {
    const page = await context.newPage();
    await page.goto(site);
    await page.click('#body');
    await waitForUnderlines(page, 1);

    await layer(page).locator('.op-fab-wrap').hover();
    await layer(page).locator('.op-mini').click();
    await layer(page).getByRole('menuitem', { name: 'Turn off on this site' }).click();

    await expect(layer(page).locator('.op-ul')).toHaveCount(0);
    await expect(layer(page).locator('.op-fab')).toHaveCount(0);

    await page.reload();
    await page.click('#body');
    await page.waitForTimeout(1500);
    await expect(layer(page).locator('.op-ul')).toHaveCount(0);
  });

  test('stays on top of the page', async ({ context, site }) => {
    const page = await context.newPage();
    await page.goto(site);
    await page.click('#body');
    await waitForUnderlines(page, 1);
    const host = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('oppenly-layer')!);
      return { position: style.position, zIndex: style.zIndex };
    });
    expect(host).toEqual({ position: 'fixed', zIndex: '2147483647' });
    // A page that tries to restyle the layer cannot push it down.
    await page.addStyleTag({
      content:
        'oppenly-layer { z-index: 1 !important; position: static !important; display: none !important; }',
    });
    await expect(layer(page).locator('.op-fab')).toBeVisible();
  });
});

test.describe('privacy', () => {
  test('makes no network requests without an AI provider', async ({ context, site, outbound }) => {
    const page = await context.newPage();
    await page.goto(site);
    await page.click('#body');
    await waitForUnderlines(page, 4);
    await page.click('#rich');
    await page.keyboard.type(' Their was a problem.');
    await page.waitForTimeout(1500);
    await layer(page).locator('.op-fab').click();
    await layer(page).locator('.op-tab', { hasText: 'Insights' }).click();
    await page.waitForTimeout(500);
    expect(outbound).toEqual([]);
  });
});

test.describe('extension pages', () => {
  test('popup renders', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const errors = trackErrors(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.getByText('Everything runs on this device')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('every settings section renders', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const errors = trackErrors(page);
    const sections = {
      general: 'General',
      writing: 'Writing',
      rules: 'Suggestions',
      dictionary: 'Personal dictionary',
      sites: 'Sites',
      ai: 'AI providers',
      privacy: 'Privacy & data',
      about: 'About',
    };
    for (const [id, title] of Object.entries(sections)) {
      await page.goto(`chrome-extension://${extensionId}/options.html#${id}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    }
    expect(errors).toEqual([]);
  });

  test('adding a provider asks for consent before saving', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html#ai`);
    await page.locator('.os-provider', { hasText: 'OpenAI' }).first().click();
    await page.fill('#api-key', 'sk-test');
    await page.fill('#check-model', 'gpt-test');
    const save = page.getByRole('button', { name: 'Save and use' });
    await expect(save).toBeDisabled();
    await page.locator('.os-consent input').check();
    await expect(save).toBeEnabled();
  });

  test('welcome page demo checks text', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const errors = trackErrors(page);
    await page.goto(`chrome-extension://${extensionId}/welcome.html`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Oppenly is ready.');
    await waitForUnderlines(page, 1);
    expect(errors).toEqual([]);
  });
});
