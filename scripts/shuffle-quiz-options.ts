/**
 * Shuffle existing quiz questions' options so correct answers
 * are randomly distributed across A/B/C/D instead of all being A.
 * 
 * Uses Fisher-Yates shuffle.
 * Run with: npx tsx scripts/shuffle-quiz-options.ts
 */

import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'pokemon.db')
const db = new Database(DB_PATH)

interface QuizRow {
  id: number
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_index: number
}

const allQuestions = db.prepare('SELECT id, option_a, option_b, option_c, option_d, correct_index FROM quiz_questions').all() as QuizRow[]

console.log(`Total questions: ${allQuestions.length}`)

// Count current distribution
const before: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
for (const q of allQuestions) {
  before[q.correct_index] = (before[q.correct_index] || 0) + 1
}
console.log('Before shuffle:', before)

const updateStmt = db.prepare(`
  UPDATE quiz_questions 
  SET option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_index = ?
  WHERE id = ?
`)

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const updateAll = db.transaction(() => {
  for (const q of allQuestions) {
    const options = [q.option_a, q.option_b, q.option_c, q.option_d]
    const correctAnswer = options[q.correct_index]
    
    // Create index array and shuffle
    const indices = shuffle([0, 1, 2, 3])
    const newOptions = indices.map(i => options[i])
    const newCorrectIndex = indices.indexOf(q.correct_index)
    
    // Verify the correct answer is preserved
    if (newOptions[newCorrectIndex] !== correctAnswer) {
      console.error(`ERROR: Answer mismatch for question ${q.id}!`)
      throw new Error('Shuffle verification failed')
    }
    
    updateStmt.run(newOptions[0], newOptions[1], newOptions[2], newOptions[3], newCorrectIndex, q.id)
  }
})

updateAll()

// Verify distribution after
const after: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
const verified = db.prepare('SELECT correct_index FROM quiz_questions').all() as { correct_index: number }[]
for (const q of verified) {
  after[q.correct_index] = (after[q.correct_index] || 0) + 1
}
console.log('After shuffle:', after)

// Spot-check: verify a few questions
const samples = db.prepare('SELECT id, option_a, option_b, option_c, option_d, correct_index FROM quiz_questions ORDER BY RANDOM() LIMIT 5').all() as QuizRow[]
console.log('\nSample verification:')
for (const s of samples) {
  const opts = [s.option_a, s.option_b, s.option_c, s.option_d]
  console.log(`  Q${s.id}: correct=${['A','B','C','D'][s.correct_index]} (${opts[s.correct_index]})`)
}

db.close()
console.log('\n✅ Done! All questions shuffled successfully.')
