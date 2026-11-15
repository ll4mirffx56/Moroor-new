import { useMemo, useState } from 'react'
import { ClipboardList, Eye, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useStore } from '../../store/AppStore.js'
import { EXAM_KIND_LABELS, type Exam, type ExamKind, type ExamResult } from '../../lib/model.js'
import { aggregatePercent, examPercent, unanswered, validateCounts } from '../../lib/exam.js'
import { faNumber, formatJalali, formatPercent, parseIntegerInput } from '../../lib/date.js'
import { createId } from '../../lib/id.js'
import {
  Badge, Button, Callout, Card, ConfirmDialog, EmptyState, Field, IconButton, Input,
  Modal, Select, Textarea,
} from '../../components/ui.js'
import { DateField } from '../../components/JalaliDatePicker.js'

type ResultDraft = {
  id: string
  subjectId: string
  subjectName: string
  topicName: string
  total: string
  correct: string
  wrong: string
}

type ExamForm = {
  id?: string
  title: string
  date: string
  kind: ExamKind
  note: string
  results: ResultDraft[]
}

const KIND_OPTIONS = (Object.keys(EXAM_KIND_LABELS) as ExamKind[]).map(kind => ({ value: kind, label: EXAM_KIND_LABELS[kind] }))

function emptyResult(): ResultDraft {
  return { id: createId('result'), subjectId: '', subjectName: '', topicName: '', total: '', correct: '', wrong: '' }
}

