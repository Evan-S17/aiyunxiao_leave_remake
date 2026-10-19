import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { initialRecords, STORAGE_KEY } from '../src/data.js';

async function manage(page) {
  await page.getByRole('button', { name: '更多操作' }).click();
  await page.getByRole('button', { name: '管理请假记录', exact: true }).click();
}

test.beforeEach(async ({ page }) => { await page.goto('/leave/vacationList'); });

test('自适应列表，无模拟状态栏，280–920px 及横屏无横向溢出', async ({ page }, testInfo) => {
  await expect(page.locator('.leave-card')).toHaveCount(6);
  await expect(page.locator('.leave-card').first()).toContainText('已批准');
  await expect(page.locator('.recurrence-row').first()).toContainText('共110节课');
  await expect(page.locator('.status-bar, .clock, .wifi, .signal, .battery, .bottom-safe-area')).toHaveCount(0);
  for (const [width, height] of [[280, 653], [320, 568], [360, 800], [375, 667], [390, 844], [414, 896], [430, 932], [540, 720], [768, 1024], [844, 390], [920, 412]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    expect(await page.locator('.student-value').first().evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
    expect(await page.locator('.phone').evaluate(el => Math.round(el.getBoundingClientRect().width))).toBe(Math.min(width, 768));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('mobile-list.png'), fullPage: true });
});

test('长姓名、长事由、时间节次、字体放大和安全区不遮挡，窄屏表单可操作', async ({ page }, testInfo) => {
  const records = structuredClone(initialRecords);
  Object.assign(records[0], {
    name: '学生'.repeat(15),
    reason: '较长的请假事由，需要完整显示并自然换行。'.repeat(15) + 'https://example.com/' + 'a'.repeat(100),
    startDate: '2026-12-31', endDate: '2026-12-31', useToday: false,
    startTime: '08:30', endTime: '20:30', startPeriod: '19', endPeriod: '20',
  });
  await page.evaluate(({ records, key }) => localStorage.setItem(key, JSON.stringify(records)), { records, key: STORAGE_KEY });
  await page.reload();
  for (const fontSize of [16, 24, 32]) {
    await page.evaluate(size => { document.documentElement.style.fontSize = `${size}px`; }, fontSize);
    for (const [width, height] of [[280, 653], [320, 568], [375, 667], [430, 932], [844, 390]]) {
      await page.setViewportSize({ width, height });
      const overflow = await page.locator('.leave-card').first().evaluate(card => [...card.querySelectorAll('.detail-row,dt,dd,.student-name,.tags,.time-value>span,.revoke-button')].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.className || el.tagName));
      expect(overflow, `${width}px / ${fontSize}px text`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      const navigation = await page.locator('.navigation').evaluate(nav => {
        const title = nav.querySelector('h1').getBoundingClientRect();
        const left = nav.querySelector('.navigation-left').getBoundingClientRect();
        const more = nav.querySelector('.more').getBoundingClientRect();
        const visibleButtons = [...nav.querySelectorAll('.navigation-left button')].filter(el => el.getBoundingClientRect().width);
        const lastButton = visibleButtons.at(-1).getBoundingClientRect();
        return { noOverlap: lastButton.right <= title.left + 1 && title.right <= more.left + 1, left: left.left };
      });
      expect(navigation.noOverlap, `navigation ${width}px / ${fontSize}px text`).toBeTruthy();
      expect(await page.getByRole('searchbox').evaluate(el => el.clientWidth)).toBeGreaterThanOrEqual(fontSize * 4);
    }
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '16px';
    document.documentElement.style.setProperty('--safe-left', '44px');
    document.documentElement.style.setProperty('--safe-right', '44px');
    document.documentElement.style.setProperty('--safe-top', '24px');
    document.documentElement.style.setProperty('--safe-bottom', '34px');
  });
  await expect(page.locator('.navigation')).toHaveCSS('padding-left', '44px');
  await expect(page.locator('.app-header')).toHaveCSS('padding-top', '24px');
  expect(await page.locator('.leave-card').first().evaluate(el => el.getBoundingClientRect().left)).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: testInfo.outputPath('landscape-safe-area.png') });
  await page.evaluate(() => { ['--safe-top', '--safe-left', '--safe-right', '--safe-bottom'].forEach(name => document.documentElement.style.removeProperty(name)); });
  for (const [width, height] of [[280, 653], [320, 568], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await manage(page);
    await page.getByRole('button', { name: '编辑', exact: true }).first().click();
    expect(await page.locator('#panel').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy();
    const clipped = await page.locator('#editor').evaluate(form => [...form.querySelectorAll('input:not([type=checkbox]),select,textarea')].filter(el => {
      const bounds = el.getBoundingClientRect();
      return bounds.left < 0 || bounds.right > innerWidth;
    }).map(el => el.name));
    expect(clipped).toEqual([]);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
});

test('六项字段可编辑并在刷新后保留', async ({ page }) => {
  await manage(page);
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  const form = page.locator('#editor');
  await page.getByLabel('学生姓名（编辑）').fill('李同学');
  await form.locator('[name=status]').selectOption('approved');
  await form.locator('[name=type]').selectOption('personal');
  await form.locator('[name=startDate]').fill('2026-11-01');
  await form.locator('[name=endDate]').fill('2026-11-02');
  await form.locator('[name=startTime]').fill('09:30');
  await form.locator('[name=endTime]').fill('15:45');
  await form.locator('[name=startPeriod]').selectOption('3');
  await form.locator('[name=endPeriod]').selectOption('8');
  await page.getByLabel('请假事由').fill('家庭事务');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  const card = page.locator('.leave-card').first();
  for (const text of ['李同学', '已批准', '事假', '2026-11-1', '2026-11-2', '09:30', '15:45', '第3节', '第8节', '家庭事务']) await expect(card).toContainText(text);
  await expect(card.getByRole('button', { name: '撤销请假' })).toHaveCount(0);
});

test('姓名搜索、清空、筛选状态与类型及重置', async ({ page }) => {
  await page.getByRole('searchbox').fill('不存在');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page.getByText('暂无请假记录')).toBeVisible();
  await page.getByRole('button', { name: '清空姓名' }).click();
  await expect(page.locator('.leave-card')).toHaveCount(6);
  await page.getByRole('button', { name: '筛选', exact: true }).click();
  await page.getByLabel('审核状态').selectOption('approved');
  await page.getByLabel('请假类型').selectOption('sick');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.locator('.leave-card')).toHaveCount(1);
  await expect(page.locator('.leave-card')).toContainText('病假');
  await page.getByRole('button', { name: '筛选', exact: true }).click();
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(page.locator('.leave-card')).toHaveCount(6);
});

