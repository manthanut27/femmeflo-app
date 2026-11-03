#!/usr/bin/env python3
"""
FemmeFlo Brand Assets & Mobile App Icon Generator
Extracts and generates authentic, pixel-perfect brand logo and icon assets
for femmeflo-app based on the master brand identity in femmeflo-web/public/Femmeflo logo.png.

This script does NOT modify any files in femmeflo-web.
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFilter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(SCRIPT_DIR)
WORKSPACE_DIR = os.path.dirname(APP_DIR)
WEB_PUBLIC = os.path.join(WORKSPACE_DIR, "femmeflo-web", "public")
APP_IMAGES = os.path.join(APP_DIR, "assets", "images")
APP_ASSETS = os.path.join(APP_DIR, "assets")

def extract_clean_transparent_logo(master_logo_path):
    """
    Carefully de-mattes the master logo from its white background,
    preserving anti-aliased edges and true brand colors.
    """
    im = Image.open(master_logo_path).convert("RGB")
    w, h = im.size
    out = Image.new("RGBA", (w, h))
    pixels = im.load()
    out_pixels = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            diff_r = max(0, 255 - r)
            diff_g = max(0, 255 - g)
            diff_b = max(0, 255 - b)
            max_diff = max(diff_r, diff_g, diff_b)

            if max_diff <= 8:
                out_pixels[x, y] = (0, 0, 0, 0)
            else:
                alpha_f = min(1.0, max_diff / 160.0)
                if max_diff < 30:
                    alpha_f = (max_diff - 8) / 22.0 * (30.0 / 160.0)
                alpha = int(round(alpha_f * 255))

                a_norm = max(alpha_f, 0.05)
                ur = int(round(min(255, max(0, (r - (1 - a_norm) * 255) / a_norm))))
                ug = int(round(min(255, max(0, (g - (1 - a_norm) * 255) / a_norm))))
                ub = int(round(min(255, max(0, (b - (1 - a_norm) * 255) / a_norm))))
                out_pixels[x, y] = (ur, ug, ub, alpha)

    return out

def generate_authentic_fairy_mark(web_public_dir):
    """
    Composites the clean golden fairy body with authentic leaf/forest-green wings
    to produce the iconic standalone brand mark at high resolution.
    """
    body_path = os.path.join(web_public_dir, "fairy-body-clean.png")
    wing_path = os.path.join(web_public_dir, "fairy-wing-clean.png")

    body = Image.open(body_path).convert("RGBA")
    wing = Image.open(wing_path).convert("RGBA")

    # Map wing luminance to authentic brand greens:
    # Deep forest green #1A6642 and fresh leaf green #7CAB5B
    wing_styled = Image.new("RGBA", wing.size)
    w_px = wing.load()
    ws_px = wing_styled.load()

    for y in range(wing.height):
        for x in range(wing.width):
            r, g, b, a = w_px[x, y]
            if a > 0:
                lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255.0
                if lum < 0.45:
                    t = lum / 0.45
                    gr = int(26 * (1 - t) + 80 * t)
                    gg = int(102 * (1 - t) + 145 * t)
                    gb = int(66 * (1 - t) + 78 * t)
                else:
                    t = (lum - 0.45) / 0.55
                    gr = int(80 * (1 - t) + 140 * t)
                    gg = int(145 * (1 - t) + 185 * t)
                    gb = int(78 * (1 - t) + 105 * t)
                ws_px[x, y] = (min(255, gr), min(255, gg), min(255, gb), a)

    # Canvas scale for compositing
    canvas_size = 1600
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    box_w, box_h = 1100, 1100
    offset_x = (canvas_size - box_w) // 2
    offset_y = (canvas_size - box_h) // 2

    ww = int(box_w * 0.54)
    wh = int(box_h * 0.48)
    wx = offset_x + int(box_w * 0.42)
    wy = offset_y + int(box_h * 0.08)

    bw = int(box_w * 0.58)
    bh = int(box_h * 0.82)
    bx = offset_x + int(box_w * 0.16)
    by = offset_y + int(box_h * 0.12)

    wing_res = wing_styled.resize((ww, wh), Image.Resampling.LANCZOS)
    body_res = body.resize((bw, bh), Image.Resampling.LANCZOS)

    canvas.paste(wing_res, (wx, wy), wing_res)
    canvas.paste(body_res, (bx, by), body_res)

    bbox = canvas.getbbox()
    return canvas.crop(bbox)

def create_monochrome_mask(image, target_size, safe_radius):
    """
    Generates a pure white silhouette inside the safe zone for Android monochrome icon.
    """
    out = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    cx, cy = target_size // 2, target_size // 2

    # Fit image inside safe_radius
    max_dim = safe_radius * 2 * 0.85
    ratio = min(max_dim / image.width, max_dim / image.height)
    new_w = int(image.width * ratio)
    new_h = int(image.height * ratio)

    resized = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
    mono_img = Image.new("RGBA", (new_w, new_h), (0, 0, 0, 0))
    res_px = resized.load()
    mono_px = mono_img.load()

    for y in range(new_h):
        for x in range(new_w):
            a = res_px[x, y][3]
            if a > 30:
                mono_px[x, y] = (255, 255, 255, a)

    px = cx - new_w // 2
    py = cy - new_h // 2
    out.paste(mono_img, (px, py), mono_img)
    return out

def main():
    print("=== FemmeFlo Authentic Brand Icon Generator ===")
    os.makedirs(APP_IMAGES, exist_ok=True)

    master_logo_file = os.path.join(WEB_PUBLIC, "Femmeflo logo.png")
    if not os.path.exists(master_logo_file):
        print(f"Error: Master logo not found at {master_logo_file}")
        sys.exit(1)

    print("1. Extracting clean transparent master logo...")
    trans_logo = extract_clean_transparent_logo(master_logo_file)
    
    # Save full horizontal logo
    logo_path = os.path.join(APP_IMAGES, "femmeflo-logo.png")
    trans_logo.save(logo_path, format="PNG", optimize=True)
    print(f"   Saved {logo_path} ({trans_logo.size})")

    print("2. Generating authentic standalone Fairy Mark...")
    fairy_mark = generate_authentic_fairy_mark(WEB_PUBLIC)
    mark_path = os.path.join(APP_IMAGES, "femmeflo-mark.png")
    fairy_mark.save(mark_path, format="PNG", optimize=True)
    print(f"   Saved {mark_path} ({fairy_mark.size})")

    # --- 3. Primary Universal App Icon: 1024x1024 ---
    print("3. Generating primary app icon (icon.png 1024x1024)...")
    icon_size = 1024
    app_icon = Image.new("RGBA", (icon_size, icon_size), "#FAF8F5")
    draw = ImageDraw.Draw(app_icon)

    cx, cy = icon_size // 2, icon_size // 2
    # Outer elegant circular badge (fits comfortably inside iOS squircle and Android circle)
    r_badge = 360
    draw.ellipse([cx - r_badge, cy - r_badge, cx + r_badge, cy + r_badge], fill="#FFFFFF", outline="#A7F3D0", width=6)
    
    # Inner subtle sage ring
    r_inner = 336
    draw.ellipse([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], outline="#D1FAE5", width=3)

    # Center Fairy Mark inside badge (height ~520px)
    fairy_h = 520
    fairy_w = int(fairy_h * (fairy_mark.width / fairy_mark.height))
    fairy_scaled = fairy_mark.resize((fairy_w, fairy_h), Image.Resampling.LANCZOS)
    fx = cx - fairy_w // 2 + 10
    fy = cy - fairy_h // 2
    app_icon.paste(fairy_scaled, (fx, fy), fairy_scaled)

    # iOS requires no alpha channel in App Store icons
    app_icon_rgb = Image.new("RGB", (icon_size, icon_size), "#FAF8F5")
    app_icon_rgb.paste(app_icon, (0, 0), app_icon)
    app_icon_path = os.path.join(APP_IMAGES, "icon.png")
    app_icon_rgb.save(app_icon_path, format="PNG", optimize=True)
    print(f"   Saved {app_icon_path}")

    # --- 4. Android Adaptive Icon Foreground: 512x512 ---
    print("4. Generating Android adaptive foreground (512x512)...")
    fg_size = 512
    fg = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
    fg_draw = ImageDraw.Draw(fg)
    fcx, fcy = fg_size // 2, fg_size // 2

    # Safe zone radius is 169px (diameter 338px).
    # Badge radius = 158px fits 100% inside safe zone across all Android launchers.
    r_fg_badge = 158
    fg_draw.ellipse([fcx - r_fg_badge, fcy - r_fg_badge, fcx + r_fg_badge, fcy + r_fg_badge], fill="#FFFFFF", outline="#A7F3D0", width=4)
    r_fg_inner = 146
    fg_draw.ellipse([fcx - r_fg_inner, fcy - r_fg_inner, fcx + r_fg_inner, fcy + r_fg_inner], outline="#D1FAE5", width=2)

    fg_fairy_h = 228
    fg_fairy_w = int(fg_fairy_h * (fairy_mark.width / fairy_mark.height))
    fg_fairy_res = fairy_mark.resize((fg_fairy_w, fg_fairy_h), Image.Resampling.LANCZOS)
    fg_fx = fcx - fg_fairy_w // 2 + 4
    fg_fy = fcy - fg_fairy_h // 2
    fg.paste(fg_fairy_res, (fg_fx, fg_fy), fg_fairy_res)

    fg_path = os.path.join(APP_IMAGES, "android-icon-foreground.png")
    fg.save(fg_path, format="PNG", optimize=True)
    print(f"   Saved {fg_path}")

    # --- 5. Android Adaptive Icon Background: 512x512 ---
    print("5. Generating Android adaptive background (512x512)...")
    bg = Image.new("RGBA", (fg_size, fg_size), "#FAF8F5")
    bg_path = os.path.join(APP_IMAGES, "android-icon-background.png")
    bg.save(bg_path, format="PNG", optimize=True)
    print(f"   Saved {bg_path}")

    # --- 6. Android Monochrome Icon: 432x432 ---
    print("6. Generating Android monochrome icon (432x432)...")
    mono = create_monochrome_mask(fairy_mark, 432, 142)
    mono_path = os.path.join(APP_IMAGES, "android-icon-monochrome.png")
    mono.save(mono_path, format="PNG", optimize=True)
    print(f"   Saved {mono_path}")

    # --- 7. Splash Screen Icon: 256x256 ---
    print("7. Generating splash icon (256x256)...")
    splash_size = 256
    splash = Image.new("RGBA", (splash_size, splash_size), (0, 0, 0, 0))
    scx, scy = splash_size // 2, splash_size // 2

    # Circular badge for splash screen
    s_draw = ImageDraw.Draw(splash)
    r_splash = 110
    s_draw.ellipse([scx - r_splash, scy - r_splash, scx + r_splash, scy + r_splash], fill="#FFFFFF", outline="#A7F3D0", width=3)
    s_draw.ellipse([scx - 100, scy - 100, scx + 100, scy + 100], outline="#D1FAE5", width=2)

    sp_fairy_h = 158
    sp_fairy_w = int(sp_fairy_h * (fairy_mark.width / fairy_mark.height))
    sp_fairy_res = fairy_mark.resize((sp_fairy_w, sp_fairy_h), Image.Resampling.LANCZOS)
    sp_fx = scx - sp_fairy_w // 2 + 3
    sp_fy = scy - sp_fairy_h // 2
    splash.paste(sp_fairy_res, (sp_fx, sp_fy), sp_fairy_res)

    splash_path = os.path.join(APP_IMAGES, "splash-icon.png")
    splash.save(splash_path, format="PNG", optimize=True)
    print(f"   Saved {splash_path}")

    # --- 8. Web Favicon: 192x192 ---
    print("8. Generating favicon (192x192)...")
    fav_size = 192
    fav = Image.new("RGBA", (fav_size, fav_size), (0, 0, 0, 0))
    fav_draw = ImageDraw.Draw(fav)
    fcx, fcy = fav_size // 2, fav_size // 2
    fav_draw.ellipse([fcx - 88, fcy - 88, fcx + 88, fcy + 88], fill="#FFFFFF", outline="#A7F3D0", width=3)
    
    fav_h = 124
    fav_w = int(fav_h * (fairy_mark.width / fairy_mark.height))
    fav_res = fairy_mark.resize((fav_w, fav_h), Image.Resampling.LANCZOS)
    fav.paste(fav_res, (fcx - fav_w // 2 + 2, fcy - fav_h // 2), fav_res)

    fav_path = os.path.join(APP_IMAGES, "favicon.png")
    fav.save(fav_path, format="PNG", optimize=True)
    print(f"   Saved {fav_path}")

    # --- 9. Multi-Resolution Favicon.ico ---
    print("9. Generating favicon.ico...")
    ico_path = os.path.join(APP_ASSETS, "favicon.ico")
    fav_res.save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )
    print(f"   Saved {ico_path}")

    print("\nALL FEMMEFLO APP BRAND ASSETS GENERATED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
