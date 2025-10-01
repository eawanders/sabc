# Security Hardening Implementation (No User Auth)

This document describes the security hardening changes made to the SABC
application.

**Note:** User authentication has been intentionally excluded for now and can be
added later when needed.

## 🔒 Security Features Implemented

### 1. **API Security (No User Auth)**

- ✅ Input validation using Zod schemas
- ✅ Rate limiting (30 req/min per IP) - **OPTIONAL**
- ✅ CORS restricted to allowed origins
- ✅ Comprehensive error handling with PII redaction
- ❌ User authentication (deferred for future implementation)

### 2. **Secrets Management**

- ✅ All secrets in environment variables (never in code)
- ✅ Separate environments for prod/preview/development
- ✅ `.gitignore` prevents accidental commits
- ✅ `.env.example` template for documentation

### 3. **Cron Job Security**

- ✅ HMAC-SHA256 signatures with timestamp
- ✅ Replay protection (5-minute window)
- ✅ No more Bearer tokens in workflows
- ✅ GitHub Actions pinned to minimal permissions

### 4. **Security Headers**

- ✅ Content Security Policy (CSP)
- ✅ HSTS with preload
- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff
- ✅ Permissions-Policy
- ✅ Referrer-Policy

### 5. **Logging & Monitoring**

- ✅ Structured logging with Pino
- ✅ Automatic PII redaction
- ✅ Security event tracking
- ✅ Error boundaries

## 📋 Setup Checklist

### Immediate Actions Required

- [ ] **1. Generate HMAC Secret**

  ```bash
  # CRON_HMAC_KEY
  openssl rand -hex 32
  ```

- [ ] **2. Update Vercel Environment Variables**

  In Vercel Dashboard → Settings → Environment Variables, add:

  **Production:**

  - `CRON_HMAC_KEY`
  - `NOTION_TOKEN`
  - `NOTION_OUTINGS_DB_ID`
  - `NOTION_MEMBERS_DB_ID`
  - `NOTION_TESTS_DB_ID`
  - `NOTION_COXING_DB_ID`
  - `UPSTASH_REDIS_REST_URL` (optional - for rate limiting)
  - `UPSTASH_REDIS_REST_TOKEN` (optional - for rate limiting)

  **Preview:** Same as above but with different Notion values if needed

  **Development:** Use `.env.local` file locally

- [ ] **3. Update GitHub Environments**

  In GitHub → Settings → Environments → `outing-update`:

  - Remove `UPDATE_OUTING_STATUS_SECRET`
  - Add `CRON_HMAC_KEY` (same value as in Vercel)

- [ ] **4. Rotate Existing Secrets (If Needed)**

  If any secrets were committed to git history:

  ```bash
  # Search for secrets
  git log -p | grep -i "notion_token\|secret"

  # If found, rotate immediately:
  # 1. Create new Notion integration
  # 2. Update all environment variables
  # 3. Revoke old integration
  ```

- [ ] **5. Set Up Upstash Redis (Optional)**

  For rate limiting:

  ```bash
  # 1. Create account at https://upstash.com
  # 2. Create a Redis database
  # 3. Copy REST URL and token to environment variables
  # Note: If not configured, rate limiting will be disabled
  ```

- [ ] **6. Deploy Changes**

  ```bash
  git add .
  git commit -m "feat: implement security hardening (no user auth)"
  git push origin edward/edw-74-safety-clean-up
  ```

- [ ] **7. Test Cron Job**
  - Manually trigger workflow in GitHub Actions
  - Verify HMAC signature validation works
  - Check Vercel logs for successful cron execution

### Optional but Recommended

- [ ] Enable Vercel Access Control (if app is private)
- [ ] Set up error monitoring (Sentry, LogRocket, etc.)
- [ ] Configure Dependabot for security updates
- [ ] Add security scanning to CI/CD
- [ ] Create separate Notion workspaces for prod/staging
- [ ] Document privacy policy and user data handling

