import type { SerializedTrace } from "./types.js";

/**
 * Returns embedded sample traces for demo purposes.
 * These represent realistic agent sessions with multiple step types,
 * models, token counts, costs, and timing data.
 */
export function getSampleTraces(): SerializedTrace[] {
  return [buildCodingSession(), buildResearchTask(), buildDataPipeline()];
}

function buildCodingSession(): SerializedTrace {
  const base = new Date("2026-03-27T09:15:00.000Z");
  const at = (offset: number) => new Date(base.getTime() + offset).toISOString();

  return {
    id: "trace-a1b2c3d4",
    name: "Implement user authentication API",
    startedAt: at(0),
    endedAt: at(47_320),
    duration: 47_320,
    metadata: {
      agent: "coding-assistant",
      version: "1.4.2",
      environment: "development",
      repository: "acme/backend-api",
      branch: "feat/user-auth",
    },
    steps: [
      {
        id: "s-001",
        type: "llm_call",
        name: "Analyze task requirements",
        startedAt: at(0),
        endedAt: at(3_420),
        duration: 3_420,
        model: "claude-sonnet-4-20250514",
        input: {
          messages: [
            { role: "system", content: "You are an expert backend engineer. Help implement features with clean, well-tested code." },
            { role: "user", content: "Implement a user authentication API with JWT tokens. We need signup, login, and token refresh endpoints. Use Express.js with TypeScript. Include proper password hashing with bcrypt and input validation." },
          ],
        },
        output: {
          content: "I'll implement the user authentication API step by step. Let me first examine the existing project structure and then create the necessary files.\n\nHere's my plan:\n1. Check the existing project structure\n2. Create the User model with password hashing\n3. Implement JWT utility functions\n4. Create auth controller with signup, login, and refresh\n5. Add input validation middleware\n6. Set up routes\n7. Write tests",
          stop_reason: "end_turn",
        },
        tokens: { prompt: 245, completion: 387, total: 632 },
        cost: 0.0028,
        children: [],
        metadata: { temperature: 0.3 },
      },
      {
        id: "s-002",
        type: "tool_call",
        name: "file_read: src/index.ts",
        startedAt: at(3_500),
        endedAt: at(3_620),
        duration: 120,
        input: { tool: "file_read", arguments: { path: "src/index.ts" } },
        output: {
          content: "import express from \"express\";\nimport cors from \"cors\";\nimport { router } from \"./routes\";\n\nconst app = express();\napp.use(cors());\napp.use(express.json());\napp.use(\"/api\", router);\n\nconst PORT = process.env.PORT || 3000;\napp.listen(PORT, () => console.log(`Server running on port ${PORT}`));",
        },
        children: [],
      },
      {
        id: "s-003",
        type: "tool_call",
        name: "file_read: package.json",
        startedAt: at(3_700),
        endedAt: at(3_810),
        duration: 110,
        input: { tool: "file_read", arguments: { path: "package.json" } },
        output: {
          content: "{\n  \"name\": \"backend-api\",\n  \"version\": \"1.0.0\",\n  \"dependencies\": {\n    \"express\": \"^4.18.0\",\n    \"cors\": \"^2.8.5\",\n    \"prisma\": \"^5.10.0\"\n  }\n}",
        },
        children: [],
      },
      {
        id: "s-004",
        type: "llm_call",
        name: "Generate User model and JWT utils",
        startedAt: at(3_900),
        endedAt: at(8_750),
        duration: 4_850,
        model: "claude-sonnet-4-20250514",
        input: {
          messages: [
            { role: "assistant", content: "I can see the project uses Express with Prisma. Let me create the User model and JWT utilities." },
          ],
        },
        output: {
          content: "I'll create the Prisma schema for the User model and the JWT utility functions.\n\n```prisma\nmodel User {\n  id        String   @id @default(cuid())\n  email     String   @unique\n  password  String\n  name      String?\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n```",
          stop_reason: "end_turn",
        },
        tokens: { prompt: 1_245, completion: 892, total: 2_137 },
        cost: 0.0089,
        children: [],
        metadata: { temperature: 0.2 },
      },
      {
        id: "s-005",
        type: "tool_call",
        name: "code_interpreter",
        startedAt: at(8_900),
        endedAt: at(12_340),
        duration: 3_440,
        input: {
          tool: "code_interpreter",
          arguments: {
            code: "import * as bcrypt from \"bcrypt\";\n\nconst password = \"test_password_123\";\nconst saltRounds = 12;\nconst hash = await bcrypt.hash(password, saltRounds);\nconst isValid = await bcrypt.compare(password, hash);\nconsole.log({ hash: hash.substring(0, 20) + \"...\", isValid, saltRounds });",
            language: "typescript",
          },
        },
        output: {
          result: "{ hash: \"$2b$12$LJ3m5Z1Kqxw...\", isValid: true, saltRounds: 12 }",
          execution_time: 2_890,
        },
        children: [],
      },
      {
        id: "s-006",
        type: "decision",
        name: "Choose JWT library and token strategy",
        startedAt: at(12_500),
        endedAt: at(12_520),
        duration: 20,
        input: {
          options: [
            "jsonwebtoken with RS256 (asymmetric)",
            "jsonwebtoken with HS256 (symmetric)",
            "jose library with EdDSA",
          ],
        },
        output: {
          chosen: "jsonwebtoken with HS256 (symmetric)",
          reasoning: "HS256 is simpler for a single-service setup. RS256 would be better for microservices but adds complexity.",
        },
        children: [],
        metadata: { auto_decided: false },
      },
      {
        id: "s-007",
        type: "llm_call",
        name: "Generate auth controller implementation",
        startedAt: at(12_600),
        endedAt: at(21_300),
        duration: 8_700,
        model: "claude-sonnet-4-20250514",
        input: {
          messages: [
            { role: "assistant", content: "Now I'll implement the auth controller with signup, login, and token refresh endpoints using HS256 JWT tokens." },
          ],
        },
        output: {
          content: "Here's the complete auth controller implementation with proper error handling, password hashing, and JWT management:\n\n```typescript\nimport { Request, Response } from 'express';\nimport bcrypt from 'bcrypt';\nimport jwt from 'jsonwebtoken';\nimport { prisma } from '../db';\nimport { signupSchema, loginSchema } from '../validators/auth';\n\nconst JWT_SECRET = process.env.JWT_SECRET!;\nconst ACCESS_TOKEN_EXPIRY = '15m';\nconst REFRESH_TOKEN_EXPIRY = '7d';\n\nexport async function signup(req: Request, res: Response) {\n  const { email, password, name } = signupSchema.parse(req.body);\n  const existingUser = await prisma.user.findUnique({ where: { email } });\n  if (existingUser) return res.status(409).json({ error: 'Email already registered' });\n  const hashedPassword = await bcrypt.hash(password, 12);\n  const user = await prisma.user.create({ data: { email, password: hashedPassword, name } });\n  const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });\n  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });\n  return res.status(201).json({ user: { id: user.id, email, name }, accessToken, refreshToken });\n}\n```",
          stop_reason: "end_turn",
        },
        tokens: { prompt: 2_890, completion: 1_456, total: 4_346 },
        cost: 0.0173,
        children: [],
        metadata: { temperature: 0.2 },
      },
      {
        id: "s-008",
        type: "tool_call",
        name: "web_search",
        startedAt: at(21_500),
        endedAt: at(23_100),
        duration: 1_600,
        input: {
          tool: "web_search",
          arguments: { query: "express.js JWT refresh token best practices 2025 security" },
        },
        output: {
          results: [
            {
              title: "JWT Refresh Token Best Practices - OWASP",
              url: "https://owasp.org/best-practices/jwt-refresh-tokens",
              snippet: "Store refresh tokens in httpOnly cookies, implement token rotation, and maintain a token blacklist for revocation...",
            },
            {
              title: "Secure Token Handling in Node.js - Auth0 Blog",
              url: "https://auth0.com/blog/node-js-jwt-best-practices",
              snippet: "Always validate token claims, use short expiry for access tokens (15 min), implement refresh token rotation...",
            },
          ],
        },
        children: [],
      },
      {
        id: "s-009",
        type: "error",
        name: "TypeScript compilation check",
        startedAt: at(23_300),
        endedAt: at(25_800),
        duration: 2_500,
        input: {
          tool: "code_interpreter",
          arguments: { code: "npx tsc --noEmit", language: "shell" },
        },
        output: null,
        error: {
          message: "TypeScript compilation failed with 3 errors",
          code: "TS_COMPILE_ERROR",
          stack: "error TS2305: Module '\"../db\"' has no exported member 'prisma'.\n  at src/controllers/auth.ts:4:10\nerror TS2304: Cannot find name 'signupSchema'.\n  at src/controllers/auth.ts:9:31\nerror TS2304: Cannot find name 'loginSchema'.\n  at src/controllers/auth.ts:10:30",
        },
        children: [],
      },
      {
        id: "s-010",
        type: "llm_call",
        name: "Fix TypeScript errors and add missing imports",
        startedAt: at(25_900),
        endedAt: at(32_400),
        duration: 6_500,
        model: "claude-sonnet-4-20250514",
        input: {
          messages: [
            { role: "assistant", content: "I need to fix the compilation errors by creating the missing db module, validators, and updating imports." },
          ],
        },
        output: {
          content: "I've fixed all three TypeScript errors:\n1. Created `src/db.ts` with the Prisma client export\n2. Created `src/validators/auth.ts` with Zod schemas for signup and login\n3. Updated the auth controller imports\n\nAll files now compile cleanly.",
          stop_reason: "end_turn",
        },
        tokens: { prompt: 3_780, completion: 1_234, total: 5_014 },
        cost: 0.0198,
        children: [],
        metadata: { temperature: 0.2 },
      },
      {
        id: "s-011",
        type: "llm_call",
        name: "Generate unit tests",
        startedAt: at(32_600),
        endedAt: at(40_200),
        duration: 7_600,
        model: "gpt-4o",
        input: {
          messages: [
            { role: "user", content: "Write comprehensive unit tests for the auth controller using vitest and supertest." },
          ],
        },
        output: {
          content: "Here are the unit tests covering all auth endpoints:\n\n```typescript\nimport { describe, it, expect, beforeAll, afterAll } from 'vitest';\nimport supertest from 'supertest';\nimport { app } from '../app';\nimport { prisma } from '../db';\n\nconst request = supertest(app);\n\ndescribe('Auth API', () => {\n  beforeAll(async () => { await prisma.user.deleteMany(); });\n  afterAll(async () => { await prisma.$disconnect(); });\n\n  describe('POST /api/auth/signup', () => {\n    it('should create a new user and return tokens', async () => {\n      const res = await request.post('/api/auth/signup').send({\n        email: 'test@example.com',\n        password: 'SecurePass123!',\n        name: 'Test User'\n      });\n      expect(res.status).toBe(201);\n      expect(res.body).toHaveProperty('accessToken');\n    });\n  });\n});\n```",
          stop_reason: "end_turn",
        },
        tokens: { prompt: 4_100, completion: 1_870, total: 5_970 },
        cost: 0.0245,
        children: [],
        metadata: { temperature: 0.3 },
      },
      {
        id: "s-012",
        type: "tool_call",
        name: "code_interpreter: run tests",
        startedAt: at(40_400),
        endedAt: at(47_100),
        duration: 6_700,
        input: {
          tool: "code_interpreter",
          arguments: {
            code: "npx vitest run --reporter=verbose src/tests/auth.test.ts",
            language: "shell",
          },
        },
        output: {
          result: "Test Files  1 passed (1)\n     Tests  5 passed (5)\n   Duration  1.42s",
          execution_time: 6_500,
        },
        children: [],
      },
    ],
    summary: {
      totalSteps: 12,
      totalTokens: { prompt: 12_260, completion: 5_839, total: 18_099 },
      totalCost: 0.0733,
      totalDuration: 47_320,
      stepsByType: { llm_call: 5, tool_call: 5, decision: 1, error: 1 },
      models: ["claude-sonnet-4-20250514", "gpt-4o"],
      errorCount: 1,
    },
  };
}

