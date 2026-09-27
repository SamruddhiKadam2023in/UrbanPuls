"""
Real-time events over one WebSocket per browser tab.

Channels:
  public       every signed-in client (e.g. "zone_changed" so maps refresh availability)
  user:<id>    one user's notifications
  staff        vendors, admins and police (violation alerts)

Events are queued on the database session and only sent after the transaction commits,
so clients never hear about changes that were rolled back.
"""
import asyncio
import json
import logging
import threading
from collections import defaultdict

from fastapi import WebSocket
from sqlalchemy import event
from sqlalchemy.orm import Session

log = logging.getLogger("tpms.live")

class LiveHub:
    def __init__(self):
        self.channels: dict[str, set[WebSocket]] = defaultdict(set)
        self.loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    def connect(self, ws: WebSocket, channels: list[str]) -> None:
        for c in channels:
            self.channels[c].add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        for subscribers in self.channels.values():
            subscribers.discard(ws)

    async def _send(self, channel: str, message: str) -> None:
        for ws in list(self.channels.get(channel, ())):
            try:
                await ws.send_text(message)
            except Exception:
                self.disconnect(ws)

    def publish(self, channel: str, payload: dict) -> None:
        """Safe to call from the event loop or from worker threads."""
        if self.loop is None or self.loop.is_closed() or not self.channels.get(channel):
            return
        message = json.dumps(payload, default=str)
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is self.loop:
            self.loop.create_task(self._send(channel, message))
        else:
            asyncio.run_coroutine_threadsafe(self._send(channel, message), self.loop)

hub = LiveHub()

# ── Queue on the session, send after commit ───────────────────────────────────
def queue_event(db: Session, channel: str, payload: dict) -> None:
    db.info.setdefault("live_events", []).append((channel, payload))

def queue_email(db: Session, to: str, subject: str, body: str) -> None:
    db.info.setdefault("live_emails", []).append((to, subject, body))

def zone_changed(db: Session, zone_id: int) -> None:
    queue_event(db, "public", {"type": "zone_changed", "zone_id": zone_id})

@event.listens_for(Session, "after_commit")
def _flush_after_commit(session: Session) -> None:
    events = session.info.pop("live_events", [])
    emails = session.info.pop("live_emails", [])
    for channel, payload in events:
        try:
            hub.publish(channel, payload)
        except Exception:
            log.exception("Live event failed")
    if emails:
        from services.email_service import send_email
        # Email must never slow down or break the request that triggered it
        threading.Thread(target=lambda: [send_email(*e) for e in emails], daemon=True).start()

def discard_pending(session: Session) -> None:
    session.info.pop("live_events", None)
    session.info.pop("live_emails", None)

# "soft" rollback fires on every rollback() call, even when no transaction had started yet
@event.listens_for(Session, "after_soft_rollback")
def _drop_after_rollback(session: Session, previous_transaction) -> None:
    discard_pending(session)
