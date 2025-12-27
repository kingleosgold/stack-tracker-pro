#!/bin/bash

# Stack Tracker Pro - Pre-Launch Checklist Script
# Run this before submitting to App Store/Play Store

echo "═══════════════════════════════════════════════════════════"
echo "Stack Tracker Pro - Pre-Launch Checklist"
echo "═══════════════════════════════════════════════════════════"
echo ""

ERRORS=0
WARNINGS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# 1. Check if we're in the right directory
echo "1. Checking directory structure..."
if [ ! -f "app.json" ]; then
    check_fail "Not in mobile-app directory! Run: cd mobile-app"
    exit 1
else
    check_pass "In correct directory"
fi

# 2. Check app.json configuration
echo ""
echo "2. Checking app.json configuration..."

if grep -q "your-project-id-here" app.json; then
    check_fail "Expo project ID not set in app.json"
else
    check_pass "Expo project ID configured"
fi

if grep -q "your-expo-username" app.json; then
    check_warn "Expo username not set in app.json"
else
    check_pass "Expo username configured"
fi

# 3. Check bundle identifiers
echo ""
echo "3. Checking bundle identifiers..."

if grep -q '"bundleIdentifier": "com.stacktrackerpro.app"' app.json; then
    check_pass "iOS bundle ID correct: com.stacktrackerpro.app"
else
    check_fail "iOS bundle ID not set correctly"
fi

if grep -q '"package": "com.stacktrackerpro.app"' app.json; then
    check_pass "Android package correct: com.stacktrackerpro.app"
else
    check_fail "Android package not set correctly"
fi

# 4. Check dependencies
echo ""
echo "4. Checking dependencies..."

if [ -d "node_modules" ]; then
    check_pass "node_modules exists"
else
    check_warn "node_modules not found. Run: npm install"
fi

if grep -q "expo-constants" package.json; then
    check_pass "expo-constants installed"
else
    check_fail "expo-constants missing. Run: npm install"
fi

# 5. Check API endpoint
echo ""
echo "5. Checking API configuration..."

API_URL=$(grep -o '"apiUrl": "[^"]*"' app.json | cut -d'"' -f4)

if [ -n "$API_URL" ]; then
    check_pass "API URL configured: $API_URL"

    # Test API health
    echo "   Testing API endpoint..."
    HEALTH_CHECK=$(curl -s "$API_URL/api/health" 2>/dev/null)

    if echo "$HEALTH_CHECK" | grep -q '"status":"ok"'; then
        check_pass "API is reachable and healthy"
    else
        check_warn "API health check failed. Is Railway deployed?"
    fi
else
    check_fail "API URL not configured in app.json"
fi

# 6. Check assets
echo ""
echo "6. Checking app assets..."

if [ -f "assets/icon.png" ]; then
    check_pass "App icon exists"
else
    check_warn "assets/icon.png missing"
fi

if [ -f "assets/splash.png" ]; then
    check_pass "Splash screen exists"
else
    check_warn "assets/splash.png missing"
fi

if [ -f "assets/adaptive-icon.png" ]; then
    check_pass "Adaptive icon exists (Android)"
else
    check_warn "assets/adaptive-icon.png missing"
fi

# 7. Check EAS configuration
echo ""
echo "7. Checking EAS build configuration..."

if [ -f "eas.json" ]; then
    check_pass "eas.json exists"

    if grep -q "your-apple-id@example.com" eas.json; then
        check_warn "Apple credentials not configured in eas.json"
    else
        check_pass "Apple credentials configured"
    fi
else
    check_fail "eas.json missing. Run: eas build:configure"
fi

# 8. Check for common issues
echo ""
echo "8. Checking for common issues..."

# Check for console.log statements
LOG_COUNT=$(grep -r "console.log" App.js 2>/dev/null | wc -l)
if [ "$LOG_COUNT" -gt 5 ]; then
    check_warn "Found $LOG_COUNT console.log statements in App.js (consider removing for production)"
else
    check_pass "Minimal console.log usage"
fi

# Check for hardcoded test data
if grep -qi "test.*data\|dummy.*data\|fake.*data" App.js 2>/dev/null; then
    check_warn "Possible test data found in App.js"
else
    check_pass "No obvious test data"
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Summary:"
echo "═══════════════════════════════════════════════════════════"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready for production build.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run: eas build --profile production --platform ios"
    echo "  2. Run: eas build --profile production --platform android"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found. Review before building.${NC}"
    echo ""
    echo "You can proceed, but address warnings for best results."
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found.${NC}"
    echo ""
    echo "Fix errors before building for production."
    exit 1
fi