function buildResearchTask(): SerializedTrace {
  const base = new Date("2026-03-27T14:30:00.000Z");
  const at = (offset: number) => new Date(base.getTime() + offset).toISOString();

  return {
    id: "trace-e5f6g7h8",
    name: "Research: LLM context window optimization",
    startedAt: at(0),
    endedAt: at(28_450),
    duration: 28_450,
    metadata: {
      agent: "research-assistant",
      version: "2.1.0",
      environment: "production",
      user: "researcher-42",
    },
    steps: [
      {
        id: "r-001",
        type: "llm_call",
        name: "Understand research query",
        startedAt: at(0),
        endedAt: at(2_100),
        duration: 2_100,
        model: "claude-sonnet-4-20250514",
        input: {
          messages: [
            { role: "user", content: "Research the latest techniques for optimizing LLM context window usage. Focus on methods that reduce token consumption while maintaining output quality. Include recent papers from 2025-2026." },
          ],
        },
        output: {
          content: "I'll research LLM context window optimization techniques. Let me search for recent papers and techniques.",
          stop_reason: "end_turn",
        },
        tokens: { prompt: 120, completion: 85, total: 205 },
        cost: 0.0009,
        children: [],
      },
      {
        id: "r-002",
        type: "tool_call",
        name: "web_search: context optimization papers",
        startedAt: at(2_200),
        endedAt: at(4_800),
        duration: 2_600,
        input: { tool: "web_search", arguments: { query: "LLM context window optimization techniques 2025 2026 papers" } },
        output: {
          results: [
            { title: "Context Distillation: Efficient Long-Context Processing for LLMs", url: "https://arxiv.org/abs/2506.12345", snippet: "We present a novel approach to compress long contexts into dense representations, achieving 4x token reduction with only 2% quality degradation..." },
            { title: "Sliding Window Attention with Dynamic Anchoring", url: "https://arxiv.org/abs/2601.09876", snippet: "Our method dynamically selects anchor tokens for sliding window attention, enabling 200K context with O(n*sqrt(n)) complexity..." },
          ],
        },
        children: [],
      },
      {
        id: "r-003",
        type: "tool_call",
        name: "web_search: RAG optimization",
        startedAt: at(4_900),
        endedAt: at(7_300),
        duration: 2_400,
        input: { tool: "web_search", arguments: { query: "retrieval augmented generation context optimization token efficiency" } },
        output: {
          results: [
            { title: "RAG 2.0: Adaptive Retrieval for Optimal Context Construction", url: "https://arxiv.org/abs/2510.54321", snippet: "An adaptive retrieval framework that dynamically adjusts the number and granularity of retrieved passages..." },
            { title: "Token-Efficient RAG with Hierarchical Summarization", url: "https://arxiv.org/abs/2512.11111", snippet: "We propose hierarchical pre-summarization of document chunks before retrieval, reducing average context length by 60%..." },
          ],
        },
        children: [],
      },
      {
        id: "r-004",
        type: "llm_call",
        name: "Synthesize research findings",
        startedAt: at(7_500),
        endedAt: at(18_200),
        duration: 10_700,
        model: "claude-sonnet-4-20250514",
        input: {
          messages: [
            { role: "assistant", content: "Based on the search results, I'll synthesize the key findings about context window optimization techniques." },
          ],
        },
        output: {
          content: "# LLM Context Window Optimization: State of the Art (2025-2026)\n\n## Key Techniques\n\n### 1. Context Distillation\nCompresses long contexts into dense representations. Recent work achieves 4x token reduction with minimal quality loss.\n\n### 2. Dynamic Sliding Window Attention\nImproves on fixed sliding window by dynamically selecting important anchor tokens.\n\n### 3. Prompt Caching\nIntelligent caching of prompt prefixes shared across requests. Reduces redundant processing by 40-70%.\n\n### 4. Adaptive RAG\nDynamically adjusts retrieval granularity based on query complexity.\n\n### 5. Hierarchical Pre-summarization\nPre-processes document collections into hierarchical summaries. Reduces retrieval context by 60%.\n\n## Recommendations\nCombining prompt caching with adaptive RAG provides the best cost-quality tradeoff.",
          stop_reason: "end_turn",
        },
        tokens: { prompt: 1_890, completion: 2_340, total: 4_230 },
        cost: 0.0156,
        children: [],
        metadata: { temperature: 0.4 },
      },
      {
        id: "r-005",
        type: "llm_call",
        name: "Generate executive summary",
        startedAt: at(18_400),
        endedAt: at(28_200),
        duration: 9_800,
        model: "gpt-4o",
        input: {
          messages: [
            { role: "user", content: "Create a concise executive summary of these research findings suitable for a technical leadership audience." },
          ],
        },
        output: {
          content: "## Executive Summary\n\nContext window optimization has matured significantly in 2025-2026, with five key techniques emerging. The most production-ready approach combines prompt caching (40-70% token reduction) with adaptive RAG (dynamic context sizing). Estimated cost savings: 30-60% on LLM API spend.",
          stop_reason: "end_turn",
        },
        tokens: { prompt: 3_200, completion: 890, total: 4_090 },
        cost: 0.0178,
        children: [],
        metadata: { temperature: 0.3 },
      },
    ],
    summary: {
      totalSteps: 5,
      totalTokens: { prompt: 5_210, completion: 3_315, total: 8_525 },
      totalCost: 0.0343,
      totalDuration: 28_450,
      stepsByType: { llm_call: 3, tool_call: 2 },
      models: ["claude-sonnet-4-20250514", "gpt-4o"],
      errorCount: 0,
    },
  };
}

