# SMA ACARS Codebase Audit — Design Document

**Date**: 2026-02-23
**Scope**: Full-stack TypeScript monorepo (shared, backend, frontend, electron)

## Problem Statement

The SMA ACARS codebase needs hardening for production readiness. Audit identified 21 issues across security, type safety, error handling, performance, and code duplication.

## Audit Summary

| Severity | Count | Categories |
|----------|-------|------------|
| Critical | 3 | Committed secrets, `as any` casts, silent failures |
| High | 8 | Race conditions, no React.memo, no pagination, DRY violations |
| Medium | 6 | Polling resilience, console leaks, missing validation |
| Low | 4 | TODOs, missing config, outdated docs |

## Architecture Decisions

### 1. Secrets Management
- Remove `backend/.env` from Git tracking
- Create `backend/.env.example` with placeholder values
- Exclude `.env` from Electron build config
- VPS hosts the real `.env` file

### 2. Type Safety Strategy
- Replace `as any` with Zod schemas for route handler input validation
- Add typed query parameter parsing functions
- Keep DB row casting via typed interfaces (parameterized queries already prevent injection)

### 3. Error Handling Pattern
- New `useApiCall` hook: wraps fetch + loading state + error state + toast notification
- AbortController integration for cancellable fetches
- Environment-aware logger replacing raw `console.error`

### 4. Performance Strategy
- React.memo on list/table components with stable prop shapes
- useCallback on socket event handlers
- Lazy-load Leaflet via React.lazy + Suspense
- Backend pagination on logbook and admin queries (offset/limit)

### 5. DRY Consolidation
- Shared weather utility (merge useDispatchData + useWeather fetch logic)
- Socket subscription hook (subscribe/on/cleanup pattern)
- API error handling hook (replaces 20+ try/catch blocks)

## Phases

### Phase 1: Security & Infrastructure
- Remove .env from Git, create .env.example
- Exclude .env from Electron builder
- Make API base URL configurable via env var

### Phase 2: Type Safety
- Add Zod for route param validation
- Replace all `as any` casts with proper types
- Add typed query parsers

### Phase 3: Error Handling & Resilience
- Extract useApiCall hook
- Add toast notifications for silent failures
- Add AbortController to FlightPlanningPage
- Add try-catch to VatsimService polling

### Phase 4: Performance & Memory
- React.memo on expensive components
- useCallback on socket handlers
- Pagination on backend queries
- Lazy-load Leaflet
- Code-split frontend bundle

### Phase 5: DRY Refactoring
- Extract weather utility
- Extract socket subscription hook
- Consolidate logging

### Phase 6: Polish
- Update MEMORY.md
- Address TODO comments

## Success Criteria
- Zero `as any` casts in route handlers
- No committed secrets
- All API errors surface to users
- Frontend bundle under 800 KB per chunk
- No silent catch blocks without logging
