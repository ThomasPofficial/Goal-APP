export type TraitCategory =
  | "VISION"
  | "DRIVE"
  | "LEADERSHIP"
  | "COMMUNICATION"
  | "COLLABORATION"
  | "ORGANIZATION"
  | "ANALYTICAL"
  | "ADAPTABILITY"
  | "INTEGRITY"
  | "JUDGMENT";

export interface TraitDef {
  slug: string;
  name: string;
  description: string;
  category: TraitCategory;
  evidence: string[]; // "You might have this trait if..." examples
}

export const TRAIT_CATEGORY_LABELS: Record<TraitCategory, string> = {
  VISION: "Vision & Innovation",
  DRIVE: "Drive & Initiative",
  LEADERSHIP: "Leadership & Influence",
  COMMUNICATION: "Communication & Social Intelligence",
  COLLABORATION: "Collaboration & Teamwork",
  ORGANIZATION: "Organization & Execution",
  ANALYTICAL: "Analytical & Problem Solving",
  ADAPTABILITY: "Adaptability & Learning",
  INTEGRITY: "Integrity & Character",
  JUDGMENT: "Judgment & Risk",
};

export const TRAIT_CATEGORY_COLORS: Record<TraitCategory, string> = {
  VISION: "#7B61FF",
  DRIVE: "#FF6B35",
  LEADERSHIP: "#F7DC6F",
  COMMUNICATION: "#4ECDC4",
  COLLABORATION: "#45B7D1",
  ORGANIZATION: "#A8E063",
  ANALYTICAL: "#C9A84C",
  ADAPTABILITY: "#BB8FCE",
  INTEGRITY: "#F1948A",
  JUDGMENT: "#E8A838",
};

// ─────────────────────────────────────────────
// GENIUS QUIZ
// 8 questions × 4 options. Each option scores +1
// for one archetype (D=Dynamo, B=Blaze, T=Tempo, S=Steel).
// Highest cumulative score determines the user's type.
// ─────────────────────────────────────────────

export type GeniusType = "DYNAMO" | "BLAZE" | "TEMPO" | "STEEL";

export const GENIUS_TYPE_INFO: Record<
  GeniusType,
  { label: string; color: string; description: string; icon: string; tagline: string; nudgeCategories: TraitCategory[] }
> = {
  DYNAMO: {
    label: "Dynamo",
    color: "#F59E0B",
    icon: "⚡",
    tagline: "The Visionary Builder",
    description:
      "High-energy idea generators who spark momentum and drive breakthroughs. You see possibilities where others see problems and turn concepts into reality at full speed.",
    nudgeCategories: ["VISION", "DRIVE", "JUDGMENT"],
  },
  BLAZE: {
    label: "Blaze",
    color: "#EF4444",
    icon: "🔥",
    tagline: "The Bold Connector",
    description:
      "Charismatic connectors who inspire action and energize every room they walk into. People follow your lead because your passion is contagious.",
    nudgeCategories: ["LEADERSHIP", "COMMUNICATION", "COLLABORATION"],
  },
  TEMPO: {
    label: "Tempo",
    color: "#10B981",
    icon: "🎯",
    tagline: "The Steady Strategist",
    description:
      "Steady enablers who make great ideas actually happen. You are the calm in the storm — methodical, reliable, the reason things don't fall apart.",
    nudgeCategories: ["ORGANIZATION", "ADAPTABILITY", "COLLABORATION"],
  },
  STEEL: {
    label: "Steel",
    color: "#6366F1",
    icon: "🛡️",
    tagline: "The Deep Thinker",
    description:
      "Rigorous thinkers who protect quality and cut through noise. Your precision and integrity make you the person everyone trusts to get it exactly right.",
    nudgeCategories: ["ANALYTICAL", "INTEGRITY", "JUDGMENT"],
  },
};

