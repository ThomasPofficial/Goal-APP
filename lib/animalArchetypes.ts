export type AnimalKey = "gorilla" | "tiger" | "cheetah" | "lion" | "hyena" | "owl" | "wolf" | "shark";

export interface AnimalArchetype {
  key: AnimalKey;
  name: string;
  emoji: string;
  color: string;
  bgColor: string;
  tagline: string;
  description: string;
  superpower: string;
  blindspot: string;
}

export const ANIMAL_ARCHETYPES: Record<AnimalKey, AnimalArchetype> = {
  gorilla: {
    key: "gorilla",
    name: "Gorilla",
    emoji: "🦍",
    color: "#9B6FE8",
    bgColor: "#1E0F35",
    tagline: "The Soloist",
    description:
      "You enjoy working solo and assassinate the most gut-wrenching work no one else on your team dares to tackle. You're not afraid to shove your team members aside to get your part of the mission done and are an exceptionally hardworking individual.",
    superpower: "Ruthless execution under pressure. You take the hardest task and don't stop until it's dead.",
    blindspot: "Sometimes you lock in so deep you forget to surface. Your team loses visibility on what you're actually building.",
  },
  tiger: {
    key: "tiger",
    name: "Tiger",
    emoji: "🐯",
    color: "#E07C2C",
    bgColor: "#2A1008",
    tagline: "The Calculated Predator",
    description:
      "You don't rush. You study. You wait. And when you finally move, it's surgical. You know exactly where to apply force and you do it once, correctly, with precision most people mistake for luck.",
    superpower: "Patience that breaks others' instincts to panic. You strike when it actually matters.",
    blindspot: "You can over-plan and under-execute. The perfect moment is sometimes the one you just missed.",
  },
  cheetah: {
    key: "cheetah",
    name: "Cheetah",
    emoji: "🐆",
    color: "#D4A020",
    bgColor: "#201800",
    tagline: "The Speed Freak",
    description:
      "You're already done. While your team is reading the brief, you've shipped a prototype. You thrive on momentum and treat velocity like oxygen — the moment things slow down, you start looking for the next sprint.",
    superpower: "First to ship. You turn abstract ideas into tangible things while others are still theorizing.",
    blindspot: "Fast doesn't always mean finished. You sometimes leave scope and quality behind to hit the launch.",
  },
  lion: {
    key: "lion",
    name: "Lion",
    emoji: "🦁",
    color: "#C89B3C",
    bgColor: "#201408",
    tagline: "The Commander",
    description:
      "You walk into a room and gravity shifts. You weren't elected to lead — you just filled a void that shouldn't exist. Your team runs better around you because your presence has a way of making people believe they can do bigger things.",
    superpower: "Natural authority. You raise the ceiling for everyone around you without trying to.",
    blindspot: "You sometimes command when you should listen. Not every problem needs a general.",
  },
  hyena: {
    key: "hyena",
    name: "Hyena",
    emoji: "😈",
    color: "#C87040",
    bgColor: "#1A0E02",
    tagline: "The Scrappy Finisher",
    description:
      "You swoop in when everyone else gives up. The abandoned PR, the dying project, the deliverable no one wants to own — you eat it. You're resourceful to the point of being unsettling and consistently underestimated by teams that haven't worked with you yet.",
    superpower: "You finish things. That's rarer than it sounds.",
    blindspot: "You can come across as chaotic. Your process is hard to explain and sometimes hard to trust.",
  },
  owl: {
    key: "owl",
    name: "Owl",
    emoji: "🦉",
    color: "#4A9FD4",
    bgColor: "#061520",
    tagline: "The Deep Analyst",
    description:
      "You see what others miss because you're willing to look longer and harder. Your output is always slower to arrive and almost always the most insightful thing in the room. You don't just find patterns — you find the pattern beneath the pattern.",
    superpower: "Depth. You produce the research, the framework, or the insight that reorients the whole project.",
    blindspot: "You can get lost inside the problem. Teams sometimes need 70% accuracy delivered fast, not 99% accuracy delivered never.",
  },
  wolf: {
    key: "wolf",
    name: "Wolf",
    emoji: "🐺",
    color: "#8AB0D8",
    bgColor: "#0A1020",
    tagline: "The Pack Builder",
    description:
      "You don't work next to people — you work through them. You build trust fast, create tight collaboration loops, and make everyone on the team better just by being around. You instinctively know who needs what and you deliver before they ask.",
    superpower: "Team amplification. The team around you does better work because of you, even when you're not the one producing.",
    blindspot: "You invest so deeply in people that you sometimes lose your own thread. The pack can't run if the wolf burns out.",
  },
  shark: {
    key: "shark",
    name: "Shark",
    emoji: "🦈",
    color: "#2A90C8",
    bgColor: "#051018",
    tagline: "The Perpetual Machine",
    description:
      "You don't stop. You physically cannot stop. While your team is sleeping, you're running another thread. You take on more than anyone else on the project, somehow finish most of it, and then immediately look for what's next. Stillness feels like dying.",
    superpower: "Volume and endurance. You output more than the rest of the team combined during crunch.",
    blindspot: "Sharks drown if they stop. You sometimes carry load that should be distributed, and the team can become dependent on your inertia.",
  },
};

export const ANIMAL_KEYS: AnimalKey[] = [
  "gorilla", "tiger", "cheetah", "lion", "hyena", "owl", "wolf", "shark",
];
