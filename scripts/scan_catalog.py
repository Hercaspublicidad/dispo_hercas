import argparse, csv, json, re, unicodedata, uuid
from pathlib import Path
from difflib import SequenceMatcher
from datetime import datetime, timezone

def norm(value):
    value = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]+", " ", value).strip()

def availability(text):
    t = norm(text)
    if re.search(r"\b(NO DISPONIBLES?|NO DISPONIBILIDAD|OCUPAD[AO]S?|RESERVAD[AO]S?|VENDID[AO]S?)\b", t):
        return "No disponible"
    if re.search(r"\b(DISPONIBLE|LIBRE|VACANTE)\b", t):
        return "Disponible"
    return None

def inferred_status(explicit, full_snapshot, extension):
    if explicit:
        return explicit
    return "Disponible" if full_snapshot and extension in (".pptx", ".pdf") else None

def xlsx_items(file):
    from openpyxl import load_workbook
    wb = load_workbook(file, read_only=True, data_only=True)
    out = []
    for ws in wb:
        rows = list(ws.iter_rows(values_only=True))
        header_idx = next((i for i, row in enumerate(rows[:25]) if sum(bool(re.search(r"CODIGO|UBICACION|DIRECCION|CIUDAD|DISPONIBILIDAD|ESTADO", norm(c))) for c in row if c is not None) >= 2), None)
        if header_idx is None:
            continue
        headers = [norm(c) for c in rows[header_idx]]
        def val(row, *keys):
            for key in keys:
                for i, h in enumerate(headers):
                    if key in h and i < len(row) and row[i] is not None:
                        return str(row[i]).strip()
            return ""
        for i, row in enumerate(rows[header_idx+1:], header_idx+2):
            code = val(row, "CODIGO", "REFERENCIA", "ID VALLA")
            city = val(row, "CIUDAD", "MUNICIPIO")
            address = val(row, "UBICACION", "DIRECCION", "LUGAR")
            status = val(row, "DISPONIBILIDAD", "ESTADO", "CUPO")
            if code or address:
                out.append(dict(ref=f"{ws.title}!{i}", code=code, city=city, address=address, status=status, text=" | ".join(str(c) for c in row if c is not None)[:2500]))
    return out

def csv_items(file):
    with open(file, encoding="utf-8-sig", newline="") as fh:
        sample = fh.read(4096); fh.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        return [dict(ref=f"fila {i}", code=r.get("codigo", r.get("Código", "")), city=r.get("ciudad", r.get("Ciudad", "")), address=r.get("ubicacion", r.get("Ubicación", r.get("direccion", ""))), status=r.get("disponibilidad", r.get("Disponibilidad", r.get("estado", ""))), text=" | ".join(str(v) for v in r.values())) for i, r in enumerate(csv.DictReader(fh, dialect=dialect), 2)]

def pptx_items(file):
    from pptx import Presentation
    out = []
    for i, slide in enumerate(Presentation(file).slides, 1):
        text = "\n".join(s.text for s in slide.shapes if s.has_text_frame)
        if text.strip():
            out.append(dict(ref=f"diapositiva {i}", code="", city="", address="", status="", text=text[:5000]))
    return out

def pdf_items(file):
    from pypdf import PdfReader
    out = []
    for i, page in enumerate(PdfReader(file).pages, 1):
        text = page.extract_text() or ""
        if text.strip():
            out.append(dict(ref=f"página {i}", code="", city="", address="", status="", text=text[:5000]))
    return out

def match(item, candidates):
    code = norm(item["code"])
    city = norm(item["city"])
    address = norm(item["address"])
    text = norm(item["text"])
    scored = []
    for r in candidates:
        rc = norm(r["codigo_hercas"])
        provider_code = norm(r.get("codigo_proveedor"))
        loc = norm(r.get("ubicacion"))
        code_in_text = any(token and len(token) >= 4 and re.search(r"(?<![A-Z0-9])" + re.escape(token) + r"(?![A-Z0-9])", text) for token in (rc, provider_code))
        if (code and (code == rc or code == provider_code)) or code_in_text:
            score = 1.0
        elif loc and len(loc) >= 12 and loc in text:
            score = .94
        elif address and loc:
            score = SequenceMatcher(None, address, loc).ratio()
            if city and city == norm(r.get("ciudad")): score += .1
            score = min(score, .92)
        else:
            continue
        if score >= .55: scored.append((round(score, 3), r["codigo_hercas"], r.get("ubicacion", "")))
    scored.sort(reverse=True)
    return [dict(score=s, codigo=c, ubicacion=u) for s,c,u in scored[:3]]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True); ap.add_argument("--provider", required=True); ap.add_argument("--root", required=True)
    ap.add_argument("--full-snapshot", action="store_true")
    a = ap.parse_args(); file = Path(a.file); root = Path(a.root)
    readers = {".xlsx":xlsx_items, ".csv":csv_items, ".pptx":pptx_items, ".pdf":pdf_items}
    items = readers[file.suffix.lower()](file)
    records = json.loads((root/"avance.json").read_text(encoding="utf-8"))["registros"]
    candidates = [r for r in records if norm(r.get("proveedor")) == norm(a.provider) and r.get("estado") != "duplicado_confirmado"]
    proposals = []
    for item in items:
        hits = match(item, candidates)
        status = inferred_status(availability(item["status"]) or availability(item["text"]), a.full_snapshot, file.suffix.lower())
        unique = bool(hits and hits[0]["score"] >= .9 and (len(hits) == 1 or hits[0]["score"]-hits[1]["score"] >= .08))
        if hits or item["code"] or item["address"]:
            proposals.append(dict(ref=item["ref"], code=item["code"], city=item["city"], address=item["address"], status=status, matches=hits, action=("actualizar" if unique and status else "nueva_o_revision"), selected=unique and bool(status), excerpt=item["text"][:500]))
    stage_id = uuid.uuid4().hex
    stage = dict(id=stage_id, file=str(file), provider=a.provider, scannedAt=datetime.now(timezone.utc).isoformat(), fullSnapshot=a.full_snapshot, scanned=len(items), proposals=proposals)
    stage_dir = root/"_catalogos_entrantes"/"analisis"; stage_dir.mkdir(parents=True, exist_ok=True)
    (stage_dir/f"{stage_id}.json").write_text(json.dumps(stage, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(dict(stageId=stage_id, file=str(file), provider=a.provider, scanned=len(items), proposals=proposals, note="La disponibilidad solo se aplica a coincidencias únicas y explícitas. Los registros nuevos requieren validación y fotografía."), ensure_ascii=False))

if __name__ == "__main__": main()