test('撤销需要确认，取消不改变状态，确认后持久化', async ({ page }) => {
  const first = page.locator('[data-id=leave-2]');
  await first.getByRole('button', { name: '撤销请假' }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(first).toContainText('待审核');
  await first.getByRole('button', { name: '撤销请假' }).click();
  await page.getByRole('button', { name: '确认撤销' }).click();
  await page.reload();
  await expect(first).toContainText('已撤销');
  await expect(first.getByRole('button', { name: '撤销请假' })).toHaveCount(0);
});

test('阻止结束日期或同日节次早于开始值', async ({ page }) => {
  await manage(page);
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  const form = page.locator('#editor');
  await form.locator('[name=startDate]').fill('2026-11-01');
  await form.locator('[name=endDate]').fill('2026-10-31');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('结束时间不能早于开始时间');
  await form.locator('[name=endDate]').fill('2026-11-01');
  await form.locator('[name=startPeriod]').selectOption('14');
  await form.locator('[name=endPeriod]').selectOption('1');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('结束时间不能早于开始时间');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('新增周期请假、自动总节数、文本安全与删除', async ({ page }) => {
  await manage(page);
  await page.getByRole('button', { name: '新增请假记录' }).click();
  const form = page.locator('#editor');
  await page.getByLabel('学生姓名（编辑）').fill('测试同学');
  await form.locator('[name=startDate]').fill('2026-09-01');
  await form.locator('[name=endDate]').fill('2027-01-29');
  await page.getByLabel('周期请假', { exact: true }).check();
  await form.locator('[name=weekday]').selectOption('3');
  await form.locator('[name=periods]').fill('5,6,7,8,9');
  await page.getByLabel('请假事由').fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.leave-card')).toHaveCount(7);
  await expect(page.locator('.leave-card').first()).toContainText('共110节课');
  await expect(page.locator('.leave-card').first()).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.leave-card img')).toHaveCount(0);
  await manage(page);
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  await page.getByRole('button', { name: '删除这条记录' }).click();
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByRole('button', { name: '关闭面板' }).click();
  await page.reload();
  await expect(page.locator('.leave-card')).toHaveCount(6);
});

test('本地数据损坏时回退，不崩溃', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('aiyunxiao-leave-records-v1', '{bad json'));
  await page.reload();
  await expect(page.locator('.leave-card')).toHaveCount(6);
  await expect(page.getByRole('status')).toContainText('本地数据无法读取');
});

test('导出备份并导入替换记录，拒绝无效文件', async ({ page }) => {
  await page.getByRole('button', { name: '更多操作' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出本地数据' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('请假记录.json');
  const path = await download.path();
  await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('[{"name":"invalid"}]') });
  await expect(page.getByRole('status')).toContainText('无法导入');
  await page.locator('#import-file').setInputFiles(path);
  await expect(page.getByText('将用文件中的 6 条记录替换当前记录，是否继续？')).toBeVisible();
  await page.getByRole('button', { name: '确认导入' }).click();
  await page.reload();
  await expect(page.locator('.leave-card')).toHaveCount(6);
});

test('空记录列表保持为空，存储写入失败时明确提示', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('aiyunxiao-leave-records-v1', '[]'));
  await page.reload();
  await expect(page.getByText('暂无请假记录')).toBeVisible();
  await page.evaluate(() => localStorage.removeItem('aiyunxiao-leave-records-v1'));
  await page.reload();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.locator('[data-id=leave-2]').getByRole('button', { name: '撤销请假' }).click();
  await page.getByRole('button', { name: '确认撤销' }).click();
  await expect(page.getByRole('status')).toContainText('保存失败');
  await expect(page.locator('[data-id=leave-2]')).toContainText('待审核');
});

