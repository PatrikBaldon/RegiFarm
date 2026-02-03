#!/bin/bash
# Script ufficiale per creare il deployment package di RegiFarm per AWS Lambda (runtime Python 3.11 ARM64)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

BUILD_DIR="${BUILD_DIR:-.lambda-build}"
PACKAGE_NAME="${PACKAGE_NAME:-regifarm-lambda.zip}"
REQUIREMENTS_FILE="${REQUIREMENTS_FILE:-requirements-lambda.txt}"

echo "🔨 Building Lambda deployment package → ${PACKAGE_NAME}"
echo "📂 Working directory: ${ROOT_DIR}"

if [[ ! -f "${REQUIREMENTS_FILE}" ]]; then
  echo "❌ File dei requisiti non trovato: ${REQUIREMENTS_FILE}" >&2
  exit 1
fi

cleanup() {
  rm -rf "${BUILD_DIR}"
}
trap cleanup EXIT

rm -f "${PACKAGE_NAME}"
mkdir -p "${BUILD_DIR}"

echo "🐳 Installing dependencies inside Amazon Linux (ARM64) container..."
docker run --rm --platform linux/arm64 \
  --entrypoint /bin/bash \
  -v "${ROOT_DIR}:/var/task" \
  -w /var/task \
  public.ecr.aws/lambda/python:3.11-arm64 \
  -c "python -m pip install --upgrade pip && \
                python -m pip install --disable-pip-version-check \
                                     --no-cache-dir \
                                     --target '${BUILD_DIR}' \
                                     -r '${REQUIREMENTS_FILE}' && \
                python -m pip check"

echo "📁 Copying application source..."
rsync -a \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '*.pyo' \
  --exclude 'migrations' \
  app/ "${BUILD_DIR}/app/"

cp lambda_handler.py "${BUILD_DIR}/"

echo "🧹 Removing Python caches and metadata..."
find "${BUILD_DIR}" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_DIR}" -type f -name "*.py[co]" -delete 2>/dev/null || true
find "${BUILD_DIR}" -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

echo "📦 Creating ZIP package..."
(
  cd "${BUILD_DIR}"
  zip -r "../${PACKAGE_NAME}" . -q
)

echo "✅ Package created: ${PACKAGE_NAME}"
echo "📊 Package size: $(du -h "${PACKAGE_NAME}" | cut -f1)"
echo "✨ Done! Upload ${PACKAGE_NAME} to your Lambda function."
