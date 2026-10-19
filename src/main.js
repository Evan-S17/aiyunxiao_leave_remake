import './style.css';
import { STORAGE_KEY, initialRecords, statuses, isValidRecord, parsePeriods, periodCount } from './data.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
let records = structuredClone(initialRecords);
let storageWarning = '';
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every(isValidRecord) || new Set(parsed.map(r => r.id)).size !== parsed.length) throw new Error('Invalid records');
    records = parsed;
  }
} catch { storageWarning = '本地数据无法读取，已显示初始记录。'; }

let search = '';
let filters = { status: '', type: '' };
let toastTimer;
const panel = $('#panel');

function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2800);
}

function persist(nextRecords) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
    records = nextRecords;
    render();
    return true;
  } catch {
    notify('保存失败，请检查浏览器是否允许本地存储。');
    return false;
  }
}

function dateText(date) { return date.split('-').map(Number).join('-'); }
function tag(label, color) {
  return `<span class="tag ${color}"><svg viewBox="0 0 58 24" aria-hidden="true"><path d="M1 1H48L57 12 48 23H1Z"/><circle cx="46" cy="12" r="3"/></svg><span>${label}</span></span>`;
}

function card(record) {
  const timeRow = (label, prefix) => `<div class="detail-row"><dt>${label}</dt><dd class="time-value"><span>${dateText(record[`${prefix}Date`])}${record[`${prefix}Time`] ? `<small>${escape(record[`${prefix}Time`])}</small>` : ''}</span>${record[`${prefix}Period`] && !record.weekday ? `<span>第${escape(record[`${prefix}Period`])}节</span>` : ''}</dd></div>`;
  return `<article class="leave-card" data-id="${escape(record.id)}" aria-label="${escape(record.name)} ${statuses[record.status]} ${record.startDate}">
    <h2 class="leave-status ${record.status}">${statuses[record.status]}</h2>
    <dl class="details">
      <div class="detail-row name-row"><dt>学生姓名</dt><dd class="student-value"><span class="student-name">${escape(record.name)}</span><span class="tags">${tag(record.type === 'sick' ? '病假' : '事假', record.type === 'sick' ? 'red' : 'green')}${tag('离校', 'red')}</span></dd></div>
      ${timeRow('开始时间', 'start')}${timeRow('结束时间', 'end')}
      ${record.weekday ? `<div class="detail-row recurrence-row"><dt>周期请假</dt><dd>每星期${'一二三四五六日'[+record.weekday - 1]}，第${parsePeriods(record.periods).join('、')}节<br/>共${periodCount(record)}节课</dd></div>` : ''}
      <div class="detail-row reason-row"><dt>事由</dt><dd>${escape(record.reason)}</dd></div>
    </dl>
    ${record.status === 'pending' ? `<button class="revoke-button" data-revoke="${escape(record.id)}">撤销请假</button>` : ''}
  </article>`;
}

function render() {
  const visible = records.filter(record => record.name.includes(search) && (!filters.status || record.status === filters.status) && (!filters.type || record.type === filters.type));
  $('#records').innerHTML = visible.length ? visible.map(card).join('') : '<div class="empty-state">暂无请假记录</div>';
  $('.filter-dot').hidden = !filters.status && !filters.type;
}

function openPanel(title, body, className = '') {
  $('#panel-content').innerHTML = `<div class="panel-heading"><h2 id="panel-title">${title}</h2><button class="panel-close" aria-label="关闭面板">×</button></div>${body}`;
  panel.className = `panel ${className}`;
  if (!panel.open) panel.showModal();
  document.body.classList.add('modal-open');
  $('.panel-close').onclick = () => panel.close();
  panel.scrollTop = 0;
}

panel.addEventListener('close', () => document.body.classList.remove('modal-open'));
panel.addEventListener('click', event => { if (event.target === panel) panel.close(); });

