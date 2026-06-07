"""Trigger an outbound admission call.

  python scripts/outbound_call.py +9198XXXXXXXX "Student Name"
"""
import asyncio
import sys

sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__))))

from app.twilio_outbound import place_call  # noqa: E402


async def main():
    if len(sys.argv) < 2:
        print('Usage: python scripts/outbound_call.py <+E164 number> ["Student Name"]')
        sys.exit(1)
    to = sys.argv[1]
    name = sys.argv[2] if len(sys.argv) > 2 else ""
    try:
        sid = await place_call(to, name)
        print(f"Calling {to} ({name or 'unknown'}) — Call SID: {sid}")
    except Exception as e:
        print(str(e))
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
