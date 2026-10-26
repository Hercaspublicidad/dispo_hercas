"""Reconcile source catalogues against the original 549 and new fiche manifests."""
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path


def digest(path):
    sha = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            sha.update(chunk)
    return sha.hexdigest()


def main(root):
    original = json.loads((root / "avance.json").read_text(encoding="utf-8"))
    inventory = json.loads((root / "_nuevos_medios" / "inventario_fuentes.json").read_text(encoding="utf-8"))
    old_sources = {}
    for name in {row["archivo_fuente"] for row in original["registros"]}:
        file = Path(name)
        if file.is_file():
            old_sources[digest(file)] = str(file)
    fiches = defaultdict(list)
    for file in root.rglob("origen_y_control.json"):
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
            if Path(data.get("fuente", "")).is_file():
                fiches[digest(Path(data["fuente"]))].append(data["codigo"])
        except (OSError, ValueError):
            continue
    first_for_sha = {}
    entries = []
    for source in inventory["sources"]:
        sha = source["sha256"]
        if source.get("error"):
            status = "requiere_conversion_o_reparacion"
        elif sha in first_for_sha:
            status = "copia_duplicada"
        elif sha in old_sources:
            status = "archivo_ya_en_549"
        else:
            status = "pendiente_desglose"
        entries.append({
            "archivo": source["path"], "relativo": source["relative"],
            "area": source["area"], "grupo": source["source_group"],
            "sha256": sha, "paginas": source.get("pages"), "estado": status,
            "duplicado_de": first_for_sha.get(sha),
            "archivo_en_549": old_sources.get(sha),
            "fichas_producidas": sorted(set(fiches.get(sha, []))),
            "observacion": source.get("error", ""),
        })
        first_for_sha.setdefault(sha, source["path"])
    report = {
        "raiz_fuentes": inventory["root"],
        "total_archivos": len(entries),
        "archivos_unicos": len(first_for_sha),
        "total_fichas_nuevas": sum(len(x) for x in fiches.values()),
        "fuentes": entries,
    }
    output = root / "_nuevos_medios" / "control_fuentes.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    from collections import Counter
    print(json.dumps({"output": str(output), "estados": Counter(x["estado"] for x in entries), "fichas": report["total_fichas_nuevas"]}, ensure_ascii=False))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
