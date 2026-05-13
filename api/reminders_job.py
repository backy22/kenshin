import asyncio
from datetime import date, timedelta

from Repository.test_set import TestSetRepository


async def run_reminder_scan() -> None:
    today = date.today()
    rows = await TestSetRepository.get_all()
    for ts in rows:
        window_start = ts.next_date - timedelta(days=ts.reminder_lead_days)
        if window_start <= today <= ts.next_date:
            if ts.last_reminder_at != today:
                print(
                    f"[kenshin-reminder] user_id={ts.user_id} test_set_id={ts.id} "
                    f"next_date={ts.next_date}"
                )
                await TestSetRepository.touch_last_reminder(ts.id, today)


async def _reminder_loop() -> None:
    await asyncio.sleep(5)
    while True:
        try:
            await run_reminder_scan()
        except Exception as exc:
            print(f"[kenshin-reminder] error: {exc}")
        await asyncio.sleep(86400)


def start_reminder_worker() -> asyncio.Task:
    return asyncio.create_task(_reminder_loop())
