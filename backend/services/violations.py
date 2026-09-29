"""
Decides which detected vehicles are parked illegally: those standing inside a camera's no-parking areas.

Areas are polygons in normalised image coordinates (0..1), so they still fit when a camera sends
images at a different resolution than its reference photo.
"""

def point_in_polygon(x: float, y: float, polygon: list[list[float]]) -> bool:
    """Ray casting: count how many polygon edges a ray to the right of the point crosses."""
    inside = False
    n = len(polygon)
    for i in range(n):
        x1, y1 = polygon[i]
        x2, y2 = polygon[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            cross_x = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < cross_x:
                inside = not inside
    return inside

def ground_point(bbox: list[int], width: int, height: int) -> tuple[float, float]:
    """Where the vehicle touches the road: bottom-centre of its box, normalised."""
    x1, _, x2, y2 = bbox
    return ((x1 + x2) / 2 / width, y2 / height)

def mark_violations(detections: list[dict], areas: list[list[list[float]]], width: int, height: int) -> list[dict]:
    """Adds in_no_parking to each detection; returns the ones that are violations."""
    violations = []
    for d in detections:
        gx, gy = ground_point(d["bbox"], width, height)
        d["in_no_parking"] = any(point_in_polygon(gx, gy, poly) for poly in areas if len(poly) >= 3)
        if d["in_no_parking"]:
            violations.append(d)
    return violations
