from PIL import Image,ImageOps,ImageDraw
from pathlib import Path
p=Path(__file__).parent
for w in (320,375,390):
    files=sorted((p/'captures').glob(f'*-{w}.png'))
    sheet=Image.new('RGB',(1200,900),'#253239')
    for i,f in enumerate(files):
        im=Image.open(f).convert('RGB')
        im.thumbnail((190,265))
        x=(i%6)*200;y=(i//6)*300
        sheet.paste(im,(x,y+25))
        ImageDraw.Draw(sheet).text((x+3,y+3),f.stem[:24],fill='white')
    sheet.save(p/'captures'/f'planche-{w}.jpg')
