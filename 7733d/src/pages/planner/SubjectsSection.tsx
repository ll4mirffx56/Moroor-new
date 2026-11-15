import { useMemo, useState } from 'react'
import {
  Archive, ArchiveRestore, ChevronDown, ChevronLeft, Layers, Pencil, Plus, Trash2,
} from 'lucide-react'
import { useStore } from '../../store/AppStore.js'
import {
  TOPIC_STATUS_LABELS, SUBJECT_ICONS,
  type PaletteKey, type SubjectIconKey, type TopicStatus,
} from '../../lib/model.js'
import { MASTERY_HINTS, MASTERY_LABELS, MASTERY_LEVELS, type Mastery } from '../../lib/review.js'
import { PALETTE_CSS, PALETTE_KEYS, PALETTE_LABELS } from '../../lib/palette.js'
import { faNumber } from '../../lib/date.js'
import { ICON_OPTIONS, SubjectGlyph } from '../../components/SubjectGlyph.js'
import {
  Badge, Button, Callout, Card, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal,
  Select, StatTile, Textarea, cx,
} from '../../components/ui.js'

type SubjectForm = { id?: string; name: string; color: PaletteKey; icon: SubjectIconKey; description: string }
type ChapterForm = { id?: string; subjectId: string; name: string }
type TopicForm = { id?: string; chapterId: string; name: string; mastery: Mastery; status: TopicStatus; note: string }