test('单文件 HTML 离线运行，无外部资源，编辑刷新持久化', async ({ page }) => {
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.resourceType() !== 'document') externalRequests.push(request.url()); });
  // The managed cloud Chromium blocks file:// navigation. Supply the exact
  // local file as an intercepted document; no HTTP server or network is used.
  const html = await readFile(resolve('leave.html'), 'utf8');
  expect(/[^\x00-\x7f]/.test(html)).toBeFalsy();
  // Deliberately serve the wrong charset to catch Chinese mojibake regressions.
  await page.route('https://standalone.test/**', route => route.fulfill({ contentType: 'text/html; charset=windows-1252', body: html }));
  await page.context().setOffline(true);
  await page.goto('https://standalone.test/');
  await expect(page.locator('.leave-card')).toHaveCount(6);
  await expect(page.locator('.navigation h1')).toHaveText('请假记录');
  await expect(page.locator('.leave-card').first()).toContainText('学生');
  await manage(page);
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  await page.getByLabel('学生姓名（编辑）').fill('离线编辑');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.reload();
  await expect(page.locator('.leave-card').first()).toContainText('离线编辑');
  await manage(page);
  await page.getByRole('button', { name: '新增请假记录' }).click();
  await page.getByLabel('学生姓名（编辑）').fill('离线新增');
  await page.getByLabel('请假事由').fill('单文件测试');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.leave-card')).toHaveCount(7);
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('修改任意一个姓名同步全部记录，离线无上传，刷新和新增沿用姓名', async ({ page, browser }) => {
  await page.waitForLoadState('networkidle');
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.context().setOffline(true);
  await manage(page);
  await page.getByRole('button', { name: '编辑', exact: true }).nth(2).click();
  await page.getByLabel('学生姓名（编辑）').fill('统一姓名');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.student-name')).toHaveText(Array(6).fill('统一姓名'));
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(stored.studentName).toBe('统一姓名');
  expect(stored.records.every(record => record.name === '统一姓名')).toBeTruthy();
  expect(requests).toEqual([]);
  await page.context().setOffline(false);
  await page.reload();
  await expect(page.locator('.student-name')).toHaveText(Array(6).fill('统一姓名'));
  await manage(page);
  await page.getByRole('button', { name: '新增请假记录' }).click();
  await expect(page.getByLabel('学生姓名（编辑）')).toHaveValue('统一姓名');

  const isolated = await browser.newContext();
  try {
    const other = await isolated.newPage();
    await other.goto('http://127.0.0.1:5173/');
    await expect(other.locator('.student-name')).toHaveText(Array(6).fill('学生'));
  } finally { await isolated.close(); }
});

