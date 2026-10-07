import html
import os
import smtplib
import ssl
from email.message import EmailMessage
from datetime import datetime, timezone


def env(name, default=''):
    return os.environ.get(name, default).strip()


def month_label(year, month):
    return f"{year}/{int(month):02d}" if year and month else "unknown"

kind = env('NOTIFY_KIND', 'update_failed')
recipient = env('NOTIFY_EMAIL')
username = env('SMTP_USERNAME')
password = env('SMTP_PASSWORD')
host = env('SMTP_HOST', 'smtp.gmail.com')
port = int(env('SMTP_PORT', '465'))
review_chat_url = env('REVIEW_CHAT_URL')
staging_url = env('STAGING_URL')
production_url = env('PRODUCTION_URL', 'https://flightdata2.meshthings.com')
actions_url = env('ACTIONS_URL')
latest_year = env('LATEST_YEAR')
latest_month = env('LATEST_MONTH')
production_year = env('PRODUCTION_YEAR')
production_month = env('PRODUCTION_MONTH')
release_commit = env('RELEASE_COMMIT')
error_stage = env('ERROR_STAGE', 'GitHub Actions pipeline')
error_summary = env('ERROR_SUMMARY', '請查看 GitHub Actions 執行紀錄。')
run_date = env('RUN_DATE') or datetime.now(timezone.utc).strftime('%Y-%m-%d')

if not recipient or not username or not password:
    missing = [name for name, value in [('NOTIFY_EMAIL', recipient), ('SMTP_USERNAME', username), ('SMTP_PASSWORD', password)] if not value]
    raise SystemExit('Missing required email configuration: ' + ', '.join(missing))

latest = month_label(latest_year, latest_month)
production = month_label(production_year, production_month)

subjects = {
    'no_data': f'[FlightData2] {run_date} 檢查完成｜CAA 尚無新資料',
    'staging_pending': f'[FlightData2] {latest} 已在 Staging｜等待審核',
    'staging_ready': f'[FlightData2] {latest} Staging 已完成｜等待審核',
    'update_failed': '[FlightData2] 自動更新失敗 ❌',
    'production_success': f'[FlightData2] {latest} 正式站更新完成 ✅',
    'production_failed': f'[FlightData2] {latest} 正式站驗證失敗 ❌',
}
subject = subjects.get(kind, '[FlightData2] 自動更新通知')

rows = []
def row(label, value):
    if value:
        rows.append(f'<tr><td style="padding:6px 12px 6px 0;color:#666">{html.escape(label)}</td><td style="padding:6px 0;font-weight:600">{html.escape(value)}</td></tr>')

row('檢查日期', run_date)
if latest_year and latest_month:
    row('CAA / Release 月份', latest)
if production_year and production_month:
    row('正式站目前月份', production)
if release_commit:
    row('Release commit', release_commit[:12])

if kind == 'no_data':
    headline = '本次檢查沒有發現新的 CAA 月資料。'
    detail = '網站與 staging 都不需要變更。'
elif kind == 'staging_pending':
    headline = f'{latest} 已經在 staging 等待審核。'
    detail = '本次排程沒有重建同一份資料；請直接檢查既有 staging 版本。'
elif kind == 'staging_ready':
    headline = f'{latest} 已完成資料處理、建置與 staging 驗證。'
    detail = '正式站尚未更新，等你審核通過後才會發布。'
elif kind == 'production_success':
    headline = f'{latest} 已正式發布。'
    detail = 'Production smoke test 已通過。'
else:
    headline = 'FlightData2 自動流程發生問題。'
    detail = f'失敗階段：{error_stage}<br>{html.escape(error_summary)}'

buttons = []
def button(label, url, color='#111827'):
    if url:
        buttons.append(f'<a href="{html.escape(url, quote=True)}" style="display:inline-block;margin:8px 8px 8px 0;padding:11px 16px;background:{color};color:white;text-decoration:none;border-radius:8px;font-weight:700">{html.escape(label)}</a>')

if kind in ('staging_ready', 'staging_pending'):
    button('查看 Staging', staging_url, '#2563eb')
    button('回 ChatGPT 審核', review_chat_url, '#111827')
if kind in ('production_success', 'production_failed'):
    button('查看正式站', production_url, '#16a34a')
if actions_url:
    button('查看 GitHub Actions', actions_url, '#6b7280')

approval_text = ''
if kind in ('staging_ready', 'staging_pending') and latest_year and latest_month:
    approval_text = f'<p style="margin:20px 0 0">確認無誤後，在這個 ChatGPT 對話輸入：<br><strong>flightdata2 {latest_year}-{int(latest_month):02d} 審核通過</strong></p>'

body = f'''<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#111827;line-height:1.6">
<div style="max-width:680px;margin:auto;padding:24px">
<h2 style="margin:0 0 16px">{html.escape(subject)}</h2>
<p>{headline}</p>
<p>{detail}</p>
<table style="border-collapse:collapse;margin:18px 0">{''.join(rows)}</table>
<div>{''.join(buttons)}</div>
{approval_text}
<p style="margin-top:28px;color:#6b7280;font-size:13px">來源：交通部民用航空局 CAA。此信由 FlightData2 GitHub Actions 自動寄送。</p>
</div></body></html>'''

msg = EmailMessage()
msg['Subject'] = subject
msg['From'] = username
msg['To'] = recipient
msg.set_content(f'{headline}\n{detail.replace("<br>", "\n")}\nStaging: {staging_url}\nProduction: {production_url}\nActions: {actions_url}')
msg.add_alternative(body, subtype='html')

context = ssl.create_default_context()
with smtplib.SMTP_SSL(host, port, context=context, timeout=30) as server:
    server.login(username, password)
    server.send_message(msg)

print(f'Notification sent: {kind} -> {recipient}')
