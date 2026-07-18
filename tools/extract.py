import sys, re, html
src = open(sys.argv[1], encoding='utf-8', errors='replace').read()
src = re.sub(r'(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>', ' ', src)
src = re.sub(r'(?is)<!--.*?-->', ' ', src)
src = re.sub(r'(?i)<br\s*/?>', '\n', src)
src = re.sub(r'(?i)</(p|div|li|tr|h[1-6]|section|td|option)>', '\n', src)
txt = re.sub(r'(?s)<[^>]+>', ' ', src)
txt = html.unescape(txt)
txt = re.sub(r'[ \t\xa0]+', ' ', txt)
lines = [l.strip() for l in txt.split('\n')]
out = [l for l in lines if l]
print('\n'.join(out))
