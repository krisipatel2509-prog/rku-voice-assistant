"""Place outbound admission calls (ported from src/twilio/outbound.js)."""
import asyncio
from urllib.parse import quote

from twilio.rest import Client

from .config import config


def twilio_ready() -> bool:
    return bool(config.twilio.account_sid and config.twilio.auth_token and config.public_url)


async def place_call(to: str, name: str = "") -> str:
    if not to:
        raise ValueError("Destination number is required.")
    if not twilio_ready():
        raise ValueError("Set TWILIO_* credentials and PUBLIC_URL in .env to place calls.")

    def _create():
        client = Client(config.twilio.account_sid, config.twilio.auth_token)
        url = f"{config.public_url}/voice/outbound?name={quote(name)}"
        call = client.calls.create(to=to, from_=config.twilio.phone_number, url=url, method="POST")
        return call.sid

    return await asyncio.to_thread(_create)
