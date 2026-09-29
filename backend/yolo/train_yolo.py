"""
YOLO model tools for UrbanPuls
=========================
The app ships with the pre-trained YOLO11n model (80 COCO classes) as yolo/model.onnx. It detects
vehicles; whether one is parked illegally comes from the no-parking areas drawn on each camera.

Run these in a separate environment, not the app's venv (PyTorch is large and only needed here):
    python -m venv C:/tpms-yolo && C:/tpms-yolo/Scripts/pip install ultralytics onnx onnxslim

    python train_yolo.py export-pretrained   # re-create model.onnx + labels.txt from YOLO11n
    python train_yolo.py train               # train on your own labelled images (dataset/data.yaml)
    python train_yolo.py export <weights.pt> # use your trained model in the app

YOLO11 models are released by Ultralytics under the AGPL-3.0 licence.
"""

from ultralytics import YOLO
import os

# ── Config ──────────────────────────────────────────────────────────────────
DATA_YAML   = "dataset/data.yaml"   # path to your Roboflow export
MODEL_SIZE  = "yolo11n.pt"          # nano = fastest, yolo11s.pt for better accuracy
EPOCHS      = 50
IMG_SIZE    = 640
BATCH_SIZE  = 16
PROJECT     = "tpms_detection"
RUN_NAME    = "parking_v1"

# ── Train ────────────────────────────────────────────────────────────────────
def train():
    model = YOLO(MODEL_SIZE)
    results = model.train(
        data=DATA_YAML,
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=BATCH_SIZE,
        project=PROJECT,
        name=RUN_NAME,
        patience=10,        # early stopping
        save=True,
        device="cpu",       # change to 0 for GPU
        augment=True,
        flipud=0.0,
        fliplr=0.5,
        mosaic=1.0,
        mixup=0.1,
    )
    print(f"\n✅ Training complete. Best model: {results.save_dir}/weights/best.pt")
    return results

# ── Export to ONNX for FastAPI deployment ────────────────────────────────────
def export_onnx(weights_path: str):
    model = YOLO(weights_path)
    model.export(format="onnx", imgsz=IMG_SIZE, dynamic=False, simplify=True)
    onnx_path = weights_path.replace(".pt", ".onnx")
    # Copy to backend/yolo/
    import shutil
    dest = os.path.join("..", "backend", "yolo", "model.onnx")
    shutil.copy(onnx_path, dest)
    print(f"✅ ONNX exported → {dest}")

# ── Validate ─────────────────────────────────────────────────────────────────
def validate(weights_path: str):
    model = YOLO(weights_path)
    metrics = model.val(data=DATA_YAML)
    print(f"mAP50: {metrics.box.map50:.3f}")
    print(f"mAP50-95: {metrics.box.map:.3f}")

# ── Quick test on a single image ─────────────────────────────────────────────
def test_image(weights_path: str, image_path: str):
    model = YOLO(weights_path)
    results = model(image_path, conf=0.4)
    for r in results:
        for box in r.boxes:
            label = model.names[int(box.cls)]
            conf  = float(box.conf)
            print(f"  {label}: {conf:.2f}")
    results[0].save(filename="test_result.jpg")
    print("✅ Result saved → test_result.jpg")

# ── data.yaml template (create this file in dataset/) ───────────────────────
YAML_TEMPLATE = """
# dataset/data.yaml — fill in paths from your Roboflow export

path: ./dataset
train: images/train
val:   images/val
test:  images/test

nc: 4   # number of classes
names:
  - car
  - truck
  - illegal_parking
  - road_blockage
"""

if __name__ == "__main__":
    import sys

    cmd = sys.argv[1] if len(sys.argv) > 1 else "train"

    if cmd == "train":
        if not os.path.exists(DATA_YAML):
            os.makedirs("dataset", exist_ok=True)
            with open(DATA_YAML, "w") as f:
                f.write(YAML_TEMPLATE.strip())
            print(f"📄 Created template: {DATA_YAML}")
            print("   → Add your dataset images/labels and re-run.")
        else:
            results = train()
            best = f"{PROJECT}/{RUN_NAME}/weights/best.pt"
            export_onnx(best)

    elif cmd == "export-pretrained":
        model = YOLO("yolo11n.pt")
        onnx_path = model.export(format="onnx", imgsz=IMG_SIZE, opset=12, simplify=True, dynamic=False)
        import shutil
        here = os.path.dirname(os.path.abspath(__file__))
        shutil.copy(onnx_path, os.path.join(here, "model.onnx"))
        with open(os.path.join(here, "labels.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(model.names[i] for i in range(len(model.names))) + "\n")
        print("✅ model.onnx and labels.txt written to", here)

    elif cmd == "export":
        weights = sys.argv[2] if len(sys.argv) > 2 else f"{PROJECT}/{RUN_NAME}/weights/best.pt"
        export_onnx(weights)

    elif cmd == "test":
        weights = sys.argv[2]
        image   = sys.argv[3]
        test_image(weights, image)

    elif cmd == "validate":
        weights = sys.argv[2]
        validate(weights)

    else:
        print("Usage: python train_yolo.py [export-pretrained|train|export|test|validate]")