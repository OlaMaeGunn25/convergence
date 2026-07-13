import json
from collections import Counter

with open('deep_analysis.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

total_turns = sum(c['turns'] for c in data)
total_corrections = sum(len(c['corrections']) for c in data)
total_commands = sum(c['total_commands'] for c in data)
total_failures = sum(c['command_failures'] for c in data)

all_tools = Counter()
all_edited_files = Counter()
all_correction_phrases = []

for c in data:
    for tool, count in c['tool_calls'].items():
        all_tools[tool] += count
    for f in c['edited_files']:
        all_edited_files[f] += 1
    for corr in c['corrections']:
        cleaned = corr.split('<ADDITIONAL_METADATA>')[0].strip()
        # Remove XML tags
        cleaned = cleaned.replace('<USER_REQUEST>', '').replace('</USER_REQUEST>', '').strip()
        if len(cleaned) > 5 and len(cleaned) < 300:
            all_correction_phrases.append(cleaned)

print("=== GLOBAL STATISTICS ===")
print(f"Total Conversations: {len(data)}")
print(f"Total User Turns: {total_turns}")
print(f"Average Turns per Conversation: {total_turns / len(data):.2f}")
print(f"Total User Corrections: {total_corrections} ({total_corrections / total_turns * 100:.1f}% of all turns)")
print(f"Total Terminal Commands Run: {total_commands}")
print(f"Total Command Failures/Errors Detected: {total_failures}")

print("\n=== MOST POPULAR TOOLS USED BY AGENT ===")
for tool, count in all_tools.most_common(10):
    print(f"  {tool}: {count}")

print("\n=== MOST FREQUENTLY EDITED FILES ===")
for f, count in all_edited_files.most_common(10):
    print(f"  {f}: {count} conversations")

print("\n=== SAMPLE USER CORRECTIONS (EXACT QUOTES) ===")
# Let's print unique corrections
unique_corrections = list(dict.fromkeys(all_correction_phrases))
for i, phrase in enumerate(unique_corrections[:30]):
    print(f"  {i+1}. {phrase}")
