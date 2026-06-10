#!/bin/bash
# One-shot GCP setup for the growth metrics automation.
#
# Creates a service account with Search Console / GA4 read APIs enabled,
# generates a key, and stores it as the GOOGLE_SERVICE_ACCOUNT_KEY secret
# on the GitHub repository. Requires: gcloud (authenticated), gh (authenticated).
#
# Usage: ./scripts/growth/setup-gcp.sh [PROJECT_ID]
#   PROJECT_ID defaults to the current gcloud project.
set -euo pipefail

SA_NAME="growth-metrics"
REPO="rrih/rrih.github.io"

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  echo "No project. Run: ./scripts/growth/setup-gcp.sh <PROJECT_ID>" >&2
  exit 1
fi
echo "Using project: $PROJECT_ID"

echo "Enabling APIs (Search Console, Analytics Data)..."
gcloud services enable searchconsole.googleapis.com analyticsdata.googleapis.com \
  --project "$PROJECT_ID"

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating service account ${SA_EMAIL}..."
  gcloud iam service-accounts create "$SA_NAME" \
    --project "$PROJECT_ID" \
    --display-name "Growth metrics reader (GSC/GA4)"
else
  echo "Service account ${SA_EMAIL} already exists"
fi

KEY_FILE="$(mktemp)"
trap 'rm -f "$KEY_FILE"' EXIT
echo "Creating key..."
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account "$SA_EMAIL" \
  --project "$PROJECT_ID"

echo "Storing key as GitHub secret GOOGLE_SERVICE_ACCOUNT_KEY on ${REPO}..."
gh secret set GOOGLE_SERVICE_ACCOUNT_KEY --repo "$REPO" < "$KEY_FILE"

echo ""
echo "Done. Remaining manual steps (must be done by the Google account that owns the properties):"
echo "  1. Search Console (https://search.google.com/search-console) property https://rrih.github.io/"
echo "     Settings > Users and permissions > Add user: ${SA_EMAIL} (Full)"
echo "  2. GA4 (https://analytics.google.com) property 503144752"
echo "     Admin > Property access management > Add user: ${SA_EMAIL} (Viewer)"
echo "  3. Verify: gh workflow run growth-metrics.yml --repo ${REPO}"
