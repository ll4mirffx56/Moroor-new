import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useStore, type DailyTestRow } from '../../store/AppStore.js'
import { aggregateCounts, aggregatePercent, examPercent, unanswered, validateCounts } from '../../lib/exam.js'
import {
  addDaysISO, diffDaysISO, faNumber, formatJalali, formatPercent, isValidISODate, parseDecimalInput,
  parseIntegerInput,
} from '../../lib/date.js'
import { PALETTE_CSS } from '../../lib/palette.js'
import {
  Badge, Button, Callout, Card, ConfirmDialog, EmptyState, Field, IconButton, Input,
  Select, Textarea, cx,
} from '../../components/ui.js'
import { DateField } from '../../components/JalaliDatePicker.js'

type RowDraft = { subjectId: string; total: string; correct: string; wrong: string }

export function DailySection() {
  const { state, today, actions, notify } = useStore()
  const [date, setDate] = useState(today)
  const [hours, setHours] = useState('')
  const [planned, setPlanned] = useState('')
  const [focus, setFocus] = useState('')
  const [note, setNote] = useState('')
  const [rows, setRows] = useState<DailyTestRow[]>([])
  const [draft, setDraft] = useState<RowDraft>({ subjectId: '', total: '', correct: '', wrong: '' })
  const [error, setError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [historySubject, setHistorySubject] = useState('all')
  const [fromDate, setFromDate] = useState(addDaysISO(today, -29))
  const [toDate, setToDate] = useState(today)

  const activeSubjects = state.subjects.filter(subject => !subject.archived)
  const subjectColor = (name: string) => PALETTE_CSS[state.subjects.find(subject => subject.name === name)?.color ?? 'blue']

  useEffect(() => {
    const day = state.studyDays.find(item => item.date === date)
    setHours(day ? String(day.hours) : '')
    setPlanned(day ? String(day.plannedHours) : '')
    setFocus(day && day.focus !== null ? String(day.focus) : '')
    setNote(day?.note ?? '')
    setRows(state.tests
      .filter(test => test.date === date)
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'fa'))
      .map(test => ({
        id: test.id,
        subjectId: test.subjectId,
        subjectName: test.subjectName,
        total: test.total,
        correct: test.correct,
        wrong: test.wrong,
        note: test.note,
      })))
    setError('')
    // Only reload when the selected day changes; typing must not be overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const totalCounts = aggregateCounts(rows)
  const overall = aggregatePercent(rows)

  const history = useMemo(() => {
    const dates = new Set<string>([
      ...state.studyDays.map(day => day.date),
      ...state.tests.map(test => test.date),
    ])
    return [...dates]
      .filter(value => isValidISODate(value) && value >= fromDate && value <= toDate)
      .sort((a, b) => b.localeCompare(a))
      .map(value => {
        const day = state.studyDays.find(item => item.date === value)
        const tests = state.tests.filter(test => test.date === value && (historySubject === 'all' || test.subjectName === historySubject))
        return { date: value, hours: day?.hours ?? 0, planned: day?.plannedHours ?? 0, tests }
      })
      .filter(item => item.hours > 0 || item.tests.length > 0)
      .slice(0, 20)
  }, [state.studyDays, state.tests, fromDate, toDate, historySubject])

  function parseOptionalDecimal(value: string): number | null {
    if (!value.trim()) return 0
    return parseDecimalInput(value)
  }

  function addRow() {
    setError('')
    if (!draft.subjectId) { setError('درس را انتخاب کن.'); return }
    const subject = activeSubjects.find(item => item.id === draft.subjectId) ?? state.subjects.find(item => item.id === draft.subjectId)
    if (!subject) { setError('درس انتخاب‌شده پیدا نشد.'); return }
    const total = parseIntegerInput(draft.total)
    const correct = parseIntegerInput(draft.correct || '0')
    const wrong = parseIntegerInput(draft.wrong || '0')
    if (total === null || correct === null || wrong === null) {
      setError('تعداد کل، صحیح و غلط باید عدد صحیح نامنفی باشند.')
      return
    }
    const message = validateCounts({ total, correct, wrong })
    if (message) { setError(message); return }
    if (rows.some(row => row.subjectName === subject.name)) {
      setRows(current => current.map(row => row.subjectName === subject.name
        ? { ...row, subjectId: subject.id, total, correct, wrong }
        : row))
      notify(`آمار ${subject.name} به‌روزرسانی شد.`, 'info')
    } else {
      setRows(current => [...current, {
        subjectId: subject.id,
        subjectName: subject.name,
        total,
        correct,
        wrong,
        note: '',
      }])
      notify(`آمار ${subject.name} اضافه شد؛ نزده خودکار ${faNumber(unanswered({ total, correct, wrong }), 0)} محاسبه شد.`, 'success')
    }
    setDraft({ subjectId: '', total: '', correct: '', wrong: '' })
  }

  function editRow(row: DailyTestRow) {
    setDraft({
      subjectId: row.subjectId ?? activeSubjects.find(subject => subject.name === row.subjectName)?.id ?? '',
      total: String(row.total),
      correct: String(row.correct),
      wrong: String(row.wrong),
    })
    if (!row.subjectId) {
      setError('این ردیف به درس مشخصی متصل نیست؛ اگر درس را انتخاب نکنی، ویرایش ممکن نیست.')
    }
  }

  function save() {
    setError('')
    const hoursValue = parseOptionalDecimal(hours)
    const plannedValue = parseOptionalDecimal(planned)
    const focusValue = focus.trim() ? parseIntegerInput(focus) : null
    if (hoursValue === null || plannedValue === null) { setError('ساعت مطالعه و ساعت برنامه باید عدد نامنفی باشند.'); return }
    if (hoursValue > 24 || plannedValue > 24) { setError('ساعت مطالعه و برنامه حداکثر ۲۴ ساعت در روز است.'); return }
    if (focusValue !== null && (focusValue < 0 || focusValue > 10)) { setError('تمرکز باید عددی بین ۰ تا ۱۰ باشد.'); return }
    if (hoursValue === 0 && rows.length === 0 && !note.trim()) {
      setError('برای ثبت، حداقل ساعت مطالعه، یک ردیف تست یا یک یادداشت لازم است.')
      return
    }
    for (const row of rows) {
      const message = validateCounts(row)
      if (message) { setError(`${row.subjectName}: ${message}`); return }
    }
    actions.saveStudyDay(date, { hours: hoursValue, plannedHours: plannedValue, focus: focusValue, note })
    actions.saveDailyTests(date, rows)
    notify(`عملکرد ${formatJalali(date, 'long')} ذخیره شد.`, 'success')
  }

  const draftCounts = {
    total: parseIntegerInput(draft.total) ?? 0,
    correct: parseIntegerInput(draft.correct || '0') ?? 0,
    wrong: parseIntegerInput(draft.wrong || '0') ?? 0,
  }
  const draftValid = parseIntegerInput(draft.total) !== null &&
    parseIntegerInput(draft.correct || '0') !== null &&
    parseIntegerInput(draft.wrong || '0') !== null &&
    validateCounts(draftCounts) === null

  return (
    <div className="section-stack">
      <Card
        title="ثبت عملکرد روزانه"
        subtitle="برای هر روز می‌توانی چند درس ثبت کنی؛ تعداد نزده و درصد خودکار محاسبه می‌شوند."
        action={<Badge tone={date === today ? 'info' : 'neutral'}>{date === today ? 'امروز' : formatJalali(date, 'long')}</Badge>}
      >
        <div className="daily-top">
          <DateField label="تاریخ" value={date} today={today} onChange={setDate} />
          <Field label="ساعت مطالعه">
            <Input inputMode="decimal" value={hours} onChange={event => setHours(event.target.value)} placeholder="مثلاً ۳.۵" />
          </Field>
          <Field label="ساعت برنامه">
            <Input inputMode="decimal" value={planned} onChange={event => setPlanned(event.target.value)} placeholder="اختیاری" />
          </Field>
          <Field label="تمرکز (۰ تا ۱۰)">
            <Input inputMode="numeric" value={focus} onChange={event => setFocus(event.target.value)} placeholder="اختیاری" />
          </Field>
        </div>

        <div className="daily-add">
          <div className="form-grid form-grid-5">
            <Field label="درس">
              <Select
                value={draft.subjectId}
                onChange={event => setDraft({ ...draft, subjectId: event.target.value })}
                options={[{ value: '', label: 'انتخاب درس', disabled: true }, ...activeSubjects.map(subject => ({ value: subject.id, label: subject.name }))]}
              />
            </Field>
            <Field label="تعداد کل">
              <Input inputMode="numeric" value={draft.total} onChange={event => setDraft({ ...draft, total: event.target.value })} />
            </Field>
            <Field label="صحیح">
              <Input inputMode="numeric" value={draft.correct} onChange={event => setDraft({ ...draft, correct: event.target.value })} />
            </Field>
            <Field label="غلط">
              <Input inputMode="numeric" value={draft.wrong} onChange={event => setDraft({ ...draft, wrong: event.target.value })} />
            </Field>
            <div className="add-row-action">
              <div className="draft-preview">
                <span>نزده: <strong>{draft.total.trim() ? (draftValid ? faNumber(unanswered(draftCounts), 0) : 'نامعتبر') : '—'}</strong></span>
                <span>درصد: <strong>{draftValid ? formatPercent(examPercent(draftCounts)) : '—'}</strong></span>
              </div>
              <Button onClick={addRow} icon={<Plus size={15} />}>افزودن/ویرایش درس</Button>
            </div>
          </div>
        </div>

        {rows.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>درس</th>
                  <th>کل</th>
                  <th>صحیح</th>
                  <th>غلط</th>
                  <th>نزده</th>
                  <th>درصد</th>
                  <th aria-label="عملیات" />
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.subjectName}>
                    <td><span className="subject-dot" style={{ background: subjectColor(row.subjectName) }} />{row.subjectName}</td>
                    <td>{faNumber(row.total, 0)}</td>
                    <td className="text-positive">{faNumber(row.correct, 0)}</td>
                    <td className="text-danger">{faNumber(row.wrong, 0)}</td>
                    <td>{faNumber(unanswered(row), 0)}</td>
                    <td><strong>{formatPercent(examPercent(row))}</strong></td>
                    <td>
                      <div className="row-actions">
                        <IconButton label="ویرایش ردیف" onClick={() => editRow(row)}><Pencil size={14} /></IconButton>
                        <IconButton label="حذف ردیف" onClick={() => setRows(current => current.filter(item => item.subjectName !== row.subjectName))}><X size={14} /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>درصد کل</th>
                  <th>{faNumber(totalCounts.total, 0)}</th>
                  <th>{faNumber(totalCounts.correct, 0)}</th>
                  <th>{faNumber(totalCounts.wrong, 0)}</th>
                  <th>{faNumber(totalCounts.total - totalCounts.correct - totalCounts.wrong, 0)}</th>
                  <th colSpan={2}>{formatPercent(overall)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="empty-inline">هنوز درسی برای این روز اضافه نشده است. می‌توانی فقط ساعت مطالعه را هم ذخیره کنی.</p>
        )}

        <Field label="یادداشت روز">
          <Textarea rows={2} value={note} onChange={event => setNote(event.target.value)} placeholder="اختیاری" />
        </Field>

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <div className="form-actions">
          <Button variant="secondary" icon={<Trash2 size={15} />} onClick={() => setDeleteOpen(true)} disabled={!state.studyDays.some(day => day.date === date) && !state.tests.some(test => test.date === date)}>
            حذف رکورد روز
          </Button>
          <Button icon={<Save size={16} />} onClick={save}>ذخیرهٔ عملکرد روز</Button>
        </div>

        <Callout tone="info">
          فرمول درصد: ((صحیح × ۳) − غلط) ÷ (کل × ۳) × ۱۰۰. پاسخ نزده نمرهٔ منفی ندارد و درصد کل از مجموع داده‌های همهٔ درس‌ها محاسبه می‌شود، نه میانگین درصدها.
        </Callout>
      </Card>

      <Card title="تاریخچهٔ عملکرد" subtitle="رکوردهای ذخیره‌شده با امکان بازگشت به فرم ویرایش">
        <div className="filter-bar">
          <Select
            aria-label="فیلتر درس تاریخی"
            value={historySubject}
            onChange={event => setHistorySubject(event.target.value)}
            options={[{ value: 'all', label: 'همهٔ درس‌ها' }, ...activeSubjects.map(subject => ({ value: subject.name, label: subject.name }))]}
          />
          <DateField label="از تاریخ" value={fromDate} today={today} onChange={setFromDate} />
          <DateField label="تا تاریخ" value={toDate} today={today} onChange={setToDate} />
        </div>

        {history.length ? (
          <div className="history-list">
            {history.map(item => {
              const counts = aggregateCounts(item.tests)
              return (
                <article key={item.date} className="history-row">
                  <div className="history-head">
                    <div>
                      <strong>{formatJalali(item.date, 'full')}</strong>
                      <span className="muted">
                        {faNumber(item.hours, 1)} ساعت مطالعه
                        {item.planned > 0 ? ` از ${faNumber(item.planned, 1)} ساعت برنامه` : ''}
                        {' · '}{faNumber(counts.total, 0)} تست
                      </span>
                    </div>
                    <div className="row-actions">
                      <Badge tone="violet">{formatPercent(aggregatePercent(item.tests))}</Badge>
                      <Button size="sm" variant="ghost" icon={<CalendarDays size={14} />} onClick={() => { setDate(item.date); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                        ویرایش
                      </Button>
                    </div>
                  </div>
                  {item.tests.length ? (
                    <div className="history-tests">
                      {item.tests.map(test => (
                        <div key={test.id} className="history-test">
                          <span className="subject-dot" style={{ background: subjectColor(test.subjectName) }} />
                          <span>{test.subjectName}</span>
                          <span className={cx('muted')}>{faNumber(test.total, 0)} کل · {faNumber(test.correct, 0)} صحیح · {faNumber(test.wrong, 0)} غلط · {faNumber(unanswered(test), 0)} نزده</span>
                          <strong>{formatPercent(examPercent(test))}</strong>
                        </div>
                      ))}
                    </div>
                  ) : <p className="empty-inline">فقط ساعت مطالعه ثبت شده است.</p>}
                  <span className="history-distance">{diffDaysISO(item.date, today) === 0 ? 'امروز' : `${faNumber(Math.abs(diffDaysISO(item.date, today)), 0)} روز پیش`}</span>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState title="رکوردی در این بازه نیست" description="بازهٔ تاریخ یا فیلتر درس را تغییر بده." />
        )}
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        title="حذف رکورد روز"
        message={`همهٔ اطلاعات ${formatJalali(date, 'long')} شامل ساعت مطالعه و تست‌های ثبت‌شده حذف شود؟ این کار قابل بازگشت نیست.`}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          actions.removeDay(date)
          setHours(''); setPlanned(''); setFocus(''); setNote(''); setRows([])
          notify('رکورد روز حذف شد.', 'info')
          setDeleteOpen(false)
        }}
      />
    </div>
  )
}
