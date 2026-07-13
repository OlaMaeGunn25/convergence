import os
import json
import re
from collections import Counter

brain_dir = 'C:/Users/dahao/.gemini/antigravity-ide/brain'
conversations_data = []

# Regex patterns
correction_keywords = [
    r'\bno\b', r'\bnot\b', r'\bwrong\b', r'\bincorrect\b', r'\binstead\b',
    r'\bactually\b', r'\bredo\b', r'\brepeat\b', r'\bchange\b', r'\bfix\b',
    r'\berror\b', r'\bwhere is\b', r'\bwhere are\b', r'\bcannot\b', r'\bcan\'t\b',
    r'\bfailed\b', r'\bdid not\b', r'\bdidn\'t\b'
]
correction_regex = re.compile('|'.join(correction_keywords), re.IGNORECASE)

for conv_id in os.listdir(brain_dir):
    conv_path = os.path.join(brain_dir, conv_id)
    if not os.path.isdir(conv_path):
        continue
    
    logs_dir = os.path.join(conv_path, '.system_generated', 'logs')
    transcript_path = os.path.join(logs_dir, 'transcript_full.jsonl')
    
    if not os.path.exists(transcript_path):
        transcript_path = os.path.join(logs_dir, 'transcript.jsonl')
        if not os.path.exists(transcript_path):
            continue
            
    user_prompts = []
    corrections = []
    tool_calls_count = Counter()
    command_failures = 0
    total_commands = 0
    edited_files = []
    
    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip():
                    continue
                step = json.loads(line)
                step_type = step.get('type')
                content = step.get('content')
                tool_calls = step.get('tool_calls', [])
                
                # Check tool calls
                if tool_calls:
                    for tc in tool_calls:
                        method = tc.get('method')
                        if method:
                            tool_calls_count[method] += 1
                            if method == 'run_command':
                                total_commands += 1
                                # Check if subsequent steps indicate error
                                
                # Check for command execution outputs that might be errors
                if step_type == 'COMMAND_OUTPUT' or step_type == 'TERMINAL_OUTPUT':
                    if content and ('exit code' in content or 'error' in content.lower() or 'failed' in content.lower()):
                        command_failures += 1
                
                # Check for edits
                if step_type in ['WRITE_FILE', 'REPLACE_FILE_CONTENT', 'MULTI_REPLACE_FILE_CONTENT']:
                    # Extract file path from tool calls if present
                    for tc in tool_calls:
                        args = tc.get('arguments', {})
                        target = args.get('TargetFile') or args.get('AbsolutePath')
                        if target:
                            edited_files.append(os.path.basename(target))
                
                if step_type == 'USER_INPUT' and content:
                    user_prompts.append(content)
                    if correction_regex.search(content):
                        corrections.append(content)
                        
    except Exception as e:
        continue
        
    if user_prompts:
        conversations_data.append({
            'id': conv_id,
            'turns': len(user_prompts),
            'prompts': user_prompts,
            'corrections': corrections,
            'tool_calls': dict(tool_calls_count),
            'command_failures': command_failures,
            'total_commands': total_commands,
            'edited_files': list(set(edited_files))
        })

# Save detailed analysis to JSON
with open('deep_analysis.json', 'w', encoding='utf-8') as f:
    json.dump(conversations_data, f, indent=2)

print(f"Deep analyzed {len(conversations_data)} conversations.")
