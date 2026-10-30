#!/bin/bash
# GSD Workflow Validation Script
# Validates all workflow files for required structure

error_count=0
warning_count=0
workflows_checked=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " GSD ► VALIDATING WORKFLOWS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

shopt -s nullglob
files=(.agent/workflows/*.md)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
    echo "❌ Missing or empty .agent/workflows directory"
    exit 1
fi

for file in "${files[@]}"; do
    ((workflows_checked++))
    filename=$(basename "$file")
    has_errors=false
    
    # Check for frontmatter
    if ! head -1 "$file" | grep -q "^---"; then
        echo "❌ $filename: Missing frontmatter"
        ((error_count++))
        has_errors=true
    fi
    
    # Check for description strictly inside frontmatter
    frontmatter=$(awk 'NR==1 && /^---/{in_fm=1;next} /^---/ && in_fm{exit} in_fm{print}' "$file")
    if ! echo "$frontmatter" | grep -q "^description:"; then
        echo "❌ $filename: Missing description in frontmatter"
        ((error_count++))
        has_errors=true
    fi
    
    # Check for process tags (optional but recommended)
    if ! grep -q "<process>" "$file"; then
        echo "⚠️  $filename: Missing <process> tag"
        ((warning_count++))
    fi
    
    if [ "$has_errors" = false ]; then
        echo "✅ $filename"
    fi
done

echo ""
echo "───────────────────────────────────────────────────────"
echo ""
echo "Workflows checked: $workflows_checked"
echo "Errors: $error_count"
echo "Warnings: $warning_count"
echo ""

if [ $workflows_checked -gt 0 ] && [ $error_count -eq 0 ]; then
    echo "✅ All workflows valid!"
    exit 0
else
    echo "❌ Validation failed"
    exit 1
fi
