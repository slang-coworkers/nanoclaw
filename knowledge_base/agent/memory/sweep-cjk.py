import sys,glob,os,unicodedata
root=sys.argv[1]
hits=[]
for f in sorted(glob.glob(os.path.join(root,'*.md'))):
    s=open(f,encoding='utf-8').read()
    bad=[(i,c) for i,c in enumerate(s) if unicodedata.category(c)=='Lo']
    if bad: hits.append((os.path.basename(f),len(bad),bad[0][1]))
print('files=%d  files_with_Lo=%d'%(len(glob.glob(os.path.join(root,'*.md'))),len(hits)))
for h in hits[:10]: print('   ',h)
sys.exit(1 if hits else 0)