export function ExamsSection() {
  const { state, today, actions, notify } = useStore()
  const [query, setQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [form, setForm] = useState<ExamForm | null>(null)
  const [draft, setDraft] = useState<ResultDraft>(emptyResult())
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<Exam | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null)

  const activeSubjects = state.subjects.filter(subject => !subject.archived)
  const subjectsInExams = [...new Set(state.exams.flatMap(exam => exam.results.map(result => result.subjectName)))]

  const exams = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('fa')
    return [...state.exams]
      .filter(exam => {
        if (subjectFilter !== 'all' && !exam.results.some(result => result.subjectName === subjectFilter)) return false
        if (!search) return true
        return `${exam.title} ${exam.note} ${exam.results.map(result => `${result.subjectName} ${result.topicName}`).join(' ')}`
          .toLocaleLowerCase('fa').includes(search)
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [state.exams, query, subjectFilter])

  function openForm(exam?: Exam) {
    setError('')
    setDraft(emptyResult())
    setForm(exam
      ? {
          id: exam.id,
          title: exam.title,
          date: exam.date,
          kind: exam.kind,
          note: exam.note,
          results: exam.results.map(result => ({
            id: result.id,
            subjectId: result.subjectId ?? '',
            subjectName: result.subjectName,
            topicName: result.topicName,
            total: String(result.total),
            correct: String(result.correct),
            wrong: String(result.wrong),
          })),
        }
      : { title: '', date: today, kind: 'mock', note: '', results: [] })
  }

  function addResult() {
    setError('')
    if (!form) return
    const subject = state.subjects.find(item => item.id === draft.subjectId)
    if (!subject) { setError('درس نتیجه را انتخاب کن.'); return }
    const total = parseIntegerInput(draft.total)
    const correct = parseIntegerInput(draft.correct || '0')
    const wrong = parseIntegerInput(draft.wrong || '0')
    if (total === null || correct === null || wrong === null) { setError('تعدادها باید عدد صحیح نامنفی باشند.'); return }
    const message = validateCounts({ total, correct, wrong })
    if (message) { setError(message); return }
    if (form.results.some(result => result.subjectName === subject.name && result.topicName === draft.topicName.trim())) {
      setError('این درس و مبحث در همین آزمون ثبت شده است.')
      return
    }
    setForm({
      ...form,
      results: [...form.results, {
        id: createId('result'),
        subjectId: subject.id,
        subjectName: subject.name,
        topicName: draft.topicName.trim(),
        total: String(total),
        correct: String(correct),
        wrong: String(wrong),
      }],
    })
    setDraft(emptyResult())
  }

  function removeResult(id: string) {
    if (!form) return
    setForm({ ...form, results: form.results.filter(result => result.id !== id) })
  }

  function submit() {
    if (!form) return
    setError('')
    if (!form.title.trim()) { setError('عنوان آزمون را وارد کن.'); return }
    if (!form.date) { setError('تاریخ آزمون را انتخاب کن.'); return }
    if (!form.results.length) { setError('حداقل یک نتیجهٔ درس برای آزمون ثبت کن.'); return }
    const results: ExamResult[] = form.results.map(result => ({
      id: result.id,
      subjectId: result.subjectId || null,
      subjectName: result.subjectName,
      topicId: state.topics.find(topic => topic.name === result.topicName)?.id ?? null,
      topicName: result.topicName,
      total: Number(result.total),
      correct: Number(result.correct),
      wrong: Number(result.wrong),
    }))
    for (const result of results) {
      const message = validateCounts(result)
      if (message) { setError(`${result.subjectName}: ${message}`); return }
    }
    if (form.id) {
      actions.updateExam(form.id, {
        title: form.title.trim(),
        date: form.date,
        kind: form.kind,
        note: form.note,
        results,
      })
      notify('آزمون به‌روزرسانی شد.', 'success')
    } else {
      actions.addExam({ title: form.title.trim(), date: form.date, kind: form.kind, note: form.note, results })
      notify('آزمون ثبت شد و در تحلیل‌ها لحاظ می‌شود.', 'success')
    }
    setForm(null)
  }

  const formCounts = form?.results.map(result => ({
    total: Number(result.total), correct: Number(result.correct), wrong: Number(result.wrong),
  })) ?? []
  const formOverall = aggregatePercent(formCounts)

  return (
    <div className="section-stack">
      <Card
        title="آزمون‌ها"
        subtitle="هر آزمون می‌تواند چند درس و مبحث داشته باشد؛ درصد هر درس و درصد کل مستقل محاسبه می‌شوند."
        action={<Button icon={<Plus size={16} />} onClick={() => openForm()}>ثبت آزمون</Button>}
      >
        <div className="filter-bar">
          <Input
            aria-label="جست‌وجوی آزمون"
            placeholder="جست‌وجو در عنوان یا مبحث…"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <Select
            aria-label="فیلتر درس آزمون"
            value={subjectFilter}
            onChange={event => setSubjectFilter(event.target.value)}
            options={[{ value: 'all', label: 'همهٔ درس‌ها' }, ...subjectsInExams.map(name => ({ value: name, label: name }))]}
          />
        </div>

        {exams.length ? (
          <div className="exam-list">
            {exams.map(exam => {
              const percent = aggregatePercent(exam.results)
              return (
                <article key={exam.id} className="exam-card">
                  <div className="exam-head">
                    <div>
                      <div className="exam-title-row">
                        <strong>{exam.title}</strong>
                        <Badge tone="violet">{EXAM_KIND_LABELS[exam.kind]}</Badge>
                        <Badge tone={percent !== null && percent >= 50 ? 'positive' : percent !== null && percent < 30 ? 'danger' : 'neutral'}>
                          {formatPercent(percent)}
                        </Badge>
                      </div>
                      <span className="muted">
                        {formatJalali(exam.date, 'full')} · {faNumber(exam.results.length, 0)} درس · {faNumber(exam.results.reduce((sum, result) => sum + result.total, 0), 0)} سؤال
                      </span>
                    </div>
                    <div className="row-actions">
                      <IconButton label="مشاهدهٔ جزئیات" onClick={() => setDetail(exam)}><Eye size={16} /></IconButton>
                      <IconButton label="ویرایش آزمون" onClick={() => openForm(exam)}><Pencil size={15} /></IconButton>
                      <IconButton label="حذف آزمون" onClick={() => setDeleteTarget(exam)}><Trash2 size={15} /></IconButton>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table compact">
                      <thead>
                        <tr><th>درس</th><th>مبحث</th><th>کل</th><th>صحیح</th><th>غلط</th><th>نزده</th><th>درصد</th></tr>
                      </thead>
                      <tbody>
                        {exam.results.map(result => (
                          <tr key={result.id}>
                            <td>{result.subjectName}</td>
                            <td>{result.topicName || '—'}</td>
                            <td>{faNumber(result.total, 0)}</td>
                            <td>{faNumber(result.correct, 0)}</td>
                            <td>{faNumber(result.wrong, 0)}</td>
                            <td>{faNumber(unanswered(result), 0)}</td>
                            <td><strong>{formatPercent(examPercent(result))}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {exam.note ? <p className="exam-note">{exam.note}</p> : null}
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={<ClipboardList size={26} />}
            title="آزمونی ثبت نشده است"
            description="با ثبت اولین آزمون، تحلیل درس و مبحث و نمودار روند ساخته می‌شود."
            action={<Button onClick={() => openForm()}>ثبت آزمون</Button>}
          />
        )}
      </Card>

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? 'ویرایش آزمون' : 'ثبت آزمون'}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>انصراف</Button>
            <Button onClick={submit}>{form?.id ? 'ذخیرهٔ تغییرات' : 'ثبت آزمون'}</Button>
          </>
        )}
      >
        {form ? (
          <div className="form-stack">
            <div className="form-grid form-grid-2">
              <Field label="عنوان آزمون" required>
                <Input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="مثلاً آزمون جامع ۱۲ آبان" />
              </Field>
              <Field label="نوع آزمون">
                <Select
                  value={form.kind}
                  onChange={event => setForm({ ...form, kind: event.target.value as ExamKind })}
                  options={KIND_OPTIONS}
                />
              </Field>
              <DateField label="تاریخ آزمون" value={form.date} today={today} onChange={iso => setForm({ ...form, date: iso })} required />
              <Field label="توضیحات">
                <Input value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} placeholder="اختیاری" />
              </Field>
            </div>

            <div className="divider" />
            <h3 className="subhead">نتیجهٔ درس‌ها</h3>

            {form.results.length ? (
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr><th>درس</th><th>مبحث</th><th>کل</th><th>صحیح</th><th>غلط</th><th>درصد</th><th /></tr>
                  </thead>
                  <tbody>
                    {form.results.map(result => {
                      const counts = { total: Number(result.total), correct: Number(result.correct), wrong: Number(result.wrong) }
                      return (
                        <tr key={result.id}>
                          <td>{result.subjectName}</td>
                          <td>{result.topicName || '—'}</td>
                          <td>{faNumber(counts.total, 0)}</td>
                          <td>{faNumber(counts.correct, 0)}</td>
                          <td>{faNumber(counts.wrong, 0)}</td>
                          <td><strong>{formatPercent(examPercent(counts))}</strong></td>
                          <td><IconButton label="حذف نتیجه" onClick={() => removeResult(result.id)}><X size={14} /></IconButton></td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={2}>درصد کل</th>
                      <th>{faNumber(formCounts.reduce((sum, counts) => sum + counts.total, 0), 0)}</th>
                      <th>{faNumber(formCounts.reduce((sum, counts) => sum + counts.correct, 0), 0)}</th>
                      <th>{faNumber(formCounts.reduce((sum, counts) => sum + counts.wrong, 0), 0)}</th>
                      <th colSpan={2}>{formatPercent(formOverall)}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : <p className="empty-inline">هنوز نتیجه‌ای اضافه نشده است.</p>}

            <div className="result-add">
              <div className="form-grid form-grid-5">
                <Field label="درس">
                  <Select
                    value={draft.subjectId}
                    onChange={event => setDraft({ ...draft, subjectId: event.target.value })}
                    options={[{ value: '', label: 'انتخاب درس', disabled: true }, ...activeSubjects.map(subject => ({ value: subject.id, label: subject.name }))]}
                  />
                </Field>
                <Field label="مبحث">
                  <Input list="exam-topics" value={draft.topicName} onChange={event => setDraft({ ...draft, topicName: event.target.value })} placeholder="اختیاری" />
                  <datalist id="exam-topics">
                    {state.topics.map(topic => <option key={topic.id} value={topic.name} />)}
                  </datalist>
                </Field>
                <Field label="کل">
                  <Input inputMode="numeric" value={draft.total} onChange={event => setDraft({ ...draft, total: event.target.value })} />
                </Field>
                <Field label="صحیح">
                  <Input inputMode="numeric" value={draft.correct} onChange={event => setDraft({ ...draft, correct: event.target.value })} />
                </Field>
                <Field label="غلط">
                  <Input inputMode="numeric" value={draft.wrong} onChange={event => setDraft({ ...draft, wrong: event.target.value })} />
                </Field>
              </div>
              <Button variant="secondary" icon={<Plus size={15} />} onClick={addResult}>افزودن نتیجه</Button>
            </div>

            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <Callout tone="info">
              درصد هر درس با فرمول نمرهٔ منفی محاسبه می‌شود. اگر تعداد کل صفر باشد درصد به‌صورت «—» نمایش داده می‌شود و تقسیم بر صفر انجام نمی‌شود.
            </Callout>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.title ?? 'جزئیات آزمون'}
        subtitle={detail ? `${formatJalali(detail.date, 'full')} · ${EXAM_KIND_LABELS[detail.kind]}` : ''}
        size="lg"
      >
        {detail ? (
          <div className="form-stack">
            <div className="detail-summary">
              <div><span>درصد کل</span><strong>{formatPercent(aggregatePercent(detail.results))}</strong></div>
              <div><span>تعداد درس</span><strong>{faNumber(detail.results.length, 0)}</strong></div>
              <div><span>کل سؤال</span><strong>{faNumber(detail.results.reduce((sum, result) => sum + result.total, 0), 0)}</strong></div>
              <div><span>نزده</span><strong>{faNumber(detail.results.reduce((sum, result) => sum + unanswered(result), 0), 0)}</strong></div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>درس</th><th>مبحث</th><th>کل</th><th>صحیح</th><th>غلط</th><th>نزده</th><th>درصد</th></tr></thead>
                <tbody>
                  {detail.results.map(result => (
                    <tr key={result.id}>
                      <td>{result.subjectName}</td>
                      <td>{result.topicName || '—'}</td>
                      <td>{faNumber(result.total, 0)}</td>
                      <td>{faNumber(result.correct, 0)}</td>
                      <td>{faNumber(result.wrong, 0)}</td>
                      <td>{faNumber(unanswered(result), 0)}</td>
                      <td><strong>{formatPercent(examPercent(result))}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detail.note ? <p className="exam-note">{detail.note}</p> : <Textarea rows={2} value="یادداشتی ثبت نشده است." readOnly disabled />}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف آزمون"
        message={deleteTarget ? `آزمون «${deleteTarget.title}» و همهٔ نتایج آن حذف شوند؟ این کار قابل بازگشت نیست و تحلیل‌های قبلی تغییر می‌کنند.` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          actions.removeExam(deleteTarget.id)
          notify('آزمون حذف شد.', 'info')
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
