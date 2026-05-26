// ─────────────────────────────────────────────
// TRAIT QUIZ — 15 questions across 5 clusters
//
// Each option maps to weighted trait scores.
// The analysis engine sums weights across all answers,
// selects the top 10 by score, then calls Claude to
// pick the final 5 and write an honest explanation.
// ─────────────────────────────────────────────

export interface TraitQuizOption {
  text: string;
  weights: Partial<Record<string, number>>; // slug → weight (1 or 2)
}

export interface TraitQuizQuestion {
  id: number;
  cluster: string;
  question: string;
  options: TraitQuizOption[];
}

export const TRAIT_QUIZ_QUESTIONS: TraitQuizQuestion[] = [
  // ── CLUSTER 1: THINKING STYLE ────────────────

  {
    id: 1,
    cluster: "Thinking Style",
    question: "When you hit a problem you genuinely don't know how to solve, you usually...",
    options: [
      {
        text: "Break it into smaller parts and work through each one",
        weights: { analytical: 2, systematic: 1, "critical-thinker": 1 },
      },
      {
        text: "Throw out a bunch of ideas and see what sticks",
        weights: { creative: 2, innovative: 1, "problem-solver": 1 },
      },
      {
        text: "Look at what's actually doable given your time and resources",
        weights: { pragmatic: 2, "problem-solver": 1, organized: 1 },
      },
      {
        text: "Search for how other people have handled something like this",
        weights: { strategic: 2, curious: 1, analytical: 1 },
      },
    ],
  },
  {
    id: 2,
    cluster: "Thinking Style",
    question: "When you have to figure out something you've never done before, you usually...",
    options: [
      {
        text: "Just start doing it and figure it out as you go",
        weights: { experimenter: 2, adaptable: 1, "fast-learner": 1 },
      },
      {
        text: "Look for a framework or mental model to organize your understanding first",
        weights: {
          "conceptual-thinker": 2,
          analytical: 1,
          strategic: 1,
        },
      },
      {
        text: "Ask a lot of questions until you actually understand what's going on",
        weights: { curious: 2, "critical-thinker": 1, analytical: 1 },
      },
      {
        text: "Find the fastest path to knowing enough to function — you can fill in gaps later",
        weights: { "fast-learner": 2, pragmatic: 1, disciplined: 1 },
      },
    ],
  },
  {
    id: 3,
    cluster: "Thinking Style",
    question: "When you have to make a call but you don't have all the information...",
    options: [
      {
        text: "You gather more before deciding — you want to feel confident in it",
        weights: { analytical: 2, "detail-oriented": 1, disciplined: 1 },
      },
      {
        text: "You pick a point where you have enough and commit",
        weights: {
          "calculated-risk-taker": 2,
          decisive: 1,
          strategic: 1,
        },
      },
      {
        text: "You just decide and adjust if you're wrong — waiting too long is its own mistake",
        weights: { "risk-taker": 2, "self-starter": 1, experimenter: 1 },
      },
      {
        text: "You go with your gut and your read of the situation",
        weights: { pragmatic: 2, adaptable: 1, objective: 1 },
      },
    ],
  },

  // ── CLUSTER 2: WORK STYLE ────────────────────

  {
    id: 4,
    cluster: "Work Style",
    question: "In a group project you actually care about, you usually end up...",
    options: [
      {
        text: "Keeping everyone organized — who's doing what and by when",
        weights: { organized: 2, reliable: 1, systematic: 1 },
      },
      {
        text: "Being the one who actually pushes the work forward when people stall",
        weights: { "self-starter": 2, hardworking: 1, ambitious: 1 },
      },
      {
        text: "Checking the work and catching things that aren't good enough",
        weights: {
          "detail-oriented": 2,
          "critical-thinker": 1,
          responsible: 1,
        },
      },
      {
        text: "Making sure the team actually functions — not just five people doing separate tasks",
        weights: { cooperative: 2, connector: 1, supportive: 1 },
      },
    ],
  },
  {
    id: 5,
    cluster: "Work Style",
    question: "When a deadline is coming up, if you're being honest...",
    options: [
      {
        text: "You usually finish before it — being late genuinely stresses you out",
        weights: { disciplined: 2, punctual: 1, reliable: 1 },
      },
      {
        text: "You mostly do the real work the night before — pressure is when you actually focus",
        weights: { resilient: 2, competitive: 1, hardworking: 1 },
      },
      {
        text: "You start early enough to have a buffer if things go wrong",
        weights: { systematic: 2, disciplined: 1, reliable: 1 },
      },
      {
        text: "If you're going to be late, you say something — you don't just go quiet on people",
        weights: { responsible: 2, communicative: 1, accountable: 1 },
      },
    ],
  },
  {
    id: 6,
    cluster: "Work Style",
    question: "You actually do your best work when...",
    options: [
      {
        text: "There's clear structure — you know what's expected and who owns what",
        weights: { systematic: 2, organized: 1, disciplined: 1 },
      },
      {
        text: "You have room to explore and try things without a script",
        weights: { creative: 2, experimenter: 1, innovative: 1 },
      },
      {
        text: "The bar is high and the people around you actually care about quality",
        weights: { ambitious: 2, competitive: 1, hardworking: 1 },
      },
      {
        text: "Nobody's micromanaging you and you can decide how to approach it",
        weights: { "self-starter": 2, disciplined: 1, "vision-executor": 1 },
      },
    ],
  },

  // ── CLUSTER 3: LEADERSHIP & INFLUENCE ────────

  {
    id: 7,
    cluster: "Leadership & Influence",
    question: "When a group you're in is kind of drifting with no real plan, you usually...",
    options: [
      {
        text: "Step in and make a call — drifting is more annoying than an imperfect decision",
        weights: { decisive: 2, confident: 1, "self-starter": 1 },
      },
      {
        text: "Try to get people talking and help the group agree on a direction",
        weights: { diplomatic: 2, motivator: 1, empathetic: 1 },
      },
      {
        text: "Lay out what you know and suggest a way to move forward",
        weights: { organized: 2, communicative: 1, systematic: 1 },
      },
      {
        text: "Question whether the group is even solving the right problem",
        weights: { "critical-thinker": 2, strategic: 1, analytical: 1 },
      },
    ],
  },
  {
    id: 8,
    cluster: "Leadership & Influence",
    question: "When you're trying to get people to agree with you or go your direction, you usually...",
    options: [
      {
        text: "Paint a picture of why it matters — you try to make them feel the vision",
        weights: { visionary: 2, charismatic: 1, persuasive: 1 },
      },
      {
        text: "Rely on the fact that people trust you — you've put in the work to earn that",
        weights: { trustworthy: 2, empathetic: 1, connector: 1 },
      },
      {
        text: "Make the logical case — a strong argument should be enough",
        weights: { analytical: 2, persuasive: 1, objective: 1 },
      },
      {
        text: "Show results first — you do the work and let it speak",
        weights: { reliable: 2, hardworking: 1, "vision-executor": 1 },
      },
    ],
  },
  {
    id: 9,
    cluster: "Leadership & Influence",
    question: "When you have to tell someone something they probably don't want to hear...",
    options: [
      {
        text: "You're direct and specific — being vague is actually unkind",
        weights: { communicative: 2, accountable: 1, trustworthy: 1 },
      },
      {
        text: "You're careful about how you say it — the relationship matters too",
        weights: { diplomatic: 2, empathetic: 1, supportive: 1 },
      },
      {
        text: "You focus on what they can actually change — not what already happened",
        weights: { pragmatic: 2, "problem-solver": 1, motivator: 1 },
      },
      {
        text: "You tell them the real truth even if it's uncomfortable — they deserve that",
        weights: { ethical: 2, "critical-thinker": 1, responsible: 1 },
      },
    ],
  },

  // ── CLUSTER 4: COLLABORATION & SOCIAL STYLE ──

  {
    id: 10,
    cluster: "Collaboration",
    question: "On a team, the thing that actually bothers you most when it's missing is...",
    options: [
      {
        text: "Clarity — nobody's sure what the real goal is or who owns what",
        weights: { communicative: 2, strategic: 1, organized: 1 },
      },
      {
        text: "Respect — people don't feel safe speaking up or getting things wrong",
        weights: { supportive: 2, empathetic: 1, cooperative: 1 },
      },
      {
        text: "Quality — the work is mediocre and nobody seems to care",
        weights: { "detail-oriented": 2, disciplined: 1, responsible: 1 },
      },
      {
        text: "Growth — it's just grinding through tasks, nobody's learning anything",
        weights: { curious: 2, "fast-learner": 1, mentor: 1 },
      },
    ],
  },
  {
    id: 11,
    cluster: "Collaboration",
    question: "When you notice a teammate is clearly stuck or struggling, you...",
    options: [
      {
        text: "Jump in and help — you don't wait around to be asked",
        weights: { supportive: 2, cooperative: 1, responsible: 1 },
      },
      {
        text: "Walk them through it so they can handle it themselves next time",
        weights: { mentor: 2, communicative: 1, empathetic: 1 },
      },
      {
        text: "Flag it to the team so the right support gets organized",
        weights: { accountable: 2, reliable: 1, communicative: 1 },
      },
      {
        text: "Try to understand what's actually going wrong before doing anything",
        weights: { "problem-solver": 2, systematic: 1, "critical-thinker": 1 },
      },
    ],
  },
  {
    id: 12,
    cluster: "Collaboration",
    question: "When people in your life come to you, it's usually because...",
    options: [
      {
        text: "You know people and you'll actually make the introduction",
        weights: { connector: 2, "community-builder": 1, approachable: 1 },
      },
      {
        text: "You'll tell them the truth, not just what they want to hear",
        weights: { trustworthy: 2, objective: 1, ethical: 1 },
      },
      {
        text: "You're a good sounding board when they're trying to figure something out",
        weights: { mentor: 2, supportive: 1, empathetic: 1 },
      },
      {
        text: "If they need something done, they trust you'll actually follow through",
        weights: { reliable: 2, hardworking: 1, "vision-executor": 1 },
      },
    ],
  },

  // ── CLUSTER 5: VALUES & CHARACTER ────────────

  {
    id: 13,
    cluster: "Values & Character",
    question: "The work that actually makes you feel good about yourself afterward is work that...",
    options: [
      {
        text: "Built something that'll still matter after you're done with it",
        weights: { visionary: 2, ambitious: 1, strategic: 1 },
      },
      {
        text: "Made you better at something or showed you how much you still don't know",
        weights: { curious: 2, "fast-learner": 1, competitive: 1 },
      },
      {
        text: "Actually helped real people — not just checked boxes on a project",
        weights: { empathetic: 2, supportive: 1, mentor: 1 },
      },
      {
        text: "You know was done right — not rushed, not cut corners",
        weights: { disciplined: 2, ethical: 1, "detail-oriented": 1 },
      },
    ],
  },
  {
    id: 14,
    cluster: "Values & Character",
    question: "When something goes wrong and it was your call that caused it, you usually...",
    options: [
      {
        text: "Own it straight up — no excuses, no pointing at other factors",
        weights: { accountable: 2, responsible: 1, trustworthy: 1 },
      },
      {
        text: "Focus on fixing it — what's done is done, now what do we do",
        weights: { "problem-solver": 2, resilient: 1, pragmatic: 1 },
      },
      {
        text: "Replay what happened and try to understand exactly what went wrong",
        weights: { analytical: 2, systematic: 1, "critical-thinker": 1 },
      },
      {
        text: "Tell the people who need to know — even if it's an uncomfortable conversation",
        weights: { communicative: 2, responsible: 1, ethical: 1 },
      },
    ],
  },
  {
    id: 15,
    cluster: "Values & Character",
    question: "When it comes to taking risks, you're usually the kind of person who...",
    options: [
      {
        text: "Goes for it — you'd rather deal with the fallout than always wonder what if",
        weights: { "risk-taker": 2, ambitious: 1, "self-starter": 1 },
      },
      {
        text: "Takes the leap, but knows exactly what you're betting before you do",
        weights: {
          "calculated-risk-taker": 2,
          strategic: 1,
          analytical: 1,
        },
      },
      {
        text: "Tests things small first — you want proof before you go all in",
        weights: {
          experimenter: 2,
          pragmatic: 1,
          "calculated-risk-taker": 1,
        },
      },
      {
        text: "Takes on hard challenges but doesn't gamble with things you can't afford to lose",
        weights: { resilient: 2, disciplined: 1, reliable: 1 },
      },
    ],
  },
];
