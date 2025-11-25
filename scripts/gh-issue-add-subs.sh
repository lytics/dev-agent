#!/bin/bash
#
# gh-issue-add-subs - Add multiple sub-issues to a parent issue
#
# Usage:
#   gh-issue-add-subs <parent-issue-number> <child-issue-number>...
#
# Description:
#   This script adds multiple existing issues as sub-issues to a parent issue
#   using GitHub's GraphQL API. All relationships are created in a single
#   batched GraphQL request for efficiency.
#
# Examples:
#   # Add issues #52, #53, #54 as sub-issues of #31
#   gh-issue-add-subs 31 52 53 54
#
#   # Add a single sub-issue
#   gh-issue-add-subs 31 52
#
# Requirements:
#   - GitHub CLI (gh) installed and authenticated
#   - Issues must exist in the current repository
#
# Exit codes:
#   0 - Success
#   1 - Missing required arguments
#   2 - Failed to get parent issue ID
#   3 - Failed to get child issue ID
#   4 - GraphQL mutation failed

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print usage
usage() {
  cat << EOF
Usage: $0 <parent-issue-number> <child-issue-number>...

Add multiple sub-issues to a parent issue using GitHub's GraphQL API.

Arguments:
  parent-issue-number    The issue number of the parent issue
  child-issue-number...  One or more issue numbers to add as sub-issues

Examples:
  $0 31 52 53 54
  $0 31 52

EOF
}

# Check if GitHub CLI is available
if ! command -v gh &> /dev/null; then
  echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}" >&2
  echo "Install it from https://cli.github.com/" >&2
  exit 1
fi

# Check arguments
if [ $# -lt 2 ]; then
  echo -e "${RED}Error: Missing required arguments${NC}" >&2
  usage
  exit 1
fi

parent=$1
shift
children=("$@")

echo -e "${YELLOW}Adding ${#children[@]} sub-issue(s) to issue #${parent}...${NC}"

# Get parent issue ID
echo "Fetching parent issue #${parent}..."
parent_id=$(gh issue view "$parent" --json id -q .id 2>/dev/null || true)

if [ -z "$parent_id" ]; then
  echo -e "${RED}Error: Failed to get parent issue #${parent}${NC}" >&2
  echo "Make sure the issue exists and you have access to it." >&2
  exit 2
fi

# Build GraphQL mutation with aliases for each child
mutation="mutation {"
i=1
child_ids=()

for child in "${children[@]}"; do
  echo "Fetching child issue #${child}..."
  child_id=$(gh issue view "$child" --json id -q .id 2>/dev/null || true)
  
  if [ -z "$child_id" ]; then
    echo -e "${RED}Error: Failed to get child issue #${child}${NC}" >&2
    echo "Make sure the issue exists and you have access to it." >&2
    exit 3
  fi
  
  child_ids+=("$child_id")
  
  # Add mutation with unique alias
  mutation+="
  add$i: addSubIssue(input: {
    issueId: \"$parent_id\"
    subIssueId: \"$child_id\"
  }) {
    parentIssue {
      number
      title
    }
    subIssue {
      number
      title
    }
  }"
  ((i++))
done

mutation+="
}"

# Execute GraphQL mutation
echo -e "${YELLOW}Creating relationships...${NC}"
response=$(gh api graphql -f query="$mutation" 2>&1)

# Check for errors in response
if echo "$response" | grep -q '"errors"'; then
  echo -e "${RED}Error: GraphQL mutation failed${NC}" >&2
  echo "$response" | jq '.' >&2 || echo "$response" >&2
  exit 4
fi

# Parse and display results
echo -e "${GREEN}✓ Successfully added sub-issues:${NC}"
i=1
for child in "${children[@]}"; do
  result=$(echo "$response" | jq -r ".data.add$i.subIssue.number // empty" 2>/dev/null || echo "")
  if [ -n "$result" ]; then
    title=$(echo "$response" | jq -r ".data.add$i.subIssue.title // \"\"" 2>/dev/null || echo "")
    echo -e "  ${GREEN}✓${NC} Issue #${child} → Sub-issue of #${parent}"
    if [ -n "$title" ]; then
      echo "    \"$title\""
    fi
  else
    echo -e "  ${YELLOW}⚠${NC} Issue #${child} (may already be a sub-issue)"
  fi
  ((i++))
done

echo -e "\n${GREEN}Done!${NC} View issue #${parent} on GitHub to see the relationships."

