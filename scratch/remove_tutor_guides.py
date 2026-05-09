
import os
import re

directory = '/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/private_courses'
pattern = re.compile(r'\s*<!-- Tutor Guide \(Hidden\) -->\s*<section id="tutor-guide".*?</section>', re.DOTALL)

def remove_tutor_guide(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Also handle cases where the comment might not exist
    simple_pattern = re.compile(r'\s*<section id="tutor-guide".*?</section>', re.DOTALL)
    
    new_content = pattern.sub('', content)
    if new_content == content:
        new_content = simple_pattern.sub('', content)
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

if __name__ == "__main__":
    count = 0
    files = [f for f in os.listdir(directory) if f.endswith('.html')]
    for filename in files:
        file_path = os.path.join(directory, filename)
        if remove_tutor_guide(file_path):
            count += 1
            print(f"Cleaned: {filename}")
    
    print(f"\nDone! Total files cleaned: {count}")
