export const STORAGE_KEY = 'aiyunxiao-leave-records-v1';
export const statuses = { pending: '待审核', approved: '已批准', rejected: '教师不批准', cancelled: '已撤销' };

export const initialRecords = [
  { id: 'leave-1', name: '学生', status: 'pending', type: 'sick', startDate: '2026-10-12', endDate: '2026-10-12', startPeriod: '1', endPeriod: '14', reason: '身体不适' },
  { id: 'leave-2', name: '学生', status: 'pending', type: 'personal', startDate: '2026-09-30', endDate: '2026-09-30', startPeriod: '1', endPeriod: '1', reason: '起晚了' },
  { id: 'leave-3', name: '学生', status: 'approved', type: 'personal', startDate: '2026-09-04', endDate: '2026-09-04', startPeriod: '5', endPeriod: '14', reason: '境外ACT考试' },
  { id: 'leave-4', name: '学生', status: 'pending', type: 'personal', startDate: '2026-09-09', endDate: '2026-09-09', startPeriod: '3', endPeriod: '4', reason: '回家补觉 昨夜整理文书 没有休息 望老师批准' },
  { id: 'leave-5', name: '学生', status: 'pending', type: 'personal', startDate: '2026-09-01', endDate: '2027-01-29', startPeriod: '', endPeriod: '', weekday: '3', periods: '5、6、7、8、9', reason: '居家自习' },
  { id: 'leave-6', name: '学生', status: 'rejected', type: 'personal', startDate: '2026-09-02', endDate: '2027-01-31', startPeriod: '', endPeriod: '', weekday: '5', periods: '10、11、12、13、14', reason: '居家自习' },
];

export function isValidRecord(record) {
  if (!record || typeof record !== 'object') return false;
  const stringFields = ['id', 'name', 'reason', 'startDate', 'endDate'];
  if (stringFields.some(key => typeof record[key] !== 'string')) return false;
  if (!record.id || !record.name.trim() || record.name.length > 30 || record.reason.length > 500) return false;
  if (!Object.hasOwn(statuses, record.status) || !['sick', 'personal'].includes(record.type)) return false;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (![record.startDate, record.endDate].every(date => datePattern.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date)) return false;
  if (record.endDate < record.startDate) return false;
  if (['startTime', 'endTime'].some(key => record[key] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(record[key]))) return false;
  if (record.startDate === record.endDate && record.startTime && record.endTime && record.endTime < record.startTime) return false;
  if (['startPeriod', 'endPeriod'].some(key => record[key] && !/^(?:[1-9]|1\d|20)$/.test(String(record[key])))) return false;
  if (record.weekday && !/^[1-7]$/.test(String(record.weekday))) return false;
  if (record.weekday && !parsePeriods(record.periods).length) return false;
  if (!record.weekday && record.startDate === record.endDate && record.startPeriod && record.endPeriod && +record.endPeriod < +record.startPeriod) return false;
  return true;
}

export function parsePeriods(value = '') {
  return [...new Set(String(value).split(/[、,，\s]+/).filter(Boolean).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 20))].sort((a, b) => a - b);
}

export function periodCount(record) {
  const start = new Date(`${record.startDate}T00:00:00Z`);
  const end = new Date(`${record.endDate}T00:00:00Z`);
  const weekday = +record.weekday % 7;
  const offset = (weekday - start.getUTCDay() + 7) % 7;
  const days = Math.floor((end - start) / 86400000);
  const occurrences = Math.max(0, Math.floor((days - offset) / 7) + 1);
  return occurrences * parsePeriods(record.periods).length;
}
