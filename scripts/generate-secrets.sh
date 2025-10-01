#!/bin/bash
# Security Setup Helper Script
# Run this script to generate required secrets

set -e

echo "🔐 SABC Security Setup Helper"
echo "=============================="
echo ""

# Check for required tools
if ! command -v openssl &> /dev/null; then
    echo "❌ Error: openssl is required but not installed"
    exit 1
fi

echo "Generating secrets..."
echo ""

# Generate NEXTAUTH_SECRET
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "✅ NEXTAUTH_SECRET (for NextAuth.js):"
echo "   $NEXTAUTH_SECRET"
echo ""

# Generate CRON_HMAC_KEY
CRON_HMAC_KEY=$(openssl rand -hex 32)
echo "✅ CRON_HMAC_KEY (for cron job authentication):"
echo "   $CRON_HMAC_KEY"
echo ""

echo "📋 Next Steps:"
echo ""
echo "1. Add these secrets to Vercel:"
echo "   • Go to: https://vercel.com/[your-team]/sabc/settings/environment-variables"
echo "   • Add NEXTAUTH_SECRET (Production, Preview, Development)"
echo "   • Add CRON_HMAC_KEY (Production, Preview)"
echo ""
echo "2. Add CRON_HMAC_KEY to GitHub:"
echo "   • Go to: Settings → Environments → outing-update"
echo "   • Add secret: CRON_HMAC_KEY"
echo ""
echo "3. Configure other required environment variables:"
echo "   • NEXTAUTH_URL"
echo "   • Email provider settings (for magic links)"
echo "   • Upstash Redis credentials (for rate limiting)"
echo "   • Notion tokens and database IDs"
echo ""
echo "📖 See .env.example for the complete list"
echo "📖 See SECURITY_IMPLEMENTATION.md for detailed instructions"
echo ""

# Optionally create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    read -p "Create .env.local with these secrets? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cat > .env.local << EOF
# Generated: $(date)
# DO NOT COMMIT THIS FILE

# NextAuth
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXTAUTH_URL=http://localhost:3000

# Cron Authentication
CRON_HMAC_KEY=$CRON_HMAC_KEY

# Add other variables from .env.example as needed
# NOTION_TOKEN=
# NOTION_OUTINGS_DB_ID=
# NOTION_MEMBERS_DB_ID=
# NOTION_TESTS_DB_ID=
# NOTION_COXING_DB_ID=
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=
# EMAIL_SERVER_HOST=
# EMAIL_SERVER_PORT=
# EMAIL_SERVER_USER=
# EMAIL_SERVER_PASSWORD=
# EMAIL_FROM=
EOF
        echo "✅ Created .env.local"
        echo "⚠️  Remember to add the remaining environment variables"
    fi
fi

echo ""
echo "✨ Done! Keep these secrets safe and NEVER commit them to git."