test('统一姓名菜单在空列表仍能保存，取消不修改，新增记录使用该姓名', async ({ page }) => {
  await page.evaluate(key => localStorage.setItem(key, '[]'), STORAGE_KEY);
  await page.reload();
  await page.getByRole('button', { name: '更多操作' }).click();
  await page.getByRole('button', { name: '统一更改姓名' }).click();
  await page.getByLabel('所有记录的学生姓名').fill('不会保存');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '更多操作' }).click();
  await page.getByRole('button', { name: '统一更改姓名' }).click();
  await expect(page.getByLabel('所有记录的学生姓名')).toHaveValue('学生');
  await page.getByLabel('所有记录的学生姓名').fill('本机姓名');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.reload();
  await expect(page.getByText('暂无请假记录')).toBeVisible();
  await manage(page);
  await page.getByRole('button', { name: '新增请假记录' }).click();
  await expect(page.getByLabel('学生姓名（编辑）')).toHaveValue('本机姓名');
  await page.getByLabel('请假事由').fill('本地记录');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.student-name')).toHaveText('本机姓名');
});

test('第一条默认已批准并取当地当天，次日刷新更新，手动日期不被覆盖', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-19T16:30:00Z'));
  await page.reload();
  const first = page.locator('[data-id=leave-1]');
  await expect(first.locator('.leave-status')).toHaveText('已批准');
  await expect(first.locator('.time-value')).toHaveText(['2026-10-20第1节', '2026-10-20第14节']);
  await page.getByRole('button', { name: '更多操作' }).click();
  await page.getByRole('button', { name: '统一更改姓名' }).click();
  await page.getByLabel('所有记录的学生姓名').fill('日期检查');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.clock.setFixedTime(new Date('2026-10-20T16:30:00Z'));
  await page.reload();
  await expect(first.locator('.time-value')).toHaveText(['2026-10-21第1节', '2026-10-21第14节']);
  await manage(page);
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  await page.locator('[name=startDate]').fill('2026-11-01');
  await page.locator('[name=endDate]').fill('2026-11-02');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.clock.setFixedTime(new Date('2026-10-21T16:30:00Z'));
  await page.reload();
  await expect(first.locator('.time-value')).toHaveText(['2026-11-1第1节', '2026-11-2第14节']);
});

test('旧版数据保留自定义日期和状态，升级未修改的旧默认卡片', async ({ page }) => {
  const legacy = structuredClone(initialRecords);
  Object.assign(legacy[0], { name: '旧本地姓名', status: 'pending', startDate: '2026-10-12', endDate: '2026-10-12' });
  delete legacy[0].useToday;
  Object.assign(legacy[2], { status: 'rejected', reason: '保留自定义内容', startDate: '2026-08-01', endDate: '2026-08-01' });
  await page.evaluate(({ key, legacy }) => localStorage.setItem(key, JSON.stringify(legacy)), { key: STORAGE_KEY, legacy });
  await page.reload();
  await expect(page.locator('.student-name')).toHaveText(Array(6).fill('旧本地姓名'));
  await expect(page.locator('[data-id=leave-1] .leave-status')).toHaveText('已批准');
  await expect(page.locator('[data-id=leave-3]')).toContainText('保留自定义内容');
  await expect(page.locator('[data-id=leave-3]')).toContainText('2026-8-1');
  await expect(page.locator('[data-id=leave-3] .leave-status')).toHaveText('教师不批准');
});

test('统一姓名保存失败不改变当前记录或磁盘数据', async ({ page }) => {
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ version: 2, studentName: '保存前姓名', records: [] })), STORAGE_KEY);
  await page.reload();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: '更多操作' }).click();
  await page.getByRole('button', { name: '统一更改姓名' }).click();
  await page.getByLabel('所有记录的学生姓名').fill('不应保存');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('保存失败');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).studentName, STORAGE_KEY)).toBe('保存前姓名');
  await page.getByRole('button', { name: '关闭面板' }).click();
  await page.getByRole('button', { name: '更多操作' }).click();
  await page.getByRole('button', { name: '统一更改姓名' }).click();
  await expect(page.getByLabel('所有记录的学生姓名')).toHaveValue('保存前姓名');
});
