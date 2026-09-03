---
name: Efficient Transaction System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#424754'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#727785'
  outline-variant: '#c2c6d6'
  surface-tint: '#005ac2'
  primary: '#0058be'
  on-primary: '#ffffff'
  primary-container: '#2170e4'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#825100'
  on-tertiary: '#ffffff'
  tertiary-container: '#a36700'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-price:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  touch-target-min: 48px
  gutter: 16px
  margin-edge: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is centered on high-velocity retail and service environments where speed, accuracy, and clarity are paramount. The brand personality is professional, reliable, and invisible—prioritizing the transaction over the interface.

The design style follows a **Corporate / Modern** approach with a heavy emphasis on **Minimalism** and touch ergonomics. It utilizes a structured grid, generous hit targets, and high-contrast logic to ensure operators can navigate the system with zero cognitive friction under pressure. The interface avoids unnecessary decorative elements, favoring a functional aesthetic that feels both systematic and utilitarian.

## Colors

The palette is anchored in trust and operational clarity. 

- **Primary (#3B82F6):** Used for the main action path, such as "Checkout" or "Process Payment."
- **Success (#10B981):** Reserved for completed transactions, paid statuses, and inventory additions.
- **Warning (#F59E0B):** Utilized for low stock alerts, pending orders, or price overrides.
- **Neutral (#64748B):** Provides structural scaffolding and secondary information.

The background uses a high-contrast white (`#FFFFFF`) with subtle off-white (`#F8FAFC`) surfaces to differentiate the "Cart" area from the "Product Grid." Text maintains high legibility with deep slate tones (`#1E293B`).

## Typography

This design system uses **Inter** exclusively to ensure maximum legibility at varying distances, which is critical for tablet-based POS setups. 

- **Numerical Data:** Prices and totals use `display-price` with tight letter spacing to maximize screen real estate while remaining authoritative.
- **Interaction Targets:** Labels within buttons and cards use `label-bold` to remain legible even when the screen is viewed at an angle or under bright retail lighting.
- **Hierarchy:** Headers use semi-bold weights to clearly delineate product categories and customer details.

## Layout & Spacing

The layout is optimized for a **Landscape Tablet** orientation using a fixed-ratio split screen. 

- **The Cart (Left/Right Panel):** Occupies 35% of the horizontal space, providing a persistent view of the current transaction.
- **Product Workspace (Center):** Uses a 12-column fluid grid within the remaining 65% of the screen.
- **Spacing Rhythm:** An 8px base unit is used for all internal padding. Minimum touch targets are strictly enforced at 48px to prevent "fat-finger" errors during high-volume periods.
- **Bottom Action Bar:** A persistent 80px high bar at the bottom of the screen contains the primary "Total" and "Pay" triggers, pinned for immediate access.

## Elevation & Depth

This design system uses **Tonal Layers** rather than heavy shadows to maintain a clean, modern look that doesn't feel dated.

- **Level 0 (Base):** The main application background.
- **Level 1 (Cards):** Subtle 1px borders (`#E2E8F0`) with no shadow. These house individual products in the grid.
- **Level 2 (Modals/Overlays):** Smooth, diffused shadows (0px 10px 15px -3px rgba(0, 0, 0, 0.1)) to lift payment processing screens or customer search dialogs above the main workspace.
- **Active State:** When a product is selected, it gains a 2px inner stroke of the Primary color instead of an elevation change, maintaining a flat but clear interactive state.

## Shapes

The shape language uses **Rounded** (0.5rem) corners to balance the professional nature of the system with a modern, approachable feel. 

- **Primary Buttons:** Utilize the standard 0.5rem radius.
- **Product Cards:** Use the `rounded-lg` (1rem) token to create a friendly, tappable appearance that distinguishes them from smaller utility buttons.
- **Search Bars:** Use the `rounded-xl` (1.5rem) or "Pill" shape to clearly identify them as global navigation/input elements.

## Components

### Buttons
- **Primary:** Solid Indigo background with White text. Used for "Pay" and "Confirm."
- **Secondary:** Ghost style (Light Blue tint background) with Indigo text. Used for "Add Discount" or "Edit Item."
- **Numpad:** Large, square tiles with centered `headline-md` typography.

### Product Cards
- Cards must feature a top-aligned image or a high-contrast category color bar.
- Product name is limited to two lines; price is pinned to the bottom-right for consistent scanning.

### Cart Items
- List-based rows with a minimum height of 64px. 
- Swiping left on a row reveals a red "Delete" action; swiping right reveals a "Quantity Toggle."

### Persistent Bottom Bar
- Always visible.
- Left side: Item count and Subtotal.
- Right side: Large "CHECKOUT" button occupying 40% of the bar width.

### Input Fields
- Underlined or softly outlined containers with clear floating labels. 
- In-field clear buttons (X) are mandatory for all search and numeric inputs to facilitate quick corrections.