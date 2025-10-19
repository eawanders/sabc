#!/bin/bash
# Quick test script to verify the API fix

echo "🧪 Testing API endpoints..."

# Test local dev server
if curl -s http://localhost:3000/api/get-members | grep -q '"success":true'; then
  echo "✅ Local /api/get-members - WORKING"
else
  echo "❌ Local /api/get-members - FAILED (is dev server running?)"
fi

# Test production
if curl -s https://sabc-woad.vercel.app/api/get-members | grep -q '"success":true'; then
  echo "✅ Production /api/get-members - WORKING"
else
  echo "❌ Production /api/get-members - FAILED"
  echo "Response:"
  curl -s https://sabc-woad.vercel.app/api/get-members | head -c 500
  echo ""
fi

echo ""
echo "🔍 Testing with specific member IDs..."
if curl -s "https://sabc-woad.vercel.app/api/get-members?ids=28080040-a8fa-813b-85be-fbfafd9a8ea7" | grep -q '"success":true'; then
  echo "✅ Production /api/get-members?ids=... - WORKING"
else
  echo "❌ Production /api/get-members?ids=... - FAILED"
fi

echo ""
echo "✨ Test complete!"