function buildDataPipeline(): SerializedTrace {
  const base = new Date("2026-03-27T16:00:00.000Z");
  const at = (offset: number) => new Date(base.getTime() + offset).toISOString();

  return {
    id: "trace-i9j0k1l2",
    name: "Data Pipeline: Customer Dedup",
    startedAt: at(0),
    endedAt: at(3_900),
    duration: 3_900,
    metadata: {
      agent: "data-pipeline-v1",
      environment: "staging",
    },
    steps: [
      {
        id: "d-001",
        type: "llm_call",
        name: "Parse data pipeline request",
        startedAt: at(0),
        endedAt: at(1_200),
        duration: 1_200,
        model: "claude-sonnet-4-20250514",
        tokens: { prompt: 620, completion: 280, total: 900 },
        cost: 0.0004,
        input: { messages: [{ role: "user", content: "Process and deduplicate the customer CSV export." }] },
        output: { plan: ["read CSV", "validate schema", "deduplicate by email", "export clean data"] },
        children: [],
      },
      {
        id: "d-002",
        type: "tool_call",
        name: "file_read: customers_export.csv",
        startedAt: at(1_300),
        endedAt: at(1_800),
        duration: 500,
        input: { path: "data/customers_export.csv" },
        output: { rows: 15_420, columns: 12 },
        children: [],
      },
      {
        id: "d-003",
        type: "custom",
        name: "Schema validation",
        startedAt: at(1_900),
        endedAt: at(2_100),
        duration: 200,
        input: { expectedColumns: ["email", "name", "company", "created_at"] },
        output: { valid: true, warnings: ["column 'phone' has 23% null values"] },
        children: [],
      },
      {
        id: "d-004",
        type: "tool_call",
        name: "Deduplicate records",
        startedAt: at(2_200),
        endedAt: at(3_400),
        duration: 1_200,
        input: { key: "email", strategy: "keep_latest" },
        output: { inputRows: 15_420, outputRows: 12_847, duplicatesRemoved: 2_573 },
        children: [],
      },
      {
        id: "d-005",
        type: "tool_result",
        name: "Export: customers_clean.csv",
        startedAt: at(3_500),
        endedAt: at(3_900),
        duration: 400,
        input: { path: "data/customers_clean.csv", format: "csv" },
        output: { success: true, rows: 12_847, fileSize: "2.4MB" },
        children: [],
      },
    ],
    summary: {
      totalSteps: 5,
      totalTokens: { prompt: 620, completion: 280, total: 900 },
      totalCost: 0.0004,
      totalDuration: 3_900,
      stepsByType: { llm_call: 1, tool_call: 2, tool_result: 1, custom: 1 },
      models: ["claude-sonnet-4-20250514"],
      errorCount: 0,
    },
  };
}
