# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a NestJS-based TDD practice project for a user point management system. The project implements user point charging, usage, and history tracking with in-memory database tables that simulate async operations with random delays.

## Build and Test Commands

```bash
# Install dependencies
npm install

# Build
npm run build

# Development server (with watch mode)
npm run start:dev

# Production server
npm run start:prod

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run e2e tests
npm run test:e2e

# Lint
npm run lint

# Format code
npm run format
```

## Testing Notes

- Jest configuration is in package.json with rootDir set to "src"
- Unit test files follow the pattern `*.spec.ts` in the src directory
- E2E test files are in the test directory with pattern `*.e2e-spec.ts`
- Test environment uses jest-sonar-reporter for SonarQube integration
- Coverage reports are generated in the `../coverage` directory

## Architecture

### Module Structure

The application follows NestJS module architecture:

- **AppModule** (src/app.module.ts): Root module that imports PointModule
- **PointModule** (src/point/point.module.ts): Point management feature module that imports DatabaseModule
- **DatabaseModule** (src/database/database.module.ts): Database layer providing UserPointTable and PointHistoryTable

### Point Feature (src/point/)

The point feature is organized around:
- **point.controller.ts**: REST endpoints for point operations (GET /point/:id, GET /point/:id/histories, PATCH /point/:id/charge, PATCH /point/:id/use)
- **point.model.ts**: Type definitions for UserPoint, PointHistory, and TransactionType enum (CHARGE/USE)
- **point.dto.ts**: Request validation using class-validator (PointBody with @IsInt amount)

### Database Layer (src/database/)

In-memory database tables with async simulation:
- **UserPointTable**: Map-based storage with `selectById` and `insertOrUpdate` methods. Operations have 200-300ms random delays
- **PointHistoryTable**: Array-based storage with `insert` and `selectAllByUserId` methods. Operations have random delays
- **IMPORTANT**: These table classes should not be modified. Use only their public APIs

### Key Implementation Details

1. **Table classes simulate database latency** using setTimeout with randomInt(200-300ms)
2. **ID validation** in UserPointTable throws errors for invalid IDs (non-integers or <= 0)
3. **Transaction types** are tracked via TransactionType enum (CHARGE, USE)
4. **ValidationPipe** is used in controller endpoints to validate PointDto
5. **All endpoints have TODO comments** indicating incomplete implementations that return placeholder data