function openMenu() {
  openPanel('更多操作', `<div class="menu-actions"><button id="manage-records">管理请假记录</button><button id="menu-filter">筛选记录</button><button id="export-records">导出本地数据</button><button id="import-records">导入本地数据</button><input type="file" id="import-file" accept="application/json,.json" hidden/></div><p class="panel-note">数据仅保存在当前浏览器。可导出备份，在其他设备导入。</p>`);
  $('#manage-records').onclick = openManager;
  $('#menu-filter').onclick = openFilter;
  $('#export-records').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '请假记录.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('数据已导出');
  };
  $('#import-records').onclick = () => $('#import-file').click();
  $('#import-file').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('文件超过 1 MB');
      const imported = JSON.parse(await file.text());
      if (!Array.isArray(imported) || imported.length > 500 || !imported.every(isValidRecord) || new Set(imported.map(r => r.id)).size !== imported.length) throw new Error('记录格式不正确');
      openPanel('导入记录', `<p class="confirm-message">将用文件中的 ${imported.length} 条记录替换当前记录，是否继续？</p><div class="form-actions"><button class="secondary-button" id="cancel-import">取消</button><button class="green-button" id="confirm-import">确认导入</button></div>`);
      $('#cancel-import').onclick = openMenu;
      $('#confirm-import').onclick = () => { if (persist(imported)) { panel.close(); notify('导入成功'); } };
    } catch (error) { notify(`无法导入：${error instanceof SyntaxError ? 'JSON 文件格式不正确' : error.message}`); }
    finally { event.target.value = ''; }
  };
}

function openManager() {
  openPanel('管理请假记录', `<button class="green-button add-button" id="add-record">新增请假记录</button><div class="manage-list">${records.map(record => `<div class="manage-item"><div><strong>${escape(record.name)}</strong><span class="manage-status ${record.status}">${statuses[record.status]}</span><p>${dateText(record.startDate)} · ${record.type === 'sick' ? '病假' : '事假'}</p><p class="manage-reason">${escape(record.reason)}</p></div><button class="edit-button" data-edit="${escape(record.id)}">编辑</button></div>`).join('') || '<p class="panel-note">暂无记录，点击上方按钮新增。</p>'}</div>`);
  $('#add-record').onclick = () => openEditor();
  panel.querySelectorAll('[data-edit]').forEach(button => { button.onclick = () => openEditor(button.dataset.edit); });
}

function options(values, selected) { return values.map(([value, text]) => `<option value="${value}" ${String(selected) === String(value) ? 'selected' : ''}>${text}</option>`).join(''); }

function openEditor(id) {
  const existing = records.find(record => record.id === id);
  const today = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const record = existing || { name: '', status: 'pending', type: 'personal', startDate: today, endDate: today, startPeriod: '1', endPeriod: '1', reason: '' };
  const periods = [['', '不显示节次'], ...Array.from({ length: 20 }, (_, i) => [i + 1, `第${i + 1}节`])];
  openPanel(existing ? '编辑请假记录' : '新增请假记录', `<form id="editor" class="editor-form">
    <label>学生姓名<input name="name" aria-label="学生姓名（编辑）" value="${escape(record.name)}" maxlength="30" required autocomplete="off"/></label>
    <div class="form-grid"><label>审核状态<select name="status">${options(Object.entries(statuses), record.status)}</select></label><label>请假类型<select name="type">${options([['personal', '事假'], ['sick', '病假']], record.type)}</select></label></div>
    <fieldset><legend>开始时间</legend><div class="form-grid"><label>开始日期<input type="date" name="startDate" value="${escape(record.startDate)}" min="1900-01-01" max="9999-12-31" required/></label><label>开始节次<select name="startPeriod">${options(periods, record.startPeriod)}</select></label></div><label>具体时间（选填）<input type="time" name="startTime" value="${escape(record.startTime)}"/></label></fieldset>
    <fieldset><legend>结束时间</legend><div class="form-grid"><label>结束日期<input type="date" name="endDate" value="${escape(record.endDate)}" min="1900-01-01" max="9999-12-31" required/></label><label>结束节次<select name="endPeriod">${options(periods, record.endPeriod)}</select></label></div><label>具体时间（选填）<input type="time" name="endTime" value="${escape(record.endTime)}"/></label></fieldset>
    <label class="checkbox-label"><input type="checkbox" name="recurring" ${record.weekday ? 'checked' : ''}/>周期请假</label>
    <div id="recurring-fields" ${record.weekday ? '' : 'hidden'}><div class="form-grid"><label>重复日期<select name="weekday">${options(Array.from('一二三四五六日', (day, i) => [i + 1, `每星期${day}`]), record.weekday || '3')}</select></label><label>请假节次<input name="periods" value="${escape(record.periods || '5、6、7、8、9')}" placeholder="如：5、6、7" inputmode="text"/></label></div><p class="field-hint">总节数根据起止日期和每周节次自动计算。</p></div>
    <label>请假事由<textarea name="reason" rows="3" maxlength="500" required>${escape(record.reason)}</textarea></label>
    <p id="form-error" class="form-error" role="alert"></p>
    <div class="form-actions"><button class="secondary-button" type="button" id="cancel-edit">取消</button><button class="green-button" type="submit">保存</button></div>
    ${existing ? '<button class="delete-button" type="button" id="delete-record">删除这条记录</button>' : ''}
  </form>`, 'editor-panel');
  const form = $('#editor');
  form.elements.recurring.onchange = () => { $('#recurring-fields').hidden = !form.elements.recurring.checked; };
  $('#cancel-edit').onclick = openManager;
  if (existing) $('#delete-record').onclick = () => {
    openPanel('删除记录', '<p class="confirm-message">确认删除这条请假记录？删除后无法撤回。</p><div class="form-actions"><button class="secondary-button" id="cancel-delete">取消</button><button class="danger-button" id="confirm-delete">删除</button></div>');
    $('#cancel-delete').onclick = () => openEditor(id);
    $('#confirm-delete').onclick = () => { if (persist(records.filter(item => item.id !== id))) { openManager(); notify('记录已删除'); } };
  };
  form.onsubmit = event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const next = { id: existing?.id || crypto.randomUUID(), name: data.name.trim(), status: data.status, type: data.type, startDate: data.startDate, endDate: data.endDate, startPeriod: data.startPeriod, endPeriod: data.endPeriod, startTime: data.startTime, endTime: data.endTime, reason: data.reason.trim() };
    if (data.recurring) {
      const tokens = data.periods.split(/[、,，\s]+/).filter(Boolean);
      if (!tokens.length || tokens.some(token => !/^(?:[1-9]|1\d|20)$/.test(token))) { $('#form-error').textContent = '周期节次请输入 1–20，以顿号或逗号分隔。'; return; }
      next.weekday = data.weekday;
      next.periods = parsePeriods(data.periods).join('、');
      next.startPeriod = '';
      next.endPeriod = '';
    }
    if (!next.name || !next.reason) { $('#form-error').textContent = '请填写姓名和请假事由。'; return; }
    if (!isValidRecord(next)) { $('#form-error').textContent = '请检查日期、时间和节次，结束时间不能早于开始时间。'; return; }
    if (persist(existing ? records.map(item => item.id === id ? next : item) : [next, ...records])) { panel.close(); notify('已保存'); }
  };
}