## 🔧 API Route Pattern (No Auth)

All API routes now follow this pattern:

```typescript
import { NextRequest } from "next/server";
import { checkRateLimit } from "../_utils/rate-limit";
import { yourSchema } from "../_utils/schemas";
import {
  handleApiError,
  getClientIp,
  createSuccessResponse,
} from "../_utils/response";
import logger from "../_utils/logger";

export async function POST(req: NextRequest) {
  const route = "/api/your-route";
  const ip = getClientIp(req);

  try {
    // 1. Rate limit (optional - requires Upstash Redis)
    await checkRateLimit(ip);

    // 2. Validate input
    const json = await req.json();
    const input = yourSchema.parse(json);

    // 3. Process request
    logger.info({ route, action: "processing" }, "Processing request");
    // ... your business logic ...

    // 4. Return response with security headers
    return createSuccessResponse({ success: true, data: result });
  } catch (error) {
    return handleApiError(error, { route, method: "POST", ip });
  }
}
```

## 📚 Key Files

### Security Utilities

- `src/app/api/_utils/auth.ts` - Placeholder for future auth
- `src/app/api/_utils/rate-limit.ts` - Rate limiting with Upstash Redis
  (optional)
- `src/app/api/_utils/schemas.ts` - Zod validation schemas
- `src/app/api/_utils/hmac.ts` - HMAC signing & verification
- `src/app/api/_utils/logger.ts` - Structured logging with PII redaction
- `src/app/api/_utils/response.ts` - Standard response helpers

### Configuration

- `middleware.ts` - Security headers and CSP
- `next.config.ts` - Security headers, HTTPS redirect
- `.github/workflows/outing-status-cron.yml` - HMAC-signed cron job
- `SECURITY.md` - Security policy and incident response

## 🚨 Breaking Changes

1. **Cron authentication changed** - Update GitHub Environment with
   `CRON_HMAC_KEY`
2. **Stricter input validation** - Invalid requests return 400 with details
3. **Rate limiting (if enabled)** - High-frequency requests will be throttled

## 📖 Documentation

- Read `SECURITY.md` for incident response and key rotation procedures
- See `.env.example` for all required environment variables
- Check each API route for specific validation requirements

## ⚠️ Important Notes

1. **Never commit secrets** - Always use environment variables
2. **Treat Notion DB IDs as sensitive** - Don't expose in client bundles
3. **Monitor logs for PII** - Verify redaction is working
4. **Rotate keys quarterly** - See SECURITY.md for procedures
5. **Test thoroughly** - Especially cron job HMAC validation

## 🆘 Troubleshooting

### "CRON_HMAC_KEY environment variable is not set"

- Add `CRON_HMAC_KEY` to Vercel and GitHub environments

### "UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN missing"

- This is OK! Rate limiting will be disabled (warning logged)
- To enable rate limiting, create Redis database at upstash.com and add
  credentials

### Cron job fails with 401

- Verify `CRON_HMAC_KEY` matches in GitHub and Vercel
- Check workflow logs for signature generation
- Ensure timestamp is current (within 5 minutes)

## 🎯 Next Steps

After implementing these changes:

1. ✅ Complete the setup checklist above
2. ✅ Test cron job functionality
3. ✅ Review and update privacy policy
4. ✅ Configure monitoring and alerting
5. ✅ Schedule quarterly key rotation
6. ✅ Consider security audit before public launch

## 🔮 Future: Adding User Authentication

When you're ready to add user authentication:

1. Install NextAuth: `npm install next-auth`
2. Update auth utilities in `src/app/api/_utils/auth.ts`
3. Create `src/app/api/auth/[...nextauth]/route.ts`
4. Add `requireSession()` and `requireRole()` checks to API routes
5. Add environment variables: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, email provider
   config
6. Update documentation

The framework is ready - authentication can be added incrementally when needed.

---

**Questions?** See `SECURITY.md` or contact [your-email@domain.com]
