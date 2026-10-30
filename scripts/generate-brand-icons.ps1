Add-Type -AssemblyName System.Drawing

function Create-FemmeFloEmblemPaths {
    param(
        [float]$cx,
        [float]$cy,
        [float]$scale
    )

    # 1. Central tall petal (droplet / lotus core)
    $pCenter = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pCenter.StartFigure()
    $pCenter.AddBezier(
        $cx, $cy + (70 * $scale),
        $cx - (38 * $scale), $cy + (25 * $scale),
        $cx - (36 * $scale), $cy - (55 * $scale),
        $cx, $cy - (110 * $scale)
    )
    $pCenter.AddBezier(
        $cx, $cy - (110 * $scale),
        $cx + (36 * $scale), $cy - (55 * $scale),
        $cx + (38 * $scale), $cy + (25 * $scale),
        $cx, $cy + (70 * $scale)
    )
    $pCenter.CloseFigure()

    # 2. Left inner petal
    $pLeft = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pLeft.StartFigure()
    $pLeft.AddBezier(
        $cx - (12 * $scale), $cy + (60 * $scale),
        $cx - (70 * $scale), $cy + (40 * $scale),
        $cx - (98 * $scale), $cy - (15 * $scale),
        $cx - (78 * $scale), $cy - (75 * $scale)
    )
    $pLeft.AddBezier(
        $cx - (78 * $scale), $cy - (75 * $scale),
        $cx - (52 * $scale), $cy - (30 * $scale),
        $cx - (28 * $scale), $cy + (12 * $scale),
        $cx - (12 * $scale), $cy + (60 * $scale)
    )
    $pLeft.CloseFigure()

    # 3. Right inner petal
    $pRight = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pRight.StartFigure()
    $pRight.AddBezier(
        $cx + (12 * $scale), $cy + (60 * $scale),
        $cx + (70 * $scale), $cy + (40 * $scale),
        $cx + (98 * $scale), $cy - (15 * $scale),
        $cx + (78 * $scale), $cy - (75 * $scale)
    )
    $pRight.AddBezier(
        $cx + (78 * $scale), $cy - (75 * $scale),
        $cx + (52 * $scale), $cy - (30 * $scale),
        $cx + (28 * $scale), $cy + (12 * $scale),
        $cx + (12 * $scale), $cy + (60 * $scale)
    )
    $pRight.CloseFigure()

    # 4. Left outer sweeping petal
    $pOutLeft = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pOutLeft.StartFigure()
    $pOutLeft.AddBezier(
        $cx - (16 * $scale), $cy + (66 * $scale),
        $cx - (90 * $scale), $cy + (72 * $scale),
        $cx - (138 * $scale), $cy + (25 * $scale),
        $cx - (120 * $scale), $cy - (25 * $scale)
    )
    $pOutLeft.AddBezier(
        $cx - (120 * $scale), $cy - (25 * $scale),
        $cx - (100 * $scale), $cy + (2 * $scale),
        $cx - (58 * $scale), $cy + (38 * $scale),
        $cx - (16 * $scale), $cy + (66 * $scale)
    )
    $pOutLeft.CloseFigure()

    # 5. Right outer sweeping petal
    $pOutRight = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pOutRight.StartFigure()
    $pOutRight.AddBezier(
        $cx + (16 * $scale), $cy + (66 * $scale),
        $cx + (90 * $scale), $cy + (72 * $scale),
        $cx + (138 * $scale), $cy + (25 * $scale),
        $cx + (120 * $scale), $cy - (25 * $scale)
    )
    $pOutRight.AddBezier(
        $cx + (120 * $scale), $cy - (25 * $scale),
        $cx + (100 * $scale), $cy + (2 * $scale),
        $cx + (58 * $scale), $cy + (38 * $scale),
        $cx + (16 * $scale), $cy + (66 * $scale)
    )
    $pOutRight.CloseFigure()

    # 6. Lotus base droplet seed
    $pSeed = New-Object System.Drawing.Drawing2D.GraphicsPath
    $seedR = 12 * $scale
    $pSeed.AddEllipse($cx - $seedR, ($cy + (82 * $scale)) - $seedR, $seedR * 2, $seedR * 2)

    return @($pCenter, $pLeft, $pRight, $pOutLeft, $pOutRight, $pSeed)
}

