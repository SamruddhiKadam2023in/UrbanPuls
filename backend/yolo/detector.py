import cv2
import numpy as np
import os

# ─── Model paths ────────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.onnx")
LABELS_PATH = os.path.join(os.path.dirname(__file__), "labels.txt")

# ─── Load labels ────────────────────────────────────────────────────────────
def load_labels():
    if os.path.exists(LABELS_PATH):
        with open(LABELS_PATH) as f:
            return [l.strip() for l in f.readlines()]
    # Default COCO classes subset relevant to parking
    return ["person","bicycle","car","motorcycle","bus","truck",
            "traffic light","stop sign","parking meter","illegal_parking"]

LABELS = load_labels()

# ─── Load model (lazy, once) ─────────────────────────────────────────────────
_net = None

def get_net():
    global _net
    if _net is None:
        if not os.path.exists(MODEL_PATH):
            return None
        _net = cv2.dnn.readNetFromONNX(MODEL_PATH)
    return _net

# ─── Run detection ────────────────────────────────────────────────────────────
def run_detection(frame: np.ndarray, conf_threshold: float = 0.4) -> list:
    net = get_net()
    if net is None:
        # Model not loaded — return mock detection for dev/testing
        return _mock_detection()

    h, w = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(frame, 1/255.0, (640, 640), swapRB=True, crop=False)
    net.setInput(blob)
    outputs = net.forward()

    detections = []
    # YOLOv11 / YOLO ONNX output shape: [1, num_classes+4, num_boxes]
    output = outputs[0]  # shape (1, 84, 8400) for COCO
    output = output.transpose((0, 2, 1))  # → (1, 8400, 84)
    rows = output[0]

    for row in rows:
        scores = row[4:]
        class_id = int(np.argmax(scores))
        confidence = float(scores[class_id])
        if confidence < conf_threshold:
            continue

        cx, cy, bw, bh = row[0], row[1], row[2], row[3]
        x1 = int((cx - bw / 2) * w / 640)
        y1 = int((cy - bh / 2) * h / 640)
        x2 = int((cx + bw / 2) * w / 640)
        y2 = int((cy + bh / 2) * h / 640)

        label = LABELS[class_id] if class_id < len(LABELS) else f"class_{class_id}"
        detections.append({
            "label": label,
            "confidence": round(confidence, 3),
            "bbox": [x1, y1, x2, y2]
        })

    return detections

def _mock_detection():
    """Returns mock detections when model is not loaded (dev mode)."""
    return [
        {"label": "car", "confidence": 0.91, "bbox": [100, 150, 300, 280]},
        {"label": "illegal_parking", "confidence": 0.78, "bbox": [320, 200, 500, 350]}
    ]

def draw_detections(frame: np.ndarray, detections: list) -> np.ndarray:
    for d in detections:
        x1, y1, x2, y2 = d["bbox"]
        color = (0, 0, 255) if "illegal" in d["label"] else (0, 255, 0)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        label_text = f"{d['label']} {d['confidence']:.2f}"
        cv2.putText(frame, label_text, (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
    return frame
