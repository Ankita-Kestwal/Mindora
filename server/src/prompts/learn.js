// Prompt templates for AI Learning. Output is Markdown; diagrams are Mermaid code blocks.

export const CONTENT_TYPES = {
  explanation: { label: 'Explanation', tokens: 3000, ask: 'Explain the topic clearly from first principles. Start with a one-paragraph overview, then the key ideas in order, each with a short intuitive example. End with a 3–5 bullet "Key takeaways" section.' },
  theory: { label: 'Theory', tokens: 4000, ask: 'Give the formal theory: definitions, principles, laws/theorems, formulas (in LaTeX-free plain notation), derivations or reasoning where relevant, assumptions and limitations. Use headings.' },
  notes: { label: 'Notes', tokens: 3000, ask: 'Write concise revision notes: headings, bullet points, bolded keywords, important formulas or definitions, and a short "Remember for exams" box at the end. Optimise for quick revision.' },
  examples: { label: 'Examples', tokens: 3500, ask: 'Give 4–6 worked examples from easy to hard. For each: the problem/scenario, a step-by-step solution, and the final answer. Include at least one real-world application.' },
  diagram: { label: 'Diagram', tokens: 2500, ask: 'Create 1–2 diagrams that explain the topic, each as a ```mermaid code block (flowchart, sequence, class, state or mindmap — whichever fits). Use short node labels without special characters like quotes, parentheses or semicolons. Under each diagram, explain it in 3–6 bullets.' },
  code: { label: 'Programming', tokens: 4000, ask: 'Give a programming solution or implementation that demonstrates the topic. State the problem, explain the approach, then provide well-commented code in fenced code blocks with the language name (default to Python unless the topic implies another language), sample input/output, and time/space complexity where relevant.' },
  'exam-answer': { label: 'Exam answer', tokens: 5000, ask: null },
};

export const MARKS = [2, 3, 5, 8, 10, 12, 15, 20, 25, 30];

function examAsk(marks) {
  const words = marks <= 2 ? '40–60' : marks <= 3 ? '60–90' : marks <= 5 ? '150–250' : marks <= 8 ? '300–400' : marks <= 10 ? '400–550' : marks <= 15 ? '600–850' : marks <= 20 ? '850–1100' : '1100–1500';
  return `Write a model examination answer worth ${marks} marks (about ${words} words). Structure it the way examiners reward: ${marks <= 3 ? 'a precise definition and one key point or example.' : 'an introduction/definition, well-organised headed sections with points, a labelled diagram (as a ```mermaid block) if it helps, examples, advantages/limitations or applications where relevant, and a short conclusion.'} Put a line "**Marks: ${marks}**" at the top.`;
}

export function buildMessages({ topic, type, marks, subject }, profile) {
  const level = profile?.learningLevel || 'intermediate';
  const edu = profile?.education || {};
  const who = [
    `Learner level: ${level}.`,
    `Account type: ${profile?.category || 'student'}.`,
    edu.level ? `Education: ${edu.level}${edu.course ? `, ${edu.course}` : ''}${edu.board ? ` (${edu.board})` : ''}.` : '',
  ].filter(Boolean).join(' ');
  const system = [
    'You are Mindora, an academic tutor. You only help with educational and academic topics (school, university, competitive exams, professional and technical subjects).',
    'If the topic is not educational, or asks for something harmful, reply with exactly: NOT_ACADEMIC',
    'Be accurate. If you are unsure about a fact, say so. Never invent sources, statistics or past exam questions.',
    `Adapt depth and vocabulary to the learner. ${who}`,
    'Format in GitHub-flavoured Markdown. Do not include any preamble like "Sure" — start with the content.',
  ].join('\n');
  const ask = type === 'exam-answer' ? examAsk(marks || 5) : CONTENT_TYPES[type].ask;
  const user = `Topic: ${topic}${subject ? `\nSubject: ${subject}` : ''}\n\nTask: ${ask}`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}
