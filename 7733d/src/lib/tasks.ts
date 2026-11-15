import { diffDaysISO } from './date.js'
import type { Priority, StudyTask, TaskKind } from './model.js'

export type TaskCategory = 'overdue' | 'today' | 'upcoming' | 'completed'

export type TaskWithState = StudyTask & {
  category: TaskCategory
  blockedBy: string | null
}

const PRIORITY_WEIGHT: Record<Priority, number> = { high: 3, medium: 2, low: 1 }

export function isTaskBlocked(task: StudyTask, tasks: StudyTask[]): StudyTask | null {
  if (!task.dependsOn) return null
  const dependency = tasks.find(candidate => candidate.id === task.dependsOn)
  return dependency && dependency.status !== 'done' ? dependency : null
}

export function taskCategory(task: StudyTask, today: string): TaskCategory {
  if (task.status === 'done') return 'completed'
  if (task.dueDate < today) return 'overdue'
  if (task.dueDate === today) return 'today'
  return 'upcoming'
}

/**
 * Automatic order: priority, deadline, difficulty, then manual order. A task
 * whose dependency is unfinished is shown after tasks that are not blocked.
 */
export function sortTasks(tasks: StudyTask[], today: string, mode: 'auto' | 'manual' = 'auto'): TaskWithState[] {
  const withState: TaskWithState[] = tasks.map(task => {
    const blockedBy = isTaskBlocked(task, tasks)
    return { ...task, category: taskCategory(task, today), blockedBy: blockedBy ? blockedBy.title : null }
  })
  return withState.sort((a, b) => {
    if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1
    if (mode === 'manual') {
      if (a.order !== b.order) return a.order - b.order
      return a.createdAt.localeCompare(b.createdAt)
    }
    if (a.category !== b.category) {
      const rank: Record<TaskCategory, number> = { overdue: 0, today: 1, upcoming: 2, completed: 3 }
      return rank[a.category] - rank[b.category]
    }
    if (Boolean(a.blockedBy) !== Boolean(b.blockedBy)) return a.blockedBy ? 1 : -1
    const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
    if (priorityDiff !== 0) return priorityDiff
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.difficulty !== b.difficulty) return b.difficulty - a.difficulty
    return a.order - b.order
  })
}

export function filterTasks(tasks: TaskWithState[], category: TaskCategory | 'all'): TaskWithState[] {
  return category === 'all' ? tasks : tasks.filter(task => task.category === category)
}

export type DebtSummary = {
  overdue: number
  today: number
  upcoming: number
  completed: number
  open: number
  highPriority: number
  blocked: number
  dueSoon: number
}

export function debtSummary(tasks: StudyTask[], today: string): DebtSummary {
  const summary: DebtSummary = { overdue: 0, today: 0, upcoming: 0, completed: 0, open: 0, highPriority: 0, blocked: 0, dueSoon: 0 }
  for (const task of tasks) {
    const category = taskCategory(task, today)
    if (category === 'completed') {
      summary.completed += 1
      continue
    }
    summary.open += 1
    summary[category] += 1
    if (task.priority === 'high') summary.highPriority += 1
    if (task.dependsOn && task.dependsOn !== task.id) {
      const dependency = tasks.find(candidate => candidate.id === task.dependsOn)
      if (dependency && dependency.status !== 'done') summary.blocked += 1
    }
    const offset = diffDaysISO(task.dueDate, today)
    if (offset >= 0 && offset <= 3) summary.dueSoon += 1
  }
  return summary
}

export type DebtTrendPoint = { weekStart: string; open: number; completed: number }

/**
 * Weekly debt movement reconstructed from creation and completion dates. This is
 * a real history of the stored tasks, not a projection.
 */
export function debtTrend(tasks: StudyTask[], weekStarts: string[], weekEnds: string[]): DebtTrendPoint[] {
  return weekStarts.map((start, index) => {
    const end = weekEnds[index]
    const created = tasks.filter(task => task.createdAt.slice(0, 10) <= end)
    const completedByThen = tasks.filter(task => {
      const completed = task.completedAt?.slice(0, 10)
      return task.status === 'done' && completed !== undefined && completed !== null && completed <= end
    }).length
    const open = created.filter(task => {
      const completed = task.completedAt?.slice(0, 10)
      const stillOpen = task.status !== 'done' || !completed || completed > end
      return stillOpen
    }).length
    return { weekStart: start, open, completed: completedByThen }
  })
}

export function shiftTaskOrder(tasks: StudyTask[], id: string, direction: 'up' | 'down'): StudyTask[] {
  const ordered = [...tasks].sort((a, b) => a.order - b.order)
  const index = ordered.findIndex(task => task.id === id)
  if (index < 0) return tasks
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= ordered.length) return tasks
  const swapped = [...ordered]
  const temp = swapped[index]
  swapped[index] = swapped[target]
  swapped[target] = temp
  return swapped.map((task, order) => ({ ...task, order }))
}

export function nextTaskOrder(tasks: StudyTask[]): number {
  return tasks.reduce((max, task) => Math.max(max, task.order), 0) + 1
}

export const TASK_KINDS: TaskKind[] = ['study', 'test', 'review', 'assignment', 'other']
