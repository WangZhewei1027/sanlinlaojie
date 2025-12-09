# Refactor Prompt — Structural Refactoring Guide

This document defines the **standard prompt and rules** for structural refactoring
in this repository.

The goal is **not performance optimization**, but **reducing cognitive load** for
both humans and LLM-based tools (Copilot / ChatGPT).

---

## When to Use This Prompt

Use this prompt when:

- A file exceeds **120 lines**
- A page mixes **UI + data fetching + side effects**
- A component is hard to understand at first glance
- Copilot starts producing irrelevant or incorrect edits
- You feel unsafe modifying a file (“blast radius anxiety”)

---

## Core Philosophy

- One file answers **one clear question**
- File boundaries define **thinking boundaries**
- Smaller files reduce:
  - human working-memory load
  - LLM token usage
  - refactor risk

Refactoring here means **structural decomposition**, not logic changes.

---

## ✅ Standard Refactor Prompt (Recommended)

Copy everything below and paste it into ChatGPT / Copilot Chat,
then append the original file.

You are a senior frontend architect with strong experience in
Next.js App Router and large-scale React applications.

Please refactor the following file with a focus on STRUCTURE,
not logic changes.

Primary goals (in order):

Significantly reduce cognitive load for human readers

Avoid any single file exceeding 120 lines

Improve separation of concerns

Keep behavior 100% identical

Hard constraints:

Do NOT change runtime behavior

Do NOT introduce new dependencies

Do NOT change API contracts, props, or message formats

Do NOT “optimize” logic or performance

Do NOT refactor unrelated files

Refactor rules:

page.tsx should only compose components

Data fetching, side effects, and messaging logic must be extracted into hooks

Route-specific components go under app/[route]/components

Global reusable UI belongs in /components

Hooks used only by one route go under app/[route]/hooks

Do not split files smaller than ~20 lines unless it reduces mental overhead

Each resulting file must have a single, clear responsibility

Output format:

Recommended directory structure (tree)

One-sentence responsibility for each file

Full code for each new file

Brief explanation of how this refactor reduces cognitive load

Here is the original file:

yaml
Copy code

---

## ✅ Short Prompt (Daily Use)

For quick refactors inside the editor:

Refactor this file to reduce cognitive load.
Split responsibilities into hooks and components.
Ensure no file exceeds 120 lines.
Do not change behavior — structure only.

yaml
Copy code

---

## Architectural Placement Checklist

Before creating or moving a file, ask:

- Is this used by multiple routes?
  → `/components`

- Is this specific to one route?
  → `app/[route]/components` or `app/[route]/hooks`

- Is this < 20 lines and non-reusable?
  → Keep it local

- Does this file mix UI and side effects?
  → Extract hooks

---

## File Size Guidelines

| File Type        | Ideal Lines |
|------------------|-------------|
| page.tsx         | 30–70       |
| UI component     | 40–100      |
| Custom hook      | 30–80       |
| Utility          | 5–30        |
| Any file > 120   | Must split  |

---

## Definition of Done (Refactor)

A refactor is complete when:

- Each file’s purpose is obvious within 5 seconds
- No file feels “dangerous” to modify
- Changes affect a small, predictable area
- Copilot suggestions become more accurate

---

## Guiding Principle

> Code is read far more often than it is written.
> Structure exists to reduce thinking, not to show cleverness.