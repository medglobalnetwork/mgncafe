# MGN Cafe - Smart Tablet POS System (100% Offline)

A high-performance, landscape tablet-optimized Point of Sale (POS) application built for **MGN Cafe**. Designed in accordance with the *Material Design 3 (M3)* and *Efficient Transaction System* specifications.

---

## 🌟 Key Features

### 1. 🖥️ POS Catalog & Cart Dashboard
- **65% Catalog Area / 35% Cart Split**: Designed for high-speed counter interactions and ergonomics.
- **Search & Category Filtering**: Instant live search and category chips (*All Items, Burgers, Beverages, Salads, Sides, Desserts, Bakery*).
- **Interactive Product Cards**: High-resolution menu items with automatic offline fallback icons and real-time cart badge counters.
- **Cart Management**: Item modifier notes (e.g. *No Pickles, Oat Milk*), quantity steppers (+ / -), item removal, and order notes.
- **Dynamic Pricing Engine**: Subtotal, configurable tax (e.g., 8%), and discount options (10%, 15%, 20%, 50%, or custom fixed amount).
- **Clear Cart Modal**: Darker modal backdrop confirmation to prevent accidental loss of active orders.

---

### 2. 💳 Multi-Method Payment Selector
- **Step 2 of 3 Workflow**: Persistent order summary ticket with live tax and high-contrast total due display.
- **Cash**: Direct routing to the cash & change calculator.
- **Digital & Card**: Interactive simulator supporting Contactless NFC, EMV chip cards, and UPI/QR code payment.
- **Split Payment**: Flexible tender splitting allowing customers to pay partly in cash and partly by card.

---

### 3. 🧮 Cash & Change Touch Calculator
- **3x4 Large Touch Numpad**: 48px+ minimum touch targets for rapid error-free cashier input.
- **Quick Amount Chips**: Instant "Exact", "$50", "$60", "$100", and auto-calculated round cash denominations.
- **Dynamic Change Due**: Visual status with green "Due to Customer" pill or red "Insufficient Amount" alert.
- **Cash Drawer Status**: Integrated drawer audit balance tracking.

---

### 4. 🧾 Thermal Receipt Printing & Confirmation
- **Success State**: Pulsing green confirmation badge, transaction ID, and digital receipt logger.
- **Thermal Printer Ready**: Pre-formatted 80mm standard thermal receipt with store header, phone, itemized table, SKUs, tax, discount, payment breakdown, and footer message triggered via `window.print()`.
- **Digital Email Receipt**: Simulated customer email delivery with instant toast alerts.
- **New Order Transition**: One-tap reset to prepare for the next customer in queue.

---

### 5. 📊 Order History & Offline Storage
- **100% Offline Persistence**: All orders, settings, customer lists, and drawer logs are saved directly in browser `localStorage`.
- **Receipts Browser**: View details of any past order, re-print thermal receipts, or review customer records.
- **Sales CSV Export**: Download sales transactions into a `.csv` spreadsheet for offline bookkeeping.

---

### 6. ⚙️ Store Management & Cash Drawer Audit
- **Customizable Store Info**: Cafe Name (**MGN Cafe**), Terminal ID, Cashier Name, Currency Symbol, and Tax Rate %.
- **Cash Float & Drawer Tracking**: Starting float, cash sales tracking, and drawer audit logs.
- **Backup & Restore**: Export complete POS system state as JSON backup or restore to default menu.

---

## 🚀 How to Run Completely Offline

1. **Direct Browser Launch**:
   - Double-click [`index.html`](file:///c:/Users/ASUS/Downloads/stitch_smart_tablet_pos%20%282%29/index.html) to open the POS system in Chrome, Edge, Safari, or Firefox.
   - Works 100% offline without needing internet access or terminal installations.

2. **Local Web Server (Optional)**:
   ```bash
   # Using Python
   python -m http.server 8080

   # Or using Node.js
   npx serve
   ```
   Open `http://localhost:8080` in your browser.

---

## 📁 File Structure

```
c:\Users\ASUS\Downloads\stitch_smart_tablet_pos (2)\
├── index.html                 # Main Single Page Application shell & layout
├── app.js                     # Complete state management, cart engine, routing & storage
├── styles.css                 # Offline styles, animations, M3 tokens & print styling
├── README.md                  # System manual and instructions
└── stitch_smart_tablet_pos/   # Original design specifications and screen prototypes
```
