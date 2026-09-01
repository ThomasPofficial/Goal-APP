import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // This repo has other Claude Code worktrees checked out under
    // .claude/worktrees/ and .worktrees/, each with its own unrelated test
    // suites (different dependencies, some not even installed here) — vitest's
    // default recursive glob would otherwise pick those up too. Scope
    // discovery to this project's own source.
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "app/**/*.test.tsx"],
    exclude: ["node_modules", ".next", ".claude", ".worktrees", ".git"],
  },
});
