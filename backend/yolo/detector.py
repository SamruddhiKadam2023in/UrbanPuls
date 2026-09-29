"""
Vehicle detection with a YOLO model in ONNX format, run through OpenCV (no PyTorch needed at runtime).

model.onnx is the pre-trained YOLO11n model (COCO, 80 classes), exported with
    python train_yolo.py export-pretrained
Deciding whether a vehicle is parked *illegally* is done separately, from the no-parking areas
drawn on each camera (services/violations.py).
"""
import os
import cv2
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.onnx")
LABELS_PATH = os.path.join(os.path.dirname(__file__), "labels.txt")
INPUT_SIZE = 640

# Only these COCO classes matter for parking; people, animals etc. are ignored
VEHICLE_LABELS = {"car", "motorcycle", "bus", "truck", "bicycle"}

def load_labels():
    if os.path.exists(LABELS_PATH):
        with open(LABELS_PATH, encoding="utf-8") as f:
            return [l.strip() for l in f if l.strip()]
    return []

LABELS = load_labels()

_net = None

def model_available() -> bool:
    return os.path.exists(MODEL_PATH)

def get_net():
    global _net
    if _net is None and model_available():
        _net = cv2.dnn.readNetFromONNX(MODEL_PATH)
    return _net

def _letterbox(frame: np.ndarray):
    """Scale to fit 640x640 without distortion and pad the rest, as YOLO was trained."""
    h, w = frame.shape[:2]
    scale = min(INPUT_SIZE / w, INPUT_SIZE / h)
    nw, nh = int(round(w * scale)), int(round(h * scale))
    pad_x, pad_y = (INPUT_SIZE - nw) // 2, (INPUT_SIZE - nh) // 2
    canvas = np.full((INPUT_SIZE, INPUT_SIZE, 3), 114, dtype=np.uint8)
    canvas[pad_y:pad_y + nh, pad_x:pad_x + nw] = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_LINEAR)
    return canvas, scale, pad_x, pad_y

def run_detection(frame: np.ndarray, conf_threshold: float = 0.35, nms_threshold: float = 0.45) -> list:
    """Returns vehicles found in the image: [{label, confidence, bbox: [x1, y1, x2, y2] in image pixels}]."""
    net = get_net()
    if net is None:
        # Only reached when mock mode is allowed (never in production, see routes/detection.py)
        return _mock_detection(frame)

    h, w = frame.shape[:2]
    canvas, scale, pad_x, pad_y = _letterbox(frame)
    blob = cv2.dnn.blobFromImage(canvas, 1 / 255.0, (INPUT_SIZE, INPUT_SIZE), swapRB=True, crop=False)
    net.setInput(blob)
    # YOLO ONNX output: [1, 4 + num_classes, num_boxes] with centre-x, centre-y, width, height
    rows = net.forward()[0].T

    boxes, scores, class_ids = [], [], []
    for row in rows:
        class_scores = row[4:]
        class_id = int(np.argmax(class_scores))
        confidence = float(class_scores[class_id])
        if confidence < conf_threshold:
            continue
        label = LABELS[class_id] if class_id < len(LABELS) else f"class_{class_id}"
        if label not in VEHICLE_LABELS:
            continue
        cx, cy, bw, bh = row[:4]
        # Undo the letterbox: remove padding, then scale back to the original image
        x1 = (cx - bw / 2 - pad_x) / scale
        y1 = (cy - bh / 2 - pad_y) / scale
        boxes.append([int(x1), int(y1), int(bw / scale), int(bh / scale)])
        scores.append(confidence)
        class_ids.append(class_id)

    # Non-max suppression removes duplicate boxes around the same vehicle
    keep = cv2.dnn.NMSBoxes(boxes, scores, conf_threshold, nms_threshold)
    detections = []
    for i in np.array(keep).flatten():
        x, y, bw, bh = boxes[i]
        detections.append({
            "label": LABELS[class_ids[i]],
            "confidence": round(scores[i], 3),
            "bbox": [max(0, x), max(0, y), min(w, x + bw), min(h, y + bh)],
        })
    return detections

def _mock_detection(frame: np.ndarray):
    """Fixed sample output for development without a model file."""
    h, w = frame.shape[:2]
    return [
        {"label": "car", "confidence": 0.91, "bbox": [int(w * 0.10), int(h * 0.45), int(w * 0.40), int(h * 0.80)]},
        {"label": "motorcycle", "confidence": 0.78, "bbox": [int(w * 0.55), int(h * 0.55), int(w * 0.70), int(h * 0.85)]},
    ]
