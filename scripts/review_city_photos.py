import json
from collections import defaultdict
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(r"D:\Aliados exteriores\Fichas_HERCAS_2026")
app=Path(r"D:\Aliados exteriores\catalogo_hercas_app")
records=json.loads((root/"avance.json").read_text(encoding="utf-8"))["registros"]
by_city=defaultdict(list)
for r in records:
    if r["estado"]=="completo" and r.get("foto_HERCAS") and Path(r["foto_HERCAS"]).is_file():
        by_city[r["ciudad"]].append(r)
selected={}
for city,items in by_city.items():
    ranked=[]
    for r in items:
        with Image.open(r["foto_HERCAS"]) as im:
            ratio=im.width/im.height
            ranked.append((abs(ratio-1.78), -im.width*im.height, r))
    selected[city]=min(ranked, key=lambda x:(x[0],x[1]))[2]
cities=sorted(selected)
w,h=360,235
sheet=Image.new("RGB",(w*3,h*6),"white")
draw=ImageDraw.Draw(sheet)
for idx,city in enumerate(cities):
    r=selected[city]
    with Image.open(r["foto_HERCAS"]) as im:
        im=im.convert("RGB")
        im.thumbnail((w-10,h-42))
        x=(idx%3)*w+(w-im.width)//2
        y=(idx//3)*h+5
        sheet.paste(im,(x,y))
    draw.text(((idx%3)*w+10,(idx//3)*h+h-32),f"{city} | {r['codigo_hercas']}",fill="#10213b")
out=app/"_trabajo_fondos"
out.mkdir(exist_ok=True)
sheet.save(out/"contacto_ciudades.jpg",quality=85)
(out/"seleccion.json").write_text(json.dumps({c:{"codigo":r["codigo_hercas"],"foto":r["foto_HERCAS"]} for c,r in selected.items()},ensure_ascii=False,indent=2),encoding="utf-8")
print(out/"contacto_ciudades.jpg")