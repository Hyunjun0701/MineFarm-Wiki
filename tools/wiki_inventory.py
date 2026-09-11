"""Read-only inventory for wiki artwork and public fictional resident profiles.

Reads the active MineValley server definitions and the local resource pack.
Does not connect to Minecraft, change server data, or infer live execution.
"""
from pathlib import Path
import argparse
import json
import re
import yaml

LIVE = None
PACK = None

def source_ref(path, root, label):
    return label + "/" + path.relative_to(root).as_posix()

def load(path):
    return yaml.safe_load(path.read_text(encoding="utf-8"))

def pack_path(ref, kind, ext):
    namespace, name = ref.split(":", 1)
    return PACK / namespace / kind / (name + ext)

def plain(value):
    return re.sub(r"§.", "", str(value or "")).strip()

def gui_model(node):
    if node.get("type") == "minecraft:select" and node.get("property") == "minecraft:display_context":
        for case in node.get("cases", []):
            values = case["when"] if isinstance(case["when"], list) else [case["when"]]
            if "gui" in values:
                return gui_model(case["model"])
    return node.get("model") if isinstance(node.get("model"), str) else None

def inventory():
    cases = json.loads((PACK / "minecraft/items/paper.json").read_text(encoding="utf-8"))["model"]["cases"]
    models = {}
    for case in cases:
        for key in case["when"] if isinstance(case["when"], list) else [case["when"]]:
            models[key] = gui_model(case["model"])
    items = []
    for file in sorted((LIVE / "MineFarmContentPlugin/content/items").rglob("*.yml")):
        item = load(file)
        model_ref = models.get(item.get("model_id"))
        texture = None
        if model_ref:
            model_file = pack_path(model_ref, "models", ".json")
            if model_file.exists():
                model = json.loads(model_file.read_text(encoding="utf-8"))
                layer = model.get("textures", {}).get("layer0")
                if layer and not layer.startswith("#"):
                    candidate = pack_path(layer, "textures", ".png")
                    if candidate.exists():
                        texture = candidate
        items.append({"id": item["id"], "name": plain(item.get("display_name")),
                      "family": item.get("family"), "model": item.get("model_id"),
                      "definition": source_ref(file, LIVE.parent, "SERVER_ROOT"),
                      "source": source_ref(texture, PACK.parent, "RESOURCE_PACK_ROOT") if texture else None,
                      "target": "assets/images/items/" + item["id"].replace(":", "-").replace("/", "-") + ".png"})
    font = json.loads((PACK / "minefarm/font/hud_free100.json").read_text(encoding="utf-8"))
    portraits = {}
    for provider in font["providers"]:
        chars = "".join(provider.get("chars", []))
        if provider.get("type") == "bitmap" and len(chars) == 1 and "/npc/" in provider.get("file", ""):
            portraits[chars] = pack_path(provider["file"].removesuffix(".png"), "textures", ".png")
    residents = []
    npcs_file = LIVE / "MineFarmNpcPlugin/data/npcs.yml"
    for npc_id, npc in load(npcs_file)["npcs"].items():
        if npc.get("category") != "WORLD" or not npc.get("enabled"):
            continue
        identity = npc["identity"]
        portrait = portraits.get(npc.get("visual", {}).get("portrait-id"))
        slug = npc_id.replace("_", "-")
        residents.append({"id": npc_id, "slug": slug, "name": identity["display-name"],
                          "role": identity.get("role", "마을 주민"), "region": identity.get("region-id", ""),
                          "description": identity.get("description", []), "personality": identity.get("personality", ""),
                          "source": source_ref(portrait, PACK.parent, "RESOURCE_PACK_ROOT") if portrait and portrait.exists() else None,
                          "target": "assets/images/residents/" + slug + ".png"})
    return {"server": "SERVER_ROOT", "resourcePack": "RESOURCE_PACK_ROOT", "items": items, "residents": residents}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server-root", type=Path, required=True)
    parser.add_argument("--resource-pack-root", type=Path, required=True)
    args = parser.parse_args()
    LIVE = args.server_root.resolve() / "plugins"
    PACK = args.resource_pack_root.resolve() / "assets"
    print(json.dumps(inventory(), ensure_ascii=False))