function openFilter() {
  openPanel('筛选记录', `<form id="filter-form" class="editor-form"><label>审核状态<select name="status">${options([['', '全部状态'], ...Object.entries(statuses)], filters.status)}</select></label><label>请假类型<select name="type">${options([['', '全部类型'], ['sick', '病假'], ['personal', '事假']], filters.type)}</select></label><div class="form-actions"><button class="secondary-button" type="button" id="reset-filter">重置</button><button class="green-button" type="submit">确定</button></div></form>`);
  $('#filter-form').onsubmit = event => { event.preventDefault(); filters = Object.fromEntries(new FormData(event.target)); render(); panel.close(); };
  $('#reset-filter').onclick = () => { filters = { status: '', type: '' }; render(); panel.close(); };
}

function resetView() { search = ''; filters = { status: '', type: '' }; $('#search-name').value = ''; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

$('.more').onclick = openMenu;
$('.back').onclick = resetView;
$('.close-page').onclick = resetView;
$('#open-filter').onclick = openFilter;
$('#search-form').onsubmit = event => { event.preventDefault(); search = $('#search-name').value.trim(); $('#search-name').blur(); render(); };
$('.clear-search').onclick = () => { $('#search-name').value = ''; search = ''; render(); };
$('#search-name').addEventListener('search', () => { if (!$('#search-name').value) { search = ''; render(); } });
$('#records').addEventListener('click', event => {
  const button = event.target.closest('[data-revoke]');
  if (!button) return;
  const id = button.dataset.revoke;
  openPanel('撤销请假', '<p class="confirm-message">确认撤销这条请假申请？</p><div class="form-actions"><button class="secondary-button" id="cancel-revoke">取消</button><button class="green-button" id="confirm-revoke">确认撤销</button></div>');
  $('#cancel-revoke').onclick = () => panel.close();
  $('#confirm-revoke').onclick = () => { if (persist(records.map(record => record.id === id ? { ...record, status: 'cancelled' } : record))) { panel.close(); notify('请假已撤销'); } };
});

function updateClock() { $('.clock').textContent = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); }
updateClock();
setInterval(updateClock, 30000);
render();
if (storageWarning) notify(storageWarning);
