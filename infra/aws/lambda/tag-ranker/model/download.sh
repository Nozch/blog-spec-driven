#!/bin/bash
#
# Download Model2Vec pre-trained model for tag suggestion
#
# Requirements:
# - research.md:67: Model2Vec distilled from all-MiniLM-L6-v2
# - Model size: 8-30MB for Lambda deployment
# - Languages: Japanese (primary), English, Chinese, Korean
#
# Usage:
#   ./download.sh [--force]
#

set -euo pipefail

# Configuration
MODEL_URL="${MODEL_URL:-https://huggingface.co/minishlab/M2V_base_output/resolve/main}"
MODEL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL_FILE="model2vec.bin"
VOCAB_FILE="vocab.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
FORCE=false
if [[ "${1:-}" == "--force" ]]; then
  FORCE=true
fi

echo -e "${GREEN}Model2Vec Download Script${NC}"
echo "======================================"
echo ""

# Check if model already exists
if [[ -f "${MODEL_DIR}/${MODEL_FILE}" ]] && [[ "${FORCE}" == "false" ]]; then
  echo -e "${YELLOW}Model already exists. Use --force to re-download.${NC}"
  echo ""
  echo "Model path: ${MODEL_DIR}/${MODEL_FILE}"
  ls -lh "${MODEL_DIR}/${MODEL_FILE}"
  exit 0
fi

# Check dependencies
if ! command -v curl &> /dev/null; then
  echo -e "${RED}Error: curl is required but not installed.${NC}"
  exit 1
fi

echo "📦 Downloading Model2Vec model..."
echo "   Source: ${MODEL_URL}"
echo "   Target: ${MODEL_DIR}"
echo ""

# Download model file
echo "⬇️  Downloading ${MODEL_FILE}..."
curl -L -o "${MODEL_DIR}/${MODEL_FILE}" \
  "${MODEL_URL}/${MODEL_FILE}" \
  --progress-bar

# Download vocabulary file
echo "⬇️  Downloading ${VOCAB_FILE}..."
curl -L -o "${MODEL_DIR}/${VOCAB_FILE}" \
  "${MODEL_URL}/${VOCAB_FILE}" \
  --progress-bar

# Verify downloads
echo ""
echo "✅ Download complete!"
echo ""

# Check file sizes
MODEL_SIZE=$(stat -f%z "${MODEL_DIR}/${MODEL_FILE}" 2>/dev/null || stat -c%s "${MODEL_DIR}/${MODEL_FILE}")
VOCAB_SIZE=$(stat -f%z "${MODEL_DIR}/${VOCAB_FILE}" 2>/dev/null || stat -c%s "${MODEL_DIR}/${VOCAB_FILE}")

MODEL_SIZE_MB=$((MODEL_SIZE / 1024 / 1024))
VOCAB_SIZE_KB=$((VOCAB_SIZE / 1024))

echo "📊 File Information:"
echo "   ${MODEL_FILE}: ${MODEL_SIZE_MB} MB"
echo "   ${VOCAB_FILE}: ${VOCAB_SIZE_KB} KB"
echo ""

# Verify size constraints (8-30MB per research.md)
if [[ ${MODEL_SIZE_MB} -lt 8 ]] || [[ ${MODEL_SIZE_MB} -gt 30 ]]; then
  echo -e "${RED}⚠️  Warning: Model size ${MODEL_SIZE_MB}MB is outside expected range (8-30MB)${NC}"
  echo "   This may indicate a download issue or model version mismatch."
fi

# Generate checksums
echo "🔐 Generating checksums..."
if command -v shasum &> /dev/null; then
  MODEL_SHA256=$(shasum -a 256 "${MODEL_DIR}/${MODEL_FILE}" | awk '{print $1}')
  VOCAB_SHA256=$(shasum -a 256 "${MODEL_DIR}/${VOCAB_FILE}" | awk '{print $1}')

  echo "   ${MODEL_FILE}: ${MODEL_SHA256}"
  echo "   ${VOCAB_FILE}: ${VOCAB_SHA256}"

  # Update metadata.json with checksums
  if command -v jq &> /dev/null; then
    METADATA_FILE="${MODEL_DIR}/metadata.json"
    if [[ -f "${METADATA_FILE}" ]]; then
      jq ".checksum.model = \"${MODEL_SHA256}\" | .checksum.vocabulary = \"${VOCAB_SHA256}\"" \
        "${METADATA_FILE}" > "${METADATA_FILE}.tmp"
      mv "${METADATA_FILE}.tmp" "${METADATA_FILE}"
      echo "   ✅ Updated checksums in metadata.json"
    fi
  fi
fi

echo ""
echo -e "${GREEN}✨ Model download complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify model loads correctly: npm test"
echo "  2. Build Lambda package: npm run package"
echo "  3. Deploy to AWS Lambda"
echo ""