export function SubjectsSection() {
  const { state, actions, notify } = useStore()
  const [openSubject, setOpenSubject] = useState<string | null>(state.subjects[0]?.id ?? null)
  const [openChapter, setOpenChapter] = useState<string | null>(null)
  const [subjectForm, setSubjectForm] = useState<SubjectForm | null>(null)
  const [chapterForm, setChapterForm] = useState<ChapterForm | null>(null)
  const [topicForm, setTopicForm] = useState<TopicForm | null>(null)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'chapter' | 'topic'; id: string; name: string } | null>(null)

  const active = state.subjects.filter(subject => !subject.archived).sort((a, b) => a.order - b.order)
  const archived = state.subjects.filter(subject => subject.archived)
  const chaptersOf = (subjectId: string) => state.chapters.filter(chapter => chapter.subjectId === subjectId).sort((a, b) => a.order - b.order)
  const topicsOf = (chapterId: string) => state.topics.filter(topic => topic.chapterId === chapterId)
  const topicCount = (subjectId: string) => {
    const chapterIds = new Set(chaptersOf(subjectId).map(chapter => chapter.id))
    return state.topics.filter(topic => chapterIds.has(topic.chapterId)).length
  }
  const mastered = state.topics.filter(topic => topic.status === 'mastered').length

  useMemo(() => state.chapters.length, [state.chapters.length])

  function openSubjectForm(subject?: typeof state.subjects[number]) {
    setFormError('')
    setSubjectForm(subject
      ? { id: subject.id, name: subject.name, color: subject.color, icon: subject.icon, description: subject.description }
      : { name: '', color: 'blue', icon: 'book', description: '' })
  }

  function saveSubject() {
    if (!subjectForm) return
    const name = subjectForm.name.trim()
    if (!name) { setFormError('نام درس را وارد کن.'); return }
    const duplicate = state.subjects.some(subject => subject.name.trim() === name && subject.id !== subjectForm.id)
    if (duplicate) { setFormError('درسی با همین نام وجود دارد.'); return }
    if (subjectForm.id) {
      actions.updateSubject(subjectForm.id, {
        name,
        color: subjectForm.color,
        icon: subjectForm.icon,
        description: subjectForm.description.trim(),
      })
      notify('درس به‌روزرسانی شد.', 'success')
    } else {
      const id = actions.addSubject({ name, color: subjectForm.color, icon: subjectForm.icon, description: subjectForm.description })
      setOpenSubject(id)
      notify('درس جدید ساخته شد.', 'success')
    }
    setSubjectForm(null)
  }

  function saveChapter() {
    if (!chapterForm) return
    const name = chapterForm.name.trim()
    if (!name) { setFormError('نام فصل را وارد کن.'); return }
    const duplicate = state.chapters.some(chapter =>
      chapter.subjectId === chapterForm.subjectId && chapter.name.trim() === name && chapter.id !== chapterForm.id)
    if (duplicate) { setFormError('فصلی با همین نام در این درس وجود دارد.'); return }
    if (chapterForm.id) {
      actions.updateChapter(chapterForm.id, name)
      notify('فصل به‌روزرسانی شد.', 'success')
    } else {
      const id = actions.addChapter(chapterForm.subjectId, name)
      setOpenChapter(id)
      notify('فصل جدید ساخته شد.', 'success')
    }
    setChapterForm(null)
  }

  function saveTopic() {
    if (!topicForm) return
    const name = topicForm.name.trim()
    if (!name) { setFormError('نام مبحث را وارد کن.'); return }
    const duplicate = state.topics.some(topic =>
      topic.chapterId === topicForm.chapterId && topic.name.trim() === name && topic.id !== topicForm.id)
    if (duplicate) { setFormError('مبحثی با همین نام در این فصل وجود دارد.'); return }
    if (topicForm.id) {
      actions.updateTopic(topicForm.id, {
        name,
        mastery: topicForm.mastery,
        status: topicForm.status,
        note: topicForm.note,
      })
      notify('مبحث به‌روزرسانی شد.', 'success')
    } else {
      actions.addTopic({
        chapterId: topicForm.chapterId,
        name,
        mastery: topicForm.mastery,
        status: topicForm.status,
        note: topicForm.note,
      })
      notify('مبحث جدید ساخته شد.', 'success')
    }
    setTopicForm(null)
  }

  function renderSubject(subject: typeof state.subjects[number]) {
    const isOpen = openSubject === subject.id
    const chapters = chaptersOf(subject.id)
    return (
      <article key={subject.id} className="subject-card">
        <div className="subject-head">
          <button type="button" className="subject-toggle" onClick={() => setOpenSubject(isOpen ? null : subject.id)} aria-expanded={isOpen}>
            <span className="subject-glyph" style={{ background: `color-mix(in oklab, ${PALETTE_CSS[subject.color]} 22%, transparent)`, color: PALETTE_CSS[subject.color] }}>
              <SubjectGlyph icon={subject.icon} />
            </span>
            <span className="subject-title">
              <strong>{subject.name}</strong>
              <span className="muted">{faNumber(chapters.length, 0)} فصل · {faNumber(topicCount(subject.id), 0)} مبحث</span>
            </span>
            <ChevronLeft size={16} className={cx('subject-chevron', isOpen && 'subject-chevron-open')} aria-hidden="true" />
          </button>
          <div className="row-actions">
            <IconButton label="افزودن فصل" onClick={() => { setFormError(''); setChapterForm({ subjectId: subject.id, name: '' }); setOpenSubject(subject.id) }}>
              <Plus size={16} />
            </IconButton>
            <IconButton label="ویرایش درس" onClick={() => openSubjectForm(subject)}><Pencil size={15} /></IconButton>
            <IconButton label={subject.archived ? 'بازگرداندن درس' : 'بایگانی درس'} onClick={() => actions.updateSubject(subject.id, { archived: !subject.archived })}>
              {subject.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            </IconButton>
          </div>
        </div>
        {subject.description ? <p className="subject-desc">{subject.description}</p> : null}

        {isOpen ? (
          <div className="chapter-list">
            {chapters.length ? chapters.map(chapter => {
              const topics = topicsOf(chapter.id)
              const isChapterOpen = openChapter === chapter.id
              return (
                <div key={chapter.id} className="chapter-item">
                  <div className="chapter-head">
                    <button type="button" className="chapter-toggle" onClick={() => setOpenChapter(isChapterOpen ? null : chapter.id)} aria-expanded={isChapterOpen}>
                      <ChevronDown size={15} className={cx('subject-chevron', isChapterOpen && 'subject-chevron-open')} aria-hidden="true" />
                      <span>{chapter.name}</span>
                      <span className="muted">{faNumber(topics.length, 0)} مبحث</span>
                    </button>
                    <div className="row-actions">
                      <IconButton label="افزودن مبحث" onClick={() => { setFormError(''); setTopicForm({ chapterId: chapter.id, name: '', mastery: 'weak', status: 'not-started', note: '' }); setOpenChapter(chapter.id) }}>
                        <Plus size={15} />
                      </IconButton>
                      <IconButton label="ویرایش فصل" onClick={() => { setFormError(''); setChapterForm({ id: chapter.id, subjectId: subject.id, name: chapter.name }) }}><Pencil size={14} /></IconButton>
                      <IconButton label="حذف فصل" onClick={() => setDeleteTarget({ kind: 'chapter', id: chapter.id, name: chapter.name })}><Trash2 size={14} /></IconButton>
                    </div>
                  </div>
                  {isChapterOpen ? (
                    topics.length ? (
                      <div className="topic-list">
                        {topics.map(topic => (
                          <div key={topic.id} className="topic-row">
                            <div>
                              <strong>{topic.name}</strong>
                              {topic.note ? <span className="muted topic-note">{topic.note}</span> : null}
                            </div>
                            <div className="row-actions">
                              <Badge tone="violet">{MASTERY_LABELS[topic.mastery]}</Badge>
                              <Badge tone={topic.status === 'mastered' ? 'positive' : topic.status === 'reviewing' ? 'info' : 'neutral'}>
                                {TOPIC_STATUS_LABELS[topic.status]}
                              </Badge>
                              <IconButton
                                label="ویرایش مبحث"
                                onClick={() => {
                                  setFormError('')
                                  setTopicForm({ id: topic.id, chapterId: chapter.id, name: topic.name, mastery: topic.mastery, status: topic.status, note: topic.note })
                                }}
                              >
                                <Pencil size={14} />
                              </IconButton>
                              <IconButton label="حذف مبحث" onClick={() => setDeleteTarget({ kind: 'topic', id: topic.id, name: topic.name })}>
                                <Trash2 size={14} />
                              </IconButton>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="empty-inline">مبحثی در این فصل ثبت نشده است.</p>
                  ) : null}
                </div>
              )
            }) : <p className="empty-inline">هنوز فصلی برای این درس ساخته نشده است. با دکمهٔ + شروع کن.</p>}
          </div>
        ) : null}
      </article>
    )
  }

  return (
    <div className="section-stack">
      <div className="stat-grid-4">
        <StatTile label="درس‌های فعال" value={faNumber(active.length, 0)} hint={`${faNumber(archived.length, 0)} بایگانی‌شده`} />
        <StatTile label="فصل‌ها" value={faNumber(state.chapters.length, 0)} />
        <StatTile label="مباحث" value={faNumber(state.topics.length, 0)} />
        <StatTile label="مباحث مسلط" value={faNumber(mastered, 0)} tone={mastered ? 'positive' : 'neutral'} />
      </div>

      <Card
        title="ساختار درس، فصل و مبحث"
        subtitle="این ساختار مبنای مرورها، آزمون‌ها و گزارش‌های مبحثی است."
        action={<Button icon={<Plus size={16} />} onClick={() => openSubjectForm()}>درس جدید</Button>}
      >
        {active.length ? active.map(renderSubject) : (
          <EmptyState icon={<Layers size={26} />} title="درسی وجود ندارد" description="برای شروع یک درس بساز." action={<Button onClick={() => openSubjectForm()}>افزودن درس</Button>} />
        )}

        {archived.length ? (
          <div className="archived-block">
            <h3 className="subhead">درس‌های بایگانی‌شده</h3>
            {archived.map(subject => (
              <div key={subject.id} className="archived-row">
                <span className="subject-dot" style={{ background: PALETTE_CSS[subject.color] }} />
                <span>{subject.name}</span>
                <IconButton label="بازگرداندن درس" onClick={() => actions.updateSubject(subject.id, { archived: false })}>
                  <ArchiveRestore size={16} />
                </IconButton>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Callout tone="info" title="چرا بایگانی به‌جای حذف؟">
        حذف یک درس ممکن است مرورها و سابقهٔ آزمون‌های قبلی را بی‌ارتباط کند. بایگانی درس را از انتخاب‌های جدید کنار می‌گذارد
        اما سابقهٔ آن حفظ می‌شود. حذف فصل و مبحث فقط ساختار را حذف می‌کند و نام‌های ثبت‌شده در مرورهای قبلی باقی می‌مانند.
      </Callout>

      <Modal
        open={Boolean(subjectForm)}
        onClose={() => setSubjectForm(null)}
        title={subjectForm?.id ? 'ویرایش درس' : 'افزودن درس'}
        footer={<><Button variant="secondary" onClick={() => setSubjectForm(null)}>انصراف</Button><Button onClick={saveSubject}>ذخیره</Button></>}
      >
        {subjectForm ? (
          <div className="form-stack">
            <Field label="نام درس" required>
              <Input value={subjectForm.name} onChange={event => setSubjectForm({ ...subjectForm, name: event.target.value })} placeholder="مثلاً زیست‌شناسی" />
            </Field>
            <Field label="توضیحات">
              <Textarea rows={2} value={subjectForm.description} onChange={event => setSubjectForm({ ...subjectForm, description: event.target.value })} />
            </Field>
            <Field label="رنگ">
              <div className="color-row">
                {PALETTE_KEYS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={cx('color-swatch', subjectForm.color === color && 'color-swatch-active')}
                    style={{ background: PALETTE_CSS[color] }}
                    aria-label={PALETTE_LABELS[color]}
                    aria-pressed={subjectForm.color === color}
                    onClick={() => setSubjectForm({ ...subjectForm, color })}
                  />
                ))}
              </div>
            </Field>
            <Field label="آیکون">
              <div className="icon-row">
                {SUBJECT_ICONS.map(icon => {
                  const label = ICON_OPTIONS.find(option => option.value === icon)?.label ?? icon
                  return (
                    <button
                      key={icon}
                      type="button"
                      className={cx('icon-choice', subjectForm.icon === icon && 'icon-choice-active')}
                      aria-label={label}
                      aria-pressed={subjectForm.icon === icon}
                      onClick={() => setSubjectForm({ ...subjectForm, icon })}
                    >
                      <SubjectGlyph icon={icon} size={19} />
                    </button>
                  )
                })}
              </div>
            </Field>
            {formError ? <p className="form-error" role="alert">{formError}</p> : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(chapterForm)}
        onClose={() => setChapterForm(null)}
        title={chapterForm?.id ? 'ویرایش فصل' : 'افزودن فصل'}
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setChapterForm(null)}>انصراف</Button><Button onClick={saveChapter}>ذخیره</Button></>}
      >
        {chapterForm ? (
          <div className="form-stack">
            <Field label="نام فصل" required>
              <Input value={chapterForm.name} onChange={event => setChapterForm({ ...chapterForm, name: event.target.value })} placeholder="مثلاً سینماتیک" />
            </Field>
            {formError ? <p className="form-error" role="alert">{formError}</p> : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(topicForm)}
        onClose={() => setTopicForm(null)}
        title={topicForm?.id ? 'ویرایش مبحث' : 'افزودن مبحث'}
        footer={<><Button variant="secondary" onClick={() => setTopicForm(null)}>انصراف</Button><Button onClick={saveTopic}>ذخیره</Button></>}
      >
        {topicForm ? (
          <div className="form-stack">
            <Field label="نام مبحث" required>
              <Input value={topicForm.name} onChange={event => setTopicForm({ ...topicForm, name: event.target.value })} />
            </Field>
            <div className="form-grid form-grid-2">
              <Field label="میزان تسلط" hint={MASTERY_HINTS[topicForm.mastery]}>
                <Select
                  value={topicForm.mastery}
                  onChange={event => setTopicForm({ ...topicForm, mastery: event.target.value as Mastery })}
                  options={MASTERY_LEVELS.map(level => ({ value: level, label: MASTERY_LABELS[level] }))}
                />
              </Field>
              <Field label="وضعیت مطالعه">
                <Select
                  value={topicForm.status}
                  onChange={event => setTopicForm({ ...topicForm, status: event.target.value as TopicStatus })}
                  options={(Object.keys(TOPIC_STATUS_LABELS) as TopicStatus[]).map(status => ({ value: status, label: TOPIC_STATUS_LABELS[status] }))}
                />
              </Field>
            </div>
            <Field label="یادداشت مبحث">
              <Textarea rows={3} value={topicForm.note} onChange={event => setTopicForm({ ...topicForm, note: event.target.value })} />
            </Field>
            {formError ? <p className="form-error" role="alert">{formError}</p> : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.kind === 'chapter' ? 'حذف فصل' : 'حذف مبحث'}
        message={deleteTarget?.kind === 'chapter'
          ? `فصل «${deleteTarget.name}» و مباحث زیرمجموعهٔ آن حذف شوند؟ مرورهای قبلی حفظ می‌شوند اما ارتباطشان با این فصل برداشته می‌شود.`
          : `مبحث «${deleteTarget?.name}» حذف شود؟ مرورهای ثبت‌شده حفظ می‌شوند.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          if (deleteTarget.kind === 'chapter') actions.removeChapter(deleteTarget.id)
          else actions.removeTopic(deleteTarget.id)
          notify('ساختار حذف شد؛ سابقهٔ مرورها حفظ شد.', 'info')
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