export interface QuizQuestion {
  id: number;
  question: string;
  options: { text: string; type: GeniusType }[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "When you first encounter a big opportunity, you typically...",
    options: [
      { text: "Immediately start imagining possibilities and what could be built", type: "DYNAMO" },
      { text: "Think about who to tell and how to get others excited", type: "BLAZE" },
      { text: "Map out what resources and steps would actually be needed", type: "TEMPO" },
      { text: "Research precedents and identify the risks involved", type: "STEEL" },
    ],
  },
  {
    id: 2,
    question: "In a team meeting with no clear agenda, you tend to...",
    options: [
      { text: "Propose bold directions and push for ambitious decisions", type: "DYNAMO" },
      { text: "Read the room and pull quieter voices into the conversation", type: "BLAZE" },
      { text: "Suggest a structure and make sure everyone stays on track", type: "TEMPO" },
      { text: "Ask the clarifying questions nobody else is asking", type: "STEEL" },
    ],
  },
  {
    id: 3,
    question: "People most often come to you when...",
    options: [
      { text: "They need a creative breakthrough or a spark of inspiration", type: "DYNAMO" },
      { text: "Team dynamics are tense and they need someone to connect the dots", type: "BLAZE" },
      { text: "Something needs to get done and they trust you'll follow through", type: "TEMPO" },
      { text: "They need to stress-test an idea or catch a flaw before it's too late", type: "STEEL" },
    ],
  },
  {
    id: 4,
    question: "Under serious pressure, you...",
    options: [
      { text: "Double down and push harder — pressure sharpens you", type: "DYNAMO" },
      { text: "Rally the team, keep morale up, and find the silver lining", type: "BLAZE" },
      { text: "Stabilize — focus on what still works and build from there", type: "TEMPO" },
      { text: "Slow down to make sure mistakes aren't made under stress", type: "STEEL" },
    ],
  },
  {
    id: 5,
    question: "Your deepest source of energy at work is...",
    options: [
      { text: "Building something new that didn't exist before", type: "DYNAMO" },
      { text: "The energy of a team working well together toward something big", type: "BLAZE" },
      { text: "Seeing a complex system run smoothly because you set it up right", type: "TEMPO" },
      { text: "Solving a hard problem that took real depth to figure out", type: "STEEL" },
    ],
  },
  {
    id: 6,
    question: "What frustrates you most in a team environment?",
    options: [
      { text: "Excessive caution that kills good ideas before they're tried", type: "DYNAMO" },
      { text: "People working in silos without communication or trust", type: "BLAZE" },
      { text: "Chaos, missed deadlines, and no sense of who owns what", type: "TEMPO" },
      { text: "Sloppy thinking, untested assumptions, and avoidable mistakes", type: "STEEL" },
    ],
  },
  {
    id: 7,
    question: "Your natural role in a group project would be...",
    options: [
      { text: "The one who conceived the idea and keeps pushing the vision forward", type: "DYNAMO" },
      { text: "The one who unifies the group and keeps relationships healthy", type: "BLAZE" },
      { text: "The one who builds the systems and makes sure everything gets done", type: "TEMPO" },
      { text: "The one who ensures the work is actually correct and holds up to scrutiny", type: "STEEL" },
    ],
  },
  {
    id: 8,
    question: "When you look back on your best work, it was usually...",
    options: [
      { text: "Something that started with a wild idea most people doubted", type: "DYNAMO" },
      { text: "Something built with people you genuinely loved working with", type: "BLAZE" },
      { text: "Something you can point to and say 'I built that and it works'", type: "TEMPO" },
      { text: "Something you're proud of because it was done to the highest standard", type: "STEEL" },
    ],
  },
];

// ─────────────────────────────────────────────
// TRAIT DEFINITIONS (50 traits, 10 categories)
// evidence[] = "You might have this trait if..."
// ─────────────────────────────────────────────

