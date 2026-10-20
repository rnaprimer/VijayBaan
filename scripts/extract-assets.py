from PIL import Image, ImageDraw, ImageFont
from collections import deque
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]/'public/assets/game'
(root/'originals').mkdir(parents=True,exist_ok=True)
shutil.copy('/Users/debashismohanty/Downloads/Indian Mythology Game Asset Sprite Sheet.png',root/'originals/sprite-sheet.png')
(root/'environment').mkdir(exist_ok=True)
shutil.copy('/Users/debashismohanty/Downloads/Mythic Temple River Landscape.png',root/'environment/background.png')
sheet=Image.open(root/'originals/sprite-sheet.png').convert('RGBA')
regions={'characters/rama':(14,24,461,486),'weapons/bow':(476,18,613,433),'weapons/arrow-standard':(608,91,851,153),'weapons/arrow-special':(608,200,849,321),'structures/wood-long':(19,524,416,607),'structures/wood-column':(453,451,526,650),'structures/wood-short':(557,535,722,613),'structures/stone-square':(751,483,897,630),'structures/stone-wide':(925,516,1150,642),'structures/stone-column':(1188,447,1301,650),'structures/crate':(1342,471,1512,650),'powerups/agni':(18,641,242,983),'powerups/vajra':(253,643,481,984),'powerups/volley':(505,650,780,987),'decorations/banner':(802,700,962,984),'decorations/flag':(984,699,1119,990),'decorations/om':(1112,689,1258,975),'decorations/platform':(1255,761,1529,963)}
for row in range(2):
 for col in range(5):
  regions[f'characters/ravana-heads/{row*5+col+1:02}']=(870+col*129,41+row*203,999+col*129,222+row*203)
for name,box in regions.items():
 im=sheet.crop(box); w,h=im.size; px=im.load(); seen=set(); q=deque()
 # Only remove green reachable from the exterior. Internal jewels and painted details survive.
 def green(p):
  r,g,b,a=p; return g>180 and g>r*2.1 and g>b*2.1
 for x in range(w):
  for y in (0,h-1):
   if green(px[x,y]): q.append((x,y));seen.add((x,y))
 for y in range(h):
  for x in (0,w-1):
   if green(px[x,y]):q.append((x,y));seen.add((x,y))
 while q:
  x,y=q.popleft()
  for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
   if 0<=nx<w and 0<=ny<h and (nx,ny) not in seen and green(px[nx,ny]):seen.add((nx,ny));q.append((nx,ny))
 # Remove large enclosed chroma pockets (bow string encloses the background).
 checked=set(seen)
 for yy in range(h):
  for xx in range(w):
   if (xx,yy) in checked or not green(px[xx,yy]):continue
   comp={(xx,yy)};todo=[(xx,yy)];checked.add((xx,yy))
   while todo:
    ax,ay=todo.pop()
    for nx,ny in ((ax-1,ay),(ax+1,ay),(ax,ay-1),(ax,ay+1)):
     if 0<=nx<w and 0<=ny<h and (nx,ny) not in checked and green(px[nx,ny]):checked.add((nx,ny));comp.add((nx,ny));todo.append((nx,ny))
   if len(comp)>100 and not name.startswith('characters/ravana') and name!='decorations/platform':seen.update(comp)
 for x,y in seen:px[x,y]=(0,0,0,0)
 # Decontaminate only fringe pixels adjacent to the exterior mask.
 for y in range(h):
  for x in range(w):
   if (x,y) in seen:continue
   r,g,b,a=px[x,y]
   if any((x+dx,y+dy) in seen for dx,dy in ((-1,0),(1,0),(0,-1),(0,1))) and g>max(r,b)*1.25:
    px[x,y]=(r,min(g,max(r,b)+18),b,a)
 # Discard disconnected crop crumbs while keeping intentional magic particles.
 visited=set()
 for yy in range(h):
  for xx in range(w):
   if (xx,yy) in visited or px[xx,yy][3]==0:continue
   comp={(xx,yy)};todo=[(xx,yy)];visited.add((xx,yy))
   while todo:
    ax,ay=todo.pop()
    for nx,ny in ((ax-1,ay),(ax+1,ay),(ax,ay-1),(ax,ay+1)):
     if 0<=nx<w and 0<=ny<h and (nx,ny) not in visited and px[nx,ny][3]>0:visited.add((nx,ny));comp.add((nx,ny));todo.append((nx,ny))
   if len(comp)<24:
    for cx,cy in comp:px[cx,cy]=(0,0,0,0)
 bounds=im.getbbox();im=im.crop(bounds) if bounds else im
 path=root/(name+'.png');path.parent.mkdir(parents=True,exist_ok=True);im.save(path)
preview=Image.new('RGB',(1200,((len(regions)+5)//6)*230),'#eee5d0');d=ImageDraw.Draw(preview)
for i,name in enumerate(regions):
 x=(i%6)*200;y=(i//6)*230
 for cy in range(y,y+200,20):
  for cx in range(x,x+200,20):d.rectangle((cx,cy,cx+19,cy+19),fill=('#333039' if ((cx-x)//20+(cy-y)//20)%2 else '#ece3d1'))
 im=Image.open(root/(name+'.png'));im.thumbnail((184,185));preview.paste(im,(x+(200-im.width)//2,y+(200-im.height)//2),im)
 d.text((x+5,y+205),name.split('/')[-1],fill='#2e2721')
preview.save(root/'asset-preview.png')
print('Extracted',len(regions),'sprites',sheet.size)
