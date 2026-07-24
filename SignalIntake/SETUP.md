# راه‌اندازی ماژول ۱ — فرم ثبت سیگنال

## ۱. ساخت Google Sheet
یک Google Sheet جدید بسازید (نام دلخواه، مثلاً «Ethical Horizon Signals»).

## ۲. افزودن Apps Script
- در شیت: Extensions → Apps Script
- محتوای فایل `apps-script.gs` را کپی و جایگزین کد پیش‌فرض کنید
- ذخیره کنید (Ctrl+S)

## ۳. Deploy کردن Web App
- Deploy → New deployment
- Type: **Web app**
- Execute as: **Me**
- Who has access: **Anyone**
- Deploy را بزنید و مجوزهای لازم را تأیید کنید
- آدرس URL که نمایش داده می‌شود را کپی کنید (چیزی شبیه `https://script.google.com/macros/s/.../exec`)

## ۴. اتصال فرم
فایل `signal-intake.html` را باز کنید، خط زیر را در انتهای فایل (تگ `<script>`) پیدا کنید:

```js
const ENDPOINT_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";
```

و آدرس مرحله ۳ را جایگزین کنید.

## ۵. تست
فایل HTML را در مرورگر باز کنید، یک سیگنال آزمایشی ثبت کنید، و بررسی کنید که ردیف جدید در Google Sheet ظاهر شده باشد.

---

**نکته:** اگر آدرس هنوز تنظیم نشده باشد، فرم داده را به‌صورت موقت در `localStorage` مرورگر ذخیره می‌کند تا داده‌ای از دست نرود — اما برای اشتراک‌گذاری با شرکت‌کنندگان واقعی، اتصال به Sheet ضروری است.
