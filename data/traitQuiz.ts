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
    question:
      "When you're facing a complex problem at work, your instinct is to...",
    options: [
      {
        text: "Break it down step by step and trace it to the root cause",
        weights: { analytical: 2, systematic: 1, "critical-thinker": 1 },
      },
      {
        text: "Generate as many possible solutions as you can first",
        weights: { creative: 2, innovative: 1, "problem-solver": 1 },
      },
      {
        text: "Look at the real constraints and find what will actually work",
        weights: { pragmatic: 2, "problem-solver": 1, organized: 1 },
      },
      {
        text: "Research what has worked and failed in similar situations",
        weights: { strategic: 2, curious: 1, analytical: 1 },
      },
    ],
  },
  {
    id: 2,
    cluster: "Thinking Style",
    question: "When you need to learn something new quickly, you typically...",
    options: [
      {
        text: "Jump in and figure it out as you go — learning by doing works best",
        weights: { experimenter: 2, adaptable: 1, "fast-learner": 1 },
      },
      {
        text: "Build a mental model or framework before diving into details",
        weights: {
          "conceptual-thinker": 2,
          analytical: 1,
          strategic: 1,
        },
      },
      {
        text: "Ask questions relentlessly until you understand the fundamentals",
        weights: { curious: 2, "critical-thinker": 1, analytical: 1 },
      },
      {
        text: "Find the fastest path to working knowledge — theory can wait",
        weights: { "fast-learner": 2, pragmatic: 1, disciplined: 1 },
      },
    ],
  },
  {
    id: 3,
    cluster: "Thinking Style",
    question:
      "When you have to make an important decision without all the information...",
    options: [
      {
        text: "You research and gather as much data as possible before committing",
        weights: { analytical: 2, "detail-oriented": 1, disciplined: 1 },
      },
      {
        text: "You set a confidence threshold and commit once you hit it",
        weights: {
          "calculated-risk-taker": 2,
          decisive: 1,
          strategic: 1,
        },
      },
      {
        text: "You act fast and iterate — being wrong quickly beats waiting forever",
        weights: { "risk-taker": 2, "self-starter": 1, experimenter: 1 },
      },
      {
        text: "You trust your pattern recognition and read of the situation",
        weights: { pragmatic: 2, adaptable: 1, objective: 1 },
      },
    ],
  },

  // ── CLUSTER 2: WORK STYLE ────────────────────

  {
    id: 4,
    cluster: "Work Style",
    question: "In a group project, the role you naturally fall into is...",
    options: [
      {
        text: "Keeping track of what's been decided, who owns what, and what's next",
        weights: { organized: 2, reliable: 1, systematic: 1 },
      },
      {
        text: "Pushing the work forward and keeping momentum going",
        weights: { "self-starter": 2, hardworking: 1, ambitious: 1 },
      },
      {
        text: "Reviewing quality and catching what doesn't meet the bar",
        weights: {
          "detail-oriented": 2,
          "critical-thinker": 1,
          responsible: 1,
        },
      },
      {
        text: "Connecting the dots between people and making the team work smoothly",
        weights: { cooperative: 2, connector: 1, supportive: 1 },
      },
    ],
  },
  {
    id: 5,
    cluster: "Work Style",
    question: "Your relationship with deadlines is best described as...",
    options: [
      {
        text: "You build buffer and deliver before the deadline — being late is uncomfortable",
        weights: { disciplined: 2, punctual: 1, reliable: 1 },
      },
      {
        text: "You work best under pressure — deadlines sharpen your focus",
        weights: { resilient: 2, competitive: 1, hardworking: 1 },
      },
      {
        text: "You set internal deadlines earlier than the external ones as a buffer",
        weights: { systematic: 2, disciplined: 1, reliable: 1 },
      },
      {
        text: "You flag issues early rather than scramble — transparency beats heroics",
        weights: { responsible: 2, communicative: 1, accountable: 1 },
      },
    ],
  },
  {
    id: 6,
    cluster: "Work Style",
    question: "The environment where you do your best work has...",
    options: [
      {
        text: "Clear structure, defined ownership, and reliable processes",
        weights: { systematic: 2, organized: 1, disciplined: 1 },
      },
      {
        text: "Creative freedom, space to explore, and room to try new things",
        weights: { creative: 2, experimenter: 1, innovative: 1 },
      },
      {
        text: "High standards, excellent peers, and real stakes",
        weights: { ambitious: 2, competitive: 1, hardworking: 1 },
      },
      {
        text: "Autonomy to work the way I decide, on problems I think matter",
        weights: { "self-starter": 2, disciplined: 1, "vision-executor": 1 },
      },
    ],
  },

  // ── CLUSTER 3: LEADERSHIP & INFLUENCE ────────

  {
    id: 7,
    cluster: "Leadership & Influence",
    question:
      "When a group you're part of doesn't have a clear direction, you typically...",
    options: [
      {
        text: "Step in and make a call — drifting is worse than an imperfect move",
        weights: { decisive: 2, confident: 1, "self-starter": 1 },
      },
      {
        text: "Help the group surface its thinking and guide it toward consensus",
        weights: { diplomatic: 2, motivator: 1, empathetic: 1 },
      },
      {
        text: "Organize what's known and propose a structured process to move forward",
        weights: { organized: 2, communicative: 1, systematic: 1 },
      },
      {
        text: "Challenge the premise — you try to diagnose the right problem first",
        weights: { "critical-thinker": 2, strategic: 1, analytical: 1 },
      },
    ],
  },
  {
    id: 8,
    cluster: "Leadership & Influence",
    question:
      "When you want to move people toward an idea or decision, you typically do it...",
    options: [
      {
        text: "Through the strength of a compelling vision or bold idea",
        weights: { visionary: 2, charismatic: 1, persuasive: 1 },
      },
      {
        text: "Through the trust and credibility you've built over time",
        weights: { trustworthy: 2, empathetic: 1, connector: 1 },
      },
      {
        text: "Through clear reasoning that's logically hard to argue with",
        weights: { analytical: 2, persuasive: 1, objective: 1 },
      },
      {
        text: "Through results — you do the work and let your track record speak",
        weights: { reliable: 2, hardworking: 1, "vision-executor": 1 },
      },
    ],
  },
  {
    id: 9,
    cluster: "Leadership & Influence",
    question: "When you need to give someone difficult feedback, your default is...",
    options: [
      {
        text: "Direct and specific — clarity is a form of respect",
        weights: { communicative: 2, accountable: 1, trustworthy: 1 },
      },
      {
        text: "Thoughtful and relationship-aware — the person matters as much as the issue",
        weights: { diplomatic: 2, empathetic: 1, supportive: 1 },
      },
      {
        text: "Focused on the actionable — what can they do differently right now?",
        weights: { pragmatic: 2, "problem-solver": 1, motivator: 1 },
      },
      {
        text: "Honest, even if it's uncomfortable — they deserve the real truth",
        weights: { ethical: 2, "critical-thinker": 1, responsible: 1 },
      },
    ],
  },

  // ── CLUSTER 4: COLLABORATION & SOCIAL STYLE ──

  {
    id: 10,
    cluster: "Collaboration",
    question: "On a project team, the thing you find yourself caring most about is...",
    options: [
      {
        text: "That everyone is aligned on the goal and knows what they're building",
        weights: { communicative: 2, strategic: 1, organized: 1 },
      },
      {
        text: "That people feel psychologically safe and genuinely respected",
        weights: { supportive: 2, empathetic: 1, cooperative: 1 },
      },
      {
        text: "That the output is genuinely excellent — not just good enough",
        weights: { "detail-oriented": 2, disciplined: 1, responsible: 1 },
      },
      {
        text: "That we're learning from the work, not just executing it",
        weights: { curious: 2, "fast-learner": 1, mentor: 1 },
      },
    ],
  },
  {
    id: 11,
    cluster: "Collaboration",
    question: "When you notice a teammate is struggling with something, you...",
    options: [
      {
        text: "Step in and help directly — even if it's not your responsibility",
        weights: { supportive: 2, cooperative: 1, responsible: 1 },
      },
      {
        text: "Guide them through it so they can solve it themselves next time",
        weights: { mentor: 2, communicative: 1, empathetic: 1 },
      },
      {
        text: "Flag it to the team so the right support gets organized",
        weights: { accountable: 2, reliable: 1, communicative: 1 },
      },
      {
        text: "Try to understand the root cause of why they're stuck",
        weights: { "problem-solver": 2, systematic: 1, "critical-thinker": 1 },
      },
    ],
  },
  {
    id: 12,
    cluster: "Collaboration",
    question:
      "If you had to describe what people in your network come to you for, it would be...",
    options: [
      {
        text: "Introductions — you know people and you're generous with connections",
        weights: { connector: 2, "community-builder": 1, approachable: 1 },
      },
      {
        text: "Honest perspective — they know you won't just tell them what they want to hear",
        weights: { trustworthy: 2, objective: 1, ethical: 1 },
      },
      {
        text: "Guidance — you're their sounding board when they're figuring something out",
        weights: { mentor: 2, supportive: 1, empathetic: 1 },
      },
      {
        text: "Execution — they trust that if you're involved, it will actually get done",
        weights: { reliable: 2, hardworking: 1, "vision-executor": 1 },
      },
    ],
  },

  // ── CLUSTER 5: VALUES & CHARACTER ────────────

  {
    id: 13,
    cluster: "Values & Character",
    question: "The kind of work that makes you feel most fulfilled is work that...",
    options: [
      {
        text: "Builds something that will outlast your direct involvement in it",
        weights: { visionary: 2, ambitious: 1, strategic: 1 },
      },
      {
        text: "Deepens your expertise or expands what you're capable of",
        weights: { curious: 2, "fast-learner": 1, competitive: 1 },
      },
      {
        text: "Makes a real difference to the people involved",
        weights: { empathetic: 2, supportive: 1, mentor: 1 },
      },
      {
        text: "You can point to and say was done to the highest standard",
        weights: { disciplined: 2, ethical: 1, "detail-oriented": 1 },
      },
    ],
  },
  {
    id: 14,
    cluster: "Values & Character",
    question:
      "When something goes wrong because of a decision you made, your first instinct is to...",
    options: [
      {
        text: "Own it immediately and fully — no excuses, no hedging",
        weights: { accountable: 2, responsible: 1, trustworthy: 1 },
      },
      {
        text: "Focus on fixing it — the past matters less than the path forward",
        weights: { "problem-solver": 2, resilient: 1, pragmatic: 1 },
      },
      {
        text: "Diagnose what caused it so you don't make the same mistake again",
        weights: { analytical: 2, systematic: 1, "critical-thinker": 1 },
      },
      {
        text: "Communicate clearly and bring in whoever needs to know",
        weights: { communicative: 2, responsible: 1, ethical: 1 },
      },
    ],
  },
  {
    id: 15,
    cluster: "Values & Character",
    question:
      "When it comes to risk, you would describe yourself as someone who...",
    options: [
      {
        text: "Accepts risk as the price of real upside — you move and deal with consequences",
        weights: { "risk-taker": 2, ambitious: 1, "self-starter": 1 },
      },
      {
        text: "Takes bold risks, but always knows exactly what you're actually betting",
        weights: {
          "calculated-risk-taker": 2,
          strategic: 1,
          analytical: 1,
        },
      },
      {
        text: "Prefers to test small and scale what works before going all-in",
        weights: {
          experimenter: 2,
          pragmatic: 1,
          "calculated-risk-taker": 1,
        },
      },
      {
        text: "Takes on hard challenges but avoids unnecessary exposure",
        weights: { resilient: 2, disciplined: 1, reliable: 1 },
      },
    ],
  },
];