function Create-RoundedRectanglePath {
    param(
        [float]$x,
        [float]$y,
        [float]$width,
        [float]$height,
        [float]$radius
    )
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $width - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $width - $d, $y + $height - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $height - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

# --- 1. PRIMARY APP ICON: assets/images/icon.png (1024 x 1024) ---
$size = 1024
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Background: Rich Berry Rose gradient with rounded corners
$rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.ColorTranslator]::FromHtml("#E61C5D"),
    [System.Drawing.ColorTranslator]::FromHtml("#9F2545"),
    45.0
)
$g.FillRectangle($gradBrush, $rect)

# Soft radial highlight in upper center
$hlPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$hlPath.AddEllipse(150, 50, 724, 724)
$pbg = New-Object System.Drawing.Drawing2D.PathGradientBrush($hlPath)
$pbg.CenterColor = [System.Drawing.Color]::FromArgb(60, 255, 255, 255)
$pbg.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 230, 28, 93))
$g.FillPath($pbg, $hlPath)
$pbg.Dispose()
$hlPath.Dispose()

# Inner squircle container with glassmorphic glow
$cardMargin = 96
$cardSize = $size - ($cardMargin * 2)
$cardPath = Create-RoundedRectanglePath $cardMargin $cardMargin $cardSize $cardSize 180
$cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 255, 255, 255))
$cardPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 255, 255, 255), 3.0)
$g.FillPath($cardBrush, $cardPath)
$g.DrawPath($cardPen, $cardPath)
$cardBrush.Dispose()
$cardPen.Dispose()
$cardPath.Dispose()

# Draw Emblem in crisp White with subtle drop shadow
$emblemScale = 2.7
$cx = 512
$cy = 490

# Shadow pass
$shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(50, 100, 10, 30))
$shadowPaths = Create-FemmeFloEmblemPaths $cx ($cy + 12) $emblemScale
foreach ($p in $shadowPaths) {
    $g.FillPath($shadowBrush, $p)
    $p.Dispose()
}
$shadowBrush.Dispose()

# Pure white emblem pass
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$paths = Create-FemmeFloEmblemPaths $cx $cy $emblemScale
foreach ($p in $paths) {
    $g.FillPath($whiteBrush, $p)
    $p.Dispose()
}
$whiteBrush.Dispose()

# Subtle brand text "FemmeFlo" below the emblem
$fontFamily = New-Object System.Drawing.FontFamily("Arial")
$font = New-Object System.Drawing.Font($fontFamily, 44, [System.Drawing.FontStyle]::Bold)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("FemmeFlo", $font, $textBrush, 512, 850, $sf)
$textBrush.Dispose()
$font.Dispose()
$fontFamily.Dispose()

