import os
import cv2
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.onnx")
LABELS_PATH = os.path.join(os.path.dirname(__file__), "labels.txt")

# Only these labels count as a parking violation. A plain "car" is not a violation.
VIOLATION_LABELS = {"illegal_parking"}

def load_labels():
    if os.path.exists(LABELS_PATH):
        with open(LABELS_PATH) as f:
            return [l.strip() for l in f if l.strip()]
    return ["car", "truck", "illegal_parking", "road_blockage"]

LABELS = load_labels()

_net = None

def model_available() -> bool:
    return os.path.exists(MODEL_PATH)

def get_net():
    global _net
    if _net is None and model_available():
        _net = cv2.dnn.readNetFromONNX(MODEL_PATH)
    return _net

def run_detection(frame: np.ndarray, conf_threshold: float = 0.4, nms_threshold: float = 0.45) -> list:
    net = get_net()
    if net is None:
        # Only reached when mock mode is allowed (never in production, see routes/detection.py)
        return _mock_detection()

    h, w = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(frame, 1 / 255.0, (640, 640), swapRB=True, crop=False)
    net.setInput(blob)
    # YOLO ONNX output shape: [1, 4 + num_classes, num_boxes]
    rows = net.forward()[0].T

    boxes, scores, class_ids = [], [], []
    for row in rows:
        class_scores = row[4:]
        class_id = int(np.argmax(class_scores))
        confidence = float(class_scores[class_id])
        if confidence < conf_threshold:
            continue
        cx, cy, bw, bh = row[:4]
        x1 = int((cx - bw / 2) * w / 640)
        y1 = int((cy - bh / 2) * h / 640)
        boxes.append([x1, y1, int(bw * w / 640), int(bh * h / 640)])
        scores.append(confidence)
        class_ids.append(class_id)

    # Non-max suppression removes duplicate boxes around the same object
    keep = cv2.dnn.NMSBoxes(boxes, scores, conf_threshold, nms_threshold)
    detections = []
    for i in np.array(keep).flatten():
        x, y, bw, bh = boxes[i]
        cid = class_ids[i]
        detections.append({
            "label": LABELS[cid] if cid < len(LABELS) else f"class_{cid}",
            "confidence": round(scores[i], 3),
            "bbox": [x, y, x + bw, y + bh],
        })
    return detections

def _mock_detection():
    """Fixed sample output for development without a trained model."""
    return [
        {"label": "car", "confidence": 0.91, "bbox": [100, 150, 300, 280]},
        {"label": "illegal_parking", "confidence": 0.78, "bbox": [320, 200, 500, 350]},
    ]
