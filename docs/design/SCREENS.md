# FemmeFlo Mobile App - Screen Designs & Visual Specifications

This document catalogs the Stitch MCP design outputs and visual specifications for the FemmeFlo Mobile Expo App (`femmeflo-app`).

## Stitch Project Details
- **Project ID**: `projects/18339912893813270854`
- **Design System Asset**: `assets/09669548ba8c444aab53a0d26ea664f7` ("FemmeFlo Field Core")
- **Device Target**: Mobile (4-column fluid, thumb-zone optimized)
- **Primary Color**: Berry Pink `#E61C5D`
- **Secondary Color**: Forest Green `#156035`
- **Canvas Base**: Warm Paper `#FAF8F5`
- **Typography**: Space Grotesk (Metrics/Headers) + Plus Jakarta Sans (Body/Forms)

---

## Screen Inventory

### 1. Field Officer Home (`/(seller)/dashboard`)
- **Stitch Screen ID**: `ceb16ed8c6f34d528c761f8a2442ac8c`
- **Screenshot URL**: [Download PNG](https://stitch.googleapis.com/v1/projects/18339912893813270854/files/9b0354e8c13644a6bac8193d4074ae67:download)
- **Key Elements**:
  - Live shift status pill (`ACTIVE SHIFT` / `OFF DUTY`)
  - Hero Sales Target & Commission progress gauge
  - Today's Route summary (Target visits, visited stores)
  - Quick Action grid: "New Order", "Check-in Visit", "Onboard Store", "Stock Balance"
  - Recent sales activity list with settlement indicators

### 2. POS Sales Order Entry (`/(seller)/sales/new`)
- **Stitch Screen ID**: `74648d565d9b4113ac76be94a8fbe7a4`
- **Screenshot URL**: [Download PNG](https://stitch.googleapis.com/v1/projects/18339912893813270854/files/34afb8a515354e8f91487e0bebbd2d83:download)
- **Key Elements**:
  - Header with back navigation, 'New Sale' title, and draft autosave indicator with Idempotency Key badge (`#FF-941`)
  - Customer selector showing shop name, owner name, balance due badge
  - Product line items card list with product name, SKU, price in ₹, quantity steppers (`-` / `+`), and custom unit price input
  - **Minimum price warning banner**: Orange alert (`#D97706`) stating: *"Unit price is below minimum threshold ₹X. Manager approval required!"*
  - Payment mode segment control: Cash, Bank Transfer / UPI, Pending Credit
  - Summary card: Subtotal, GST, Total Payable ₹
  - Docked Primary CTA button: Berry Pink `#E61C5D` *"Submit Sale & Generate Invoice"*

### 3. Duty Shift & Visits Tracker (`/(seller)/shift`)
- **Stitch Screen ID**: `cfa034a9fa924a78a498a5c06ce74838`
- **Screenshot URL**: [Download PNG](https://stitch.googleapis.com/v1/projects/18339912893813270854/files/7b462b7f50574117809eca7bc1891f00:download)
- **Key Elements**:
  - Top header with 'Duty Shift & Visits' and live status pill
  - Shift Hero card: Live elapsed timer (`04:12:38`), start timestamp, GPS location pin
  - Action buttons: "Check-in Visit" (Forest Green `#156035`) with GPS lock + "End Shift"
  - Shift KPI row: Visits Completed (`8`), Total Sales (`₹18,500`), Distance (`14.2 km`)
  - Timeline of store visits: Store Name, arrival timestamp, visit outcome pill (`Order Placed`, `Stock Audited`, `Follow-up Needed`), notes

### 4. Store Directory & Onboarding (`/(seller)/customers`, `/(seller)/customers/new`)
- **Key Elements**:
  - Store search and category filters (`All`, `Verified`, `Credit Due`)
  - Floating/Top action: `+ Onboard New Store` (Berry Pink `#E61C5D`)
  - Store card: Name, category badge, owner name, phone call trigger, credit balance badge, distance
  - Onboarding drawer/screen:
    - JPEG storefront photo picker/camera trigger
    - Store name, owner name, phone number, GSTIN (optional)
    - Foreground GPS pin capture
    - Submits via `multipart/form-data` with field name `photo`

### 5. Order Details & Tax Invoice (`/(seller)/sales/[id]`)
- **Key Elements**:
  - Order status badge (`PENDING_APPROVAL`, `APPROVED`, `DELIVERED`, `CANCELLED`)
  - Customer billing & shipping address
  - Line items breakdown with unit prices, GST, and totals
  - Download Tax Invoice PDF button: Authenticated request (`GET /api/v1/invoices/:id/pdf` with Bearer token) via `expo-file-system`, opened with `expo-sharing`

