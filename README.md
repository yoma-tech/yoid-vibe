# yoid-vibe

A vibe-coded demo of the [YoID](https://yoid.me) product, built solely from the [YoID developer documentation](https://docs.yoid.me) to surface gaps, inaccuracies, and areas for improvement.

---

## Purpose

**yoid-vibe** is a demonstrator of the YoID product. It exists not to be a polished end product, but as a structured exercise in integrating YoID using only the publicly available developer documentation — and observing what breaks, what's missing, and what's unclear along the way.

---

## Problem Statement

The YoID developer docs were written by AI, based on an older version of [didx.me](https://didx.me). This means there is real potential for documentation that is:

- **Technically inaccurate** — describing behaviour that doesn't match the current implementation
- **Incomplete** — missing steps, edge cases, or concepts a developer would need
- **Unclear** — written in ways that are confusing or ambiguous to an integrating developer

This project creates a repeatable, evidence-based way to identify exactly those issues.

---

## Goals

### Primary — Test, Verify & Identify Gaps in YoID Developer Docs

The core purpose of this project is to stress-test the documentation by actually building against it.

1. **Test the integration flow** — follow the docs as a developer would, integrating YoID into a real working demo
2. **Verify technical accuracy** — confirm that what the docs say actually works as described
3. **Identify and document gaps** — capture:
   - Technical inaccuracies (things that are wrong)
   - Areas of confusion (things that are hard to follow)
   - Room for improvement (things that could be clearer or more helpful)

All gaps are logged as they are discovered during the build process.

### Secondary — Discover Missing Core Functionality

While integrating, flag any cases where the YoID use case requires something that the underlying **didx.me** core technology does not currently support. This surfaces product gaps that go beyond documentation.

### Bonus — Demonstrate YoID Flows to the Ecosystem

A working demo of how YoID functions across the various ecosystem actors is a valuable artefact in its own right — for onboarding partners, pitching to stakeholders, and communicating the YoID vision.

---

## Ecosystem Actors

The demo covers four primary actor types and their core functions within the YoID ecosystem.

### 🎓 Issuers — Learning & Impact Providers

Organisations that issue credentials to young people (e.g. training providers, NGOs, learning platforms).

- Issue verifiable credentials to youth completers
- Understand monitoring & evaluation (M&E) of their youth completions
- Get a picture of the youth in their ecosystem — what they have accomplished, and what they go on to do beyond their touchpoint
  > _e.g. A young person completes a learning course with Umuzi, then goes on to get a job with JobJack. This longitudinal data is valuable for the learning provider._

### 💼 Verifiers — Opportunity & Job Providers

Organisations that want to verify youth credentials and connect young people to opportunities (e.g. employers, opportunity platforms).

- Verify a young person's CV / credential claims
- Access a curated talent pool
- Search for relevant youth based on skills, credentials, or attributes
- Notify youth of available opportunities
- Enable youth to apply for opportunities

### 🙋 Holders — Youth / Young People

The primary beneficiaries of YoID — young people building and managing their digital identity.

- Onboard easily (low friction, accessible)
- View their credentials
- Manage and control what they share
- Create and share a verifiable CV
- View available opportunities
- Apply for opportunities

### 🛠️ Ecosystem Admins

Administrators with oversight of the broader YoID ecosystem.

- Access ecosystem-wide analytics and insights
- Monitor activity across issuers, verifiers, and holders

---

## Solutions Architecture

> _A detailed technical architecture diagram (tech stack, component relationships, data flows) will be added here as the demo build progresses._

**Key technologies in use:**

| Layer | Technology |
|---|---|
| Frontend | Next.js (React) |
| Auth / Identity | YoID / didx.me |
| Credential Standards | W3C Verifiable Credentials |
| API | YoID REST API (per docs.yoid.me) |

---

## Documentation Gap Log

As the demo is built, gaps in the YoID developer documentation are captured and logged. See [`docs/gap-log.md`](docs/gap-log.md) for the running list.

The gap log tracks:
- **Type** (inaccuracy / missing content / confusing / missing functionality)
- **Location** in the docs
- **Description** of the issue
- **Impact** on the integration

---

## Reference

- YoID Developer Docs: [docs.yoid.me](https://docs.yoid.me)
- YoID Product: [yoid.me](https://yoid.me)
- Core Technology: [didx.me](https://didx.me)