$g.Dispose()
$gradBrush.Dispose()
$bmp.Save("assets/images/icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Generated assets/images/icon.png (1024x1024)"

# --- 2. ANDROID ADAPTIVE FOREGROUND: assets/images/android-icon-foreground.png (512 x 512) ---
$size = 512
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# Centered circular badge matching login.tsx logoBadge (#FFF5F7 with #FCE7F3 border)
[int]$badgeR = 145
[int]$bx = 256 - $badgeR
[int]$by = 256 - $badgeR
[int]$bw = $badgeR * 2
[int]$bh = $badgeR * 2
$badgeRect = New-Object System.Drawing.Rectangle($bx, $by, $bw, $bh)
$badgeBg = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#FFF5F7"))
$badgeBorder = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#FCE7F3"), 4.0)
$g.FillEllipse($badgeBg, $badgeRect)
$g.DrawEllipse($badgeBorder, $badgeRect)
$badgeBg.Dispose()
$badgeBorder.Dispose()

# Vibrant Berry Rose emblem (#E61C5D)
$roseBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#E61C5D"))
$paths = Create-FemmeFloEmblemPaths 256 252 0.98
foreach ($p in $paths) {
    $g.FillPath($roseBrush, $p)
    $p.Dispose()
}
$roseBrush.Dispose()

$g.Dispose()
$bmp.Save("assets/images/android-icon-foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Generated assets/images/android-icon-foreground.png (512x512)"

# --- 3. ANDROID ADAPTIVE BACKGROUND: assets/images/android-icon-background.png (512 x 512) ---
$bmp = New-Object System.Drawing.Bitmap(512, 512)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.ColorTranslator]::FromHtml("#FAF8F5"))
$g.Dispose()
$bmp.Save("assets/images/android-icon-background.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Generated assets/images/android-icon-background.png (512x512)"

# --- 4. ANDROID MONOCHROME ICON: assets/images/android-icon-monochrome.png (432 x 432) ---
$bmp = New-Object System.Drawing.Bitmap(432, 432)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$paths = Create-FemmeFloEmblemPaths 216 216 1.15
foreach ($p in $paths) {
    $g.FillPath($whiteBrush, $p)
    $p.Dispose()
}
$whiteBrush.Dispose()
$g.Dispose()
$bmp.Save("assets/images/android-icon-monochrome.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Generated assets/images/android-icon-monochrome.png (432x432)"

# --- 5. SPLASH SCREEN ICON: assets/images/splash-icon.png (256 x 256) ---
$bmp = New-Object System.Drawing.Bitmap(256, 256)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

# Elegant Berry Rose emblem with soft badge glow
[int]$badgeR = 100
[int]$bx = 128 - $badgeR
[int]$by = 128 - $badgeR
[int]$bw = $badgeR * 2
[int]$bh = $badgeR * 2
$badgeRect = New-Object System.Drawing.Rectangle($bx, $by, $bw, $bh)
$badgeBg = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#FFF5F7"))
$badgeBorder = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#FCE7F3"), 3.0)
$g.FillEllipse($badgeBg, $badgeRect)
$g.DrawEllipse($badgeBorder, $badgeRect)
$badgeBg.Dispose()
$badgeBorder.Dispose()

$roseBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#E61C5D"))
$paths = Create-FemmeFloEmblemPaths 128 126 0.68
foreach ($p in $paths) {
    $g.FillPath($roseBrush, $p)
    $p.Dispose()
}
$roseBrush.Dispose()
$g.Dispose()
$bmp.Save("assets/images/splash-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Generated assets/images/splash-icon.png (256x256)"

# --- 6. WEB FAVICON: assets/images/favicon.png (192 x 192) ---
$size = 192
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::Transparent)

# Crisp high-contrast Berry Rose rounded container
$favPath = Create-RoundedRectanglePath 4 4 ($size - 8) ($size - 8) 38
$favBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle(0, 0, $size, $size)),
    [System.Drawing.ColorTranslator]::FromHtml("#E61C5D"),
    [System.Drawing.ColorTranslator]::FromHtml("#9F2545"),
    45.0
)
$g.FillPath($favBrush, $favPath)
$favBrush.Dispose()
$favPath.Dispose()

# Pure white emblem in center
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$paths = Create-FemmeFloEmblemPaths ($size / 2) (($size / 2) + 2) 0.58
foreach ($p in $paths) {
    $g.FillPath($whiteBrush, $p)
    $p.Dispose()
}
$whiteBrush.Dispose()
$g.Dispose()
$bmp.Save("assets/images/favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Generated assets/images/favicon.png (192x192)"

# --- 7. MULTI-RESOLUTION FAVICON.ICO (assets/favicon.ico) ---
$iconBmp = New-Object System.Drawing.Bitmap("assets/images/favicon.png")
$hIcon = $iconBmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = New-Object System.IO.FileStream("assets/favicon.ico", [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$iconBmp.Dispose()
Write-Output "Generated assets/favicon.ico"

Write-Output "ALL ICONS GENERATED SUCCESSFULLY!"