export const TRAITS: TraitDef[] = [
  // ── VISION & INNOVATION ──────────────────────
  {
    slug: "visionary",
    name: "Visionary",
    description: "Thinks in long-term possibilities and big ideas.",
    category: "VISION",
    evidence: [
      "You regularly think years ahead and find near-term problems less interesting than distant possibilities",
      "Friends or colleagues often say you 'see things before they happen'",
      "You feel a physical restlessness when executing on something that doesn't feel meaningful long-term",
      "Your best ideas come from connecting trends across very different domains",
      "You've been told your plans are 'unrealistic' and been right anyway",
      "You find yourself drawn to reading about the future, emerging tech, or civilizational change",
    ],
  },
  {
    slug: "creative",
    name: "Creative",
    description: "Generates imaginative and original solutions.",
    category: "VISION",
    evidence: [
      "When handed a constraint, your mind immediately starts looking for ways around it",
      "You've frequently come up with approaches that surprised people who know you",
      "Blank whiteboards or empty documents energize rather than paralyze you",
      "You make unexpected connections between unrelated ideas",
      "Others often ask you to brainstorm with them because you reliably generate novel options",
      "You find routine processes dull and tend to invent better ones",
    ],
  },
  {
    slug: "strategic",
    name: "Strategic",
    description: "Plans with long-term structure and foresight.",
    category: "VISION",
    evidence: [
      "You naturally think in terms of trade-offs, sequencing, and what decision opens which doors",
      "Before acting, you tend to map the second and third order consequences",
      "You catch misalignments between stated goals and the actions being taken",
      "You've often redirected a group's effort away from the obvious move toward a smarter one",
      "You enjoy games and problems that reward planning over reaction",
      "Others describe you as someone who always has a bigger picture in mind",
    ],
  },
  {
    slug: "curious",
    name: "Curious",
    description: "Always exploring new knowledge and ideas.",
    category: "VISION",
    evidence: [
      "You regularly read or learn about things completely outside your field",
      "You ask more questions than most people in any given conversation",
      "Dead ends in learning just make you want to try a different path",
      "People have described you as someone who 'knows a lot about a lot'",
      "You feel genuinely uncomfortable when you realize you've stopped learning",
      "You can go deep into rabbit holes that started with a casual question",
    ],
  },
  {
    slug: "innovative",
    name: "Innovative",
    description: "Constantly seeks better methods or products.",
    category: "VISION",
    evidence: [
      "You find yourself redesigning things in your head that others accept as fixed",
      "You've built or shipped something new that didn't exist before you made it",
      "Status quo explanations like 'that's how it's always been done' genuinely frustrate you",
      "You prototype ideas quickly — even if just mentally — before committing to one direction",
      "You frequently see products or services and think 'I could do this differently'",
      "Your ideas have a track record of actually getting built or adopted",
    ],
  },
  {
    slug: "futurist",
    name: "Futurist",
    description: "Focused on emerging trends and technologies.",
    category: "VISION",
    evidence: [
      "You follow emerging technologies before they go mainstream",
      "You've made predictions about tech or culture shifts that later came true",
      "Your mental model of the world includes timelines for how things will change",
      "You enjoy scenario planning and imagining multiple possible futures",
      "You often feel a step ahead of conversations about where things are going",
      "You find the intersection of technology and human behavior endlessly fascinating",
    ],
  },
  {
    slug: "conceptual-thinker",
    name: "Conceptual Thinker",
    description: "Understands abstract systems and models.",
    category: "VISION",
    evidence: [
      "You naturally represent problems as diagrams, frameworks, or mental models",
      "You enjoy understanding the theory behind things, not just how to use them",
      "Abstract or philosophical discussions don't exhaust you — they energize you",
      "Others often ask you to explain complex ideas because you can make them simple",
      "You notice when two problems in different domains have the same underlying structure",
      "You feel frustrated when people work on the surface of a problem without understanding its root",
    ],
  },

  // ── DRIVE & INITIATIVE ────────────────────────
  {
    slug: "ambitious",
    name: "Ambitious",
    description: "Highly motivated to achieve big goals.",
    category: "DRIVE",
    evidence: [
      "You set goals that make other people slightly uncomfortable with how big they are",
      "Comfort zones don't hold you — you consistently push into harder territory",
      "You measure your progress against something meaningful, not just activity",
      "You feel restless unless what you're working on has significant stakes",
      "You've voluntarily taken on challenges others avoided because of the scale",
      "Mediocrity genuinely bothers you, even in small things",
    ],
  },
  {
    slug: "self-starter",
    name: "Self-Starter",
    description: "Takes initiative without needing direction.",
    category: "DRIVE",
    evidence: [
      "You've started projects without anyone asking you to",
      "When you see something broken or missing, you fix or build it instead of waiting",
      "You rarely need external motivation to begin work you believe in",
      "Leaders trust you with open-ended assignments because you don't need hand-holding",
      "Ambiguity energizes rather than paralyzes you",
      "You've had experiences where you looked up and realized you'd built something others didn't realize you were working on",
    ],
  },
  {
    slug: "persistent",
    name: "Persistent",
    description: "Pushes through obstacles and setbacks.",
    category: "DRIVE",
    evidence: [
      "You've stayed with a hard problem long after others would have quit",
      "Rejection or failure makes you more determined, not less",
      "You have stories of eventually succeeding at things that took many attempts",
      "You don't give up on important things just because they get difficult",
      "People describe you as stubborn in the best sense of the word",
      "You find something almost addictive about the challenge of not giving up",
    ],
  },
  {
    slug: "competitive",
    name: "Competitive",
    description: "Motivated by challenge and winning.",
    category: "DRIVE",
    evidence: [
      "You perform noticeably better when there's something real to win",
      "Benchmarks and rankings motivate rather than intimidate you",
      "You've pushed past your limits specifically because someone said you couldn't",
      "Losing stings in a way that sharpens your preparation next time",
      "You naturally track how you're doing relative to a goal or peer",
      "You've made things into games or competitions to motivate yourself",
    ],
  },
  {
    slug: "resilient",
    name: "Resilient",
    description: "Recovers quickly from failure or stress.",
    category: "DRIVE",
    evidence: [
      "You've bounced back from a significant failure or setback in a way that surprised people",
      "Difficult periods rarely take you out of the game for long",
      "You can absorb bad news and still function at a high level",
      "You've developed a kind of earned confidence that comes from having survived hard things",
      "Stress is uncomfortable but doesn't break your sense of self",
      "Others have called you 'unbreakable' or expressed genuine admiration for how you handle adversity",
    ],
  },
  {
    slug: "hardworking",
    name: "Hardworking",
    description: "Consistently puts in strong effort.",
    category: "DRIVE",
    evidence: [
      "Your output per unit of time is consistently higher than most people around you",
      "You rarely leave work undone if you said you'd do it",
      "People trust your effort because you have a track record of showing up fully",
      "You've succeeded at things through sheer work ethic when talent alone wouldn't have been enough",
      "You take real pride in thoroughness — things should be done well, not just done",
      "Others notice your work ethic without you having to tell them about it",
    ],
  },

  // ── LEADERSHIP & INFLUENCE ────────────────────
  {
    slug: "charismatic",
    name: "Charismatic",
    description: "Naturally inspires and energizes others.",
    category: "LEADERSHIP",
    evidence: [
      "When you walk into a room, the energy often shifts in a subtle but noticeable way",
      "People follow your lead without you having to ask for it",
      "You've inspired people to take action they were on the fence about",
      "Stories and arguments land more powerfully when you deliver them",
      "You find it relatively easy to earn early trust with strangers",
      "Your conviction about ideas is often contagious",
    ],
  },
  {
    slug: "decisive",
    name: "Decisive",
    description: "Makes decisions confidently and quickly.",
    category: "LEADERSHIP",
    evidence: [
      "You make clear calls in situations where others hedge or defer",
      "You rarely suffer from analysis paralysis — at some point you just decide",
      "Others gravitate to you when a group can't reach a conclusion",
      "You've made judgment calls under pressure that turned out to be right",
      "You hold a decision once made and don't constantly second-guess it",
      "People trust your judgment specifically because you commit to it",
    ],
  },
  {
    slug: "vision-executor",
    name: "Vision-Executor",
    description: "Turns ideas into real outcomes.",
    category: "LEADERSHIP",
    evidence: [
      "You have a track record of taking vague goals and producing concrete results",
      "You don't just plan — you ship",
      "Others rely on you as the person who will actually make the thing happen",
      "You're good at breaking a 'big idea' into the actual steps needed to produce it",
      "You find people who only dream without building somewhat frustrating",
      "Your contribution is often measured in completed things, not just interesting thoughts",
    ],
  },
  {
    slug: "motivator",
    name: "Motivator",
    description: "Encourages others to perform at their best.",
    category: "LEADERSHIP",
    evidence: [
      "People around you tend to raise their own bar because of your presence",
      "You know how to give feedback in a way that builds people up rather than shutting them down",
      "Others have told you that working with you changed what they believed was possible for them",
      "You naturally adjust your approach to unlock different people's best work",
      "When a team is stuck, you're often the one who reignites momentum",
      "Developing others is genuinely satisfying to you, not just a management duty",
    ],
  },
  {
    slug: "confident",
    name: "Confident",
    description: "Projects assurance and leadership presence.",
    category: "LEADERSHIP",
    evidence: [
      "You express opinions clearly, even in rooms full of more experienced people",
      "Uncertainty doesn't prevent you from leading — you act on your best judgment",
      "Others describe you as someone who 'takes up space' in the best sense",
      "Your confidence is grounded in capability — you don't project what you haven't earned",
      "People follow your lead partly because of how you carry yourself",
      "You've spoken your mind in situations where it would have been easier to stay quiet",
    ],
  },

  // ── COMMUNICATION & SOCIAL INTELLIGENCE ───────
  {
    slug: "communicative",
    name: "Communicative",
    description: "Shares ideas clearly and listens well.",
    category: "COMMUNICATION",
    evidence: [
      "People rarely need you to repeat or clarify what you meant",
      "You write and speak in a way that matches your audience without dumbing things down",
      "You're known as a good listener who absorbs what others actually say, not just what you expected them to say",
      "Others often ask you to present or explain things on their behalf",
      "You catch communication failures early and address them directly",
      "You can take a complex topic and explain it to someone who knows nothing about it",
    ],
  },
  {
    slug: "empathetic",
    name: "Empathetic",
    description: "Understands and respects others' feelings.",
    category: "COMMUNICATION",
    evidence: [
      "People tell you things they don't tell others — you create a feeling of genuine safety",
      "You pick up on unspoken emotional cues in conversations and group settings",
      "You can be in disagreement with someone and still make them feel heard",
      "Others describe you as someone who 'really gets it' when they explain their situation",
      "You adjust your communication instinctively based on someone's emotional state",
      "You've mediated between people and found common ground that wasn't visible before",
    ],
  },
  {
    slug: "diplomatic",
    name: "Diplomatic",
    description: "Handles conflict with tact and balance.",
    category: "COMMUNICATION",
    evidence: [
      "You can deliver hard truths in ways that preserve relationships",
      "Others trust you to represent multiple interests fairly in a conflict",
      "You avoid taking sides publicly even when you have a private view",
      "You've de-escalated situations that were heading somewhere damaging",
      "You know when to speak and when the most powerful move is silence",
      "People come to you when they need someone to navigate a sensitive situation",
    ],
  },
  {
    slug: "approachable",
    name: "Approachable",
    description: "Easy for others to talk to.",
    category: "COMMUNICATION",
    evidence: [
      "Strangers and new colleagues warm up to you faster than they do to most",
      "People feel at ease bringing you problems or uncertainties without fear of judgment",
      "Others have told you that you were easier to talk to than they expected",
      "You're often the first person someone goes to with a sensitive issue",
      "You have a way of making people feel like their time with you mattered",
      "You rarely make people feel small or judged for what they share with you",
    ],
  },
  {
    slug: "persuasive",
    name: "Persuasive",
    description: "Skilled at influencing opinions.",
    category: "COMMUNICATION",
    evidence: [
      "You've changed someone's mind on something they were previously firm about",
      "You know how to frame an argument in terms that matter to the person you're talking to",
      "People have taken significant actions based on your recommendation",
      "You understand that persuasion is about understanding what someone values, not just making a good argument",
      "You've won support for an unpopular idea through skill in presenting it",
      "You rarely rely on authority — you prefer to earn agreement through reasoning",
    ],
  },
  {
    slug: "storyteller",
    name: "Storyteller",
    description: "Explains ideas through engaging narratives.",
    category: "COMMUNICATION",
    evidence: [
      "When you explain something, you start with a situation or example rather than a definition",
      "People remember what you said long after the conversation ends",
      "You've used narrative to make a dry or technical topic genuinely compelling",
      "Others ask you to present or pitch things because your framing lands better",
      "You naturally think in examples, analogies, and case studies",
      "You've seen your story of an idea move someone to action where a facts-based presentation didn't",
    ],
  },

  // ── COLLABORATION & TEAMWORK ──────────────────
  {
    slug: "cooperative",
    name: "Cooperative",
    description: "Works smoothly with teammates.",
    category: "COLLABORATION",
    evidence: [
      "You default to working with others rather than around them",
      "Others describe you as 'easy to work with' or a 'good teammate'",
      "You share information, credit, and context without needing to be asked",
      "You adapt your working style to match what the team needs, not just your preference",
      "Conflict in a team bothers you because it breaks something you genuinely value",
      "You've sacrificed personal credit or convenience for the benefit of team cohesion",
    ],
  },
  {
    slug: "supportive",
    name: "Supportive",
    description: "Encourages and assists others.",
    category: "COLLABORATION",
    evidence: [
      "You notice when someone is struggling and find a way to help without being asked",
      "Others feel stronger and more capable when you're on their side",
      "You celebrate teammates' wins with genuine enthusiasm, not performative applause",
      "You've given up something of your own to help a teammate succeed",
      "People feel safer taking risks when you're in their corner",
      "You invest in people's success even when it doesn't benefit you directly",
    ],
  },
  {
    slug: "connector",
    name: "Connector",
    description: "Builds strong networks and relationships.",
    category: "COLLABORATION",
    evidence: [
      "You instinctively think about which two people should know each other",
      "Your network often produces unexpected value — the right person at the right moment",
      "Others come to you when they need an introduction",
      "You maintain relationships over time without it feeling transactional",
      "You know someone useful in almost every domain when a need arises",
      "You've created collaborations between people who became long-term partners",
    ],
  },
  {
    slug: "mentor",
    name: "Mentor",
    description: "Helps others grow and develop skills.",
    category: "COLLABORATION",
    evidence: [
      "Others have told you that working with you changed the direction or capability of their career",
      "You enjoy sharing what you know without needing to be the smartest person in the room",
      "You invest in teaching people, even when it would be faster to just do it yourself",
      "You're good at identifying what someone actually needs to grow, not just what they're asking for",
      "Your most meaningful professional achievements often involve someone else's growth",
      "People you've worked with continue to reach out for your guidance long after the work ended",
    ],
  },
  {
    slug: "community-builder",
    name: "Community-Builder",
    description: "Creates strong group culture.",
    category: "COLLABORATION",
    evidence: [
      "Groups feel more cohesive after you've been in them for a while",
      "You think intentionally about culture — norms, values, shared language",
      "You've created a community or group that outlasted your direct involvement",
      "Others describe you as someone who makes a team feel like a team",
      "You feel uncomfortable when people are excluded or left feeling peripheral",
      "You invest energy in the shared identity of a group, not just individual output",
    ],
  },

  // ── ORGANIZATION & EXECUTION ──────────────────
  {
    slug: "organized",
    name: "Organized",
    description: "Keeps work structured and planned.",
    category: "ORGANIZATION",
    evidence: [
      "Your workspace, digital or physical, reflects a clear system that makes sense to others",
      "You rarely lose things, miss context, or have to reconstruct what was decided",
      "Others ask you to run projects because you're trusted to keep track of everything",
      "You feel genuinely uncomfortable when responsibilities are unclear or tasks are falling through gaps",
      "You create order out of chaos naturally and sometimes without being asked to",
      "Teams run better when you're managing the process",
    ],
  },
  {
    slug: "reliable",
    name: "Reliable",
    description: "Consistently follows through on commitments.",
    category: "ORGANIZATION",
    evidence: [
      "People rarely have to follow up with you — if you said you'd do it, it gets done",
      "Your word is trusted because your track record earns it",
      "Others delegate important things to you specifically because they know you'll deliver",
      "You feel genuine discomfort when you can't follow through on a commitment",
      "You're the person people call in a crunch because they know you won't drop the ball",
      "Over time, reliability has become one of your defining professional characteristics",
    ],
  },
  {
    slug: "disciplined",
    name: "Disciplined",
    description: "Maintains routines and focus.",
    category: "ORGANIZATION",
    evidence: [
      "You maintain productive habits even when motivation is low",
      "Distractions that derail others rarely knock you off course for long",
      "You've built and sustained a consistent practice in some area of your life",
      "You say no to short-term temptations when they conflict with long-term goals",
      "Your self-management doesn't depend entirely on external accountability",
      "Others have asked how you stay focused and disciplined in environments they find hard",
    ],
  },
  {
    slug: "punctual",
    name: "Punctual",
    description: "Respects time and deadlines.",
    category: "ORGANIZATION",
    evidence: [
      "Being late genuinely bothers you — you treat other people's time as valuable",
      "Deadlines you own are almost never missed without advance warning",
      "Others comment positively on your reliability around time",
      "You build in buffer time because you've thought through what could go wrong",
      "You're typically the person ready before others in a group setting",
      "Time management is something you've thought about and actively maintained",
    ],
  },
  {
    slug: "systematic",
    name: "Systematic",
    description: "Approaches work step-by-step.",
    category: "ORGANIZATION",
    evidence: [
      "You build processes and playbooks, not just one-off solutions",
      "Others can replicate what you've done because you document and structure your work",
      "You find ad-hoc, re-invented-every-time approaches genuinely inefficient and frustrating",
      "You enjoy optimizing repeating processes to remove unnecessary steps",
      "Teams you work with get more efficient over time because of systems you put in place",
      "You naturally ask 'how do we make sure this doesn't break again?' after fixing a problem",
    ],
  },

  // ── ANALYTICAL & PROBLEM SOLVING ─────────────
  {
    slug: "analytical",
    name: "Analytical",
    description: "Makes decisions using logic and data.",
    category: "ANALYTICAL",
    evidence: [
      "Before forming an opinion, you look for data and evidence",
      "Others ask you to 'look at the numbers' or 'check the logic' before committing",
      "You find gut-only decisions uncomfortable when data is available",
      "You've changed your view because the evidence pointed a different direction",
      "You can spot inconsistencies in arguments or data quickly",
      "Your analysis has saved a team from a decision that felt right but wasn't",
    ],
  },
  {
    slug: "problem-solver",
    name: "Problem-Solver",
    description: "Finds effective solutions quickly.",
    category: "ANALYTICAL",
    evidence: [
      "When something breaks or blocks the team, you're drawn to fixing it rather than waiting",
      "You've solved problems others had been stuck on for a long time",
      "You approach problems as puzzles to be figured out rather than walls to give up at",
      "Others describe you as resourceful in finding a path when the obvious one is blocked",
      "You stay calm in crises partly because your mind shifts directly into solution mode",
      "You've invented solutions that nobody else in the group thought of",
    ],
  },
  {
    slug: "critical-thinker",
    name: "Critical Thinker",
    description: "Challenges assumptions and ideas.",
    category: "ANALYTICAL",
    evidence: [
      "You routinely ask 'how do we actually know this is true?'",
      "You've caught important flaws in plans by questioning assumptions others accepted",
      "People present ideas to you specifically because you'll stress-test them honestly",
      "You don't accept premises just because they're said confidently",
      "You've saved a team from a mistake by asking the uncomfortable question",
      "Logic gaps, unstated assumptions, and circular reasoning stand out to you immediately",
    ],
  },
  {
    slug: "detail-oriented",
    name: "Detail-Oriented",
    description: "Notices small errors and refinements.",
    category: "ANALYTICAL",
    evidence: [
      "You catch typos, inconsistencies, and small errors that others walk past",
      "Work you produce is rarely incomplete or approximate when completeness is possible",
      "Others ask you to review things before they go out because you'll catch what they missed",
      "You feel genuine discomfort when something is shipped in a state you know is below standard",
      "The difference between almost right and fully right matters significantly to you",
      "Your attention to detail has caught problems that would have been expensive to fix later",
    ],
  },
  {
    slug: "objective",
    name: "Objective",
    description: "Makes fair, unbiased judgments.",
    category: "ANALYTICAL",
    evidence: [
      "You can evaluate an idea on its merits even when you emotionally prefer a different outcome",
      "Others trust you to give feedback that isn't colored by politics or personal loyalty",
      "You've recommended against your own previous position when new evidence warranted it",
      "You're known for being able to see multiple sides of a dispute without losing your ability to make a call",
      "People bring sensitive decisions to you because they trust your impartiality",
      "You flag your own potential biases and try to correct for them",
    ],
  },

  // ── ADAPTABILITY & LEARNING ──────────────────
  {
    slug: "adaptable",
    name: "Adaptable",
    description: "Adjusts easily to change.",
    category: "ADAPTABILITY",
    evidence: [
      "When plans change suddenly, you recalibrate quickly without unraveling",
      "You've thrived in environments where the rules changed mid-game",
      "Others describe you as flexible — not in a soft way, but in a resilient way",
      "You've successfully worked across very different environments, industries, or contexts",
      "Change feels like a prompt to find a better approach rather than a threat",
      "You can be fully committed to a direction and still pivot cleanly when needed",
    ],
  },
  {
    slug: "fast-learner",
    name: "Fast Learner",
    description: "Quickly picks up new skills.",
    category: "ADAPTABILITY",
    evidence: [
      "You've become competent in new domains faster than the average person",
      "Others are often surprised how quickly you develop real ability in unfamiliar areas",
      "You ask different questions than most learners — you go for structure and principles first",
      "You've succeeded in roles you were 'underqualified' for on paper because you learned fast",
      "Learning something hard doesn't frustrate you — it engages you",
      "You can extract usable knowledge from a book, mentor, or experience much faster than peers",
    ],
  },
  {
    slug: "experimenter",
    name: "Experimenter",
    description: "Likes testing new approaches.",
    category: "ADAPTABILITY",
    evidence: [
      "You regularly try new methods even when the old ones worked",
      "Your workflow evolves over time because you're always testing improvements",
      "You treat failures as informative data, not personal setbacks",
      "Others describe you as someone who likes to 'try things and see what happens'",
      "You've proposed running an experiment when others wanted a consensus answer",
      "You have a bias for testing over theorizing",
    ],
  },
  {
    slug: "explorer",
    name: "Explorer",
    description: "Seeks out unfamiliar opportunities.",
    category: "ADAPTABILITY",
    evidence: [
      "You've deliberately left familiar territory to try something new and uncertain",
      "The frontier of an industry or field pulls you more than its well-established center",
      "You become bored with mastery faster than most and move on to something harder",
      "Others describe you as someone who likes going 'off the map'",
      "You've made career or project choices that prioritized discovery over safety",
      "The words 'uncharted' and 'first of its kind' are motivating rather than warning signs",
    ],
  },

  // ── INTEGRITY & CHARACTER ─────────────────────
  {
    slug: "trustworthy",
    name: "Trustworthy",
    description: "Acts with honesty and reliability.",
    category: "INTEGRITY",
    evidence: [
      "People share sensitive things with you and they don't end up going further",
      "Your honesty is consistent — you say the same things in public as in private",
      "Others rely on you in high-stakes situations where honesty and discretion both matter",
      "You've told a hard truth when silence or a soft answer would have been easier",
      "Your word has a track record that earns you real trust, not just assumed trust",
      "People describe you as 'exactly who you appear to be'",
    ],
  },
  {
    slug: "ethical",
    name: "Ethical",
    description: "Guided by strong moral principles.",
    category: "INTEGRITY",
    evidence: [
      "You've made a decision that cost you something because it was the right thing to do",
      "You hold the same standards for yourself that you hold for others",
      "Gray areas make you think harder, not look for the convenient interpretation",
      "Others have described you as someone who does the right thing even when nobody's watching",
      "You've declined to participate in something you found ethically compromised",
      "Your moral reasoning is principled — it doesn't bend based on who benefits",
    ],
  },
  {
    slug: "responsible",
    name: "Responsible",
    description: "Takes ownership of outcomes.",
    category: "INTEGRITY",
    evidence: [
      "When something goes wrong in your area, your first instinct is to own it, not explain it away",
      "Others trust you with important things because they know you feel the weight of responsibility",
      "You follow through on things even when they become inconvenient",
      "You don't pass accountability to circumstance or other people when you played a part",
      "You've proactively raised a problem you caused instead of hoping it would go unnoticed",
      "People around you feel safe because they trust that you'll take responsibility seriously",
    ],
  },
  {
    slug: "accountable",
    name: "Accountable",
    description: "Accepts consequences and learns from them.",
    category: "INTEGRITY",
    evidence: [
      "When you make a mistake, you acknowledge it clearly and work on not repeating it",
      "Others have noted your ability to own failure with dignity and without defensiveness",
      "You don't need external accountability structures to hold yourself to your standards",
      "You've done a candid retrospective on your own failures that changed how you operate",
      "Blame-shifting is something you find genuinely distasteful",
      "Your track record of accountability is what earns you the autonomy others trust you with",
    ],
  },

  // ── JUDGMENT & RISK ───────────────────────────
  {
    slug: "risk-taker",
    name: "Risk-Taker",
    description: "Willing to pursue bold opportunities.",
    category: "JUDGMENT",
    evidence: [
      "You've made large bets on uncertain outcomes and been right often enough to justify it",
      "The possibility of a big upside genuinely excites you even when the downside is real",
      "You've chosen a high-risk high-reward path when the safe option was clearly available",
      "Others describe you as bold or willing to go where most wouldn't",
      "Fear of failure is not a reliable deterrent for you when the opportunity is compelling",
      "You have a track record of taking swings that paid off over time",
    ],
  },
  {
    slug: "calculated-risk-taker",
    name: "Calculated Risk-Taker",
    description: "Takes risks with analysis.",
    category: "JUDGMENT",
    evidence: [
      "You take bold actions, but rarely without first understanding what you're actually risking",
      "Your risk-taking has a track record: you're bold but not reckless",
      "You've mapped out downside scenarios before committing to high-stakes decisions",
      "Others describe you as someone who is 'smart about risk' or 'knows when to bet'",
      "You distinguish between risk you can absorb and risk that could be fatal — and act accordingly",
      "You've sized bets based on conviction and evidence, not just feeling",
    ],
  },
  {
    slug: "pragmatic",
    name: "Pragmatic",
    description: "Focuses on practical results.",
    category: "JUDGMENT",
    evidence: [
      "Your first question is 'will this actually work?' rather than 'does this sound good?'",
      "You've cut elegance or theoretical purity in favor of something that gets results",
      "Others describe you as grounded or as someone who 'keeps it real'",
      "You find endless theorizing that doesn't lead to action frustrating",
      "Your solutions are often simpler than others propose — you resist unnecessary complexity",
      "You've gotten things done in imperfect conditions rather than waiting for perfect ones",
    ],
  },
];

export const TRAITS_BY_CATEGORY = Object.keys(TRAIT_CATEGORY_LABELS).reduce(
  (acc, cat) => {
    acc[cat as TraitCategory] = TRAITS.filter((t) => t.category === cat);
    return acc;
  },
  {} as Record<TraitCategory, TraitDef[]>
);
